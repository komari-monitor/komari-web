import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CONTROL_MOTION, MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { getOSImage } from "@/utils/osImageHelper";
import FileManagerPanel from "./FileManagerPanel";
import TerminalBackgroundMedia from "./TerminalBackgroundMedia";
import TerminalSession from "./TerminalSession";
import TerminalPaneTree, {
  PersistentSessionPortal,
  type DragHoverTarget,
} from "./TerminalPaneTree";
import type { TerminalSessionApi } from "./TerminalSession";
import {
  findTopRightLeaf,
  type DropZone,
  type SplitZone,
  type TerminalPaneLeaf,
  type TerminalPaneNode,
} from "./splitTree";
import type { TerminalSettings } from "./terminalDefaults";
import {
  formatTabTitle,
  type CloseMode,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";

export interface TerminalPaneStageProps {
  tabs: TerminalTab[];
  paneTree: TerminalPaneNode;
  leaves: TerminalPaneLeaf[];
  activePaneId: string;
  clients: TerminalClient[];
  clientsLoading: boolean;
  editingTabId: string | null;
  renameDraft: string;
  serverMenuPaneId?: string | null;
  workbenchMenuPaneId?: string | null;
  resourceMonitorServers?: string[];
  tabLatencies: Record<string, number>;
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
  onLatencyChange: (id: string, latencyMs: number | null) => void;
  onTitleChange: (id: string, title: string) => void;
  onFocusPane: (paneId: string) => void;
  onActivateTab: (paneId: string, tabId: string) => void;
  onServerMenuOpenChange?: (paneId: string, open: boolean) => void;
  onWorkbenchMenuOpenChange?: (paneId: string, open: boolean) => void;
  onCreateSingleServerTab?: (paneId: string) => void;
  onOpenTerminalClient?: (client: TerminalClient, paneId: string) => void;
  onOpenWorkbenchClient?: (client: TerminalClient) => void;
  onStartRename: (tabId: string) => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (tabId: string) => void;
  onExportText: (tabId: string) => void;
  onFind: (tabId: string) => void;
  onOpenFileManager?: (tabId: string) => void;
  onOpenEditor?: (tabId: string) => void;
  onToggleResourceWindow?: (uuid: string) => void;
  onColor: (tabId: string, color: string | null) => void;
  onClose: (tabId: string, mode: CloseMode, paneId: string) => void;
  onReorderTab: (paneId: string, sourceId: string, targetId: string) => void;
  onSplitPane: (paneId: string, zone: SplitZone, tabId?: string) => void;
  onMoveTab: (
    tabId: string,
    targetPaneId: string,
    zone: DropZone,
    insertBeforeTabId?: string | null,
  ) => void;
  onResizeSplit: (splitId: string, ratio: number) => void;
  onResizeSplitEnd: () => void;
  terminalSettings: TerminalSettings;
  fontSize?: number;
  padding?: number;
  hasBackground?: boolean;
  tabBarPosition?: "top" | "right";
  singleServerMode?: boolean;
  onOpenSettings?: () => void;
  onHidePanel?: () => void;
}

export interface TerminalWorkspaceProps extends TerminalPaneStageProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isSidebarOpen: boolean;
  leftWidth: number;
  activeTabId: string | null;
  onToggleSidebar: () => void;
  onStartDragging: (event: ReactMouseEvent | ReactTouchEvent) => void;
}

const Divider = ({
  onMouseDown,
}: {
  onMouseDown: (event: ReactMouseEvent | ReactTouchEvent) => void;
}) => (
  <div
    className="km-terminal-divider relative z-[1] h-full w-1.5 flex-[0_0_6px] cursor-col-resize bg-[#141414]/80 transition-colors hover:bg-neutral-700"
    onMouseDown={onMouseDown}
    onTouchStart={onMouseDown}
    role="separator"
    aria-orientation="vertical"
  />
);

const computeDropZoneForBody = (
  rect: DOMRect,
  clientX: number,
  clientY: number,
  allowCenterMerge: boolean,
): DropZone => {
  const rx = Math.max(
    0,
    Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
  );
  const ry = Math.max(
    0,
    Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)),
  );
  const edgeThreshold = allowCenterMerge ? 0.28 : 0.5;
  const minEdge = Math.min(rx, 1 - rx, ry, 1 - ry);

  if (allowCenterMerge && minEdge > edgeThreshold) {
    return "center";
  }
  if (minEdge === rx) return "left";
  if (minEdge === 1 - rx) return "right";
  if (minEdge === ry) return "top";
  return "bottom";
};

