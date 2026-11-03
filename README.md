# Cloud4green Nexus

**Your Infrastructure. One Platform.** — Enterprise Virtual Infrastructure Management Portal developed for **Cloud4green Technologies**.

---

## Overview

Cloud4green Nexus is a production-grade web portal designed to monitor, manage, and interact with VMware vSphere and ESXi virtual machines. It provides authenticated self-service workstation access for developers and end users, alongside comprehensive administrative controls for infrastructure operations.

---

## Core Features

- **VMware vSphere / ESXi Integration**: Native pyVmomi integration connecting to vCenter or standalone ESXi hosts for inventory discovery, live status monitoring, and power management.
- **Interactive WebMKS HTML5 Browser Console**: Low-latency, in-browser VM console access featuring:
  - Dual-mode connection: Secure Backend WebSocket Tunnel Proxy (zero browser certificate rejections) or Direct ESXi WSS.
  - Interactive keyboard and mouse synchronization.
  - Dedicated **Ctrl+Alt+Del** shortcut, full-screen toggle, and display rescaling.
- **Role-Based Access Control (RBAC)**:
  - **Administrators**: Global VM inventory, host synchronization, power actions, user management, VM assignments, and audit logging.
  - **Standard Users**: Restricted exclusively to their assigned virtual machines with anti-IDOR protection.
- **Zero Dummy Data**: Clean, real-data-driven application architecture without synthetic, demo, or placeholder infrastructure records.
- **Support System**: Built-in ticketing system for user workstation and infrastructure requests.
- **Enterprise Security**:
  - Argon2id password hashing.
  - Short-lived JWT access tokens with rotating refresh sessions.
  - Fernet-encrypted vCenter credentials at rest.
  - Single-use, time-bounded WebMKS console tickets (never logged or persisted).

---

## Architecture & Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Console**: VMware WebMKS SDK Adapter

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **VMware Integration**: pyVmomi (vSphere SDK)
- **Database & ORM**: SQLAlchemy 2.0 with SQLite (dev) / PostgreSQL (production)
- **Authentication**: PyJWT + Argon2-cffi + Cryptography
- **WebSocket Gateway**: Asynchronous WebMKS binary/text tunnel proxy

---

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Access to a VMware vCenter Server or ESXi Host (optional for offline dev)

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your local settings:
```bash
cp .env.example .env
```

Generate a secure encryption key:
```bash
./scripts/gen-secret.sh
```

### 3. Local Development

#### Start Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Start Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3001` in your browser.

---

## Docker Deployment

To launch Nexus with a production PostgreSQL database:

```bash
docker compose up --build -d
```

- Portal: `http://localhost:3001/`
- API Documentation: `http://localhost:3001/api/docs`

---

## Documentation

- [VMware vSphere Integration Guide](docs/VMWARE.md)
- [WebMKS Browser Console Architecture & SDK Setup](docs/WEBMKS.md)

---

## Testing

Run the automated backend test suite:
```bash
cd backend && pytest
```

Build and validate the frontend production bundle:
```bash
cd frontend && npm run build
```

---

## License

Copyright © Cloud4green Technologies. All rights reserved.
VMware WebMKS SDK is subject to Broadcom / VMware licensing agreements.
