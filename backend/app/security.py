import base64, hashlib, secrets, time
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet
from .config import get_settings
_ph = PasswordHasher()  # Argon2id
def hash_password(p): return _ph.hash(p)
def verify_password(h, p):
    try: return _ph.verify(h, p)
    except VerifyMismatchError: return False
def _key():
    k = get_settings().secret_key
    if len(k) < 32: raise RuntimeError("SECRET_KEY must be at least 32 characters")
    return k
def make_access(user_id, role):
    exp = datetime.now(timezone.utc) + timedelta(minutes=get_settings().access_minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, _key(), algorithm="HS256")
def decode_access(t): return jwt.decode(t, _key(), algorithms=["HS256"])
def new_refresh():
    t = secrets.token_urlsafe(48); return t, hashlib.sha256(t.encode()).hexdigest()
def hash_refresh(t): return hashlib.sha256(t.encode()).hexdigest()
def _fernet(): return Fernet(base64.urlsafe_b64encode(hashlib.sha256(_key().encode()).digest()))
def encrypt(s): return _fernet().encrypt(s.encode()).decode()
def decrypt(s): return _fernet().decrypt(s.encode()).decode()
_hits: dict = {}
def rate_limited(key, limit=10, window=60):
    n = time.time(); h = [t for t in _hits.get(key, []) if n - t < window]
    h.append(n); _hits[key] = h; return len(h) > limit