const resolveHoverTargetAtPoint = (
  clientX: number,
  clientY: number,
  dragSourcePaneId: string | null,
  draggingTabId: string | null,
  scopeRoot: HTMLElement | null,
): DragHoverTarget | null => {
  const elements = document.elementsFromPoint(clientX, clientY);

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    if (scopeRoot && !scopeRoot.contains(el)) continue;

    const tabBarEl = el.closest<HTMLElement>("[data-pane-tabbar]");
    if (tabBarEl && (!scopeRoot || scopeRoot.contains(tabBarEl))) {
      const paneId = tabBarEl.dataset.paneTabbar;
      if (!paneId) continue;
      const isVertical =
        tabBarEl.dataset.paneTabbarOrientation === "vertical";

      let insertBeforeTabId: string | null = null;
      const tabEls = Array.from(
        tabBarEl.querySelectorAll<HTMLElement>("[data-tab-id]"),
      );
      for (const tabEl of tabEls) {
        const tid = tabEl.dataset.tabId;
        if (!tid || tid === draggingTabId) continue;
        const r = tabEl.getBoundingClientRect();
        const isBefore = isVertical
          ? clientY < r.top + r.height / 2
          : clientX < r.left + r.width / 2;
        if (isBefore) {
          insertBeforeTabId = tid;
          break;
        }
      }

      return {
        paneId,
        zone: "tabbar",
        insertBeforeTabId,
      };
    }

    const bodyEl = el.closest<HTMLElement>("[data-pane-body]");
    if (bodyEl && (!scopeRoot || scopeRoot.contains(bodyEl))) {
      const paneId = bodyEl.dataset.paneBody;
      if (!paneId) continue;
      const rect = bodyEl.getBoundingClientRect();
      const allowCenterMerge = dragSourcePaneId !== paneId;
      const zone = computeDropZoneForBody(
        rect,
        clientX,
        clientY,
        allowCenterMerge,
      );
      return { paneId, zone };
    }
  }

  return null;
};

