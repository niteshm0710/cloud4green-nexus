import { useEffect, useState, useMemo, useRef, ReactNode } from "react";
import {
  Server,
  LifeBuoy,
  User as UserIcon,
  LogOut,
  Play,
  Square,
  RotateCw,
  MonitorPlay,
  Users,
  Link2,
  Cloud,
  ScrollText,
  LayoutDashboard,
  Eye,
  EyeOff,
  X,
  ArrowRight,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Plus,
  Search,
  ExternalLink,
  Shield,
  HardDrive,
  Cpu,
  Layers,
  Activity,
  Check,
  Maximize2,
  Minimize2,
  Keyboard,
  Cast,
} from "lucide-react";
import {
  api,
  setTokens,
  clearTokens,
  getRefresh,
  getAccess,
  User,
  VM,
  Assignment,
  AuditItem,
  SupportTicketItem,
  OverviewData,
} from "./api";
import { sdkAvailable, openConsole, Ticket, ConsoleSession } from "./console";

const NAME = "Cloud4green Nexus";
const TAG = "Your Infrastructure. One Platform.";
const FOOT = "Powered by Cloud4green Technologies";

// ---------- Formatters & Helpers ----------
function parseUtcDate(iso?: string | null): Date | null {
  if (!iso) return null;
  let s = iso.trim();
  // Ensure naive UTC timestamps (without offset or Z) are parsed as UTC rather than local time
  if (!s.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = parseUtcDate(iso);
    if (!d) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string | null, includeTz: boolean = true): string {
  if (!iso) return "—";
  try {
    const d = parseUtcDate(iso);
    if (!d) return iso;
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    if (includeTz) {
      options.timeZoneName = "short";
    }
    return new Intl.DateTimeFormat(undefined, options).format(d);
  } catch {
    return iso;
  }
}

// ---------- OS Visual Identity & Detection ----------
function WindowsIcon({ className = "w-4 h-4" }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.802" />
    </svg>
  );
}

function UbuntuIcon({ className = "w-4 h-4" }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-7.05 9.176a1.59 1.59 0 1 1 0 3.178 1.59 1.59 0 0 1 0-3.178zm15.485 5.92a1.59 1.59 0 1 1 0-3.18 1.59 1.59 0 0 1 0 3.18zm-4.735 4.887a1.59 1.59 0 1 1-3.178 0 1.59 1.59 0 0 1 3.178 0zM12 2.769c3.992 0 7.37 2.616 8.52 6.273a3.524 3.524 0 0 0-2.316 2.054A6.877 6.877 0 0 0 12 6.892c-3.18 0-5.876 2.16-6.67 5.108a3.535 3.535 0 0 0-2.327-2.07C4.167 6.002 7.695 2.769 12 2.769zm-6.67 8.338a3.54 3.54 0 0 0 2.327 2.07A6.877 6.877 0 0 0 12 17.108c2.42 0 4.54-1.246 5.76-3.14a3.524 3.524 0 0 0 2.316 2.054C18.92 19.384 15.69 21.23 12 21.23c-4.305 0-7.833-2.767-8.996-6.646.993-.82 1.626-2.05 1.626-3.477z" />
    </svg>
  );
}

function LinuxIcon({ className = "w-4 h-4" }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.002 2c-2.4 0-4.002 1.8-4.002 4.4 0 1.5.6 3.1 1.2 4.1-.3.5-.8 1.1-1.4 1.7-1.8 1.8-3.8 4.3-3.8 7.3 0 1.3.9 2.5 2.2 2.5 2.3 0 3.7-1.4 5.8-1.4 2.1 0 3.5 1.4 5.8 1.4 1.3 0 2.2-1.2 2.2-2.5 0-3-2-5.5-3.8-7.3-.6-.6-1.1-1.2-1.4-1.7.6-1 1.2-2.6 1.2-4.1 0-2.6-1.6-4.4-4-4.4zm-1.5 4.5a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zm3 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zm-2.2 2.2h1.4c.2 0 .4.2.3.4-.2.5-.5.9-.7.9s-.5-.4-.7-.9c-.1-.2.1-.4.3-.4z" />
    </svg>
  );
}

function AppleIcon({ className = "w-4 h-4" }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.92.04-2.02.62-2.67 1.38-.56.65-1.05 1.71-.92 2.74 1.03.08 2.06-.5 2.67-1.25" />
    </svg>
  );
}

interface OsMeta {
  type: "windows-server" | "windows" | "ubuntu" | "linux" | "macos" | "esxi" | "generic";
  label: string;
  badge: string;
  icon: (props: { className?: string; size?: number }) => JSX.Element;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  borderHover: string;
  accentBar: string;
}

function getOsMeta(guestOs?: string | null, name?: string | null): OsMeta {
  const g = (guestOs || "").toLowerCase();
  const n = (name || "").toLowerCase();
  const text = `${g} ${n}`;

  // 1. Windows Server
  if (
    (text.includes("windows") || text.includes("win")) &&
    (text.includes("server") ||
      text.includes("2012") ||
      text.includes("2016") ||
      text.includes("2019") ||
      text.includes("2022") ||
      text.includes("2025") ||
      text.includes("domain") ||
      text.includes("dc_") ||
      text.includes("jump"))
  ) {
    let year = "Server";
    if (text.includes("2025")) year = "Server 2025";
    else if (text.includes("2022")) year = "Server 2022";
    else if (text.includes("2019")) year = "Server 2019";
    else if (text.includes("2016")) year = "Server 2016";
    return {
      type: "windows-server",
      label: `Windows ${year}`,
      badge: "Win Server",
      icon: (props) => <WindowsIcon {...props} />,
      iconBg: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-700",
      badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
      borderHover: "hover:border-blue-300",
      accentBar: "from-blue-600 via-indigo-600 to-blue-500",
    };
  }

  // 2. Windows Client (Windows 10, Windows 11, etc.)
  if (text.includes("windows") || text.includes("win-") || text.includes("win10") || text.includes("win11")) {
    const is11 = text.includes("11");
    return {
      type: "windows",
      label: is11 ? "Windows 11" : "Windows",
      badge: is11 ? "Windows 11" : "Windows",
      icon: (props) => <WindowsIcon {...props} />,
      iconBg: "bg-sky-50 border-sky-200",
      iconColor: "text-sky-600",
      badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
      borderHover: "hover:border-sky-300",
      accentBar: "from-sky-500 via-blue-500 to-cyan-500",
    };
  }

  // 3. Ubuntu
  if (text.includes("ubuntu")) {
    return {
      type: "ubuntu",
      label: "Ubuntu Linux",
      badge: "Ubuntu",
      icon: (props) => <UbuntuIcon {...props} />,
      iconBg: "bg-orange-50 border-orange-200",
      iconColor: "text-orange-600",
      badgeBg: "bg-orange-50 text-orange-700 border-orange-200",
      borderHover: "hover:border-orange-300",
      accentBar: "from-orange-500 via-amber-500 to-red-500",
    };
  }

  // 4. macOS / Apple
  if (text.includes("mac") || text.includes("darwin") || text.includes("osx") || text.includes("apple")) {
    return {
      type: "macos",
      label: "macOS",
      badge: "macOS",
      icon: (props) => <AppleIcon {...props} />,
      iconBg: "bg-zinc-100 border-zinc-200",
      iconColor: "text-zinc-800",
      badgeBg: "bg-zinc-100 text-zinc-700 border-zinc-200",
      borderHover: "hover:border-zinc-400",
      accentBar: "from-zinc-500 via-slate-500 to-zinc-400",
    };
  }

  // 5. VMware ESXi / Hypervisor
  if (text.includes("esxi") || text.includes("vmware") || text.includes("hypervisor")) {
    return {
      type: "esxi",
      label: "VMware ESXi",
      badge: "ESXi",
      icon: (props) => <Layers className={props.className} size={props.size || 18} />,
      iconBg: "bg-purple-50 border-purple-200",
      iconColor: "text-purple-600",
      badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
      borderHover: "hover:border-purple-300",
      accentBar: "from-purple-600 via-indigo-500 to-purple-400",
    };
  }

  // 6. Other Linux distributions (Debian, Red Hat / RHEL, Kali, CentOS, Fedora, openSUSE)
  if (
    text.includes("linux") ||
    text.includes("debian") ||
    text.includes("red hat") ||
    text.includes("rhel") ||
    text.includes("kali") ||
    text.includes("centos") ||
    text.includes("fedora") ||
    text.includes("suse")
  ) {
    let dist = "Linux";
    if (text.includes("debian")) dist = "Debian";
    else if (text.includes("kali")) dist = "Kali Linux";
    else if (text.includes("red hat") || text.includes("rhel")) dist = "Red Hat";
    else if (text.includes("centos")) dist = "CentOS";
    return {
      type: "linux",
      label: dist,
      badge: dist,
      icon: (props) => <LinuxIcon {...props} />,
      iconBg: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-700",
      badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
      borderHover: "hover:border-amber-300",
      accentBar: "from-amber-500 via-yellow-500 to-orange-400",
    };
  }

  // 7. Unknown / Generic Fallback
  return {
    type: "generic",
    label: guestOs || "Virtual Machine",
    badge: "VM",
    icon: (props) => <Server className={props.className} size={props.size || 18} />,
    iconBg: "bg-green-50 border-green-200",
    iconColor: "text-green-700",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    borderHover: "hover:border-green-300",
    accentBar: "from-green-600 via-emerald-500 to-teal-500",
  };
}

