import os
from pathlib import Path
from dotenv import load_dotenv

_current = Path(__file__).resolve().parent
_backend_dir = _current.parent
_repo_root = _backend_dir.parent

for p in (_repo_root / ".env", _backend_dir / ".env", Path(".env"), Path("../.env")):
    if p.exists():
        load_dotenv(p, override=False)
        break

class Settings:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./nexus.db")
        self.secret_key = os.getenv("SECRET_KEY", "")
        self.admin_email = os.getenv("ADMIN_EMAIL", "")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "")
        self.access_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
        self.refresh_days = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
        self.cors = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:8080").split(",") if o]

    @property
    def vmware_enabled(self) -> bool:
        return os.getenv("VMWARE_ENABLED", "false").lower() == "true"

def get_settings():
    return Settings()

BRAND = {
    "company": "Cloud4green Technologies",
    "product": "Cloud4green Nexus",
    "tagline": "Your Infrastructure. One Platform.",
    "footer": "Powered by Cloud4green Technologies"
}