export const TerminalPaneStage = ({
  tabs,
  paneTree,
  leaves,
  activePaneId,
  clients,
  clientsLoading,
  editingTabId,
  renameDraft,
  serverMenuPaneId,
  workbenchMenuPaneId,
  resourceMonitorServers,
  tabLatencies,
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
  onLatencyChange,
  onTitleChange,
  onFocusPane,
  onActivateTab,
  onServerMenuOpenChange,
  onWorkbenchMenuOpenChange,
  onCreateSingleServerTab,
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
  onReorderTab,
  onSplitPane,
  onMoveTab,
  onResizeSplit,
  onResizeSplitEnd,
  terminalSettings,
  fontSize,
  padding,
  hasBackground: hasBackgroundProp,
  tabBarPosition = "top",
  singleServerMode = false,
  onOpenSettings,
  onHidePanel,
}: TerminalPaneStageProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewportsByPane, setViewportsByPane] = useState<
    Record<string, HTMLDivElement | null>
  >({});
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragSourcePaneId, setDragSourcePaneId] = useState<string | null>(null);
  const [dragHoverTarget, setDragHoverTarget] =
    useState<DragHoverTarget | null>(null);
  const dragHoverRef = useRef<DragHoverTarget | null>(null);
  dragHoverRef.current = dragHoverTarget;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const tabsById = useMemo(
    () => new Map(tabs.map((tab) => [tab.id, tab])),
    [tabs],
  );

  const clientsByUuid = useMemo(
    () => new Map(clients.map((client) => [client.uuid, client])),
    [clients],
  );

  const topRightPaneId = useMemo(
    () => findTopRightLeaf(paneTree).id,
    [paneTree],
  );

  const tabOwnerLeafByTabId = useMemo(() => {
    const map = new Map<string, TerminalPaneLeaf>();
    for (const leaf of leaves) {
      for (const tabId of leaf.tabIds) {
        map.set(tabId, leaf);
      }
    }
    return map;
  }, [leaves]);

  const handleViewportMount = useCallback(
    (paneId: string, element: HTMLDivElement | null) => {
      setViewportsByPane((current) => {
        if (current[paneId] === element) return current;
        const next = { ...current };
        if (element) {
          next[paneId] = element;
        } else {
          delete next[paneId];
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!draggingTabId) {
      setDragHoverTarget(null);
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextTarget = resolveHoverTargetAtPoint(
        event.clientX,
        event.clientY,
        dragSourcePaneId,
        draggingTabId,
        stageRef.current,
      );
      setDragHoverTarget((prev) => {
        if (
          prev?.paneId === nextTarget?.paneId &&
          prev?.zone === nextTarget?.zone &&
          prev?.insertBeforeTabId === nextTarget?.insertBeforeTabId
        ) {
          return prev;
        }
        return nextTarget;
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [dragSourcePaneId, draggingTabId]);

  const resetDragState = useCallback(() => {
    setDraggingTabId(null);
    setDragSourcePaneId(null);
    setDragHoverTarget(null);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const tabId = String(event.active.id);
    const paneId =
      (event.active.data.current?.paneId as string | undefined) ?? null;
    setDraggingTabId(tabId);
    setDragSourcePaneId(paneId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const tabId = String(event.active.id);
      const sourcePane =
        (event.active.data.current?.paneId as string | undefined) ??
        dragSourcePaneId;
      const hover = dragHoverRef.current;
      resetDragState();

      if (!sourcePane) return;

      // Released inside the same pane's tab bar -> reorder within this tab bar
      if (hover && hover.paneId === sourcePane && hover.zone === "tabbar") {
        const overId = event.over ? String(event.over.id) : null;
        const overPaneId =
          (event.over?.data.current?.paneId as string | undefined) ?? null;
        if (overId && overId !== tabId && overPaneId === sourcePane) {
          onReorderTab(sourcePane, tabId, overId);
        } else if (hover.insertBeforeTabId && hover.insertBeforeTabId !== tabId) {
          onReorderTab(sourcePane, tabId, hover.insertBeforeTabId);
        }
        return;
      }

      // Released outside source tab bar -> split or move to target pane without changing remaining tabs' order
      if (hover) {
        onMoveTab(
          tabId,
          hover.paneId,
          hover.zone,
          hover.zone === "tabbar" ? hover.insertBeforeTabId : null,
        );
      }
    },
    [dragSourcePaneId, onMoveTab, onReorderTab, resetDragState],
  );

  const draggingTab = draggingTabId ? tabsById.get(draggingTabId) : undefined;
  const draggingClient = draggingTab
    ? clientsByUuid.get(draggingTab.uuid)
    : undefined;
  const hasBackground =
    hasBackgroundProp ?? Boolean(terminalSettings.backgroundUrl.trim());
  const effectiveFontSize = fontSize ?? terminalSettings.fontSize;

  const dragOverlayContent = (
    <DragOverlay dropAnimation={null} zIndex={100020}>
      {draggingTab ? (
        <div
          className="pointer-events-none flex h-8 max-w-[220px] items-center gap-2 rounded-[8px] border border-sky-400/60 bg-[#252526]/95 px-3 text-xs font-medium text-white shadow-2xl backdrop-blur-md"
          style={
            draggingTab.color
              ? { backgroundColor: draggingTab.color }
              : undefined
          }
        >
          <img
            src={getOSImage(draggingClient?.os || "")}
            alt=""
            draggable={false}
            className="h-3.5 w-3.5 shrink-0 object-contain"
          />
          <span className="truncate">
            {formatTabTitle(draggingTab, draggingClient?.name)}
          </span>
        </div>
      ) : null}
    </DragOverlay>
  );

  return (
    <div
      ref={stageRef}
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDragState}
      >
        <TerminalPaneTree
          node={paneTree}
          activePaneId={activePaneId}
          topRightPaneId={topRightPaneId}
          hasMultiplePanes={leaves.length > 1}
          hasBackground={hasBackground}
          tabBarPosition={tabBarPosition}
          singleServerMode={singleServerMode}
          tabsById={tabsById}
          clients={clients}
          clientsLoading={clientsLoading}
          editingTabId={editingTabId}
          renameDraft={renameDraft}
          serverMenuPaneId={serverMenuPaneId}
          workbenchMenuPaneId={workbenchMenuPaneId}
          resourceMonitorServers={resourceMonitorServers}
          tabLatencies={tabLatencies}
          sessionsReady={sessionsReady}
          draggingTabId={draggingTabId}
          dragSourcePaneId={dragSourcePaneId}
          dragHoverTarget={dragHoverTarget}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          searchResultIndex={searchResultIndex}
          searchResultCount={searchResultCount}
          searchCaseSensitive={searchCaseSensitive}
          searchUseRegex={searchUseRegex}
          onSearchTermChange={onSearchTermChange}
          onFindNext={onFindNext}
          onFindPrevious={onFindPrevious}
          onToggleCaseSensitive={onToggleCaseSensitive}
          onToggleUseRegex={onToggleUseRegex}
          onCloseSearch={onCloseSearch}
          onFocusPane={onFocusPane}
          onActivateTab={onActivateTab}
          onServerMenuOpenChange={onServerMenuOpenChange}
          onWorkbenchMenuOpenChange={onWorkbenchMenuOpenChange}
          onCreateSingleServerTab={onCreateSingleServerTab}
          onOpenTerminalClient={onOpenTerminalClient}
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
          onToggleResourceWindow={onToggleResourceWindow}
          onColor={onColor}
          onClose={onClose}
          onSplitPane={onSplitPane}
          onResizeSplit={onResizeSplit}
          onResizeSplitEnd={onResizeSplitEnd}
          onViewportMount={handleViewportMount}
          onOpenSettings={onOpenSettings}
          onHidePanel={onHidePanel}
        />

        {typeof document !== "undefined"
          ? createPortal(dragOverlayContent, document.body)
          : dragOverlayContent}
      </DndContext>

      {sessionsReady &&
        tabs.map((tab) => {
          const ownerLeaf = tabOwnerLeafByTabId.get(tab.id);
          const isPaneActiveTab = ownerLeaf?.activeTabId === tab.id;
          const targetViewport = ownerLeaf
            ? (viewportsByPane[ownerLeaf.id] ?? null)
            : null;
          return (
            <PersistentSessionPortal
              key={tab.id}
              targetViewport={targetViewport}
              onFocusPane={
                ownerLeaf ? () => onFocusPane(ownerLeaf.id) : undefined
              }
            >
              <TerminalSession
                uuid={tab.uuid}
                active={Boolean(isPaneActiveTab)}
                initialRequestId={tab.requestId}
                fontFamily={terminalSettings.fontFamily}
                fontSize={effectiveFontSize}
                convertEol={terminalSettings.convertEol}
                hasBackground={hasBackground}
                padding={padding}
                twoFaEnabled={twoFaEnabled}
                disconnectMessage={disconnectMessage}
                onApiChange={(api) => onApiChange(tab.id, api)}
                onLatencyChange={(latency) => onLatencyChange(tab.id, latency)}
                onTitleChange={(title) => onTitleChange(tab.id, title)}
              />
            </PersistentSessionPortal>
          );
        })}
    </div>
  );
};

const TerminalWorkspace = ({
  containerRef,
  isSidebarOpen,
  leftWidth,
  activeTabId,
  onToggleSidebar,
  onStartDragging,
  ...stageProps
}: TerminalWorkspaceProps) => {
  const { t } = useTranslation();
  const { tabs, clients, terminalSettings } = stageProps;

  const activeTab = useMemo(
    () => (activeTabId ? tabs.find((tab) => tab.id === activeTabId) : undefined),
    [activeTabId, tabs],
  );
  const activeClient = useMemo(
    () =>
      activeTab
        ? clients.find((client) => client.uuid === activeTab.uuid)
        : undefined,
    [activeTab, clients],
  );
  const activeServerName =
    activeClient?.name || activeTab?.title || activeTab?.uuid || "";
  const backgroundUrl = terminalSettings.backgroundUrl.trim();
  const hasBackground = Boolean(backgroundUrl);

  return (
    <div
      ref={containerRef}
      className="km-terminal-body relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#000000]"
    >
      {hasBackground && (
        <TerminalBackgroundMedia
          url={backgroundUrl}
          offsetX={terminalSettings.backgroundOffsetX}
          offsetY={terminalSettings.backgroundOffsetY}
          scale={terminalSettings.backgroundScale}
          opacity={terminalSettings.backgroundOpacity}
          blur={terminalSettings.backgroundBlur}
        />
      )}
      <div
        className="km-terminal-main relative z-[1] flex h-full min-h-0 min-w-[300px] flex-[0_0_auto] overflow-hidden max-[640px]:min-w-0"
        style={{
          width: isSidebarOpen ? `${leftWidth}px` : "100%",
        }}
      >
        <TerminalPaneStage {...stageProps} hasBackground={hasBackground} />
        <motion.button
          type="button"
          whileTap={CONTROL_MOTION.tap}
          transition={CONTROL_MOTION.transition}
          className="km-terminal-sidebar-toggle absolute right-0 top-1/2 z-30 flex h-[48px] w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-[5px] border-0 bg-[#2b2b2b] text-neutral-400 transition-colors hover:bg-[#383838] hover:text-white"
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
        </motion.button>
      </div>
      {isSidebarOpen && <Divider onMouseDown={onStartDragging} />}
      {/*
        文件栏始终挂载、收起时只隐藏（与原实现一致）：用 AnimatePresence 卸载会让
        FileManagerPanel 每次打开都重新拉目录、丢失当前路径与展开状态。
        surface 层：打开时从右侧轻推入；同一个元素用 animate 驱动，快速开合可被打断。
      */}
      <motion.aside
        initial={false}
        animate={isSidebarOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
        transition={{ x: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fade }}
        className={`${
          isSidebarOpen
            ? "relative z-[1] flex h-full min-w-[300px] flex-1 flex-col overflow-hidden border-l border-white/[0.08] bg-[#121212]/58 backdrop-blur-[6px] max-[640px]:min-w-[220px]"
            : "hidden"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <FileManagerPanel
            uuid={activeTab?.uuid ?? null}
            serverName={activeServerName}
            serverOs={activeClient?.os}
            terminalSettings={terminalSettings}
          />
        </div>
      </motion.aside>
    </div>
  );
};

export default TerminalWorkspace;