function formatRam(mb: number): string {
  if (!mb || mb <= 0) return "0 MB";
  if (mb >= 1024) {
    const gb = mb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

// ---------- UI Components ----------
const Badge = ({ on }: { on: boolean }) => (
  <span
    className={
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold " +
      (on
        ? "bg-green-100 text-green-800 border border-green-200"
        : "bg-slate-100 text-slate-600 border border-slate-200")
    }
  >
    <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-green-600" : "bg-slate-400"}`} />
    {on ? "Running" : "Stopped"}
  </span>
);

const RoleBadge = ({ role }: { role: string }) => {
  const isAdmin = role.toLowerCase() === "admin";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (isAdmin
          ? "bg-purple-100 text-purple-800 border border-purple-200"
          : "bg-blue-100 text-blue-800 border border-blue-200")
      }
    >
      <Shield size={11} />
      {isAdmin ? "Administrator" : "Standard User"}
    </span>
  );
};

const StatusBadge = ({ active }: { active: boolean }) => (
  <span
    className={
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
      (active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")
    }
  >
    {active ? "Active" : "Disabled"}
  </span>
);

const AlertBanner = ({
  msg,
  type = "info",
  onDismiss,
}: {
  msg: string;
  type?: "success" | "error" | "info";
  onDismiss?: () => void;
}) => {
  if (!msg) return null;
  const isErr = type === "error";
  const isSucc = type === "success";

  return (
    <div
      role="alert"
      className={
        "mb-4 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm transition shadow-sm " +
        (isErr
          ? "border-red-200 bg-red-50 text-red-800"
          : isSucc
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-blue-200 bg-blue-50 text-blue-800")
      }
    >
      <div className="flex items-center gap-2.5">
        {isErr ? (
          <AlertCircle size={18} className="text-red-600 shrink-0" />
        ) : isSucc ? (
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
        ) : (
          <AlertTriangle size={18} className="text-blue-600 shrink-0" />
        )}
        <span className="font-medium">{msg}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
          aria-label="Dismiss message"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="card py-12 px-6 text-center bg-white border border-slate-200/80 shadow-sm rounded-xl">
    <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
      <Icon size={24} />
    </div>
    <h3 className="text-base font-semibold text-navy-900">{title}</h3>
    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ---------- 1. Login Component ----------
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!email.trim() || !pw) {
      setErr("Please enter your email or username and password.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await api("/auth/login", "POST", { email: email.trim(), username: email.trim(), password: pw });
      setTokens(r.access_token, r.refresh_token);
      onLogin(r.user);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-[#F4F5F7] overflow-x-hidden font-sans">
      {/* LEFT PANEL — 42% width on desktop */}
      <div className="hidden md:flex md:w-[40%] lg:w-[42%] bg-[#101B32] bg-gradient-to-br from-[#101B32] via-[#0E2038] to-[#0A2922] relative flex-col justify-between p-8 sm:p-10 lg:p-14 overflow-hidden border-r border-[#172B4D]/40">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#16A34A]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-[#172B4D]/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex-1 flex items-center justify-center my-auto min-h-[300px] lg:min-h-[420px]">
          <div className="relative w-full max-w-[460px]">
            <img
              src="/assets/infrastructure-illustration.png"
              alt="Cloud4green Virtual Infrastructure"
              className="w-full h-auto object-contain rounded-2xl shadow-2xl drop-shadow-[0_20px_35px_rgba(0,0,0,0.5)]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#101B32]/70 via-transparent to-transparent pointer-events-none rounded-2xl" />
          </div>
        </div>

        <div className="relative z-20 mt-auto pt-6 text-left">
          <span className="text-[11px] font-bold tracking-widest text-[#22C55E] uppercase mb-2 inline-block">
            SECURE ACCESS
          </span>
          <h2 className="text-xl sm:text-2xl lg:text-[28px] font-bold text-white leading-snug mb-3 tracking-tight">
            Quiet, capable access to your team's virtual machines.
          </h2>
          <p className="text-sm text-[#8993A5] leading-relaxed max-w-md">
            Sign in to launch your assigned workstations or, if you're an admin, manage users and VM assignments across your workspace.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — 58% width on desktop */}
      <div className="flex-1 md:w-[60%] lg:w-[58%] flex flex-col justify-between bg-[#F4F5F7] p-5 sm:p-8 lg:p-12 min-h-screen">
        <div className="md:hidden w-full bg-[#101B32] rounded-2xl p-6 mb-4 text-white text-center shadow-md">
          <img
            src="/assets/infrastructure-illustration.png"
            alt="Infrastructure Illustration"
            className="w-44 h-auto mx-auto mb-3 object-contain rounded-lg"
          />
          <span className="text-[10px] font-bold tracking-widest text-[#22C55E] uppercase block mb-1">
            SECURE ACCESS
          </span>
          <h3 className="text-sm font-bold text-white">Quiet, capable access to your virtual machines.</h3>
        </div>

        <div className="flex-1 flex items-center justify-center py-6">
          <div className="w-full max-w-[525px] rounded-[18px] bg-white p-7 sm:p-10 lg:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/70">
            <div className="text-left mb-6">
              <img
                src="/assets/cloud4green-logo.png"
                alt="Cloud4green Technologies"
                className="h-10 sm:h-11 w-auto max-w-[210px] object-contain"
              />
              <div className="text-[11px] font-bold tracking-wider text-[#8993A5] uppercase mt-2">
                CLOUD4GREEN NEXUS
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#172033] mb-6 tracking-tight text-left">
              Welcome back
            </h1>

            {err && (
              <div role="alert" className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 text-left">
                {err}
              </div>
            )}

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-semibold text-[#172033] mb-1.5">
                  Email or username <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg bg-[#E7F0FF] border border-[#d2e3fc] px-4 py-3 text-sm text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] transition"
                  type="text"
                  autoComplete="username"
                  placeholder="name@company.com or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && go()}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#172033] mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-lg bg-[#E7F0FF] border border-[#d2e3fc] px-4 py-3 pr-11 text-sm text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] transition"
                    type={show ? "text" : "password"}
                    placeholder="Enter your password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && go()}
                  />
                  <button
                    type="button"
                    aria-label="toggle password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#172033] transition p-1"
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <a
                  href="mailto:support@cloud4green.com"
                  className="text-xs font-medium text-[#16A34A] hover:underline transition"
                >
                  Forgot password? Contact your administrator.
                </a>
              </div>

              <button
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] active:bg-[#166534] text-white font-semibold py-3.5 px-4 text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
                disabled={busy}
                onClick={go}
              >
                <span>{busy ? "Signing in…" : "Sign in"}</span>
                {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="text-center pt-4 text-[#8993A5] text-xs">
          {FOOT}
        </div>
      </div>
    </div>
  );
}

// ---------- 2. Console View ----------
function ConsoleView({ vm, onClose }: { vm: VM; onClose: () => void }) {
  const [state, setState] = useState("connecting");
  const [err, setErr] = useState("");
  const [n, setN] = useState(0);
  const [useProxy, setUseProxy] = useState(true);
  const [ticketData, setTicketData] = useState<Ticket | null>(null);
  const [screenRes, setScreenRes] = useState<{ width: number; height: number } | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const sessionRef = useRef<ConsoleSession | null>(null);

  useEffect(() => {
    let dead = false;
    setState("connecting");
    setErr("");
    sessionRef.current?.destroy();
    sessionRef.current = null;

    (async () => {
      try {
        const t: Ticket = await api(`/vms/${vm.id}/console-ticket`, "POST");
        if (dead) return;
        setTicketData(t);

        const token = getAccess() || localStorage.getItem("token") || "";
        const session = openConsole(
          "wmks",
          t,
          {
            onState: (s) => {
              if (!dead) setState(s);
            },
            onError: (errType) => {
              if (dead) return;
              setState("error");
              if (errType === "websocketerror" && !useProxy) {
                setErr(`Direct connection to ESXi host (${t.host}) was blocked by browser security (self-signed SSL certificate). Accept host certificate below or switch to Secure Tunnel Proxy.`);
              } else if (errType === "authenticationfailed") {
                setErr("WebMKS console ticket expired or rejected by VMware host. Click Reconnect to acquire a new ticket.");
              } else {
                setErr(`WebMKS connection notice: ${errType}`);
              }
            },
            onScreenSizeChange: (sz) => {
              if (!dead) setScreenRes(sz);
            },
          },
          {
            useProxy: useProxy,
            token: token,
          }
        );
        sessionRef.current = session;
      } catch (e) {
        if (!dead) {
          setErr((e as Error).message);
          setState("error");
        }
      }
    })();

    return () => {
      dead = true;
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, [vm.id, n, useProxy]);

  const handleCAD = () => {
    sessionRef.current?.sendCAD();
  };

  const handleFullScreen = () => {
    if (isFullScreen) {
      sessionRef.current?.exitFullScreen();
      setIsFullScreen(false);
    } else {
      sessionRef.current?.enterFullScreen();
      setIsFullScreen(true);
    }
  };

  const handleRescale = () => {
    sessionRef.current?.rescale();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 border-b border-navy-800 px-5 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <MonitorPlay size={20} className="text-emerald-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide">{vm.name}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {vm.guest_os || "VMware VM"}
              </span>
            </div>
            {screenRes && (
              <div className="text-[10px] text-slate-400 font-mono">
                Resolution: {screenRes.width} × {screenRes.height}
              </div>
            )}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                state === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : state === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : state === "error"
                  ? "bg-red-400"
                  : "bg-slate-400"
              }`}
            />
            <span className="capitalize text-slate-200 text-xs">{state}</span>
          </div>

          {!sdkAvailable() && (
            <span className="text-xs text-amber-400 font-medium">· WebMKS SDK not loaded</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Connection Mode Toggle */}
          <button
            onClick={() => setUseProxy(!useProxy)}
            title="Toggle between Backend WebSocket Tunnel and Direct ESXi connection"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700 transition cursor-pointer"
          >
            <Cast size={13} className={useProxy ? "text-emerald-400" : "text-amber-400"} />
            <span>Mode: {useProxy ? "Tunnel Proxy" : "Direct ESXi"}</span>
          </button>

          {/* Send Ctrl+Alt+Del */}
          <button
            onClick={handleCAD}
            disabled={state !== "connected"}
            title="Send Ctrl+Alt+Del to the virtual machine"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Keyboard size={13} className="text-blue-400" />
            <span>Ctrl+Alt+Del</span>
          </button>

          {/* Rescale Screen */}
          <button
            onClick={handleRescale}
            title="Fit console display to window"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            <span>Fit Screen</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullScreen}
            title="Toggle Full Screen"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Reconnect */}
          <button
            onClick={() => setN(n + 1)}
            title="Reconnect to Console"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <RotateCw size={13} className={state === "connecting" ? "animate-spin" : ""} />
            <span>Reconnect</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition ml-2 cursor-pointer"
          >
            <X size={14} />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Error & Guidance Banner */}
      {err && (
        <div role="alert" className="m-3 rounded-xl bg-red-950/80 border border-red-800 p-4 text-sm text-red-200 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-100">Console Connection Issue</div>
                <div className="mt-0.5 text-xs text-red-300">{err}</div>

                {ticketData?.host && !useProxy && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`https://${ticketData.host}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-xs font-medium text-white border border-red-700"
                    >
                      <ExternalLink size={12} />
                      <span>Accept Certificate for {ticketData.host}</span>
                    </a>
                    <button
                      onClick={() => setUseProxy(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-medium text-white cursor-pointer"
                    >
                      Switch to Secure Tunnel Proxy
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setErr("")}
              className="text-red-400 hover:text-red-200 p-1 rounded cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Console Canvas Container */}
      <div
        id="wmks"
        tabIndex={0}
        className="flex-1 bg-black overflow-hidden flex items-center justify-center outline-none cursor-default"
      />

      {/* Status Bar / Input capture hint */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-navy-950 border-t border-navy-900 text-[11px] text-slate-400">
        <div>
          <span>Click inside the console screen to capture keyboard & mouse input.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Host: {ticketData?.host || "vSphere"}</span>
          <span>Tunnel: {useProxy ? "Backend WebSocket Proxy (TLS)" : "Direct WSS"}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- 3. User VM Cards (Standard User View) ----------
function VMCards({ vms, reload }: { vms: VM[]; reload: () => void }) {
  const [con, setCon] = useState<VM | null>(null);
  const [det, setDet] = useState<any>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  const power = async (v: VM, a: string) => {
    setMsg(null);
    setActing(v.id);
    try {
      await api(`/vms/${v.id}/power`, "POST", { action: a });
      setMsg({ text: `Virtual machine power state updated to: ${a === "start" ? "Running" : "Stopped"}.`, type: "success" });
      reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "error" });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      {msg && <AlertBanner msg={msg.text} type={msg.type} onDismiss={() => setMsg(null)} />}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {vms.map((v) => {
          const isRunning = v.power_state === "on";
          const isBusy = acting === v.id;
          const os = getOsMeta(v.guest_os, v.name);
          const OsIcon = os.icon;

          return (
            <div
              key={v.id}
              className={`card relative overflow-hidden p-5 bg-white border border-slate-200/90 shadow-sm hover:shadow transition flex flex-col justify-between ${os.borderHover}`}
            >
              {/* Subtle OS accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${os.accentBar}`} />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg ${os.iconBg} ${os.iconColor} flex items-center justify-center shrink-0 border`}>
                      <OsIcon className="w-[18px] h-[18px]" size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-navy-900 text-base leading-tight">{v.name}</h3>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${os.badgeBg}`}>
                          {os.badge}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{v.guest_os || "Unknown Guest OS"}</span>
                    </div>
                  </div>
                  <Badge on={isRunning} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 rounded-xl p-3 border border-slate-100 mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">vCPU Cores</span>
                    <span className="font-semibold text-slate-700">{v.cpu} cores</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Memory</span>
                    <span className="font-semibold text-slate-700">{formatRam(v.ram_mb)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Storage</span>
                    <span className="font-semibold text-slate-700">{v.storage_gb} GB</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">IP Address</span>
                    <span className="font-semibold text-slate-700 truncate block">{v.ip_address || "—"}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <button
                    className="btn-p text-xs py-1.5 px-3 flex-1 justify-center disabled:opacity-50"
                    disabled={!isRunning || isBusy}
                    onClick={() => setCon(v)}
                    title={!isRunning ? "VM must be powered on to connect" : "Launch WebMKS console"}
                  >
                    <MonitorPlay size={14} /> Connect
                  </button>

                  {!isRunning ? (
                    <button
                      className="btn-s text-xs py-1.5 px-3 flex-1 justify-center text-green-700 hover:bg-green-50 hover:border-green-200 disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => power(v, "start")}
                    >
                      <Play size={13} /> {isBusy ? "Starting…" : "Power On"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn-s text-xs py-1.5 px-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => power(v, "stop")}
                        title="Power Off"
                      >
                        <Square size={13} /> Stop
                      </button>
                      <button
                        className="btn-s text-xs py-1.5 px-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => power(v, "restart")}
                        title="Restart VM"
                      >
                        <RotateCw size={13} />
                      </button>
                    </>
                  )}

                  <button
                    className="btn-s text-xs py-1.5 px-2.5 text-slate-600 hover:bg-slate-50"
                    onClick={async () => {
                      try {
                        const d = await api(`/vms/${v.id}`);
                        setDet(d);
                      } catch (e) {
                        setMsg({ text: (e as Error).message, type: "error" });
                      }
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!vms.length && (
          <div className="col-span-full">
            <EmptyState
              icon={Server}
              title="No virtual machines assigned yet"
              description="Your administrator has not assigned any virtual machines to your account. If you require a workstation, please submit a request in the Support section."
            />
          </div>
        )}
      </div>

      {con && <ConsoleView vm={con} onClose={() => setCon(null)} />}

      {/* VM Details Modal */}
      {det && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <div className="card w-full max-w-lg bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const os = getOsMeta(det.guest_os, det.name);
                  const OsIcon = os.icon;
                  return (
                    <div className={`h-9 w-9 rounded-lg ${os.iconBg} ${os.iconColor} flex items-center justify-center shrink-0 border`}>
                      <OsIcon className="w-5 h-5" size={18} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-bold text-navy-900 text-lg leading-tight">{det.name}</h3>
                  <span className="text-xs text-slate-500">{det.guest_os || "Virtual Machine"}</span>
                </div>
              </div>
              <button
                onClick={() => setDet(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">Power State</span>
                  <Badge on={det.power_state === "on"} />
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Guest OS</span>
                  <span className="font-medium text-slate-800">{det.guest_os || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">vCPU Cores</span>
                  <span className="font-medium text-slate-800">{det.cpu} cores</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">RAM</span>
                  <span className="font-medium text-slate-800">{formatRam(det.ram_mb)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Storage</span>
                  <span className="font-medium text-slate-800">{det.storage_gb} GB</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">IP Address</span>
                  <span className="font-medium text-slate-800">{det.ip_address || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Host System</span>
                  <span className="font-medium text-slate-800 truncate block">{det.host || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Datastore</span>
                  <span className="font-medium text-slate-800 truncate block">{det.datastore || "—"}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Recent Activity
                </h4>
                {det.recent_activity && det.recent_activity.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-600 max-h-40 overflow-y-auto pr-1">
                    {det.recent_activity.map((a: any, i: number) => (
                      <li key={i} className="flex justify-between py-1 border-b border-slate-50">
                        <span className="font-medium text-slate-700">{a.action}</span>
                        <span className="text-slate-400">{formatDateTime(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                    No recent activity recorded for this machine.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button className="btn-s text-xs py-2 px-4" onClick={() => setDet(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 4. Support Component ----------
function Support({ admin }: { admin: boolean }) {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const data = await api("/support/tickets");
      setTickets(data);
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "error" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTicket = async () => {
    if (!subject.trim() || !body.trim()) {
      setMsg({ text: "Please provide both a subject and a description for your request.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await api("/support/tickets", "POST", { subject: subject.trim(), body: body.trim() });
      setSubject("");
      setBody("");
      setMsg({ text: "Support request submitted successfully.", type: "success" });
      load();
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (id: number) => {
    try {
      const detail = await api(`/support/tickets/${id}`);
      setSelectedTicket(detail);
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "error" });
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    try {
      await api(`/support/tickets/${selectedTicket.id}/messages`, "POST", { body: replyText.trim() });
      setReplyText("");
      const updated = await api(`/support/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated);
      load();
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "error" });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {msg && <AlertBanner msg={msg.text} type={msg.type} onDismiss={() => setMsg(null)} />}

      {!admin && (
        <div className="card p-6 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <LifeBuoy size={20} className="text-green-600" />
            <h3 className="font-bold text-navy-900 text-lg">Raise a Support Request</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                className="inp"
                placeholder="Brief summary of your inquiry or VM issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                className="inp min-h-[90px]"
                placeholder="Please describe the issue or VM resource requirement in detail"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="pt-1">
              <button className="btn-p text-sm" disabled={loading} onClick={createTicket}>
                {loading ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tickets List */}
      <div className="card p-0 bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-navy-900 text-sm">
            {admin ? "All Support Requests" : "Your Support History"}
          </h3>
          <span className="text-xs text-slate-500 font-medium">{tickets.length} total</span>
        </div>

        {tickets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => openTicket(t.id)}
                className="p-4 hover:bg-slate-50/80 cursor-pointer transition flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-400">#{t.id}</span>
                    <span className="font-semibold text-navy-900 text-sm truncate">{t.subject}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    {admin && <span>From: {t.user_email || t.user_name}</span>}
                    <span>Submitted: {formatDate(t.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={
                      "text-xs px-2.5 py-1 rounded-full font-semibold " +
                      (t.status === "open"
                        ? "bg-amber-100 text-amber-800"
                        : t.status === "answered"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700")
                    }
                  >
                    {t.status.toUpperCase()}
                  </span>
                  <ArrowRight size={16} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 text-sm">
            No support requests recorded yet.
          </div>
        )}
      </div>

      {/* Ticket Conversation Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="card w-full max-w-xl bg-white p-6 rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">#{selectedTicket.id}</span>
                  <h3 className="font-bold text-navy-900 text-base">{selectedTicket.subject}</h3>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  User: {selectedTicket.user_email} · Status: <b className="uppercase">{selectedTicket.status}</b>
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {selectedTicket.messages && selectedTicket.messages.map((m: any, i: number) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-navy-900">{m.user_email}</span>
                    <span className="text-slate-400">{formatDateTime(m.at)}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 shrink-0">
              <textarea
                className="inp min-h-[70px] text-sm"
                placeholder={admin ? "Write an administrative reply…" : "Type your message…"}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button className="btn-s text-xs" onClick={() => setSelectedTicket(null)}>
                  Close
                </button>
                <button className="btn-p text-xs" disabled={!replyText.trim()} onClick={sendReply}>
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 5. Admin Portal Component ----------
function AdminPortal({ page, onNavigate }: { page: string; onNavigate: (p: string) => void }) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vms, setVms] = useState<VM[]>([]);
  const [asg, setAsg] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [vmStatus, setVmStatus] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Forms
  const [newUser, setNewUser] = useState({ email: "", full_name: "", password: "", role: "user" });
  const [showAddUser, setShowAddUser] = useState(false);
  const [targetUid, setTargetUid] = useState(0);
  const [selectedVmIds, setSelectedVmIds] = useState<number[]>([]);
  const [vc, setVc] = useState({ host: "", username: "", password: "", verify_tls: true });

  // Filters
  const [vmFilter, setVmFilter] = useState("");
  const [powerFilter, setPowerFilter] = useState("all");
  const [auditFilter, setAuditFilter] = useState("");
  const [consoleVm, setConsoleVm] = useState<VM | null>(null);

  const refreshAll = async () => {
    try {
      const [ov, u, v, a, l, vs] = await Promise.all([
        api<OverviewData>("/admin/overview").catch(() => null),
        api<User[]>("/admin/users").catch(() => []),
        api<VM[]>("/admin/vms").catch(() => []),
        api<Assignment[]>("/admin/assignments").catch(() => []),
        api<AuditItem[]>("/admin/audit-logs").catch(() => []),
        api("/admin/vmware/status").catch(() => null),
      ]);
      if (ov) setOverview(ov);
      setUsers(u);
      setVms(v);
      setAsg(a);
      setLogs(l);
      setVmStatus(vs);
    } catch (e) {
      setBanner({ text: (e as Error).message, type: "error" });
    }
  };

  useEffect(() => {
    refreshAll();
  }, [page]);

  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await actionFn();
      const text = res?.message || successMsg;
      setBanner({ text, type: "success" });
      refreshAll();
    } catch (e) {
      setBanner({ text: (e as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists
  const filteredVms = useMemo(() => {
    return vms.filter((v) => {
      const matchesName =
        !vmFilter ||
        v.name.toLowerCase().includes(vmFilter.toLowerCase()) ||
        v.guest_os.toLowerCase().includes(vmFilter.toLowerCase());
      const matchesPower =
        powerFilter === "all" ||
        (powerFilter === "running" && v.power_state === "on") ||
        (powerFilter === "stopped" && v.power_state !== "on");
      return matchesName && matchesPower;
    });
  }, [vms, vmFilter, powerFilter]);

  const filteredLogs = useMemo(() => {
    if (!auditFilter.trim()) return logs;
    const q = auditFilter.toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.user_email.toLowerCase().includes(q) ||
        (l.detail && l.detail.toLowerCase().includes(q)) ||
        (l.ip && l.ip.includes(q))
    );
  }, [logs, auditFilter]);

  // --- Sub-View: Overview ---
  if (page === "overview") {
    const totalVms = overview?.total_vms ?? vms.length;
    const runningVms = overview?.running_vms ?? vms.filter((v) => v.power_state === "on").length;
    const totalUsers = overview?.total_users ?? users.length;
    const totalAsg = overview?.total_assignments ?? asg.length;

    const vmwareConfigured = overview?.vmware.configured ?? vmStatus?.configured;
    const vmwareEnabled = overview?.vmware.enabled ?? vmStatus?.vmware_enabled;

    return (
      <div className="space-y-6">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        {/* Top Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5 bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Virtual Machines</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">{totalVms}</div>
              <div className="text-xs text-slate-500 mt-1">Discovered on VMware</div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Server size={22} />
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Running Workstations</div>
              <div className="text-3xl font-bold text-green-700 mt-1">{runningVms}</div>
              <div className="text-xs text-slate-500 mt-1">Active powered on state</div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-100">
              <Activity size={22} />
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registered Users</div>
              <div className="text-3xl font-bold text-navy-900 mt-1">{totalUsers}</div>
              <div className="text-xs text-slate-500 mt-1">{totalAsg} active assignments</div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Users size={22} />
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">VMware Status</div>
              <div className="mt-1">
                {!vmwareEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Disabled in config
                  </span>
                ) : vmwareConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle2 size={13} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Not Configured
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-2 truncate max-w-[140px]">
                {overview?.vmware.host || "No host bound"}
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Cloud size={22} />
            </div>
          </div>
        </div>

        {/* Overview Split Panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Infrastructure Panel */}
          <div className="card p-6 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Cloud size={20} className="text-green-600" />
                  <h3 className="font-bold text-navy-900 text-base">VMware Infrastructure</h3>
                </div>
                <button
                  className="btn-s text-xs py-1 px-3"
                  onClick={() => onNavigate("vmware")}
                >
                  Manage Connection
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Configured Host</span>
                  <span className="font-medium text-navy-900">{overview?.vmware.host || "None"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Integration Mode</span>
                  <span className="font-medium text-navy-900">
                    {vmwareEnabled ? "Live pyVmomi Direct" : "Disabled (VMWARE_ENABLED=false)"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Last Inventory Sync</span>
                  <span className="font-medium text-navy-900">{formatDateTime(overview?.vmware.last_sync)}</span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Synchronize inventory with VMware host</span>
              <button
                className="btn-p text-xs py-2 px-4"
                disabled={loading || !vmwareEnabled}
                onClick={() => handleAction(() => api("/admin/vmware/sync", "POST"), "VM inventory synchronized successfully.")}
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Sync Inventory Now
              </button>
            </div>
          </div>

          {/* Recent System Activity Panel */}
          <div className="card p-6 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <ScrollText size={20} className="text-green-600" />
                  <h3 className="font-bold text-navy-900 text-base">Recent Audit Events</h3>
                </div>
                <button
                  className="btn-s text-xs py-1 px-3"
                  onClick={() => onNavigate("audit")}
                >
                  View All Logs
                </button>
              </div>

              {overview?.recent_logs && overview.recent_logs.length > 0 ? (
                <div className="space-y-2.5">
                  {overview.recent_logs.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-slate-800 uppercase px-1.5 py-0.5 rounded bg-slate-100 border text-[10px]">
                          {l.action}
                        </span>
                        <span className="text-slate-600 truncate max-w-[200px]">{l.user_email}</span>
                        {l.detail && <span className="text-slate-400 truncate max-w-[140px]">({l.detail})</span>}
                      </div>
                      <span className="text-slate-400 shrink-0 ml-2">{formatDateTime(l.at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No activity recorded yet. Audit events will appear as users interact with the system.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
              Immutable logging active: all authentication, VM power, and administrative updates are logged.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Sub-View: Users ---
  if (page === "users") {
    return (
      <div className="space-y-5">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">User Management</h2>
            <p className="text-xs text-slate-500">Manage portal access, roles, and user states.</p>
          </div>
          <button
            className="btn-p text-xs py-2 px-3.5"
            onClick={() => setShowAddUser(!showAddUser)}
          >
            {showAddUser ? <X size={14} /> : <Plus size={14} />}
            {showAddUser ? "Cancel" : "Add New User"}
          </button>
        </div>

        {/* Add User Form Drawer */}
        {showAddUser && (
          <div className="card p-5 bg-white border border-green-200 shadow-sm rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
              <UserIcon size={16} className="text-green-600" /> Create User Account
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  className="inp text-xs"
                  placeholder="e.g. Jane Doe"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  className="inp text-xs"
                  type="email"
                  placeholder="jane@cloud4green.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  className="inp text-xs bg-white"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password</label>
                <input
                  className="inp text-xs"
                  type="password"
                  placeholder="Min 12 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                className="btn-p text-xs py-2 px-4"
                disabled={loading || !newUser.email || !newUser.full_name || newUser.password.length < 12}
                onClick={() =>
                  handleAction(async () => {
                    const r = await api("/admin/users", "POST", newUser);
                    setNewUser({ email: "", full_name: "", password: "", role: "user" });
                    setShowAddUser(false);
                    return { message: `User ${r.email} created successfully.` };
                  }, "User created successfully.")
                }
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="card p-0 bg-white border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Member Since</th>
                <th className="px-4 py-3.5">Last Login</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const initials = (u.full_name || u.email || "U").slice(0, 2).toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 text-green-800 font-bold flex items-center justify-center shrink-0 text-xs">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-navy-900">{u.full_name}</div>
                          <div className="text-slate-500 text-[11px]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge active={u.is_active} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDateTime(u.last_login)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {u.is_active ? (
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-semibold transition"
                          onClick={() =>
                            handleAction(
                              () => api(`/admin/users/${u.id}`, "DELETE"),
                              `User ${u.email} has been disabled.`
                            )
                          }
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          className="text-xs text-green-600 hover:text-green-800 font-semibold transition"
                          onClick={() =>
                            handleAction(
                              () => api(`/admin/users/${u.id}`, "PUT", { is_active: true }),
                              `User ${u.email} re-enabled.`
                            )
                          }
                        >
                          Enable
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!users.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No users available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Sub-View: Virtual Machines ---
  if (page === "vms") {
    return (
      <div className="space-y-5">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="inp pl-9 py-2 text-xs"
                placeholder="Search by name or OS…"
                value={vmFilter}
                onChange={(e) => setVmFilter(e.target.value)}
              />
            </div>
            <select
              className="inp w-36 py-2 text-xs bg-white"
              value={powerFilter}
              onChange={(e) => setPowerFilter(e.target.value)}
            >
              <option value="all">All States</option>
              <option value="running">Running Only</option>
              <option value="stopped">Stopped Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-p text-xs py-2 px-3.5"
              disabled={loading}
              onClick={() => handleAction(() => api("/admin/vmware/sync", "POST"), "Inventory synchronized successfully.")}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Sync from VMware
            </button>
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredVms.length > 0 ? (
          <div className="card p-0 bg-white border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Machine Name</th>
                  <th className="px-4 py-3.5">Power</th>
                  <th className="px-4 py-3.5">Guest OS</th>
                  <th className="px-4 py-3.5">vCPU</th>
                  <th className="px-4 py-3.5">RAM</th>
                  <th className="px-4 py-3.5">Storage</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-4 py-3.5">Host</th>
                  <th className="px-5 py-3.5 text-right">Power Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVms.map((v) => {
                  const isRunning = v.power_state === "on";
                  const os = getOsMeta(v.guest_os, v.name);
                  const OsIcon = os.icon;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3 font-bold text-navy-900 flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded shrink-0 ${os.iconBg} ${os.iconColor} border`}>
                          <OsIcon className="w-3.5 h-3.5" size={14} />
                        </span>
                        <span>{v.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge on={isRunning} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{v.guest_os || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{v.cpu} cores</td>
                      <td className="px-4 py-3 text-slate-600">{formatRam(v.ram_mb)}</td>
                      <td className="px-4 py-3 text-slate-600">{v.storage_gb} GB</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{v.ip_address || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[120px]">{v.host || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            className="btn-s text-[11px] py-1 px-2.5 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-40"
                            disabled={!isRunning || loading}
                            onClick={() => setConsoleVm(v)}
                            title={!isRunning ? "VM must be running to open console" : "Open WebMKS console"}
                          >
                            <MonitorPlay size={11} /> Console
                          </button>
                          {!isRunning ? (
                            <button
                              className="btn-s text-[11px] py-1 px-2.5 text-green-700 hover:bg-green-50"
                              disabled={loading}
                              onClick={() => handleAction(() => api(`/admin/vms/${v.id}/power`, "POST", { action: "start" }), `Power on initiated for ${v.name}.`)}
                            >
                              <Play size={11} /> Start
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn-s text-[11px] py-1 px-2 text-slate-700 hover:bg-slate-100"
                                disabled={loading}
                                onClick={() => handleAction(() => api(`/admin/vms/${v.id}/power`, "POST", { action: "stop" }), `Power off initiated for ${v.name}.`)}
                              >
                                <Square size={11} /> Stop
                              </button>
                              <button
                                className="btn-s text-[11px] py-1 px-2 text-slate-700 hover:bg-slate-100"
                                disabled={loading}
                                onClick={() => handleAction(() => api(`/admin/vms/${v.id}/power`, "POST", { action: "restart" }), `Restart initiated for ${v.name}.`)}
                              >
                                <RotateCw size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Server}
            title="No virtual machines found"
            description="No virtual machines have been synchronized yet. Configure your VMware vCenter or ESXi connection in the VMware Infrastructure tab to discover virtual machines."
            action={
              <button className="btn-p text-xs py-2 px-4" onClick={() => onNavigate("vmware")}>
                Configure VMware Connection
              </button>
            }
          />
        )}

        {consoleVm && <ConsoleView vm={consoleVm} onClose={() => setConsoleVm(null)} />}
      </div>
    );
  }

  // --- Sub-View: Assignments ---
  if (page === "assign") {
    return (
      <div className="space-y-6">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        {/* Creator Panel */}
        <div className="card p-6 bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-navy-900 text-base">Assign Workstations to Users</h3>
            <p className="text-xs text-slate-500">Select an active user and check the virtual machines they are permitted to access.</p>
          </div>

          {!vms.length ? (
            <div className="py-6 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No virtual machines available in inventory. Synchronize VMs from VMware first.
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target User</label>
                <select
                  className="inp max-w-md text-xs bg-white"
                  value={targetUid}
                  onChange={(e) => setTargetUid(+e.target.value)}
                >
                  <option value={0}>Choose a user account…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Available Virtual Machines</label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto p-1">
                  {vms.map((v) => {
                    const isChecked = selectedVmIds.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className={
                          "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition " +
                          (isChecked
                            ? "border-green-400 bg-green-50/50 text-navy-900 font-semibold"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700")
                        }
                      >
                        <input
                          type="checkbox"
                          className="rounded text-green-600 focus:ring-green-500"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedVmIds(
                              e.target.checked
                                ? [...selectedVmIds, v.id]
                                : selectedVmIds.filter((id) => id !== v.id)
                            )
                          }
                        />
                        <div className="truncate">
                          <div>{v.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal truncate">
                            {v.guest_os || "Unknown OS"} · {formatRam(v.ram_mb)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  className="btn-p text-xs py-2.5 px-5"
                  disabled={loading || !targetUid || !selectedVmIds.length}
                  onClick={() =>
                    handleAction(async () => {
                      const res = await api("/admin/assignments", "POST", { user_id: targetUid, vm_ids: selectedVmIds });
                      setSelectedVmIds([]);
                      return res;
                    }, "Workstation(s) assigned successfully.")
                  }
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Existing Assignments Table */}
        <div className="card p-0 bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-navy-900 text-sm">Active Assignments</h3>
          </div>

          {asg.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-4 py-3">Assigned Virtual Machine</th>
                  <th className="px-4 py-3">Assignment Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {asg.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3 font-semibold text-navy-900">
                      {a.user_name}
                      <span className="text-slate-400 block font-normal text-[11px]">{a.user_email}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                      {(() => {
                        const os = getOsMeta(undefined, a.vm_name);
                        const OsIcon = os.icon;
                        return (
                          <span className={`inline-flex items-center justify-center h-5 w-5 rounded shrink-0 ${os.iconBg} ${os.iconColor} border`}>
                            <OsIcon className="w-3 h-3" size={12} />
                          </span>
                        );
                      })()}
                      {a.vm_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(a.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-xs text-red-600 hover:text-red-800 font-semibold transition"
                        disabled={loading}
                        onClick={() =>
                          handleAction(() => api(`/admin/assignments/${a.id}`, "DELETE"), "Assignment revoked.")
                        }
                      >
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs">
              No active assignments recorded.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Sub-View: VMware Infrastructure ---
  if (page === "vmware") {
    const isConfigured = vmStatus?.configured;
    const isEnabled = vmStatus?.vmware_enabled;

    return (
      <div className="space-y-6 max-w-4xl">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        {/* Status card */}
        <div className="card p-6 bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Cloud size={20} className="text-green-600" />
              <h3 className="font-bold text-navy-900 text-base">VMware Connection Status</h3>
            </div>
            {!isEnabled ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Disabled in Configuration
              </span>
            ) : isConfigured ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Connected
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Not Configured
              </span>
            )}
          </div>

          {!isEnabled && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">Configuration Notice:</span> VMware integration is currently set to <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">VMWARE_ENABLED=false</code> in system settings. You can enter and test your connection credentials below. To activate continuous live synchronization in production, configure <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">VMWARE_ENABLED=true</code> in your <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">.env</code> file.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-400 block">Configured Endpoint</span>
              <span className="font-semibold text-navy-900 text-sm">{vmStatus?.host || "None"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Last Inventory Sync</span>
              <span className="font-semibold text-navy-900 text-sm">{formatDateTime(vmStatus?.last_sync)}</span>
            </div>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="card p-6 bg-white border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-navy-900 text-base">Configure Host Credentials</h3>
            <p className="text-xs text-slate-500">
              Provide credentials for your VMware vCenter Server or standalone VMware ESXi host. Passwords are encrypted at rest using AES-128 Fernet encryption.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                vCenter Server or ESXi Host (FQDN or IP)
              </label>
              <input
                className="inp text-xs"
                placeholder="e.g. vcenter.cloud4green.local or 192.168.1.100"
                value={vc.host}
                onChange={(e) => setVc({ ...vc, host: e.target.value })}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Account Username
                </label>
                <input
                  className="inp text-xs"
                  placeholder="e.g. administrator@vsphere.local or root"
                  value={vc.username}
                  onChange={(e) => setVc({ ...vc, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Account Password
                </label>
                <input
                  className="inp text-xs"
                  type="password"
                  placeholder="Password"
                  value={vc.password}
                  onChange={(e) => setVc({ ...vc, password: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="text-xs flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-green-600 focus:ring-green-500"
                  checked={vc.verify_tls}
                  onChange={(e) => setVc({ ...vc, verify_tls: e.target.checked })}
                />
                <span>Verify SSL/TLS Certificate (Uncheck for self-signed certificates in development)</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
              <button
                className="btn-p text-xs py-2 px-4"
                disabled={loading || !vc.host || !vc.username || !vc.password}
                onClick={() =>
                  handleAction(
                    () => api("/admin/vmware/test-connection", "POST", vc),
                    "VMware connection verified and saved successfully."
                  )
                }
              >
                {loading ? "Testing Connection…" : "Test & Save Connection"}
              </button>

              <button
                className="btn-s text-xs py-2 px-4"
                disabled={loading}
                onClick={() =>
                  handleAction(
                    () => api("/admin/vmware/sync", "POST"),
                    "VMware inventory synchronized successfully."
                  )
                }
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Synchronize Inventory
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Sub-View: Audit Logs ---
  if (page === "audit") {
    return (
      <div className="space-y-4">
        {banner && <AlertBanner msg={banner.text} type={banner.type} onDismiss={() => setBanner(null)} />}

        <div className="flex items-center justify-between gap-3">
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="inp pl-9 py-2 text-xs"
              placeholder="Search audit trail by user, action, detail…"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">{filteredLogs.length} events</span>
        </div>

        <div className="card p-0 bg-white border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5">Event Action</th>
                <th className="px-4 py-3.5">Details</th>
                <th className="px-5 py-3.5 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3 text-slate-600 font-mono text-[11px]">{formatDateTime(l.at)}</td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{l.user_email}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 border text-slate-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{l.detail || "—"}</td>
                  <td className="px-5 py-3 text-right text-slate-400 font-mono text-[11px]">{l.ip || "—"}</td>
                </tr>
              ))}
              {!filteredLogs.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Fallback to Support overview for admin
  return <Support admin />;
}

// ---------- 6. Profile View ----------
function Profile({ user }: { user: User }) {
  const [profileData, setProfileData] = useState<User>(user);

  useEffect(() => {
    api<User>("/users/me")
      .then((u) => setProfileData(u))
      .catch(() => {});
  }, []);

  const u = profileData;
  const roleLabel = u.role.toLowerCase() === "admin" ? "Administrator" : "Standard User";
  const initials = (u.full_name || u.email || "User")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="max-w-4xl space-y-6">
      {/* 1. Profile header with subtle green gradient */}
      <div className="rounded-2xl bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-green-500/20 text-green-700 flex items-center justify-center font-bold">
            <UserIcon size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight">My Profile</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">View your account information and activity.</p>
          </div>
        </div>
      </div>

      {/* 2. User information card */}
      <div className="card p-6 sm:p-8 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-green-600 via-emerald-500 to-green-700 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-white shrink-0">
              {initials}
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center" title="Active">
              <span className="h-2 w-2 rounded-full bg-white" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl sm:text-2xl font-bold text-navy-900">{u.full_name}</h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                <ShieldCheck size={14} />
                {roleLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-sm text-slate-600 pt-1">
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-green-600 shrink-0" />
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-navy-900 truncate">{u.email}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-green-600 shrink-0" />
                <span className="text-slate-500">Role:</span>
                <span className="font-medium text-navy-900">{roleLabel}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-green-600 shrink-0" />
                <span className="text-slate-500">Member since:</span>
                <span className="font-medium text-navy-900">{formatDate(u.created_at)}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-green-600 shrink-0" />
                <span className="text-slate-500">Last login:</span>
                <span className="font-medium text-navy-900">{formatDateTime(u.last_login)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Account overview */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Overview</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5 bg-white border border-slate-200/80 shadow-sm flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 border border-green-100">
              <Calendar size={22} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Member Since</div>
              <div className="text-base sm:text-lg font-bold text-navy-900">{formatDate(u.created_at)}</div>
              <p className="text-xs text-slate-500">Actual account registration date</p>
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200/80 shadow-sm flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Clock size={22} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Last Login</div>
              <div className="text-base sm:text-lg font-bold text-navy-900">{formatDateTime(u.last_login)}</div>
              <p className="text-xs text-slate-500">Most recent successful session timestamp</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 7. Main Application Root ----------
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("overview");
  const [vms, setVms] = useState<VM[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user?.role.toLowerCase() === "admin";

  const reloadUserVms = () => {
    if (!isAdmin) {
      api<VM[]>("/vms")
        .then(setVms)
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (user) {
      setPage(isAdmin ? "overview" : "vms");
      if (!isAdmin) {
        reloadUserVms();
      }
    }
  }, [user]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const navItems: [string, string, ReactNode][] = isAdmin
    ? [
        ["overview", "Overview", <LayoutDashboard size={18} />],
        ["vms", "Virtual Machines", <Server size={18} />],
        ["assign", "VM Assignments", <Link2 size={18} />],
        ["users", "Users", <Users size={18} />],
        ["vmware", "VMware Infrastructure", <Cloud size={18} />],
        ["audit", "Audit Logs", <ScrollText size={18} />],
        ["support", "Support Tickets", <LifeBuoy size={18} />],
        ["profile", "Profile", <UserIcon size={18} />],
      ]
    : [
        ["vms", "My Virtual Machines", <Server size={18} />],
        ["support", "Support", <LifeBuoy size={18} />],
        ["profile", "Profile", <UserIcon size={18} />],
      ];

  const logout = async () => {
    try {
      await api("/auth/logout", "POST", { refresh_token: getRefresh() });
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans antialiased text-slate-800">
      {/* Header */}
      <header className="flex items-center justify-between bg-[#0F1E36] border-b border-[#1A3156] px-4 md:px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden text-slate-300 hover:text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle Navigation"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <img
              src="/assets/cloud4green-logo.png"
              alt="Cloud4green Technologies"
              className="h-7 w-auto object-contain brightness-0 invert"
            />
            <div className="hidden sm:block border-l border-slate-700 pl-3">
              <span className="text-xs text-green-400 font-medium tracking-wide">{TAG}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setPage("profile")}
            className="flex items-center gap-2.5 hover:opacity-90 transition text-left cursor-pointer bg-[#162C4E] px-3 py-1.5 rounded-full border border-slate-700/60"
          >
            <div className="h-6 w-6 rounded-full bg-green-600 text-white font-bold flex items-center justify-center text-[10px]">
              {(user.full_name || user.email || "U").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-200 hidden sm:inline">{user.full_name}</span>
            <span className="text-[10px] text-green-400 font-semibold uppercase">{isAdmin ? "Admin" : "User"}</span>
          </button>

          <button
            className="btn-s text-xs py-1.5 px-3 text-slate-700 hover:bg-slate-100 cursor-pointer"
            onClick={logout}
          >
            <LogOut size={13} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1">
        {/* Sidebar Nav */}
        <nav
          className={
            (menuOpen ? "block" : "hidden") +
            " w-60 shrink-0 bg-[#0A1629] border-r border-slate-800 p-4 md:block flex flex-col justify-between"
          }
        >
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
              {isAdmin ? "Infrastructure Management" : "Workstations"}
            </div>
            {navItems.map(([k, label, icon]) => {
              const active = page === k;
              return (
                <button
                  key={k}
                  onClick={() => {
                    setPage(k);
                    setMenuOpen(false);
                  }}
                  className={
                    "w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-medium transition cursor-pointer " +
                    (active
                      ? "bg-[#16A34A] text-white shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-[#162C4E]/60 hover:text-white")
                  }
                >
                  <span className={active ? "text-white" : "text-slate-400"}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-400 px-3">
            <div className="font-semibold text-slate-300">{NAME}</div>
            <div>Production v1.0</div>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto">
          {page !== "profile" && (
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight">
                {navItems.find((i) => i[0] === page)?.[1]}
              </h1>
            </div>
          )}

          {page === "profile" ? (
            <Profile user={user} />
          ) : isAdmin ? (
            <AdminPortal page={page} onNavigate={setPage} />
          ) : page === "vms" ? (
            <VMCards vms={vms} reload={reloadUserVms} />
          ) : (
            <Support admin={false} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="py-3 text-center text-xs text-slate-500 bg-white border-t border-slate-200">
        {FOOT}
      </footer>
    </div>
  );
}
