import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Code2, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import { MOTION_SPRING } from "@/lib/motion";
import TerminalTabBar from "./TerminalTabBar";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type {
  DropZone,
  SplitDirection,
  SplitZone,
  TerminalPaneLeaf,
  TerminalPaneNode,
} from "./splitTree";
import type { CloseMode, TerminalClient, TerminalTab } from "./terminalTypes";

export interface DragHoverTarget {
  paneId: string;
  zone: DropZone;
  insertBeforeTabId?: string | null;
}

export interface TerminalPaneTreeProps {
  node: TerminalPaneNode;
  activePaneId: string;
  topRightPaneId: string;
  hasMultiplePanes: boolean;
  hasBackground?: boolean;
  tabsById: Map<string, TerminalTab>;
  clients: TerminalClient[];
  clientsLoading: boolean;
  editingTabId: string | null;
  renameDraft: string;
  serverMenuPaneId: string | null;
  workbenchMenuPaneId: string | null;
  resourceMonitorServers: string[];
  tabLatencies: Record<string, number>;
  sessionsReady: boolean;
  draggingTabId: string | null;
  dragSourcePaneId: string | null;
  dragHoverTarget: DragHoverTarget | null;
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
  onFocusPane: (paneId: string) => void;
  onActivateTab: (paneId: string, tabId: string) => void;
  onServerMenuOpenChange: (paneId: string, open: boolean) => void;
  onWorkbenchMenuOpenChange: (paneId: string, open: boolean) => void;
  onOpenTerminalClient: (client: TerminalClient, paneId: string) => void;
  onOpenWorkbenchClient: (client: TerminalClient) => void;
  onStartRename: (tabId: string) => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (tabId: string) => void;
  onExportText: (tabId: string) => void;
  onFind: (tabId: string) => void;
  onOpenFileManager: (tabId: string) => void;
  onOpenEditor: (tabId: string) => void;
  onToggleResourceWindow: (uuid: string) => void;
  onColor: (tabId: string, color: string | null) => void;
  onClose: (tabId: string, mode: CloseMode, paneId: string) => void;
  onSplitPane: (paneId: string, zone: SplitZone, tabId?: string) => void;
  onResizeSplit: (splitId: string, ratio: number) => void;
  onResizeSplitEnd: () => void;
  onViewportMount: (paneId: string, element: HTMLDivElement | null) => void;
  onOpenSettings: () => void;
}

const DROP_OVERLAY_CLASS: Record<Exclude<DropZone, "tabbar">, string> = {
  left: "inset-y-0 left-0 w-1/2 border-r-2 border-sky-400/90 bg-sky-500/20",
  right: "inset-y-0 right-0 w-1/2 border-l-2 border-sky-400/90 bg-sky-500/20",
  top: "inset-x-0 top-0 h-1/2 border-b-2 border-sky-400/90 bg-sky-500/20",
  bottom: "inset-x-0 bottom-0 h-1/2 border-t-2 border-sky-400/90 bg-sky-500/20",
  center: "inset-0 border-2 border-sky-400/90 bg-sky-500/15",
};

