import { useEffect, useId, useRef } from "react";
import type { CSSProperties } from "react";
import { Terminal } from "@xterm/xterm";
import type { ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DEFAULT_TERMINAL_OPTIONS,
  DEFAULT_TERMINAL_PADDING,
} from "./terminalDefaults";

export interface TerminalSessionApi {
  terminal: Terminal;
  searchAddon: SearchAddon;
  send: (data: string | Uint8Array) => void;
  fit: () => void;
  exportText: () => string;
}

interface TerminalSessionProps {
  uuid: string;
  active: boolean;
  fontSize?: number;
  padding?: number;
  twoFaEnabled: boolean;
  disconnectMessage: string;
  onApiChange: (api: TerminalSessionApi | null) => void;
}

const RECONNECT_INTERVAL = 1000;
// 与 Server/Agent 的会话保留窗口（5 分钟）保持一致，Agent 离线恢复后会话仍可续用。
const RECONNECT_WINDOW = 5 * 60 * 1000;
// 被控端通常几百毫秒内就附着上，等待提示延迟出现，避免每次打开都闪一下。
const WAITING_HINT_DELAY = 800;

const encode = (value: string) => new TextEncoder().encode(value);

const normalizePaste = (value: string) => value.replace(/\r?\n/g, "\r");

// 单个终端标签的 xterm、WebSocket 与快捷键会话
const TerminalSession = ({
  uuid,
  active,
  fontSize = DEFAULT_TERMINAL_OPTIONS.fontSize,
  padding = DEFAULT_TERMINAL_PADDING,
  twoFaEnabled,
  disconnectMessage,
  onApiChange,
}: TerminalSessionProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const disconnectMessageRef = useRef(disconnectMessage);
  const onApiChangeRef = useRef(onApiChange);
  const apiRef = useRef<TerminalSessionApi | null>(null);
  const toastId = useId();
  const { t } = useTranslation();
  const tRef = useRef(t);

  activeRef.current = active;
  tRef.current = t;

  useEffect(() => {
    disconnectMessageRef.current = disconnectMessage;
  }, [disconnectMessage]);

  useEffect(() => {
    onApiChangeRef.current = onApiChange;
  }, [onApiChange]);

  useEffect(() => {
    const currentApi = apiRef.current;
    if (!currentApi) {
      return;
    }
    currentApi.terminal.options.fontSize = fontSize;
    currentApi.fit();
  }, [fontSize]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const themeWithSelection = {
      selectionBackground: "#ffffff",
      selectionForeground: "#000000",
      selectionInactiveBackground: "#ffffff",
      scrollbarSliderBackground: "#555555",
      scrollbarSliderHoverBackground: "#777777",
      scrollbarSliderActiveBackground: "#888888",
    };

    const terminalOptions: Partial<ITerminalOptions> = {
      ...DEFAULT_TERMINAL_OPTIONS,
      fontSize,
      cursorStyle: "bar",
      cursorInactiveStyle: "bar",
      cursorWidth: 2,
      allowProposedApi: true,
      overviewRuler: { width: 4 },
      theme: themeWithSelection,
    };

    const term = new Terminal(terminalOptions);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const host = hostRef.current;
    let disposed = false;
    let firstBinary = false;
    let firstBinaryTimeout: ReturnType<typeof setTimeout> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let requestID: string | null = null;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDeadline: number | null = null;
    let otpBuffer = "";
    let awaitingOtp = false;
    let currentOtp: string | null = null;
    const waitingToastId = `${toastId}-waiting`;
    // 被控端附着前先在 toast 里提示“等待连接”，避免把提示写进终端缓冲。
    let waitingTimer: ReturnType<typeof setTimeout> | null = null;
    let waitingShown = false;
    // 收到 terminate 后进入终态：不再重连，也不再响应任何后续事件。
    let terminated = false;

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.open(host);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = `${protocol}//${window.location.host}`;

    const send = (data: string | Uint8Array) => {
      if (disposed || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(typeof data === "string" ? encode(data) : data);
    };

    const fit = () => {
      if (disposed) {
        return;
      }
      fitAddon.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      }
    };

    const exportText = () => {
      const buffer = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      return lines.join("\n");
    };

    const copySelection = async () => {
      const selectedText = term.getSelection();
      if (!selectedText) {
        return;
      }
      try {
        await navigator.clipboard.writeText(selectedText);
        if (!disposed) {
          term.clearSelection();
          term.focus();
        }
      } catch {
        // Clipboard permissions are reported by the existing HTTPS callout.
      }
    };

    const pasteClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (disposed) {
          return;
        }
        term.clearSelection();
        term.focus();
        send(normalizePaste(text));
      } catch {
        // Clipboard permissions are reported by the existing HTTPS callout.
      }
    };

    const getPromptOtpLine = () =>
      "\r\n\x1b[1m" +
      tRef.current("terminal.2fa_prompt", "Two-factor authentication required.") +
      "\x1b[0m\r\n" +
      tRef.current("terminal.2fa_code_prompt", "Enter 2FA code: ");

    const startOtpPrompt = (isRetry: boolean) => {
      awaitingOtp = true;
      otpBuffer = "";
      if (isRetry) {
        term.write(
          "\r\n\x1b[31m" +
            tRef.current("terminal.otp_invalid", "Invalid or expired 2FA code.") +
            "\x1b[0m",
        );
      } else {
        term.clear();
      }
      term.write(getPromptOtpLine());
      term.focus();
    };

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      const ctrlOnly =
        event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
      const ctrlAlt =
        event.ctrlKey &&
        event.altKey &&
        !event.metaKey &&
        !event.shiftKey;
      const ctrlShiftV =
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "v";

      if (
        ctrlOnly ||
        ctrlAlt ||
        ctrlShiftV
      ) {
        const key = event.key.toLowerCase();
        if (key === "c") {
          event.preventDefault();
          if (term.hasSelection() || ctrlAlt) {
            void copySelection();
          } else {
            if (!awaitingOtp) {
              send(new Uint8Array([3]));
            } else {
              otpBuffer = "";
              term.write("^C\r\n");
              term.write(
                tRef.current("terminal.2fa_code_prompt", "Enter 2FA code: "),
              );
            }
          }
          return false;
        }
        if (key === "v") {
          event.preventDefault();
          void pasteClipboard();
          return false;
        }
      }

      // Allow page shortcuts like Ctrl+Alt / Ctrl+Shift+F / Alt+Enter to bubble.
      if (
        (event.ctrlKey && event.altKey) ||
        (event.ctrlKey && event.shiftKey) ||
        (event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          event.key === "Enter")
      ) {
        return false;
      }

      return true;
    });

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (term.hasSelection()) {
        void copySelection();
      } else {
        void pasteClipboard();
      }
    };
    host.addEventListener("contextmenu", handleContextMenu);

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);
    const handleWindowResize = () => fit();
    window.addEventListener("resize", handleWindowResize);

    const startHeartbeat = () => {
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
      }
      heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }, 10000);
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    const hideReconnectingToast = () => {
      toast.dismiss(toastId);
    };

    const hideWaitingToast = () => {
      // 输出流里每帧都会调用这里，没显示过就什么都不做，避免高频 dismiss。
      if (waitingTimer === null && !waitingShown) {
        return;
      }
      if (waitingTimer !== null) {
        clearTimeout(waitingTimer);
        waitingTimer = null;
      }
      waitingShown = false;
      toast.dismiss(waitingToastId);
    };

    // 等待被控端时显示常驻 toast：连接建立后才出现（无竞态地响应后端状态帧），
    // 被控端就位后由 ready 或首帧输出关闭。重连时同样生效。
    const showWaitingToast = () => {
      if (waitingTimer !== null || waitingShown) {
        return;
      }
      waitingTimer = setTimeout(() => {
        waitingTimer = null;
        if (disposed) {
          return;
        }
        waitingShown = true;
        toast.loading(
          tRef.current("terminal.waiting_agent", "等待被控端连接..."),
          {
            duration: Infinity,
            id: waitingToastId,
            // 被控端久不上线时允许手动关掉，不必等它连上。
            closeButton: true,
          },
        );
      }, WAITING_HINT_DELAY);
    };

    const connect = (otp: string | null) => {
      const params = new URLSearchParams();
      // 2FA is required only for the initial session creation. Reattach is
      // authorized by the server-side session owner and must not reuse an
      // expired TOTP value.
      if (otp && !requestID) {
        params.set("2fa_code", otp);
      }
      if (requestID) {
        params.set("request_id", requestID);
      }
      const query = params.toString();
      const socket = new WebSocket(
        `${baseUrl}/api/admin/client/${uuid}/terminal${query ? `?${query}` : ""}`,
      );
      ws = socket;
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        if (disposed || ws !== socket) return;
        reconnectTimer = null;
        if (stableConnectionTimer !== null) {
          clearTimeout(stableConnectionTimer);
        }
        // Keep a reconnect window across short-lived flaps. Once the
        // connection is stable, a future outage gets a fresh window.
        stableConnectionTimer = setTimeout(() => {
          reconnectDeadline = null;
          stableConnectionTimer = null;
        }, 10000);
        hideReconnectingToast();
        // 后端只在被控端真正附着后才发状态帧，所以这里先显示等待提示；
        // 被控端已在位的会话会在 attach 时立刻收到 ready。
        showWaitingToast();
        fit();
        startHeartbeat();
      };

      socket.onmessage = (event) => {
        if (disposed || ws !== socket) {
          return;
        }
        if (typeof event.data === "string") {
          // 文本帧 = 控制消息，二进制帧 = 终端内容（见服务端 terminal/control.go）。
          try {
            const control = JSON.parse(event.data);
            if (control && typeof control === "object" && control.type) {
              switch (control.type) {
                case "assigned":
                  // 会话已建立，记住 request_id；此后任何一侧掉线都能用它重连。
                  if (typeof control.request_id === "string") {
                    requestID = control.request_id;
                  }
                  return;
                case "ready":
                  // 被控端就位，转发开始。
                  hideWaitingToast();
                  return;
                case "abort":
                  // 对端意外掉线：会话仍保留，稍后重连即可恢复。
                  showWaitingToast();
                  return;
                case "terminate":
                  // 终态：不再重连。
                  terminated = true;
                  hideWaitingToast();
                  hideReconnectingToast();
                  term.write(`\n ${disconnectMessageRef.current}`);
                  return;
                default:
                  // 未知控制消息：忽略，绝不写进终端。前向兼容靠这一条。
                  return;
              }
            }
          } catch {
            // 不是合法的控制消息，按终端输出处理，交给下面写入 xterm。
          }
        }
        if (event.data instanceof ArrayBuffer) {
          // 有任何输出就说明被控端已附着。
          hideWaitingToast();
          if (!firstBinary) {
            firstBinary = true;
            // Clear screen when first agent binary packet arrives
            term.clear();
            term.write(new Uint8Array(event.data));
            firstBinaryTimeout = setTimeout(() => {
              if (disposed) {
                return;
              }
              term.resize(Math.max(1, term.cols - 1), term.rows);
              fit();
            }, 200);
          } else {
            term.write(new Uint8Array(event.data));
          }
        } else {
          term.write(event.data);
        }
      };

      socket.onclose = () => {
        if (ws !== socket) return;
        ws = null;
        stopHeartbeat();
        // 等待提示只在“已连上但还没等到被控端”时有效，断线后交给重连流程重新给出。
        hideWaitingToast();
        if (stableConnectionTimer !== null) {
          clearTimeout(stableConnectionTimer);
          stableConnectionTimer = null;
        }
        if (disposed) {
          return;
        }
        // terminate 已经处理过（会写断开提示并停止重连），这里不重复。
        if (terminated) {
          return;
        }
        if (!requestID && twoFaEnabled) {
          hideReconnectingToast();
          startOtpPrompt(true);
          return;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {};
    };

    const scheduleReconnect = () => {
      const now = Date.now();
      if (reconnectDeadline === null) {
        reconnectDeadline = now + RECONNECT_WINDOW;
      }
      if (now >= reconnectDeadline) {
        hideReconnectingToast();
        hideWaitingToast();
        term.write(`\n ${disconnectMessageRef.current}`);
        return;
      }
      if (reconnectTimer !== null) return;
      toast.loading(
        tRef.current("terminal.reconnecting", "连接已断开，正在尝试重新连接"),
        {
          duration: Infinity,
          id: toastId,
        },
      );
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        // Reuse the verified code while reattaching the existing request.
        // A fresh OTP prompt is shown when the initial authenticated connect
        // fails before a request ID is issued.
        connect(twoFaEnabled ? currentOtp : null);
      }, RECONNECT_INTERVAL);
    };

    if (twoFaEnabled) {
      startOtpPrompt(false);
    } else {
      connect(null);
    }

    const termDataDisposable = term.onData((data) => {
      if (awaitingOtp) {
        if (data === "\r") {
          awaitingOtp = false;
          term.write("\r\n");
          if (!otpBuffer) {
            startOtpPrompt(false);
            return;
          }
          currentOtp = otpBuffer;
          otpBuffer = "";
          connect(currentOtp);
        } else if (data === "\x7f" || data === "\b") {
          if (otpBuffer.length > 0) {
            otpBuffer = otpBuffer.slice(0, -1);
          }
        } else if (data.length === 1 && data >= " " && data <= "~") {
          otpBuffer += data;
        }
        return;
      }
      send(data);
    });
    const api: TerminalSessionApi = {
      terminal: term,
      searchAddon,
      send,
      fit,
      exportText,
    };
    apiRef.current = api;
    onApiChangeRef.current(api);
    requestAnimationFrame(() => {
      fit();
      if (activeRef.current) {
        term.focus();
      }
    });

    return () => {
      disposed = true;
      apiRef.current = null;
      onApiChangeRef.current(null);
      host.removeEventListener("contextmenu", handleContextMenu);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      termDataDisposable.dispose();
      if (firstBinaryTimeout !== null) {
        clearTimeout(firstBinaryTimeout);
      }
      stopHeartbeat();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      if (stableConnectionTimer !== null) {
        clearTimeout(stableConnectionTimer);
      }
      hideReconnectingToast();
      hideWaitingToast();
      if (ws) {
        const socket = ws;
        ws = null;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        if (socket.readyState === WebSocket.OPEN && !terminated) {
          // 用户主动关标签 = 正常终止：明确告知，双方都不再重连。
          socket.send(JSON.stringify({ type: "terminate" }));
        }
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      }
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFaEnabled, toastId, uuid]);

  const style = {
    "--xterm-padding": `${padding}px`,
  } as CSSProperties;

  return (
    <div
      className={`km-terminal-session terminal-page terminal-xterm-host absolute inset-0 h-full w-full overflow-hidden box-border bg-[var(--xterm-container-bg,#000)] p-[var(--xterm-padding,16px)] transition-opacity duration-[var(--km-dur-fast)] ease-[var(--km-ease-standard)] [&_.xterm-viewport]:[scrollbar-width:thin] [&_.xterm-viewport]:[scrollbar-color:var(--xterm-scrollbar-thumb,#555)_var(--xterm-scrollbar-track,#000000)] [&_.xterm-viewport::-webkit-scrollbar]:h-2.5 [&_.xterm-viewport]:[scrollbar-width:thin] [&_.xterm-viewport::-webkit-scrollbar]:w-2.5 [&_.xterm-viewport::-webkit-scrollbar-track]:bg-[var(--xterm-scrollbar-track,#000000)] [&_.xterm-viewport::-webkit-scrollbar-thumb]:rounded-[5px] [&_.xterm-viewport::-webkit-scrollbar-thumb]:bg-[var(--xterm-scrollbar-thumb,#555)] [&_.xterm-viewport::-webkit-scrollbar-thumb:hover]:bg-[var(--xterm-scrollbar-thumb-hover,#777)] ${
        active
          ? "is-active z-[1] visible pointer-events-auto opacity-100"
          : "invisible pointer-events-none opacity-0"
      }`}
      style={style}
      aria-hidden={!active}
    >
      <div
        ref={hostRef}
        className="km-terminal-xterm-viewport h-full min-h-0 w-full overflow-hidden"
      />
    </div>
  );
};

export default TerminalSession;
