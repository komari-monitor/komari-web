import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { SearchAddon } from "xterm-addon-search";
import "xterm/css/xterm.css";
import "./Terminal.css";
import { Callout, Flex, IconButton, Theme } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Cross1Icon } from "@radix-ui/react-icons";
import { TablerAlertTriangleFilled } from "../../components/Icones/Tabler";
import CommandClipboardPanel from "@/pages/terminal/CommandClipboard";
import { Toaster } from "@/components/ui/sonner";
import { TerminalContext } from "@/contexts/TerminalContext";
import { motion } from "framer-motion";
import throttle from "lodash/throttle";
interface TerminalAreaProps {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  toggleClipboard: () => void;
  width: number | string;
  isOpen: boolean;
}
const TerminalArea: React.FC<TerminalAreaProps> = ({
  terminalRef,
  toggleClipboard,
  width,
  isOpen,
}) => (
  <div
    className="relative flex justify-center bg-black md:bg-accent-3 flex-col h-full min-w-128"
    style={{ width }}
  >
    <div className="m-0 md:p-4 p-0 w-full h-full bg-black">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
    <div
      className="absolute right-0 top-1/2 transform -translate-y-1/2 flex items-center justify-center bg-accent-4 hover:bg-accent-6 text-white cursor-pointer rounded-l-full w-6 h-12 z-20"
      onClick={toggleClipboard}
    >
      {isOpen ? ">" : "<"}
    </div>
  </div>
);

const Divider: React.FC<{
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
}> = ({ onMouseDown }) => (
  <div
    className="h-full bg-accent-2 cursor-col-resize hover:bg-accent-4"
    style={{ width: 8 }}
    onMouseDown={onMouseDown}
    onTouchStart={onMouseDown}
  />
);

const ClipboardPanel: React.FC = () => (
  <div className="h-screen p-2 min-w-64" style={{ flex: 1 }}>
    <CommandClipboardPanel className="h-full w-full" />
  </div>
);

