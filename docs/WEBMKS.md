# VMware WebMKS Console Architecture & Deployment Guide

## Overview

Cloud4green Nexus integrates the official VMware WebMKS (HTML5 Console SDK) to provide low-latency, interactive virtual machine console access directly in the web browser without requiring browser plugins, vSphere client installations, or external VNC/RDP viewers.

The console communicates directly with VMware ESXi host daemons (`hostd`) via secure WebSockets (`wss`), streaming the VM's framebuffer and forwarding interactive keyboard and mouse input.

---

## SDK Version & Broadcom Licensing

### Licensing Notice
The VMware WebMKS SDK is proprietary software owned by Broadcom Inc. (formerly VMware, Inc.). Its distribution and use are governed by the Broadcom Software License Agreement. Redistribution with third-party software outside an authorized vSphere / ESXi environment may require an active VMware/Broadcom entitlement.

### Supported SDK Version
- **Target Version**: **VMware WebMKS SDK 2.2.0 (Build 22342085)**
- **Compatibility**: VMware vSphere 7.0, 8.0, and VMware ESXi 7.x/8.x host daemon.
- **Dependencies**: jQuery 2.2.0, jQuery UI 1.12.1.

### Authorized Methods for Obtaining the SDK

#### Method A: Broadcom Developer Portal (Recommended for Enterprise Distribution)
1. Log in to the [Broadcom Support Portal](https://support.broadcom.com/).
2. Navigate to **VMware Cloud Infrastructure** > **Developer Tools & SDKs**.
3. Locate **VMware HTML Console SDK (WebMKS)** version 2.2.x or 2.1.x.
4. Download the SDK archive and extract `wmks.min.js`, `css/`, and dependencies.
5. Place the assets in `frontend/public/wmks/`.

#### Method B: Extraction from Licensed ESXi Host (Recommended for On-Premises Appliances)
When operating an on-premises Nexus deployment connected to a licensed ESXi host (e.g. `192.168.0.244`), the authorized WebMKS 2.2.0 library can be sourced directly from the ESXi Host Client:
- **jQuery**: `https://<esxi-host>/ui/bower_components/jquery/dist/jquery.min.js`
- **jQuery UI**: `https://<esxi-host>/ui/bower_components/jquery-ui/jquery-ui.min.js`
- **jQuery UI CSS**: `https://<esxi-host>/ui/bower_components/jquery-ui/themes/base/jquery-ui.min.css`
- **WebMKS Module**: Embedded within `https://<esxi-host>/ui/scripts/main.js` (starts at `define("WMKS"`)

---

## Asset Directory Layout

The frontend loads static SDK assets from `frontend/public/wmks/`:

```
frontend/public/wmks/
├── jquery.min.js         # jQuery v2.2.0
├── jquery-ui.min.js      # jQuery UI v1.12.1
├── jquery-ui.min.css     # jQuery UI Base Theme
├── wmks-all.css          # WebMKS canvas styling & layout
└── wmks.min.js           # Official WebMKS SDK 2.2.0 (UMD wrapper)
```

In `frontend/index.html`, these assets are loaded before the React application bundle:
```html
<link rel="stylesheet" href="/wmks/jquery-ui.min.css"/>
<link rel="stylesheet" href="/wmks/wmks-all.css"/>
<script src="/wmks/jquery.min.js"></script>
<script src="/wmks/jquery-ui.min.js"></script>
<script src="/wmks/wmks.min.js"></script>
```

---

## Connection Modes & Certificate Architecture

Connecting a web browser to an ESXi host's WebSocket interface presents a unique TLS challenge when ESXi hosts use default self-signed SSL certificates. Modern browsers (Chrome, Safari, Firefox) enforce strict certificate validation for WebSockets without presenting an interactive "Accept self-signed certificate" prompt.

Cloud4green Nexus solves this with a **Dual-Mode Connection Architecture**:

```
[ Browser Client ]
       │
       ├─ (Default: Tunnel Proxy) ──► [ FastAPI WebSocket Proxy ] ──► [ ESXi hostd:443 ]
       │                               (/api/v1/vms/{id}/console-ws)      (wss://.../ticket/...)
       │
       └─ (Optional: Direct Mode) ──────────────────────────────────► [ ESXi hostd:443 ]
                                                                          (wss://.../ticket/...)
```

### Mode 1: Secure Backend Tunnel Proxy (Default & Recommended)
- **Endpoint**: `/api/v1/vms/{vm_id}/console-ws?token=<session_token>`
- **Workflow**:
  1. The browser opens a standard WebSocket connection to the Nexus backend origin.
  2. The FastAPI backend authenticates the user JWT, enforces VM assignment (anti-IDOR), and checks that the VM is powered on.
  3. The backend acquires a single-use WebMKS ticket via pyVmomi.
  4. The backend opens an asynchronous WebSocket client connection to the target ESXi host (`wss://<host>:443/ticket/<ticket>`) using the system-configured TLS verification policy (`verify_tls`).
  5. Raw binary RFB/MKS frames are transparently relayed between client and host.
- **Benefits**:
  - Zero browser SSL certificate errors with self-signed ESXi hosts.
  - Internal ESXi management IP addresses and console tickets are never exposed to the client network.
  - Works even when client browsers cannot route directly to internal ESXi management networks.

### Mode 2: Direct Host WebSocket
- **Endpoint**: `wss://<esxi_host>:443/ticket/<ticket>`
- **Workflow**:
  1. The browser receives the ticket and host IP directly from `POST /api/v1/vms/{id}/console-ticket`.
  2. WebMKS connects directly to `wss://<esxi_host>:443/ticket/<ticket>`.
- **Certificate Handling**:
  If the ESXi host uses a self-signed certificate, the UI detects the connection failure and provides a one-click helper button:
  `[Accept Certificate for <host>]` which opens `https://<esxi_host>/` in a new tab so the operator can trust the host certificate.

---

## Security & Anti-IDOR Enforcement

1. **Strict VM Assignment (Anti-IDOR)**:
   - Users can only acquire tickets or open WebSockets for virtual machines assigned to their user account.
   - Non-assigned requests return HTTP 404 / WebSocket close code 4404.
   - Administrators have permission to open consoles for any discovered virtual machine.

2. **Power State Enforcement**:
   - VMware ESXi rejects WebMKS tickets for powered-off VMs (`vim.fault.InvalidPowerState`).
   - The backend validates that the VM is running (`power_state == "on"`) before issuing a ticket or establishing a proxy.
   - The UI disables the Connect button for powered-off machines with helpful tooltips.

3. **Credential & Ticket Privacy**:
   - Console tickets are single-use and valid for approximately 30–60 seconds.
   - Tickets and VMware credentials are never logged, never stored in `localStorage`, and never exposed in browser address bars.

---

## Interactive Console Features

- **Keyboard & Mouse Capture**: Seamless pointer synchronization with relative pad and touch support.
- **Ctrl+Alt+Delete (CAD)**: Direct button invoking `wmksInstance.sendCAD()` to unlock Windows VMs.
- **Resolution Rescaling**: Automatic dynamic resolution adjustment and manual "Fit Screen" rescaling.
- **Full-Screen Mode**: Native HTML5 full-screen toggle with ESC release.
- **State Indicators**: Visual badges for Connecting, Connected, Disconnected, and Error states.
