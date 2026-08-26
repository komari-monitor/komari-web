import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Tooltip } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getOSImage } from "@/utils/osImageHelper";
import type { TerminalClient, TerminalTab } from "./terminalTypes";

interface TabButtonProps {
  tab: TerminalTab;
  client: TerminalClient | undefined;
  index: number;
  active: boolean;
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
  index,
  active,
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
  const { t } = useTranslation();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const activeBgColor = tab.color || "#000000";
  const tabBackgroundColor = active
    ? activeBgColor
    : tab.color || "rgba(255, 255, 255, 0.08)";
  const inactiveOverlay = !active && tab.color
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(255, 255, 255, 0)";
  const tabBackgroundStyle: CSSProperties = {
    backgroundColor: tabBackgroundColor,
    backgroundImage: inactiveOverlay
      ? `linear-gradient(${inactiveOverlay}, ${inactiveOverlay})`
      : undefined,
  };
  const shortcutNum = index < 10 ? (index === 9 ? 0 : index + 1) : null;
  const serverName = client?.name || tab.title;

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
      content={tooltipContent}
      delayDuration={300}
      className="!bg-[#202020] !text-white"
    >
      <div
        role="tab"
        aria-selected={active}
        className={`group relative flex h-full w-full min-w-0 cursor-pointer items-center gap-2 px-3 select-none transition-colors duration-150 ${
          active
            ? "z-[3] text-white"
            : "z-[1] text-neutral-400 hover:z-[2] hover:text-neutral-200"
        }`}
        onClick={onActivate}
        onDoubleClick={(event) => {
          event.preventDefault();
          onStartRename();
        }}
        >
          <div
            className={`pointer-events-none absolute inset-0 rounded-t-[10px] overflow-visible transition-all duration-150 ${
              active
                ? "opacity-100"
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
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
            aria-label={t("terminal.rename_tab")}
          />
        ) : (
          <span
            className={`relative z-[1] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs ${
              active ? "font-medium text-white" : "font-normal"
            }`}
          >
            {tab.title}
          </span>
        )}

        <button
          type="button"
          className="relative z-[1] ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-current opacity-40 transition-opacity duration-150 hover:bg-white/20 hover:opacity-100"
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
