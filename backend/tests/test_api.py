from conftest import tok
from app.db import SessionLocal
from app import models as m, main as app_main

def test_login_fail(client): assert client.post("/api/v1/auth/login", json={"email": "admin@nexus-test.com", "password": "nope"}).status_code == 401
def test_requires_auth(client):
    assert client.get("/api/v1/vms").status_code == 401 and client.get("/api/v1/admin/users").status_code == 401
def test_full_flow(client, admin, monkeypatch):
    r = client.post("/api/v1/admin/users", json={"email": "u1@nexus-test.com", "full_name": "U One", "password": "User-Test-Passw0rd!"}, headers=admin); assert r.status_code == 201
    uid = r.json()["id"]
    assert client.post("/api/v1/admin/users", json={"email": "u2@nexus-test.com", "full_name": "U Two", "password": "short"}, headers=admin).status_code == 422
    
    # Verify no fake demo VMs exist initially
    initial_vms = client.get("/api/v1/admin/vms", headers=admin).json()
    assert len(initial_vms) == 0

    # Insert test virtual machines
    with SessionLocal() as db:
        db.add(m.VirtualMachine(uuid="test-uuid-01", name="prod-vm-01", guest_os="Ubuntu 22.04", power_state="on", cpu=2, ram_mb=4096, storage_gb=50, ip_address="192.168.1.10", host="esxi-01", datastore="datastore1", source="vmware"))
        db.add(m.VirtualMachine(uuid="test-uuid-02", name="prod-vm-02", guest_os="Debian 12", power_state="off", cpu=4, ram_mb=8192, storage_gb=100, ip_address="192.168.1.11", host="esxi-01", datastore="datastore1", source="vmware"))
        db.commit()

    vms = client.get("/api/v1/admin/vms", headers=admin).json(); assert len(vms) == 2
    assert client.post("/api/v1/admin/assignments", json={"user_id": uid, "vm_ids": [vms[0]["id"]]}, headers=admin).status_code == 201
    u = tok(client, "u1@nexus-test.com", "User-Test-Passw0rd!")
    mine = client.get("/api/v1/vms", headers=u).json(); assert [v["id"] for v in mine] == [vms[0]["id"]]
    other = vms[1]["id"]  # IDOR checks: unassigned VM
    assert client.get(f"/api/v1/vms/{other}", headers=u).status_code == 404
    assert client.post(f"/api/v1/vms/{other}/power", json={"action": "start"}, headers=u).status_code == 404
    assert client.post(f"/api/v1/vms/{other}/console-ticket", headers=u).status_code == 404
    assert client.get("/api/v1/admin/users", headers=u).status_code == 403

    class MockProvider:
        def power(self, vm, action): return "off" if action == "stop" else "on"
        def console_ticket(self, vm): raise app_main.VMwareError("Real console not available in test")

    monkeypatch.setattr(app_main, "provider", lambda db: MockProvider())

    p = client.post(f"/api/v1/vms/{vms[0]['id']}/power", json={"action": "stop"}, headers=u); assert p.status_code == 200 and p.json()["power_state"] == "off"
    assert client.post(f"/api/v1/vms/{vms[0]['id']}/power", json={"action": "explode"}, headers=u).status_code == 422
    assert client.post(f"/api/v1/vms/{vms[0]['id']}/console-ticket", headers=u).status_code == 503
    a = client.get("/api/v1/admin/assignments", headers=admin).json()[0]
    assert client.delete(f"/api/v1/admin/assignments/{a['id']}", headers=admin).status_code == 200
    assert client.get("/api/v1/vms", headers=u).json() == []
    acts = [l["action"] for l in client.get("/api/v1/admin/audit-logs", headers=admin).json()]
    assert {"login", "user_create", "assign", "revoke", "power_stop"} <= set(acts)
def test_refresh_rotation(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@nexus-test.com", "password": "Adm1n-Test-Passw0rd!"}).json()
    n = client.post("/api/v1/auth/refresh", json={"refresh_token": r["refresh_token"]}); assert n.status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": r["refresh_token"]}).status_code == 401
def test_disabled_user_blocked(client, admin):
    uid = client.post("/api/v1/admin/users", json={"email": "u3@nexus-test.com", "full_name": "U3", "password": "User-Test-Passw0rd!"}, headers=admin).json()["id"]
    h = tok(client, "u3@nexus-test.com", "User-Test-Passw0rd!")
    client.delete(f"/api/v1/admin/users/{uid}", headers=admin); assert client.get("/api/v1/auth/me", headers=h).status_code == 401
def test_tickets_isolated(client, admin):
    h = tok(client, "u1@nexus-test.com", "User-Test-Passw0rd!")
    t = client.post("/api/v1/support/tickets", json={"subject": "Help", "body": "VM slow"}, headers=h).json()
    admin_msg = client.post(f"/api/v1/support/tickets/{t['id']}/messages", json={"body": "On it"}, headers=admin); assert admin_msg.status_code == 201
    assert len(client.get(f"/api/v1/support/tickets/{t['id']}", headers=h).json()["messages"]) == 2
