import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Terminal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  defaultXtermjsSettings,
  useXtermjsSettings,
} from "@/hooks/useXtermjsSettings";
import type { XtermjsSettings } from "@/hooks/useXtermjsSettings";
import TerminalSession from "./TerminalSession";

interface EditorTerminalPanelProps {
  uuid: string;
  onClose: () => void;
}

const MIN_TERMINAL_HEIGHT = 100;
const MAX_TERMINAL_HEIGHT = 600;
const EDITOR_TERMINAL_FONT_SIZE = 12;

const EditorTerminalPanel = ({ uuid, onClose }: EditorTerminalPanelProps) => {
  const { t } = useTranslation();
  const { settings, error } = useXtermjsSettings();
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [height, setHeight] = useState(180);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  const resolvedSettings = useMemo<XtermjsSettings>(() => {
    const baseSettings = error ? defaultXtermjsSettings : settings;
    return {
      ...baseSettings,
      terminalOptions: {
        ...baseSettings.terminalOptions,
        fontFamily: baseSettings.terminalOptions.fontFamily,
        fontSize: Math.min(
          baseSettings.terminalOptions.fontSize ?? EDITOR_TERMINAL_FONT_SIZE,
          EDITOR_TERMINAL_FONT_SIZE,
        ),
      },
      terminalPadding: Math.min(baseSettings.terminalPadding, 8),
    };
  }, [error, settings]);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/me")
      .then((response) => response.json())
      .then((data: { "2fa_enabled"?: boolean }) => {
        if (mounted) setTwoFaEnabled(Boolean(data?.["2fa_enabled"]));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settings.customCss) return;
    const style = document.createElement("style");
    style.id = `custom-xtermjs-style-editor-${uuid}`;
    style.textContent = settings.customCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [settings.customCss, uuid]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dragRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    setHeight(
      Math.round(
        Math.max(
          MIN_TERMINAL_HEIGHT,
          Math.min(
            MAX_TERMINAL_HEIGHT,
            resizeState.startHeight + resizeState.startY - event.clientY,
          ),
        ),
      ),
    );
  };

  const handleResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dragRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(resizeState.pointerId)) {
      event.currentTarget.releasePointerCapture(resizeState.pointerId);
    }
  };

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden border-t border-[#2b2b2b] bg-[#181818]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("terminal.title", "Terminal")}
        className="h-1 w-full shrink-0 cursor-row-resize touch-none bg-transparent transition-colors hover:bg-[#55a7e0]/60"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#2b2b2b] px-2">
        <Terminal size={14} className="shrink-0 text-[#55a7e0]" />
        <span className="min-w-0 flex-1 truncate text-xs text-[#cccccc]">
          {t("terminal.title", "Terminal")}
        </span>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent text-[#bdbdbd] hover:bg-[#3a3d41] hover:text-white"
          onClick={onClose}
          title={t("common.close", "Close")}
        >
          <X size={14} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <TerminalSession
          uuid={uuid}
          active
          settings={resolvedSettings}
          twoFaEnabled={twoFaEnabled}
          disconnectMessage={t("terminal.disconnect", "Connection lost")}
          onApiChange={() => {}}
        />
      </div>
    </div>
  );
};

export default EditorTerminalPanel;