const TerminalPage = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const params = new URLSearchParams(window.location.search);
  const uuid = params.get("uuid");
  const [callout, setCallout] = useState(false);
  const [t] = useTranslation();
  const firstBinary = useRef(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(window.innerWidth * 0.7);
  const draggingRef = useRef(false);
  const fitAddonRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用 useCallback 确保 resizeTerminal 引用稳定
  const resizeTerminal = useCallback(() => {
    fitAddonRef.current?.fit();
    const term = terminalInstance.current;
    const ws = wsRef.current;
    if (term && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        })
      );
    }
  }, []);

  const startDragging = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      document.body.style.userSelect = "none";
    },
    []
  );

  const stopDragging = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      document.body.style.userSelect = "";
      resizeTerminal();
    }
  }, [resizeTerminal]);

  // 限制resize onMouseMove 调用频率
  const onMouseMove = useCallback(
    throttle((e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      let clientX: number;

      if (e instanceof MouseEvent) {
        clientX = e.clientX;
      } else {
        clientX = e.touches[0].clientX;
      }

      const newLeftWidth = clientX - containerRect.left;
      const minWidth = 300;
      const maxWidth = containerRect.width - 300;

      if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
        setLeftWidth(newLeftWidth);
      }
    }, 1000 / 60), // （60fps）
    []
  );

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDragging);
    document.addEventListener("touchmove", onMouseMove);
    document.addEventListener("touchend", stopDragging);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopDragging);
      document.removeEventListener("touchmove", onMouseMove);
      document.removeEventListener("touchend", stopDragging);
      onMouseMove.cancel(); // 清理 throttle
    };
  }, [onMouseMove, stopDragging]);

  useEffect(() => {
    if (uuid === null) {
      window.location.href = "/";
    }
    fetch("./api/admin/client/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.length === 0) {
          alert(t("terminal.no_active_connection"));
        }
        const client = data.find(
          (item: { uuid: string }) => item.uuid === uuid
        );
        document.title = `${t("terminal.title")} - ${
          client?.name || t("terminal.title")
        }`;
      });
  }, [t, uuid]);

  useEffect(() => {
    setCallout(window.location.protocol !== "https:");
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 5000,
      convertEol: true,
      fontFamily: "'Cascadia Mono', 'Noto Sans SC', monospace",
      fontSize: 16,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(terminalRef.current);
    terminalInstance.current = term;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const baseUrl = `${protocol}//${host}`;
    const ws = new WebSocket(`${baseUrl}/api/admin/client/${uuid}/terminal`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      resizeTerminal();
      startHeartbeat();
    };

    const startHeartbeat = () => {
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            })
          );
        }
      }, 10000);
    };

    const stopHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(event.data);
        term.write(uint8Array);
      } else {
        term.write(event.data);
      }
      if (!firstBinary.current && event.data instanceof ArrayBuffer) {
        firstBinary.current = true;
        setTimeout(() => {
          const term = terminalInstance.current;
          if (term) {
            term.resize(term.cols - 1, term.rows);
          }
          resizeTerminal();
        }, 200);
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      term.write(`\n ${t("terminal.disconnect")}`);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(data);
        ws.send(uint8Array);
      }
    });

    const handleResize = () => {
      resizeTerminal();
    };
    window.addEventListener("resize", handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === "f" || e.key === "d") {
          searchAddon.findNext("");
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    const handleContextMenu = (e: MouseEvent) => {
      if (e.ctrlKey || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0;
      if (hasSelection) {
        e.preventDefault();
        const selectedText = selection.toString();
        navigator.clipboard.writeText(selectedText).finally(() => {
          term.focus();
          term.clearSelection();
        });
      } else {
        e.preventDefault();
        term.focus();
        navigator.clipboard.readText().then((text) => {
          const encoder = new TextEncoder();
          const uint8Array = encoder.encode(text.replace(/\r?\n/g, "\r"));
          ws.send(uint8Array);
        });
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      stopHeartbeat();
      term.dispose();
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [t, uuid, resizeTerminal]);

  // 移除对 leftWidth 的直接依赖，改用防抖
  useEffect(() => {
    if (!fitAddonRef.current) return;
    const debouncedResize = setTimeout(() => {
      resizeTerminal();
    }, 100);
    return () => clearTimeout(debouncedResize);
  }, [isClipboardOpen, resizeTerminal]);

  const sendCommand = useCallback((cmd: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoder = new TextEncoder();
      ws.send(encoder.encode(cmd + "\r"));
    }
  }, []);

  return (
    <TerminalContext.Provider
      value={{ terminal: terminalInstance.current, sendCommand }}
    >
      <Theme appearance="dark">
        <Toaster theme="dark" />
        <div className="absolute inset-x-0 top-4 flex justify-center items-center z-30">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            hidden={!callout}
          >
            <Callout.Root
              color="red"
              size="2"
              className="bg-red-50 backdrop-blur-sm border-2 border-red-800 rounded-lg"
            >
              <Callout.Icon>
                <TablerAlertTriangleFilled className="text-red-700" />
              </Callout.Icon>
              <Callout.Text className="text-red-400 font-medium">
                <Flex align="center" justify="between" gap="3">
                  <span>{t("warn_https")}</span>
                  <IconButton
                    variant="soft"
                    color="red"
                    size="1"
                    className="hover:bg-red-200/50 transition-colors"
                    onClick={() => setCallout(false)}
                  >
                    <Cross1Icon />
                  </IconButton>
                </Flex>
              </Callout.Text>
            </Callout.Root>
          </motion.div>
        </div>
        <Flex className="h-screen w-screen" direction="row" ref={containerRef}>
          <TerminalArea
            terminalRef={terminalRef}
            toggleClipboard={() => setIsClipboardOpen(!isClipboardOpen)}
            width={isClipboardOpen ? `${leftWidth}px` : "100%"}
            isOpen={isClipboardOpen}
          />
          {isClipboardOpen && <Divider onMouseDown={startDragging} />}
          {isClipboardOpen && <ClipboardPanel />}
        </Flex>
      </Theme>
    </TerminalContext.Provider>
  );
};

export default TerminalPage;
