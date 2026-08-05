import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { Terminal } from "@xterm/xterm";
import type { ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  IconButton,
  TextField,
  Theme,
} from "@radix-ui/themes";


import { useTranslation } from "react-i18next";
import { Cross1Icon } from "@radix-ui/react-icons";
import { TablerAlertTriangleFilled } from "../../components/Icones/Tabler";
import CommandClipboardPanel from "@/pages/terminal/CommandClipboard";
import { Toaster } from "@/components/ui/sonner";
import { TerminalContext } from "@/contexts/TerminalContext";
import {
  isTransparentBackground,
  defaultXtermjsSettings,
  type XtermjsSettings,
  useXtermjsSettings,
} from "@/hooks/useXtermjsSettings";
import { motion } from "framer-motion";
import throttle from "lodash/throttle";
interface TerminalAreaProps {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  toggleClipboard: () => void;
  width: number | string;
  isOpen: boolean;
  appearance: CSSProperties;
}
const TerminalArea: React.FC<TerminalAreaProps> = ({
  terminalRef,
  toggleClipboard,
  width,
  isOpen,
  appearance,
}) => {
  const { t } = useTranslation();
  return (
    <div
      className="km-terminal-container terminal-page relative flex justify-center flex-col h-full min-w-128"
      style={{ width, ...appearance }}
    >
      <div className="km-terminal-toolbar terminal-xterm-host m-0 w-full h-full">
        <div ref={terminalRef} className="km-terminal-xterm h-full w-full" />
      </div>
      <div
        className="absolute right-0 top-1/2 transform -translate-y-1/2 flex items-center justify-center bg-accent-4 hover:bg-accent-6 text-white cursor-pointer rounded-l-full w-6 h-12 z-20"
        onClick={toggleClipboard}
        role="button"
        tabIndex={0}
        aria-label={isOpen ? t("common.close", "Close") : t("command_clipboard.title", "Command Clipboard")}
        title={isOpen ? t("common.close", "Close") : t("command_clipboard.title", "Command Clipboard")}
      >
        {isOpen ? ">" : "<"}
      </div>
    </div>
  );
};

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
  <div className="km-terminal-clipboard h-screen p-2 min-w-64" style={{ flex: 1 }}>
    <CommandClipboardPanel className="h-full w-full" />
  </div>
);

