import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Terminal } from "@xterm/xterm";
import type { ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { XtermjsSettings } from "@/hooks/useXtermjsSettings";
import {
  isTransparentBackground,
} from "@/hooks/useXtermjsSettings";

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
  settings: XtermjsSettings;
  otpRequired: boolean;
  otpCode: string | null;
  disconnectMessage: string;
  onApiChange: (api: TerminalSessionApi | null) => void;
}

const encode = (value: string) => new TextEncoder().encode(value);

const normalizePaste = (value: string) => value.replace(/\r?\n/g, "\r");

// 单个终端标签的 xterm、WebSocket 与快捷键会话
const TerminalSession = ({
  uuid,
  active,
  settings,
  otpRequired,
  otpCode,
  disconnectMessage,
  onApiChange,
}: TerminalSessionProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const disconnectMessageRef = useRef(disconnectMessage);
  const onApiChangeRef = useRef(onApiChange);

  useEffect(() => {
    disconnectMessageRef.current = disconnectMessage;
  }, [disconnectMessage]);

  useEffect(() => {
    onApiChangeRef.current = onApiChange;
  }, [onApiChange]);

  useEffect(() => {
    if (!hostRef.current || (otpRequired && otpCode === null)) {
      return;
    }

    const snapshot = settings;
    const baseTheme = snapshot.terminalOptions.theme || {};
    const themeWithSelection = {
      ...baseTheme,
      selectionBackground: "#ffffff",
      selectionForeground: "#000000",
      selectionInactiveBackground: "#ffffff",
      scrollbarSliderBackground: "#555555",
      scrollbarSliderHoverBackground: "#777777",
      scrollbarSliderActiveBackground: "#888888",
    };

    const terminalOptions: Partial<ITerminalOptions> = {
      cursorBlink: snapshot.terminalOptions.cursorBlink,
      cursorStyle: "bar",
      cursorInactiveStyle: "bar",
      cursorWidth: 2,
      allowProposedApi: true,
      overviewRuler: { width: 4 },
      convertEol: snapshot.terminalOptions.convertEol,
      fontFamily: snapshot.terminalOptions.fontFamily,
      fontSize: snapshot.terminalOptions.fontSize,
      macOptionIsMeta: snapshot.terminalOptions.macOptionIsMeta,
      scrollback: snapshot.terminalOptions.scrollback,
      theme: themeWithSelection,
    };

    if (
      snapshot.transparentBackground ||
      isTransparentBackground(snapshot.terminalOptions.theme?.background)
    ) {
      terminalOptions.allowTransparency = true;
    }

    const term = new Terminal(terminalOptions);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const host = hostRef.current;
    let disposed = false;
    let firstBinary = false;
    let firstBinaryTimeout: ReturnType<typeof setTimeout> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.open(host);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = `${protocol}//${window.location.host}`;
    const otpQuery = otpRequired && otpCode
      ? `?2fa_code=${encodeURIComponent(otpCode)}`
      : "";
    const ws = new WebSocket(
      `${baseUrl}/api/admin/client/${uuid}/terminal${otpQuery}`,
    );
    ws.binaryType = "arraybuffer";

    const send = (data: string | Uint8Array) => {
      if (disposed || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(typeof data === "string" ? encode(data) : data);
    };

    const fit = () => {
      if (disposed) {
        return;
      }
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
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
            send(new Uint8Array([3]));
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
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }, 10000);
    };

    ws.onopen = () => {
      fit();
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      if (disposed) {
        return;
      }
      if (event.data instanceof ArrayBuffer) {
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

    ws.onclose = () => {
      if (!disposed) {
        if (heartbeatInterval !== null) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        term.write(`\n ${disconnectMessageRef.current}`);
      }
    };

    const termDataDisposable = term.onData((data) => send(data));
    const api: TerminalSessionApi = {
      terminal: term,
      searchAddon,
      send,
      fit,
      exportText,
    };
    onApiChangeRef.current(api);
    requestAnimationFrame(fit);

    return () => {
      disposed = true;
      onApiChangeRef.current(null);
      host.removeEventListener("contextmenu", handleContextMenu);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      termDataDisposable.dispose();
      if (firstBinaryTimeout !== null) {
        clearTimeout(firstBinaryTimeout);
      }
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
      }
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      term.dispose();
    };
  }, [otpCode, otpRequired, settings, uuid]);

  const style = {
    "--xterm-padding": `${settings.terminalPadding}px`,
  } as CSSProperties;

  return (
    <div
      className={`km-terminal-session terminal-page terminal-xterm-host absolute inset-0 h-full w-full overflow-hidden box-border bg-[var(--xterm-container-bg,#000)] p-[var(--xterm-padding,16px)] transition-opacity duration-150 [&_.xterm-viewport]:[scrollbar-width:thin] [&_.xterm-viewport]:[scrollbar-color:var(--xterm-scrollbar-thumb,#555)_var(--xterm-scrollbar-track,#000000)] [&_.xterm-viewport::-webkit-scrollbar]:h-2.5 [&_.xterm-viewport::-webkit-scrollbar]:w-2.5 [&_.xterm-viewport::-webkit-scrollbar-track]:bg-[var(--xterm-scrollbar-track,#000000)] [&_.xterm-viewport::-webkit-scrollbar-thumb]:rounded-[5px] [&_.xterm-viewport::-webkit-scrollbar-thumb]:bg-[var(--xterm-scrollbar-thumb,#555)] [&_.xterm-viewport::-webkit-scrollbar-thumb:hover]:bg-[var(--xterm-scrollbar-thumb-hover,#777)] ${
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
