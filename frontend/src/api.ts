export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "user" | string;
  is_active: boolean;
  created_at?: string | null;
  last_login?: string | null;
}

export interface VM {
  id: number;
  name: string;
  guest_os: string;
  power_state: "on" | "off" | string;
  cpu: number;
  ram_mb: number;
  storage_gb: number;
  ip_address: string;
  host: string;
  datastore: string;
  source?: string;
}

export interface Assignment {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  vm_id: number;
  vm_name: string;
  vm_power_state?: string;
  created_at?: string | null;
}

export interface AuditItem {
  id: number;
  user_id: number | null;
  user_email: string;
  user_name?: string;
  action: string;
  detail: string;
  ip: string;
  at: string;
}

export interface SupportTicketItem {
  id: number;
  user_id: number;
  user_email?: string;
  user_name?: string;
  subject: string;
  status: string;
  created_at?: string | null;
  messages?: { id: number; user_id: number; user_name: string; user_email: string; body: string; at: string }[];
}

export interface OverviewData {
  total_users: number;
  total_vms: number;
  running_vms: number;
  stopped_vms: number;
  total_assignments: number;
  open_tickets: number;
  vmware: {
    enabled: boolean;
    configured: boolean;
    host: string | null;
    status: string;
    last_sync: string | null;
  };
  recent_logs: { id: number; user_email: string; action: string; detail: string; at: string }[];
}

let access = "";
let refresh = "";

export const setTokens = (a: string, r: string) => {
  access = a;
  refresh = r;
};

export const clearTokens = () => {
  access = "";
  refresh = "";
};

export const getRefresh = () => refresh;
export const getAccess = () => access;

export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (access) {
    headers["Authorization"] = "Bearer " + access;
  }

  const res = await fetch("/api/v1" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    let msg = `Request failed (${res.status})`;

    if (typeof errorBody.detail === "string" && errorBody.detail.trim()) {
      msg = errorBody.detail;
    } else if (Array.isArray(errorBody.detail) && errorBody.detail.length > 0) {
      msg = errorBody.detail.map((d: any) => d.msg || (typeof d === "string" ? d : JSON.stringify(d))).join(", ");
    } else if (res.status === 401) {
      msg = "Authentication failed or session expired. Please sign in again.";
    } else if (res.status === 403) {
      msg = "Access denied: Administrator permissions required.";
    } else if (res.status === 404) {
      msg = "The requested resource was not found.";
    } else if (res.status === 502 || res.status === 503) {
      msg = "VMware host service is unavailable or unreachable.";
    } else if (res.status >= 500) {
      msg = "An unexpected server error occurred. Please contact support.";
    }

    throw new Error(msg);
  }

  return res.json();
}
