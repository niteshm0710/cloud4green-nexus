import os, tempfile
os.environ.update(DATABASE_URL=f"sqlite:///{tempfile.mkdtemp()}/t.db", SECRET_KEY="x" * 40, VMWARE_ENABLED="false",
                  ADMIN_EMAIL="admin@nexus-test.com", ADMIN_PASSWORD="Adm1n-Test-Passw0rd!")
import pytest
from fastapi.testclient import TestClient
from app.main import app
@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c: yield c
def tok(c, e, p):
    r = c.post("/api/v1/auth/login", json={"email": e, "password": p}); assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}
@pytest.fixture(scope="session")
def admin(client): return tok(client, "admin@nexus-test.com", "Adm1n-Test-Passw0rd!")
