/** 
 * Official VMware WebMKS / HTML Console SDK Adapter.
 * Connects directly to VMware host console via secure WebSocket ticket or backend tunnel proxy.
 * See docs/WEBMKS.md for architecture and deployment details.
 */
export interface Ticket {
  url: string;
  ticket: string;
  host: string;
  port: number;
  ws_proxy_path?: string;
  thumbprint?: string;
}

export interface ConsoleSession {
  destroy: () => void;
  sendCAD: () => void;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  canFullScreen: () => boolean;
  rescale: () => void;
  sendInputString: (s: string) => void;
}

export interface ConsoleCallbacks {
  onState: (state: string) => void;
  onError?: (errType: string, errData?: any) => void;
  onScreenSizeChange?: (size: { width: number; height: number }) => void;
}

export function sdkAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as any).WMKS !== "undefined";
}

export function openConsole(
  elId: string,
  ticket: Ticket,
  callbacks: ConsoleCallbacks | ((s: string) => void),
  options?: {
    useProxy?: boolean;
    token?: string;
  }
): ConsoleSession {
  const W = (window as any).WMKS;
  if (!W) {
    throw new Error("VMware WebMKS SDK is not loaded in this browser environment. See docs/WEBMKS.md.");
  }

  const cbs: ConsoleCallbacks = typeof callbacks === "function" ? { onState: callbacks } : callbacks;

  // Clear target container DOM contents before initializing
  const container = document.getElementById(elId);
  if (container) {
    container.innerHTML = "";
  }

  const position = W.CONST?.Position?.CENTER ?? 0;
  const wmksInstance = W.createWMKS(elId, {
    changeResolution: true,
    rescale: true,
    position: position,
    useNativePixel: false,
  });

  if (W.CONST?.Events?.CONNECTION_STATE_CHANGE) {
    wmksInstance.register(
      W.CONST.Events.CONNECTION_STATE_CHANGE,
      (_: unknown, d: { state: string }) => {
        cbs.onState(d.state);
      }
    );
  }

  if (W.CONST?.Events?.ERROR && cbs.onError) {
    wmksInstance.register(
      W.CONST.Events.ERROR,
      (_: unknown, d: any) => {
        cbs.onError?.(d?.errorType || "websocketerror", d);
      }
    );
  }

  if (W.CONST?.Events?.REMOTE_SCREEN_SIZE_CHANGE && cbs.onScreenSizeChange) {
    wmksInstance.register(
      W.CONST.Events.REMOTE_SCREEN_SIZE_CHANGE,
      (_: unknown, d: { width: number; height: number }) => {
        cbs.onScreenSizeChange?.(d);
      }
    );
  }

  // Determine WebSocket target URL
  let targetUrl = ticket.url;
  if (options?.useProxy && ticket.ws_proxy_path) {
    const isHttps = window.location.protocol === "https:";
    const wsProto = isHttps ? "wss:" : "ws:";
    // In dev/preview environments running frontend on port 3001, connect directly to backend on port 8000
    const wsHost =
      window.location.port === "3001"
        ? `${window.location.hostname}:8000`
        : window.location.host;
    const tokenParam = options.token ? `?token=${encodeURIComponent(options.token)}` : "";
    targetUrl = `${wsProto}//${wsHost}${ticket.ws_proxy_path}${tokenParam}`;
  }

  // Connect to the WebSocket target
  wmksInstance.connect(targetUrl);

  const handleResize = () => {
    try {
      wmksInstance.updateScreen();
    } catch {
      // ignore resize error
    }
  };
  window.addEventListener("resize", handleResize);

  return {
    destroy: () => {
      window.removeEventListener("resize", handleResize);
      try {
        wmksInstance.disconnect();
      } catch {}
      try {
        wmksInstance.destroy();
      } catch {}
      if (container) {
        container.innerHTML = "";
      }
    },
    sendCAD: () => {
      try {
        wmksInstance.sendCAD();
      } catch (e) {
        console.warn("CAD command not sent:", e);
      }
    },
    enterFullScreen: () => {
      try {
        wmksInstance.enterFullScreen();
      } catch (e) {
        console.warn("Fullscreen toggle failed:", e);
      }
    },
    exitFullScreen: () => {
      try {
        wmksInstance.exitFullScreen();
      } catch (e) {
        console.warn("Exit fullscreen failed:", e);
      }
    },
    canFullScreen: () => {
      try {
        return wmksInstance.canFullScreen();
      } catch {
        return false;
      }
    },
    rescale: () => {
      try {
        wmksInstance.updateScreen();
      } catch {}
    },
    sendInputString: (s: string) => {
      try {
        wmksInstance.sendInputString(s);
      } catch (e) {
        console.warn("Send input failed:", e);
      }
    },
  };
}
