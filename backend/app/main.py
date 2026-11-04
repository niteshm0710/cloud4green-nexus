import logging, time, asyncio, ssl
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, Request, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from . import models as m, security as sec
from .config import get_settings, BRAND
from .db import Base, engine, get_db, SessionLocal
from .vmware import PyVmomiProvider, VMwareError

log = logging.getLogger("nexus")
app = FastAPI(
    title="Cloud4green Nexus API",
    description=BRAND["tagline"],
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)
S = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=S.cors,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

# ---------- Global Security & Error Handling Middleware ----------
@app.middleware("http")
async def sec_headers(req: Request, call_next):
    t = time.time()
    r = await call_next(req)
    r.headers.update({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store" if req.url.path.startswith("/api/v1") else "public"
    })
    log.info("%s %s %s %.0fms", req.method, req.url.path, r.status_code, (time.time() - t) * 1000)
    return r

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(req: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = [str(l) for l in err.get("loc", []) if l != "body"]
        field = " -> ".join(loc)
        msg = err.get("msg", "Invalid value")
        errors.append(f"{field}: {msg}" if field else msg)
    return JSONResponse(
        status_code=422,
        content={"detail": ", ".join(errors) or "Validation failed"}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(req: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"detail": detail}
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(req: Request, exc: Exception):
    log.exception("Unhandled server exception on %s %s: %s", req.method, req.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again or contact your administrator."}
    )

def audit(db, user, action, detail="", req: Request | None = None):
    db.add(m.AuditLog(
        user_id=user.id if user else None,
        action=action,
        detail=detail,
        ip=req.client.host if req and req.client else ""
    ))
    db.commit()

def password_ok(p):
    if len(p) < 12:
        raise HTTPException(422, "Password must be at least 12 characters")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for r in ("admin", "user"):
            if not db.scalar(select(m.Role).where(m.Role.name == r)):
                db.add(m.Role(name=r))
        db.commit()
        if S.admin_email and S.admin_password and not db.scalar(select(m.User).join(m.Role).where(m.Role.name == "admin")):
            password_ok(S.admin_password)
            db.add(m.User(
                email=S.admin_email.lower(),
                full_name="Administrator",
                password_hash=sec.hash_password(S.admin_password),
                role_id=db.scalar(select(m.Role.id).where(m.Role.name == "admin"))
            ))
            db.commit()

# ---------- Auth Dependencies ----------
def current_user(req: Request, db: Session = Depends(get_db)) -> m.User:
    a = req.headers.get("Authorization", "")
    if not a.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        p = sec.decode_access(a[7:])
    except Exception:
        raise HTTPException(401, "Invalid or expired session token")
    u = db.get(m.User, int(p["sub"]))
    if not u or not u.is_active:
        raise HTTPException(401, "Account disabled or not found")
    return u

def admin_user(u: m.User = Depends(current_user)):
    if u.role.name != "admin":
        raise HTTPException(403, "Administrator access required")
    return u

def provider(db):
    if not S.vmware_enabled:
        raise HTTPException(503, "VMware integration is disabled in system configuration (VMWARE_ENABLED=false)")
    c = db.scalar(select(m.VmwareConnection).order_by(m.VmwareConnection.id.desc()))
    if not c:
        raise HTTPException(409, "VMware connection is not configured yet. Configure connection in Admin -> VMware Infrastructure.")
    return PyVmomiProvider(c.host, c.username, sec.decrypt(c.password_enc), c.verify_tls)

def vm_out(v):
    return {
        k: getattr(v, k) for k in (
            "id", "name", "guest_os", "power_state", "cpu", "ram_mb",
            "storage_gb", "ip_address", "host", "datastore", "source"
        )
    }

def to_utc_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def user_out(u, db: Session | None = None):
    last_login = None
    if db:
        ll = db.scalar(
            select(m.AuditLog.created_at)
            .where(m.AuditLog.user_id == u.id, m.AuditLog.action == "login")
            .order_by(m.AuditLog.id.desc())
            .limit(1)
        )
        if ll:
            last_login = to_utc_iso(ll)
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.name,
        "is_active": u.is_active,
        "created_at": to_utc_iso(u.created_at),
        "last_login": last_login
    }

def assigned_vm(db, user, vm_id):
    """The path to a VM for non-admin endpoints (anti-IDOR), with admin access support."""
    if getattr(user, "role", None) and user.role.name == "admin":
        v = db.get(m.VirtualMachine, vm_id)
    else:
        v = db.scalar(
            select(m.VirtualMachine)
            .join(m.VmAssignment, m.VmAssignment.vm_id == m.VirtualMachine.id)
            .where(m.VmAssignment.user_id == user.id, m.VirtualMachine.id == vm_id)
        )
    if not v:
        raise HTTPException(404, "Virtual machine not found or not assigned to your account")
    return v

# ---------- Schemas ----------
class Login(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str

    @property
    def identifier(self) -> str:
        return (self.email or self.username or "").strip()

    @model_validator(mode="after")
    def check_identifier(self):
        if not self.identifier:
            raise ValueError("Email or username is required")
        return self

class Refresh(BaseModel):
    refresh_token: str

class UserIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str
    role: str = "user"

class UserUpd(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None

class Power(BaseModel):
    action: str = Field(pattern="^(start|stop|restart)$")

class AssignIn(BaseModel):
    user_id: int
    vm_ids: list[int] = Field(min_length=1)

class VmwareIn(BaseModel):
    host: str
    username: str
    password: str
    verify_tls: bool = True

class TicketIn(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)

class MsgIn(BaseModel):
    body: str = Field(min_length=1)

# ---------- Core App Routers ----------
api = APIRouter(prefix="/api/v1")

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "vmware_enabled": S.vmware_enabled,
        "brand": BRAND
    }

def issue(db, u):
    rt, h = sec.new_refresh()
    db.add(m.UserSession(
        user_id=u.id,
        refresh_hash=h,
        expires_at=datetime.now(timezone.utc) + timedelta(days=S.refresh_days)
    ))
    db.commit()
    return {
        "access_token": sec.make_access(u.id, u.role.name),
        "refresh_token": rt,
        "token_type": "bearer",
        "user": user_out(u, db)
    }

@api.post("/auth/login")
def login(b: Login, req: Request, db: Session = Depends(get_db)):
    if sec.rate_limited("login:" + (req.client.host if req.client else "?")):
        raise HTTPException(429, "Too many login attempts. Please wait 60 seconds.")
    ident = b.identifier
    ident_lower = ident.lower()

    candidates = db.scalars(
        select(m.User).where(
            or_(
                func.lower(m.User.email) == ident_lower,
                func.lower(m.User.full_name) == ident_lower,
                func.lower(m.User.email).startswith(f"{ident_lower}@"),
            )
        )
    ).all()

    u = next((c for c in candidates if c.email.lower() == ident_lower), None)
    if not u or not sec.verify_password(u.password_hash, b.password):
        matched = next((c for c in candidates if c.is_active and sec.verify_password(c.password_hash, b.password)), None)
        if matched:
            u = matched

    if not u or not u.is_active or not sec.verify_password(u.password_hash, b.password):
        audit(db, u, "login_failed", ident, req)
        raise HTTPException(401, "Invalid email, username, or password.")
    audit(db, u, "login", "", req)
    return issue(db, u)

@api.post("/auth/refresh")
def refresh(b: Refresh, db: Session = Depends(get_db)):
    s = db.scalar(select(m.UserSession).where(m.UserSession.refresh_hash == sec.hash_refresh(b.refresh_token)))
    if not s or s.revoked or s.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(401, "Invalid or expired session token. Please sign in again.")
    s.revoked = True
    u = db.get(m.User, s.user_id)
    if not u or not u.is_active:
        raise HTTPException(401, "Account disabled or not found")
    return issue(db, u)

@api.post("/auth/logout")
def logout(b: Refresh, u=Depends(current_user), db: Session = Depends(get_db)):
    s = db.scalar(select(m.UserSession).where(m.UserSession.refresh_hash == sec.hash_refresh(b.refresh_token), m.UserSession.user_id == u.id))
    if s:
        s.revoked = True
    audit(db, u, "logout")
    return {"ok": True}

@api.get("/auth/me")
def me(u=Depends(current_user), db: Session = Depends(get_db)):
    return user_out(u, db)

@api.get("/users/me")
def users_me(u=Depends(current_user), db: Session = Depends(get_db)):
    return user_out(u, db)

# ---------- User VM Endpoints ----------
@api.get("/vms")
def my_vms(u=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.VirtualMachine)
        .join(m.VmAssignment, m.VmAssignment.vm_id == m.VirtualMachine.id)
        .where(m.VmAssignment.user_id == u.id)
        .order_by(m.VirtualMachine.name)
    )
    return [vm_out(v) for v in rows]

@api.get("/vms/{vm_id}")
def vm_get(vm_id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    v = assigned_vm(db, u, vm_id)
    acts = db.scalars(
        select(m.AuditLog)
        .where(m.AuditLog.detail.like(f"vm={v.id} %"))
        .order_by(m.AuditLog.id.desc())
        .limit(10)
    )
    return vm_out(v) | {
        "recent_activity": [{"action": a.action, "at": to_utc_iso(a.created_at)} for a in acts]
    }

@api.post("/vms/{vm_id}/power")
def vm_power(vm_id: int, b: Power, req: Request, u=Depends(current_user), db: Session = Depends(get_db)):
    v = assigned_vm(db, u, vm_id)
    try:
        v.power_state = provider(db).power(v, b.action)
    except VMwareError as e:
        raise HTTPException(502, str(e))
    audit(db, u, "power_" + b.action, f"vm={v.id}", req)
    return vm_out(v)

@api.post("/vms/{vm_id}/console-ticket")
def console_ticket(vm_id: int, req: Request, u=Depends(current_user), db: Session = Depends(get_db)):
    v = assigned_vm(db, u, vm_id)
    try:
        if v.power_state != "on":
            raise VMwareError(f"Cannot acquire console ticket: VM '{v.name}' is currently powered off. Please power it on first.")
        t = provider(db).console_ticket(v)
    except VMwareError as e:
        raise HTTPException(503, str(e))
    audit(db, u, "console_access", f"vm={v.id}", req)
    t["ws_proxy_path"] = f"/api/v1/vms/{v.id}/console-ws"
    return t

@api.websocket("/vms/{vm_id}/console-ws")
async def console_ws(websocket: WebSocket, vm_id: int, token: str | None = None):
    # 1. Resolve auth token
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Authentication token required")
        return

    db = SessionLocal()
    try:
        payload = sec.decode_access(token)
        user_id = int(payload.get("sub", 0))
        user = db.get(m.User, user_id)
        if not user or not user.is_active:
            await websocket.close(code=4401, reason="Invalid or inactive user session")
            return

        if user.role.name == "admin":
            v = db.get(m.VirtualMachine, vm_id)
        else:
            v = db.scalar(
                select(m.VirtualMachine)
                .join(m.VmAssignment, m.VmAssignment.vm_id == m.VirtualMachine.id)
                .where(m.VmAssignment.user_id == user.id, m.VirtualMachine.id == vm_id)
            )
        if not v:
            await websocket.close(code=4404, reason="VM not assigned to your account")
            return

        if v.power_state != "on":
            await websocket.close(code=4400, reason="VM is powered off. Power on VM first.")
            return

        p = provider(db)
        t = p.console_ticket(v)
    except Exception as e:
        await websocket.close(code=4500, reason=f"Console initialization failed: {str(e)[:100]}")
        return
    finally:
        db.close()

    remote_url = t["url"]
    ssl_ctx = ssl.create_default_context() if p.verify else ssl._create_unverified_context()

    client_subprotocols = websocket.scope.get("subprotocols", [])
    selected_subprotocol = "binary" if "binary" in client_subprotocols else (client_subprotocols[0] if client_subprotocols else None)

    await websocket.accept(subprotocol=selected_subprotocol)

    try:
        import websockets
        async with websockets.connect(
            remote_url,
            ssl=ssl_ctx,
            subprotocols=["binary", "uint8utf8"],
            max_size=10 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=20,
        ) as remote_ws:
            async def forward_client_to_remote():
                try:
                    while True:
                        data = await websocket.receive()
                        if "bytes" in data and data["bytes"]:
                            await remote_ws.send(data["bytes"])
                        elif "text" in data and data["text"]:
                            await remote_ws.send(data["text"])
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except Exception:
                    pass

            async def forward_remote_to_client():
                try:
                    async for msg in remote_ws:
                        if isinstance(msg, bytes):
                            await websocket.send_bytes(msg)
                        else:
                            await websocket.send_text(msg)
                except (WebSocketDisconnect, asyncio.CancelledError):
                    pass
                except Exception:
                    pass

            task1 = asyncio.create_task(forward_client_to_remote())
            task2 = asyncio.create_task(forward_remote_to_client())

            done, pending = await asyncio.wait(
                [task1, task2],
                return_when=asyncio.FIRST_COMPLETED
            )
            for p_task in pending:
                p_task.cancel()
    except Exception as e:
        log.warning(f"Console proxy error for vm={vm_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Remote ESXi connection error")
        except Exception:
            pass

# ---------- Admin Endpoints ----------
adm = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(admin_user)])

