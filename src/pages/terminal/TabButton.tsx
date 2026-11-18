import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Tooltip } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getOSImage } from "@/utils/osImageHelper";
import {
  formatTabTitle,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";

interface TabButtonProps {
  tab: TerminalTab;
  client: TerminalClient | undefined;
  latencyMs?: number;
  index: number;
  active: boolean;
  isFocusedPane?: boolean;
  hasBackground?: boolean;
  showGuideTarget?: boolean;
  editing: boolean;
  draft: string;
  onActivate: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onClose: () => void;
}

const TabButton = ({
  tab,
  client,
  latencyMs,
  index,
  active,
  isFocusedPane = true,
  hasBackground = false,
  showGuideTarget = active,
  editing,
  draft,
  onActivate,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onClose,
}: TabButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const editingStartedAtRef = useRef(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (!editing) {
      return;
    }
    editingStartedAtRef.current = performance.now();
    inputRef.current?.focus();
    inputRef.current?.select();
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const isHighlighted = active && isFocusedPane;
  const activeBgColor = tab.color || (hasBackground ? "rgba(255, 255, 255, 0.14)" : "#000000");
  const tabBackgroundColor = isHighlighted
    ? activeBgColor
    : active
    ? tab.color || (hasBackground ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.05)")
    : tab.color || (hasBackground ? "rgba(255, 255, 255, 0.09)" : "rgba(255, 255, 255, 0.08)");
  const inactiveOverlay = !isHighlighted && tab.color
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(255, 255, 255, 0)";
  const tabBackgroundStyle: CSSProperties = {
    backgroundColor: tabBackgroundColor,
    backgroundImage: inactiveOverlay
      ? `linear-gradient(${inactiveOverlay}, ${inactiveOverlay})`
      : undefined,
  };
  const shortcutNum = index < 10 ? (index === 9 ? 0 : index + 1) : null;
  const displayTitle = formatTabTitle(tab, client?.name);
  const serverName = displayTitle || client?.name || tab.title;
  const latencyToneClass =
    latencyMs === undefined
      ? ""
      : latencyMs < 100
      ? "text-emerald-400"
      : latencyMs < 250
      ? "text-amber-400"
      : "text-rose-400";

  const tooltipContent = (
    <span className="flex flex-col items-center justify-center gap-0.5 rounded-[5px] border border-neutral-700 bg-[#202020] px-2 py-1 text-center leading-tight">
      <span className="font-medium text-white">{serverName}</span>
      {shortcutNum !== null && (
        <span className="text-[10px] italic text-neutral-300">
          Ctrl+Alt+{shortcutNum}
        </span>
      )}
    </span>
  );

  return (
    <Tooltip
      open={editing ? false : undefined}
      content={tooltipContent}
      delayDuration={300}
      className="!bg-[#202020] !text-white"
    >
      {/*
        标签本身不加缩放/位移类反馈：tab 是贴着窗口顶边的整块区域，
        任何 scale 都会让它看起来被压扁或拉伸（还会带动内部图标和文字模糊）。
        选中/悬停的反馈已经由下面那层背景的 opacity + 颜色过渡完成，
        新增/关闭/重排的补位动画由 TerminalTabBar 的 layout 负责。
      */}
      <div
        data-guide={showGuideTarget ? "terminal-tab" : undefined}
        role="tab"
        aria-selected={isHighlighted}
        className={`group relative flex h-full w-full min-w-0 cursor-pointer items-center gap-2 px-3 select-none transition-colors duration-[var(--km-dur-fast)] ease-[var(--km-ease-standard)] ${
          isHighlighted
            ? "z-[3] text-white"
            : active
            ? "z-[2] text-neutral-300 hover:text-white"
            : hasBackground
            ? "z-[1] text-neutral-300 hover:z-[2] hover:text-white"
            : "z-[1] text-neutral-400 hover:z-[2] hover:text-neutral-200"
        }`}
        onMouseDown={(event) => {
          if (editing && event.target !== inputRef.current) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
        onClick={() => {
          if (!editing) {
            onActivate();
          }
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onStartRename();
        }}
        >
          <div
            className={`pointer-events-none absolute inset-0 rounded-t-[10px] overflow-visible transition-[opacity,background-color,border-color,box-shadow] duration-[var(--km-dur-fast)] ease-[var(--km-ease-standard)] ${
              hasBackground && isHighlighted && !tab.color
                ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                : ""
            } ${
              isHighlighted
                ? "opacity-100"
              : active
              ? "opacity-80 group-hover:opacity-100"
              : tab.color
              ? "opacity-90 group-hover:opacity-100"
              : "opacity-0 group-hover:opacity-100"
            }`}
            style={tabBackgroundStyle}
          />
        <img
          src={getOSImage(client?.os || "")}
          alt=""
          draggable={false}
          className="relative z-[1] h-3.5 w-3.5 shrink-0 object-contain"
        />

        {editing ? (
          <input
            ref={inputRef}
            className="relative z-[1] h-5 min-w-0 flex-1 rounded-[3px] border border-blue-500/70 bg-[#111111] px-1.5 text-xs text-white outline-none"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={(event) => {
              const related = event.relatedTarget;
              if (
                performance.now() - editingStartedAtRef.current < 150 ||
                (related instanceof HTMLElement &&
                  related.closest(
                    "[data-radix-popper-content-wrapper], [data-slot='dropdown-menu-trigger']",
                  ))
              ) {
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  inputRef.current?.select();
                });
                return;
              }
              onCommitRename();
            }}
            aria-label={t("terminal.rename_tab")}
          />
        ) : (
          <span
            className={`relative z-[1] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs ${
              isHighlighted ? "font-medium text-white" : "font-normal"
            }`}
          >
            {displayTitle}
          </span>
        )}

        {!editing && latencyMs !== undefined && (
          <span
            className={`relative z-[1] shrink-0 font-mono text-[10px] tabular-nums opacity-85 ${latencyToneClass}`}
          >
            {latencyMs}ms
          </span>
        )}

        <button
          type="button"
          className="relative z-[1] ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-current opacity-40 transition-opacity duration-[var(--km-dur-fast)] ease-[var(--km-ease-standard)] hover:bg-white/20 hover:opacity-100"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={t("terminal.close_tab")}
        >
          <X size={11} strokeWidth={2.2} />
        </button>
      </div>
    </Tooltip>
  );
};

export default TabButton;