const TerminalPage = () => {
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
  } = useXtermjsSettings();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resolvedSettingsRef = useRef<XtermjsSettings>(defaultXtermjsSettings);
  const initializedUuidRef = useRef<string | null>(null);
  const params = new URLSearchParams(window.location.search);
  const uuid = params.get("uuid");
  const [t] = useTranslation();
  const disconnectMessageRef = useRef(t("terminal.disconnect"));
  const firstBinary = useRef(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(window.innerWidth * 0.7);
  const draggingRef = useRef(false);
  const fitAddonRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [callout, setCallout] = useState(
    window.location.protocol !== "https:"
  );
  const [settingsResolved, setSettingsResolved] = useState(false);
  const [settingsResolutionError, setSettingsResolutionError] =
    useState<Error | null>(null);
  const [appearance, setAppearance] = useState<CSSProperties>({});
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaResolved, setTwoFaResolved] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpInput, setOtpInput] = useState("");


  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((data) => {
        setTwoFaEnabled(Boolean(data?.["2fa_enabled"]));
      })
      .catch(() => {
        setTwoFaEnabled(false);
      })
      .finally(() => {
        setTwoFaResolved(true);
      });
  }, []);

  useEffect(() => {
    if (settingsLoading || settingsResolved) {
      return;
    }

    const resolvedSettings = settingsError
      ? defaultXtermjsSettings
      : settings;

    resolvedSettingsRef.current = resolvedSettings;
    setAppearance({
      "--xterm-padding": `${resolvedSettings.terminalPadding}px`,
    } as CSSProperties);
    setSettingsResolutionError(settingsError);
    setSettingsResolved(true);
  }, [settings, settingsError, settingsLoading, settingsResolved]);

  useEffect(() => {
    disconnectMessageRef.current = t("terminal.disconnect");
  }, [t]);

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
  const onMouseMove = useMemo(
    () =>
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
      return;
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

  // Trigger OTP dialog when 2FA is enabled
  useEffect(() => {
    if (!settingsResolved || !twoFaResolved) return;
    if (twoFaEnabled && otpCode === null) {
      setOtpDialogOpen(true);
    }
  }, [settingsResolved, twoFaResolved, twoFaEnabled, otpCode]);

  // Connection effect - waits for OTP if 2FA is enabled
  useEffect(() => {
    if (!settingsResolved || !twoFaResolved || uuid === null || !terminalRef.current) return;
    if (initializedUuidRef.current === uuid) return;
    if (twoFaEnabled && otpCode === null) return; // Wait for OTP

    initializedUuidRef.current = uuid;
    firstBinary.current = false;
    const otpQuery = twoFaEnabled && otpCode ? `?2fa_code=${encodeURIComponent(otpCode)}` : "";


    const snapshot = resolvedSettingsRef.current;
    const terminalOptions: Partial<ITerminalOptions> = {
      cursorBlink: snapshot.terminalOptions.cursorBlink,
      convertEol: snapshot.terminalOptions.convertEol,
      fontFamily: snapshot.terminalOptions.fontFamily,
      fontSize: snapshot.terminalOptions.fontSize,
      macOptionIsMeta: snapshot.terminalOptions.macOptionIsMeta,
      scrollback: snapshot.terminalOptions.scrollback,
    };

    if (snapshot.terminalOptions.theme !== undefined) {
      terminalOptions.theme = snapshot.terminalOptions.theme;
    }
    if (
      snapshot.transparentBackground ||
      isTransparentBackground(snapshot.terminalOptions.theme?.background)
    ) {
      terminalOptions.allowTransparency = true;
    }

    const term = new Terminal(terminalOptions);
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(terminalRef.current);
    terminalInstance.current = term;

    const customCssStyle = document.createElement("style");
    customCssStyle.id = "xtermjs-custom-css";
    customCssStyle.textContent = snapshot.customCss;
    document.head.appendChild(customCssStyle);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resizeTerminal();
          })
        : null;

    if (resizeObserver && terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    let isMounted = true;
    let disposed = false;
    let firstBinaryTimeout: ReturnType<typeof setTimeout> | null = null;

    document.fonts?.ready?.then(() => {
      if (isMounted && !disposed) {
        resizeTerminal();
      }
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const baseUrl = `${protocol}//${host}`;
    const ws = new WebSocket(`${baseUrl}/api/admin/client/${uuid}/terminal${otpQuery}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (disposed) {
        return;
      }
      resizeTerminal();
      startHeartbeat();
    };

    const startHeartbeat = () => {
      if (disposed) {
        return;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
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
      if (disposed) {
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(event.data);
        term.write(uint8Array);
      } else {
        term.write(event.data);
      }
      if (!firstBinary.current && event.data instanceof ArrayBuffer) {
        firstBinary.current = true;
        firstBinaryTimeout = setTimeout(() => {
          if (disposed) return;
          const term = terminalInstance.current;
          if (term) {
            term.resize(term.cols - 1, term.rows);
          }
          resizeTerminal();
        }, 200);
      }
    };

    ws.onclose = () => {
      if (disposed) {
        return;
      }
      stopHeartbeat();
      term.write(`\n ${disconnectMessageRef.current}`);
    };

    const termDataDisposable = term.onData((data) => {
      if (disposed) {
        return;
      }
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
          if (disposed) {
            return;
          }
          term.focus();
          term.clearSelection();
        });
      } else {
        e.preventDefault();
        term.focus();
        navigator.clipboard.readText().then((text) => {
          if (disposed || ws.readyState !== WebSocket.OPEN) {
            return;
          }
          const encoder = new TextEncoder();
          const uint8Array = encoder.encode(text.replace(/\r?\n/g, "\r"));
          ws.send(uint8Array);
        });
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      disposed = true;
      isMounted = false;
      stopHeartbeat();
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      resizeObserver?.disconnect();
      if (firstBinaryTimeout !== null) {
        clearTimeout(firstBinaryTimeout);
      }
      termDataDisposable.dispose();
      term.dispose();
      if (customCssStyle.parentNode) {
        customCssStyle.parentNode.removeChild(customCssStyle);
      }
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      if (initializedUuidRef.current === uuid) {
        initializedUuidRef.current = null;
      }
      terminalInstance.current = null;
      wsRef.current = null;
      fitAddonRef.current = null;
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [settingsResolved, twoFaEnabled, twoFaResolved, otpCode, uuid, resizeTerminal, t]);

  const submitOtp = useCallback(() => {
    if (!otpInput) return;
    setOtpCode(otpInput);
    setOtpDialogOpen(false);
  }, [otpInput]);


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
      <Theme appearance="dark" className="km-page-terminal">
        <Toaster theme="dark" />
        {settingsResolutionError ? (
          <div className="absolute left-4 top-4 z-30 max-w-[32rem]">
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
                  <span>
                    xterm settings fallback: {settingsResolutionError.message}
                  </span>
                </Flex>
              </Callout.Text>
            </Callout.Root>
          </div>
        ) : null}
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
            appearance={appearance}
          />
          {isClipboardOpen && <Divider onMouseDown={startDragging} />}
          {isClipboardOpen && <ClipboardPanel />}
        </Flex>
        <Dialog.Root
          open={otpDialogOpen}
          onOpenChange={(open) => {
            // 阻止在未输入验证码时关闭
            if (!open && otpCode === null) {
              return;
            }
            setOtpDialogOpen(open);
          }}
        >
          <Dialog.Content maxWidth="400px">
            <Dialog.Title>{t("login.two_factor")}</Dialog.Title>
            <Dialog.Description size="2" mb="3">
              {t("account.2fa_otp_input_prompt")}
            </Dialog.Description>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitOtp();
              }}
            >
              <Flex direction="column" gap="3">
                <TextField.Root
                  type="number"
                  autoFocus
                  value={otpInput}
                  placeholder="123456"
                  onChange={(e) => setOtpInput(e.target.value)}
                />
                <Flex gap="3" justify="end">
                  <Button
                    variant="soft"
                    color="gray"
                    type="button"
                    onClick={() => {
                      window.location.href = "/";
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={!otpInput}>
                    {t("common.confirm")}
                  </Button>
                </Flex>
              </Flex>
            </form>
          </Dialog.Content>
        </Dialog.Root>
      </Theme>

    </TerminalContext.Provider>
  );
};

export default TerminalPage;