def role_id(db, name):
    r = db.scalar(select(m.Role).where(m.Role.name == name))
    if not r:
        raise HTTPException(422, "Unknown role")
    return r.id

@adm.get("/overview")
def a_overview(db: Session = Depends(get_db)):
    total_users = db.scalar(select(func.count(m.User.id))) or 0
    total_vms = db.scalar(select(func.count(m.VirtualMachine.id))) or 0
    running_vms = db.scalar(select(func.count(m.VirtualMachine.id)).where(m.VirtualMachine.power_state == "on")) or 0
    total_asg = db.scalar(select(func.count(m.VmAssignment.id))) or 0
    open_tickets = db.scalar(select(func.count(m.SupportTicket.id)).where(m.SupportTicket.status == "open")) or 0
    c = db.scalar(select(m.VmwareConnection).order_by(m.VmwareConnection.id.desc()))

    recent_logs = []
    for l in db.scalars(select(m.AuditLog).order_by(m.AuditLog.id.desc()).limit(8)):
        u = db.get(m.User, l.user_id) if l.user_id else None
        recent_logs.append({
            "id": l.id,
            "user_email": u.email if u else ("System" if not l.user_id else f"User #{l.user_id}"),
            "action": l.action,
            "detail": l.detail,
            "at": to_utc_iso(l.created_at)
        })

    return {
        "total_users": total_users,
        "total_vms": total_vms,
        "running_vms": running_vms,
        "stopped_vms": max(0, total_vms - running_vms),
        "total_assignments": total_asg,
        "open_tickets": open_tickets,
        "vmware": {
            "enabled": S.vmware_enabled,
            "configured": bool(c),
            "host": c.host if c else None,
            "status": c.status if c else "not configured",
            "last_sync": to_utc_iso(c.last_sync) if c else None
        },
        "recent_logs": recent_logs
    }

