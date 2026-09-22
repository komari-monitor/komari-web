import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Code2, PanelRightClose, PanelRightOpen, SquareTerminal } from "lucide-react";
import FileManagerPanel from "./FileManagerPanel";
import TerminalSession from "./TerminalSession";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { TerminalSessionApi } from "./TerminalSession";
import type { TerminalTab } from "./terminalTypes";

export interface TerminalWorkspaceProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isSidebarOpen: boolean;
  leftWidth: number;
  tabs: TerminalTab[];
  clientsLoading: boolean;
  activeTabId: string | null;
  sessionsReady: boolean;
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
  onToggleSidebar: () => void;
  onStartDragging: (event: ReactMouseEvent | ReactTouchEvent) => void;
  onOpenTerminalMenu: () => void;
  onOpenWorkbenchMenu: () => void;
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

const TerminalWorkspace = ({
  containerRef,
  isSidebarOpen,
  leftWidth,
  tabs,
  clientsLoading,
  activeTabId,
  sessionsReady,
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
  onToggleSidebar,
  onStartDragging,
  onOpenTerminalMenu,
  onOpenWorkbenchMenu,
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
          width: isSidebarOpen ? `${leftWidth}px` : "100%",
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
                twoFaEnabled={twoFaEnabled}
                disconnectMessage={disconnectMessage}
                onApiChange={(api) => onApiChange(tab.id, api)}
              />
            ))}
          {tabs.length === 0 && (
            <div className="km-terminal-empty-state flex h-full w-full flex-col items-center justify-center gap-3">
              <strong className="text-neutral-400">
                {clientsLoading
                  ? t("terminal.tabs.loading_servers", "Loading servers...")
                  : t("terminal.tabs.empty_title")}
              </strong>
              <div className={`flex items-center gap-2 ${clientsLoading ? "opacity-40 pointer-events-none" : ""}`}>
                <button
                  onClick={onOpenTerminalMenu}
                  className="flex items-center gap-1.5 rounded-[6px] border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                >
                  <SquareTerminal size={14} />
                  {t("terminal.tabs.open_terminal", "Open terminal")}
                </button>
                <button
                  onClick={onOpenWorkbenchMenu}
                  className="flex items-center gap-1.5 rounded-[6px] border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                >
                  <Code2 size={14} />
                  {t("terminal.tabs.open_workbench", "Open workbench")}
                </button>
              </div>
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
          className="km-terminal-sidebar-toggle absolute right-0 top-1/2 z-[4] flex h-[48px] w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-[5px] border-0 bg-[#2b2b2b] text-neutral-400 transition-colors hover:bg-[#383838] hover:text-white"
          onClick={onToggleSidebar}
          aria-label={
            isSidebarOpen
              ? t("common.close", "Close")
              : t("file_manager.title", "File Manager")
          }
          title={
            isSidebarOpen
              ? t("common.close", "Close")
              : t("file_manager.title", "File Manager")
          }
        >
          {isSidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </div>
      {isSidebarOpen && <Divider onMouseDown={onStartDragging} />}
      <aside
        className={`${
          isSidebarOpen
            ? "flex h-full min-w-[300px] flex-1 flex-col overflow-hidden bg-[#121212] max-[640px]:min-w-[220px]"
            : "hidden"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <FileManagerPanel uuid={tabs.find((tab) => tab.id === activeTabId)?.uuid ?? null} />
        </div>
      </aside>
    </div>
  );
};

export default TerminalWorkspace;
