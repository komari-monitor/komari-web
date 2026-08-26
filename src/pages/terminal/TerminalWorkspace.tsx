import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import CommandClipboardPanel from "./CommandClipboard";
import TerminalSession from "./TerminalSession";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { TerminalSessionApi } from "./TerminalSession";
import type { XtermjsSettings } from "@/hooks/useXtermjsSettings";
import type { TerminalTab } from "./terminalTypes";

export interface TerminalWorkspaceProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isClipboardOpen: boolean;
  leftWidth: number;
  tabs: TerminalTab[];
  activeTabId: string | null;
  sessionsReady: boolean;
  settings: XtermjsSettings;
  twoFaEnabled: boolean;
  disconnectMessage: string;
  searchOpen: boolean;
  searchTerm: string;
  searchResultIndex: number;
  searchResultCount: number;
  searchCaseSensitive: boolean;
  searchUseRegex: boolean;
  onSearchTermChange: (term: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onToggleCaseSensitive: () => void;
  onToggleUseRegex: () => void;
  onCloseSearch: () => void;
  onApiChange: (id: string, api: TerminalSessionApi | null) => void;
  onToggleClipboard: () => void;
  onStartDragging: (event: ReactMouseEvent | ReactTouchEvent) => void;
  onAdd: () => void;
}

const Divider = ({
  onMouseDown,
}: {
  onMouseDown: (event: ReactMouseEvent | ReactTouchEvent) => void;
}) => (
  <div
    className="km-terminal-divider h-full w-1.5 flex-[0_0_6px] cursor-col-resize bg-[#141414] transition-colors hover:bg-neutral-700"
    onMouseDown={onMouseDown}
    onTouchStart={onMouseDown}
    role="separator"
    aria-orientation="vertical"
  />
);

const ClipboardPanel = () => (
  <div className="km-terminal-clipboard h-full min-w-[300px] flex-1 overflow-hidden bg-[#121212] p-2 max-[640px]:min-w-[220px]">
    <CommandClipboardPanel className="h-full w-full" />
  </div>
);

const TerminalWorkspace = ({
  containerRef,
  isClipboardOpen,
  leftWidth,
  tabs,
  activeTabId,
  sessionsReady,
  settings,
  twoFaEnabled,
  disconnectMessage,
  searchOpen,
  searchTerm,
  searchResultIndex,
  searchResultCount,
  searchCaseSensitive,
  searchUseRegex,
  onSearchTermChange,
  onFindNext,
  onFindPrevious,
  onToggleCaseSensitive,
  onToggleUseRegex,
  onCloseSearch,
  onApiChange,
  onToggleClipboard,
  onStartDragging,
  onAdd,
}: TerminalWorkspaceProps) => {
  const { t } = useTranslation();

  return (
    <div
      ref={containerRef}
      className="km-terminal-body relative flex min-h-0 min-w-0 flex-1 bg-[#000000]"
    >
      <div
        className="km-terminal-main relative flex h-full min-h-0 min-w-[300px] flex-[0_0_auto] overflow-hidden max-[640px]:min-w-0"
        style={{
          width: isClipboardOpen ? `${leftWidth}px` : "100%",
        }}
      >
        <TerminalSearchBar
          open={searchOpen}
          searchTerm={searchTerm}
          resultIndex={searchResultIndex}
          resultCount={searchResultCount}
          caseSensitive={searchCaseSensitive}
          useRegex={searchUseRegex}
          onSearchTermChange={onSearchTermChange}
          onFindNext={onFindNext}
          onFindPrevious={onFindPrevious}
          onToggleCaseSensitive={onToggleCaseSensitive}
          onToggleUseRegex={onToggleUseRegex}
          onClose={onCloseSearch}
        />

        <div className="km-terminal-session-stack relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-[#000000]">
          {sessionsReady &&
            tabs.map((tab) => (
              <TerminalSession
                key={tab.id}
                uuid={tab.uuid}
                active={tab.id === activeTabId}
                settings={settings}
                twoFaEnabled={twoFaEnabled}
                disconnectMessage={disconnectMessage}
                onApiChange={(api) => onApiChange(tab.id, api)}
              />
            ))}
          {tabs.length === 0 && (
            <div className="km-terminal-empty-state flex h-full w-full flex-col items-center justify-center gap-3">
              <strong className="text-neutral-400">
                {t("terminal.tabs.empty_title")}
              </strong>
              <p className="max-w-sm text-center text-xs text-neutral-500">
                {t("terminal.tabs.empty_description")}
              </p>
              <button
                onClick={onAdd}
                className="rounded-[6px] border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
              >
                {t("terminal.tabs.empty_action")}
              </button>
            </div>
          )}
          {tabs.length > 0 && !sessionsReady && (
            <div className="km-terminal-loading-state absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2.5 text-sm text-neutral-400">
              {t("terminal.tabs.connecting")}
            </div>
          )}
        </div>
        <button
          type="button"
          className="km-terminal-clipboard-toggle absolute right-0 top-1/2 z-[4] flex h-[48px] w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-[5px] border-0 bg-[#2b2b2b] text-neutral-400 transition-colors hover:bg-[#383838] hover:text-white"
          onClick={onToggleClipboard}
          aria-label={
            isClipboardOpen
              ? t("common.close", "Close")
              : t("command_clipboard.title", "Command Clipboard")
          }
          title={
            isClipboardOpen
              ? t("common.close", "Close")
              : t("command_clipboard.title", "Command Clipboard")
          }
        >
          {isClipboardOpen ? "›" : "‹"}
        </button>
      </div>
      {isClipboardOpen && <Divider onMouseDown={onStartDragging} />}
      {isClipboardOpen && <ClipboardPanel />}
    </div>
  );
};

export default TerminalWorkspace;