const SplitDivider = ({
  direction,
  hasBackground = false,
  onPointerDown,
  onDoubleClick,
}: {
  direction: SplitDirection;
  hasBackground?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}) => {
  const isRow = direction === "row";
  return (
    <div
      role="separator"
      aria-orientation={isRow ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={`group relative z-10 shrink-0 select-none touch-none transition-colors hover:bg-sky-500/60 active:bg-sky-500/80 ${
        hasBackground ? "bg-white/[0.10]" : "bg-[#141414]"
      } ${
        isRow ? "h-full w-1 cursor-col-resize" : "h-1 w-full cursor-row-resize"
      }`}
    >
      <div
        className={`absolute ${
          isRow ? "-inset-x-1 inset-y-0" : "inset-x-0 -inset-y-1"
        }`}
      />
    </div>
  );
};

const LeafPaneView = ({
  leaf,
  props,
}: {
  leaf: TerminalPaneLeaf;
  props: TerminalPaneTreeProps;
}) => {
  const { t } = useTranslation();
  const {
    activePaneId,
    topRightPaneId,
    hasMultiplePanes,
    hasBackground = false,
    tabsById,
    clients,
    clientsLoading,
    editingTabId,
    renameDraft,
    serverMenuPaneId,
    workbenchMenuPaneId,
    resourceMonitorServers,
    tabLatencies,
    sessionsReady,
    draggingTabId,
    dragSourcePaneId,
    dragHoverTarget,
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
    onFocusPane,
    onActivateTab,
    onServerMenuOpenChange,
    onWorkbenchMenuOpenChange,
    onOpenTerminalClient,
    onOpenWorkbenchClient,
    onStartRename,
    onDraftChange,
    onCommitRename,
    onCancelRename,
    onDuplicate,
    onExportText,
    onFind,
    onOpenFileManager,
    onOpenEditor,
    onToggleResourceWindow,
    onColor,
    onClose,
    onSplitPane,
    onViewportMount,
    onOpenSettings,
  } = props;

  const isFocusedPane = leaf.id === activePaneId;
  const leafRef = useRef<HTMLDivElement>(null);
  const onFocusPaneRef = useRef(onFocusPane);
  onFocusPaneRef.current = onFocusPane;

  useEffect(() => {
    const el = leafRef.current;
    if (!el) return;
    const handleActivate = () => {
      onFocusPaneRef.current(leaf.id);
    };
    el.addEventListener("pointerdown", handleActivate, true);
    el.addEventListener("mousedown", handleActivate, true);
    el.addEventListener("touchstart", handleActivate, {
      capture: true,
      passive: true,
    });
    el.addEventListener("focusin", handleActivate);
    return () => {
      el.removeEventListener("pointerdown", handleActivate, true);
      el.removeEventListener("mousedown", handleActivate, true);
      el.removeEventListener("touchstart", handleActivate, true);
      el.removeEventListener("focusin", handleActivate);
    };
  }, [leaf.id]);

  const paneTabs = useMemo(
    () =>
      leaf.tabIds
        .map((id) => tabsById.get(id))
        .filter((item): item is TerminalTab => Boolean(item)),
    [leaf.tabIds, tabsById],
  );

  const viewportCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      onViewportMount(leaf.id, el);
    },
    [leaf.id, onViewportMount],
  );

  const isDragging = Boolean(draggingTabId);
  const isHoveringThisPane = dragHoverTarget?.paneId === leaf.id;
  const hoverZone = isHoveringThisPane ? dragHoverTarget?.zone : null;

  // When dragging a tab out of its original tab bar (to a split zone or another pane),
  // freeze sort transforms in the source tab bar so remaining tabs never shift order.
  const freezeSortTransform =
    isDragging &&
    dragSourcePaneId === leaf.id &&
    !(isHoveringThisPane && hoverZone === "tabbar");

  // Hide drop preview if dropping would be a no-op (single tab dragged onto its own pane)
  const isNoOpSelfDrop =
    isDragging &&
    dragSourcePaneId === leaf.id &&
    paneTabs.length <= 1;

  const bodyPreviewZone: Exclude<DropZone, "tabbar"> | null =
    isDragging &&
    isHoveringThisPane &&
    hoverZone &&
    hoverZone !== "tabbar" &&
    !isNoOpSelfDrop
      ? hoverZone
      : null;

  return (
    <div
      ref={leafRef}
      data-pane-leaf={leaf.id}
      onPointerDownCapture={() => {
        if (!isFocusedPane) {
          onFocusPane(leaf.id);
        }
      }}
      className={`km-terminal-pane relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${
        hasBackground ? "bg-transparent" : "bg-[#000000]"
      } ${
        hasMultiplePanes
          ? isFocusedPane
            ? "ring-1 ring-inset ring-sky-500/45"
            : hasBackground
              ? "ring-1 ring-inset ring-white/[0.06]"
              : "ring-1 ring-inset ring-neutral-800/80"
          : ""
      }`}
    >
      <TerminalTabBar
        paneId={leaf.id}
        isFocusedPane={isFocusedPane}
        hasMultiplePanes={hasMultiplePanes}
        hasBackground={hasBackground}
        isDraggingTab={isDragging && !isNoOpSelfDrop}
        isTabBarDropTarget={Boolean(
          isHoveringThisPane && hoverZone === "tabbar" && !isNoOpSelfDrop,
        )}
        freezeSortTransform={freezeSortTransform}
        tabs={paneTabs}
        clients={clients}
        clientsLoading={clientsLoading}
        activeTabId={leaf.activeTabId}
        editingTabId={editingTabId}
        renameDraft={renameDraft}
        serverMenuOpen={serverMenuPaneId === leaf.id}
        onServerMenuOpenChange={(open) => onServerMenuOpenChange(leaf.id, open)}
        workbenchMenuOpen={workbenchMenuPaneId === leaf.id}
        onWorkbenchMenuOpenChange={(open) =>
          onWorkbenchMenuOpenChange(leaf.id, open)
        }
        onActivate={(tabId) => onActivateTab(leaf.id, tabId)}
        onOpenTerminalClient={(client) => onOpenTerminalClient(client, leaf.id)}
        onOpenWorkbenchClient={onOpenWorkbenchClient}
        onStartRename={onStartRename}
        onDraftChange={onDraftChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onDuplicate={onDuplicate}
        onExportText={onExportText}
        onFind={onFind}
        onOpenFileManager={onOpenFileManager}
        onOpenEditor={onOpenEditor}
        resourceMonitorServers={resourceMonitorServers}
        tabLatencies={tabLatencies}
        onToggleResourceWindow={onToggleResourceWindow}
        onColor={onColor}
        onClose={(tabId, mode) => onClose(tabId, mode, leaf.id)}
        onSplit={(zone, tabId) => onSplitPane(leaf.id, zone, tabId)}
        onFocusPane={() => onFocusPane(leaf.id)}
        onOpenSettings={
          leaf.id === topRightPaneId ? onOpenSettings : undefined
        }
      />

      <div
        data-pane-body={leaf.id}
        className={`km-terminal-pane-body relative flex min-h-0 min-w-0 flex-1 overflow-hidden transition-colors duration-150 ${
          hasBackground
            ? hasMultiplePanes && !isFocusedPane
              ? "bg-black/38"
              : "bg-transparent"
            : "bg-[#000000]"
        }`}
      >
        {isFocusedPane && (
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
        )}

        <div
          ref={viewportCallbackRef}
          className={`km-terminal-session-stack relative h-full min-h-0 min-w-0 flex-1 overflow-hidden ${
            hasBackground ? "bg-transparent" : "bg-[#000000]"
          }`}
        >
          <AnimatePresence initial={false}>
            {paneTabs.length === 0 && (
              <motion.div
                key="terminal-empty-state"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={MOTION_SPRING.soft}
                className="km-terminal-empty-state flex h-full w-full flex-col items-center justify-center gap-3"
              >
                {clientsLoading ? (
                  <Loading compact />
                ) : (
                  <strong className="text-neutral-400">
                    {t("terminal.tabs.empty_title")}
                  </strong>
                )}
                <div
                  className={`flex items-center gap-2 ${
                    clientsLoading ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onServerMenuOpenChange(leaf.id, true)}
                    className="flex items-center gap-1.5 rounded-[6px] border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                  >
                    <SquareTerminal size={14} />
                    {t("terminal.tabs.open_terminal", "Open terminal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onWorkbenchMenuOpenChange(leaf.id, true)}
                    className="flex items-center gap-1.5 rounded-[6px] border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                  >
                    <Code2 size={14} />
                    {t("terminal.tabs.open_workbench", "Open workbench")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {paneTabs.length > 0 && !sessionsReady && (
              <motion.div
                key="terminal-loading-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION_SPRING.soft}
                className="km-terminal-loading-state absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2.5 text-sm text-neutral-400"
              >
                <Loading compact />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {hasMultiplePanes && (
          <div
            className={`pointer-events-none absolute inset-0 z-[4] transition-opacity duration-150 ${
              isFocusedPane
                ? "opacity-0"
                : hasBackground
                  ? "bg-black/15 opacity-100"
                  : "bg-black/22 opacity-100"
            }`}
            aria-hidden="true"
          />
        )}

        {bodyPreviewZone && (
          <div
            className={`pointer-events-none absolute z-20 rounded-[4px] backdrop-blur-[1px] transition-all duration-100 ${DROP_OVERLAY_CLASS[bodyPreviewZone]}`}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

const SplitNodeView = ({
  splitNode,
  props,
}: {
  splitNode: Extract<TerminalPaneNode, { type: "split" }>;
  props: TerminalPaneTreeProps;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
  } | null>(null);

  const isRow = splitNode.direction === "row";

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current = { pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (
        !dragStateRef.current ||
        dragStateRef.current.pointerId !== event.pointerId ||
        !containerRef.current
      ) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const total = isRow ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isRow
        ? event.clientX - rect.left
        : event.clientY - rect.top;
      props.onResizeSplit(splitNode.id, offset / total);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (
        !dragStateRef.current ||
        dragStateRef.current.pointerId !== event.pointerId
      ) {
        return;
      }
      dragStateRef.current = null;
      document.body.style.userSelect = "";
      props.onResizeSplitEnd();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isRow, props, splitNode.id]);

  const firstPercent = `${(splitNode.ratio * 100).toFixed(3)}%`;
  const secondPercent = `${((1 - splitNode.ratio) * 100).toFixed(3)}%`;

  return (
    <div
      ref={containerRef}
      className={`relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden ${
        isRow ? "flex-row" : "flex-col"
      }`}
    >
      <div
        className="flex min-h-0 min-w-0 overflow-hidden"
        style={{
          flexBasis: firstPercent,
          flexGrow: splitNode.ratio,
          flexShrink: 1,
        }}
      >
        <TerminalPaneTree {...props} node={splitNode.first} />
      </div>
      <SplitDivider
        direction={splitNode.direction}
        hasBackground={props.hasBackground}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => {
          props.onResizeSplit(splitNode.id, 0.5);
          props.onResizeSplitEnd();
        }}
      />
      <div
        className="flex min-h-0 min-w-0 overflow-hidden"
        style={{
          flexBasis: secondPercent,
          flexGrow: 1 - splitNode.ratio,
          flexShrink: 1,
        }}
      >
        <TerminalPaneTree {...props} node={splitNode.second} />
      </div>
    </div>
  );
};

export const TerminalPaneTree = (props: TerminalPaneTreeProps) => {
  if (props.node.type === "leaf") {
    return <LeafPaneView leaf={props.node} props={props} />;
  }
  return <SplitNodeView splitNode={props.node} props={props} />;
};

/**
 * Keeps a TerminalSession mounted once in a persistent host element and moves
 * that host element into whichever pane viewport currently owns the tab,
 * so splitting, merging, or moving tabs across panes never resets xterm/WebSocket.
 */
export const PersistentSessionPortal = ({
  targetViewport,
  onFocusPane,
  children,
}: {
  targetViewport: HTMLDivElement | null;
  onFocusPane?: () => void;
  children: React.ReactNode;
}) => {
  const onFocusPaneRef = useRef(onFocusPane);
  onFocusPaneRef.current = onFocusPane;

  const [portalHost] = useState(() => {
    const el = document.createElement("div");
    el.className = "km-terminal-session-slot absolute inset-0 h-full w-full";
    return el;
  });

  useEffect(() => {
    const activate = () => {
      onFocusPaneRef.current?.();
    };
    portalHost.addEventListener("pointerdown", activate, true);
    portalHost.addEventListener("mousedown", activate, true);
    portalHost.addEventListener("touchstart", activate, {
      capture: true,
      passive: true,
    });
    portalHost.addEventListener("focusin", activate);
    return () => {
      portalHost.removeEventListener("pointerdown", activate, true);
      portalHost.removeEventListener("mousedown", activate, true);
      portalHost.removeEventListener("touchstart", activate, true);
      portalHost.removeEventListener("focusin", activate);
    };
  }, [portalHost]);

  useEffect(() => {
    if (!targetViewport) {
      if (portalHost.parentNode) {
        portalHost.parentNode.removeChild(portalHost);
      }
      return;
    }
    if (portalHost.parentNode !== targetViewport) {
      targetViewport.appendChild(portalHost);
    }
    return () => {
      if (portalHost.parentNode === targetViewport) {
        targetViewport.removeChild(portalHost);
      }
    };
  }, [portalHost, targetViewport]);

  return createPortal(children, portalHost);
};

export default TerminalPaneTree;