@adm.get("/users")
def a_users(db: Session = Depends(get_db)):
    return [user_out(u, db) for u in db.scalars(select(m.User).order_by(m.User.id))]

@adm.post("/users", status_code=201)
def a_user_new(b: UserIn, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    password_ok(b.password)
    if db.scalar(select(m.User).where(m.User.email == b.email.lower())):
        raise HTTPException(409, "A user account with this email address already exists.")
    u = m.User(
        email=b.email.lower(),
        full_name=b.full_name,
        password_hash=sec.hash_password(b.password),
        role_id=role_id(db, b.role)
    )
    db.add(u)
    db.commit()
    audit(db, a, "user_create", u.email, req)
    return user_out(u)

@adm.put("/users/{uid}")
def a_user_upd(uid: int, b: UserUpd, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == a.id and b.is_active is False:
        raise HTTPException(400, "Cannot disable your own administrator account")
    if b.full_name:
        u.full_name = b.full_name
    if b.role:
        u.role_id = role_id(db, b.role)
    if b.is_active is not None:
        u.is_active = b.is_active
    if b.password:
        password_ok(b.password)
        u.password_hash = sec.hash_password(b.password)
    db.commit()
    audit(db, a, "user_update", u.email, req)
    return user_out(db.get(m.User, uid))

@adm.delete("/users/{uid}")
def a_user_del(uid: int, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == a.id:
        raise HTTPException(400, "Cannot disable your own administrator account")
    u.is_active = False
    db.commit()
    audit(db, a, "user_disable", u.email, req)
    return {"ok": True, "message": f"User {u.email} disabled successfully."}

@adm.get("/vms")
def a_vms(name: str | None = None, power_state: str | None = None, db: Session = Depends(get_db)):
    q = select(m.VirtualMachine).order_by(m.VirtualMachine.name)
    if name:
        q = q.where(m.VirtualMachine.name.ilike(f"%{name}%"))
    if power_state:
        q = q.where(m.VirtualMachine.power_state == power_state)
    return [vm_out(v) for v in db.scalars(q)]

def do_sync(db, a, req):
    p = provider(db)
    n = 0
    try:
        infos = p.list_vms()
    except VMwareError as e:
        raise HTTPException(502, str(e))
    for i in infos:
        v = db.scalar(select(m.VirtualMachine).where(m.VirtualMachine.uuid == i.uuid)) or m.VirtualMachine(uuid=i.uuid, source="vmware")
        v.name = i.name
        v.guest_os = i.guest_os
        v.power_state = i.power_state
        v.cpu = i.cpu
        v.ram_mb = i.ram_mb
        v.storage_gb = i.storage_gb
        v.ip_address = i.ip_address
        v.host = i.host
        v.datastore = i.datastore
        db.add(v)
        n += 1
    c = db.scalar(select(m.VmwareConnection).order_by(m.VmwareConnection.id.desc()))
    if c:
        c.last_sync = m.now()
    db.commit()
    audit(db, a, "vm_sync", f"{n} VMs synchronized from VMware", req)
    return {
        "synced": n,
        "mode": "vmware",
        "message": f"Successfully synchronized {n} virtual machine(s) from VMware."
    }

@adm.post("/vms/sync")
def a_sync(req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    return do_sync(db, a, req)

@adm.post("/vms/{vm_id}/power")
def a_vm_power(vm_id: int, b: Power, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    v = db.get(m.VirtualMachine, vm_id)
    if not v:
        raise HTTPException(404, "Virtual machine not found")
    try:
        v.power_state = provider(db).power(v, b.action)
    except VMwareError as e:
        raise HTTPException(502, str(e))
    audit(db, a, "admin_power_" + b.action, f"vm={v.id}", req)
    return vm_out(v)

@adm.get("/assignments")
def a_assign_list(db: Session = Depends(get_db)):
    out = []
    for x in db.scalars(select(m.VmAssignment)):
        u = db.get(m.User, x.user_id)
        v = db.get(m.VirtualMachine, x.vm_id)
        out.append({
            "id": x.id,
            "user_id": x.user_id,
            "user_email": u.email if u else "Unknown User",
            "user_name": u.full_name if u else "Unknown User",
            "vm_id": x.vm_id,
            "vm_name": v.name if v else f"VM #{x.vm_id}",
            "vm_power_state": v.power_state if v else "unknown",
            "created_at": to_utc_iso(x.created_at)
        })
    return out

@adm.post("/assignments", status_code=201)
def a_assign(b: AssignIn, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    target_user = db.get(m.User, b.user_id)
    if not target_user:
        raise HTTPException(404, "Target user not found")
    made = []
    for vid in set(b.vm_ids):
        vm_obj = db.get(m.VirtualMachine, vid)
        if not vm_obj:
            raise HTTPException(404, f"Virtual Machine #{vid} not found")
        if not db.scalar(select(m.VmAssignment).where(m.VmAssignment.user_id == b.user_id, m.VmAssignment.vm_id == vid)):
            x = m.VmAssignment(user_id=b.user_id, vm_id=vid, assigned_by=a.id)
            db.add(x)
            made.append(x)
    db.commit()
    audit(db, a, "assign", f"user={b.user_id} vms={sorted(set(b.vm_ids))}", req)
    return {
        "created": len(made),
        "message": f"Successfully assigned {len(made)} virtual machine(s) to {target_user.full_name}."
    }

@adm.delete("/assignments/{aid}")
def a_revoke(aid: int, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    x = db.get(m.VmAssignment, aid)
    if not x:
        raise HTTPException(404, "Assignment not found")
    db.delete(x)
    db.commit()
    audit(db, a, "revoke", f"user={x.user_id} vm={x.vm_id}", req)
    return {"ok": True, "message": "Assignment revoked successfully."}

@adm.get("/audit-logs")
def a_audit(limit: int = 200, db: Session = Depends(get_db)):
    out = []
    for l in db.scalars(select(m.AuditLog).order_by(m.AuditLog.id.desc()).limit(min(limit, 1000))):
        u = db.get(m.User, l.user_id) if l.user_id else None
        out.append({
            "id": l.id,
            "user_id": l.user_id,
            "user_email": u.email if u else ("System" if not l.user_id else f"User #{l.user_id}"),
            "user_name": u.full_name if u else ("System" if not l.user_id else "User"),
            "action": l.action,
            "detail": l.detail,
            "ip": l.ip,
            "at": to_utc_iso(l.created_at)
        })
    return out

@adm.post("/vmware/test-connection")
def a_vm_test(b: VmwareIn, req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    if not S.vmware_enabled:
        raise HTTPException(503, "VMware integration is disabled in system configuration (VMWARE_ENABLED=false).")
    try:
        ver = PyVmomiProvider(b.host, b.username, b.password, b.verify_tls).test()
    except VMwareError as e:
        raise HTTPException(502, str(e))
    c = m.VmwareConnection(
        host=b.host,
        username=b.username,
        password_enc=sec.encrypt(b.password),
        verify_tls=b.verify_tls,
        status="connected"
    )
    db.add(c)
    db.commit()
    audit(db, a, "vmware_configure", b.host, req)
    return {
        "ok": True,
        "detail": ver,
        "message": f"Successfully connected to VMware host: {ver}"
    }

@adm.post("/vmware/sync")
def a_vm_sync(req: Request, a=Depends(admin_user), db: Session = Depends(get_db)):
    return do_sync(db, a, req)

@adm.get("/vmware/status")
def a_vm_status(db: Session = Depends(get_db)):
    c = db.scalar(select(m.VmwareConnection).order_by(m.VmwareConnection.id.desc()))
    return {
        "vmware_enabled": S.vmware_enabled,
        "configured": bool(c),
        "host": c.host if c else None,
        "status": c.status if c else "not configured",
        "last_sync": to_utc_iso(c.last_sync) if c else None
    }

@adm.get("/support/tickets")
def a_tickets(db: Session = Depends(get_db)):
    out = []
    for t in db.scalars(select(m.SupportTicket).order_by(m.SupportTicket.id.desc())):
        u = db.get(m.User, t.user_id)
        out.append({
            "id": t.id,
            "user_id": t.user_id,
            "user_email": u.email if u else "Unknown",
            "user_name": u.full_name if u else "Unknown",
            "subject": t.subject,
            "status": t.status,
            "created_at": to_utc_iso(t.created_at)
        })
    return out

# ---------- Support Endpoints ----------
sup = APIRouter(prefix="/api/v1/support")

def ticket_for(db, u, tid):
    t = db.get(m.SupportTicket, tid)
    if not t or (t.user_id != u.id and u.role.name != "admin"):
        raise HTTPException(404, "Support ticket not found")
    return t

@sup.get("/tickets")
def s_list(u=Depends(current_user), db: Session = Depends(get_db)):
    q = select(m.SupportTicket).order_by(m.SupportTicket.id.desc())
    if u.role.name != "admin":
        q = q.where(m.SupportTicket.user_id == u.id)
    out = []
    for t in db.scalars(q):
        owner = db.get(m.User, t.user_id)
        out.append({
            "id": t.id,
            "user_id": t.user_id,
            "user_email": owner.email if owner else "Unknown",
            "user_name": owner.full_name if owner else "Unknown",
            "subject": t.subject,
            "status": t.status,
            "created_at": to_utc_iso(t.created_at)
        })
    return out

@sup.post("/tickets", status_code=201)
def s_new(b: TicketIn, req: Request, u=Depends(current_user), db: Session = Depends(get_db)):
    t = m.SupportTicket(user_id=u.id, subject=b.subject)
    db.add(t)
    db.flush()
    db.add(m.SupportTicketMessage(ticket_id=t.id, user_id=u.id, body=b.body))
    db.commit()
    audit(db, u, "ticket_create", f"ticket={t.id}", req)
    return {
        "id": t.id,
        "subject": t.subject,
        "status": t.status,
        "message": "Support request submitted successfully."
    }

@sup.get("/tickets/{tid}")
def s_get(tid: int, u=Depends(current_user), db: Session = Depends(get_db)):
    t = ticket_for(db, u, tid)
    ms = db.scalars(
        select(m.SupportTicketMessage)
        .where(m.SupportTicketMessage.ticket_id == tid)
        .order_by(m.SupportTicketMessage.id)
    )
    owner = db.get(m.User, t.user_id)
    messages = []
    for x in ms:
        sender = db.get(m.User, x.user_id)
        messages.append({
            "id": x.id,
            "user_id": x.user_id,
            "user_email": sender.email if sender else "Unknown",
            "user_name": sender.full_name if sender else "User",
            "body": x.body,
            "at": to_utc_iso(x.created_at)
        })
    return {
        "id": t.id,
        "subject": t.subject,
        "status": t.status,
        "user_email": owner.email if owner else "Unknown",
        "created_at": to_utc_iso(t.created_at),
        "messages": messages
    }

@sup.post("/tickets/{tid}/messages", status_code=201)
def s_msg(tid: int, b: MsgIn, u=Depends(current_user), db: Session = Depends(get_db)):
    t = ticket_for(db, u, tid)
    db.add(m.SupportTicketMessage(ticket_id=tid, user_id=u.id, body=b.body))
    t.status = "answered" if u.role.name == "admin" else "open"
    db.commit()
    return {"ok": True, "message": "Message sent."}

for r in (api, adm, sup):
    app.include_router(r)
