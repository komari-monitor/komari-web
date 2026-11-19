import Loading from "@/components/loading";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Plus,
  Server,
  Settings,
  SquareTerminal,
  Terminal,
  X,
} from "lucide-react";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { getOSImage } from "@/utils/osImageHelper";
import {
  CONTENT_MOTION,
  CONTROL_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import TabButton from "./TabButton";
import TabMenu from "./TabMenu";
import type { SplitZone } from "./splitTree";
import {
  ACTIONS_RESERVED_WIDTH,
  MAX_TAB_WIDTH,
  MIN_TAB_WIDTH,
  SCROLL_BUTTONS_WIDTH,
  TAB_ACTION_CLASS_NAME,
  TAB_SCROLL_BUTTON_CLASS_NAME,
  TAB_SEPARATOR_CLASS_NAME,
  type CloseMode,
  type ContextMenuPosition,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";

export interface TerminalTabBarProps {
  paneId: string;
  position?: "top" | "right";
  singleServerMode?: boolean;
  isFocusedPane?: boolean;
  hasMultiplePanes?: boolean;
  hasBackground?: boolean;
  isDraggingTab?: boolean;
  isTabBarDropTarget?: boolean;
  freezeSortTransform?: boolean;
  tabs: TerminalTab[];
  clients: TerminalClient[];
  clientsLoading: boolean;
  activeTabId: string | null;
  editingTabId: string | null;
  renameDraft: string;
  serverMenuOpen?: boolean;
  onServerMenuOpenChange?: (open: boolean) => void;
  workbenchMenuOpen?: boolean;
  onWorkbenchMenuOpenChange?: (open: boolean) => void;
  onActivate: (id: string) => void;
  onCreateSingleServerTab?: () => void;
  onOpenTerminalClient?: (client: TerminalClient) => void;
  onOpenWorkbenchClient?: (client: TerminalClient) => void;
  onStartRename: (id: string) => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (id: string) => void;
  onExportText: (id: string) => void;
  onFind: (id: string) => void;
  onOpenFileManager?: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  resourceMonitorServers?: string[];
  tabLatencies: Record<string, number>;
  onToggleResourceWindow?: (uuid: string) => void;
  onColor: (id: string, color: string | null) => void;
  onClose: (id: string, mode: CloseMode) => void;
  onSplit?: (zone: SplitZone, tabId?: string) => void;
  onFocusPane?: () => void;
  onOpenSettings?: () => void;
  onHidePanel?: () => void;
}

interface SortableTabItemProps {
  paneId: string;
  orientation: "horizontal" | "vertical";
  reducedMotion: boolean;
  isFocusedPane: boolean;
  hasBackground: boolean;
  freezeSortTransform: boolean;
  tab: TerminalTab;
  client: TerminalClient | undefined;
  latencyMs?: number;
  index: number;
  total: number;
  tabWidth: number;
  /** 容器宽度测量完成前不做宽度补间，避免首帧从最小宽度「长」到实际宽度 */
  animateWidth: boolean;
  isActive: boolean;
  editingTabId: string | null;
  renameDraft: string;
  contextMenuTabId: string | null;
  contextMenuPosition: ContextMenuPosition | null;
  setContextMenuTabId: (id: string | null) => void;
  setContextMenuPosition: (pos: ContextMenuPosition | null) => void;
  onActivate: (id: string) => void;
  onStartRename: (id: string) => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (id: string) => void;
  onExportText: (id: string) => void;
  onFind: (id: string) => void;
  onOpenFileManager?: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  resourceWindowOpen: boolean;
  onToggleResourceWindow?: (uuid: string) => void;
  onColor: (id: string, color: string | null) => void;
  onClose: (id: string, mode: CloseMode) => void;
  onSplit?: (zone: SplitZone, tabId?: string) => void;
}

const VERTICAL_TAB_HEIGHT = 28;

const SortableTabItem = ({
  paneId,
  orientation,
  reducedMotion,
  isFocusedPane,
  hasBackground,
  freezeSortTransform,
  tab,
  client,
  latencyMs,
  index,
  total,
  tabWidth,
  animateWidth,
  isActive,
  editingTabId,
  renameDraft,
  contextMenuTabId,
  contextMenuPosition,
  setContextMenuTabId,
  setContextMenuPosition,
  onActivate,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onExportText,
  onFind,
  onOpenFileManager,
  onOpenEditor,
  resourceWindowOpen,
  onToggleResourceWindow,
  onColor,
  onClose,
  onSplit,
}: SortableTabItemProps) => {
  const isVertical = orientation === "vertical";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tab.id,
    disabled: editingTabId === tab.id,
    data: {
      type: "terminal-tab",
      paneId,
      tabId: tab.id,
    },
  });

  /*
    分工（避免两套动画抢同一个属性）：
    - transform 只归 dnd-kit：拖拽中的跟手位移与落下后的补位都由它的 CSS transition 完成；
      这里绝不能再加 motion 的 layout，否则落下后 motion 会从旧位置再播一遍位移。
      当标签被拖离原标签栏准备分屏时，freezeSortTransform 置为 true，原栏其他标签立即恢复原顺序，不影响排序。
    - width / height / opacity 归 motion 弹簧：新开标签从 0 展开、关闭时收拢，邻居随真实布局顺势补位；
      窗口缩放导致的标签宽度变化也走同一条弹簧，中途再变会保留速度继续追赶。
  */
  const effectiveTransform = freezeSortTransform && !isDragging ? null : transform;
  const style = {
    transform: CSS.Translate.toString(effectiveTransform),
    transition,
    zIndex: isDragging ? 20 : isActive ? 3 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      data-pane-id={paneId}
      data-tab-id={tab.id}
      initial={isVertical ? { height: 0, opacity: 0 } : { width: 0, opacity: 0 }}
      animate={
        isVertical
          ? { height: VERTICAL_TAB_HEIGHT, opacity: isDragging ? 0.4 : 1 }
          : { width: tabWidth, opacity: isDragging ? 0.4 : 1 }
      }
      exit={isVertical ? { height: 0, opacity: 0 } : { width: 0, opacity: 0 }}
      transition={
        isVertical
          ? {
              height: reducedMotion ? { duration: 0 } : MOTION_SPRING.layout,
              opacity: MOTION_TRANSITION.fade,
            }
          : {
              width: animateWidth ? MOTION_SPRING.layout : { duration: 0 },
              opacity: MOTION_TRANSITION.fade,
            }
      }
      className={
        isVertical
          ? "relative w-full shrink-0 overflow-hidden"
          : "relative h-full shrink-0 overflow-hidden"
      }
      {...attributes}
      {...listeners}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenuTabId(tab.id);
        setContextMenuPosition({
          x: event.clientX,
          y: event.clientY,
        });
      }}
    >
      <TabMenu
        tab={tab}
        index={index}
        total={total}
        open={contextMenuTabId === tab.id}
        position={contextMenuPosition}
        orientation={orientation}
        resourceWindowOpen={resourceWindowOpen}
        onOpenChange={(open) => {
          if (open) {
            setContextMenuTabId(tab.id);
            return;
          }
          // Keep the anchor in place for the Radix close animation.
          if (contextMenuTabId === tab.id) {
            setContextMenuTabId(null);
          }
        }}
        onRename={() => onStartRename(tab.id)}
        onDuplicate={() => onDuplicate(tab.id)}
        onExportText={() => onExportText(tab.id)}
        onFind={() => onFind(tab.id)}
        onOpenFileManager={
          onOpenFileManager ? () => onOpenFileManager(tab.id) : undefined
        }
        onOpenEditor={onOpenEditor ? () => onOpenEditor(tab.id) : undefined}
        onToggleResourceWindow={
          onToggleResourceWindow
            ? () => onToggleResourceWindow(tab.uuid)
            : undefined
        }
        onColor={(color) => onColor(tab.id, color)}
        onClose={(mode) => onClose(tab.id, mode)}
        onSplit={onSplit ? (zone) => onSplit(zone, tab.id) : undefined}
      />
      <TabButton
        tab={tab}
        client={client}
        latencyMs={latencyMs}
        index={index}
        active={isActive}
        isFocusedPane={isFocusedPane}
        hasBackground={hasBackground}
        orientation={orientation}
        showShortcutHint={!isVertical}
        showGuideTarget={!isVertical && isActive && isFocusedPane}
        editing={editingTabId === tab.id}
        draft={renameDraft}
        onActivate={() => onActivate(tab.id)}
        onStartRename={() => onStartRename(tab.id)}
        onDraftChange={onDraftChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onClose={() => onClose(tab.id, "current")}
      />
    </motion.div>
  );
};

const TerminalTabBar = ({
  paneId,
  position = "top",
  singleServerMode = false,
  isFocusedPane = true,
  hasMultiplePanes = false,
  hasBackground = false,
  isDraggingTab = false,
  isTabBarDropTarget = false,
  freezeSortTransform = false,
  tabs,
  clients,
  clientsLoading,
  activeTabId,
  editingTabId,
  renameDraft,
  serverMenuOpen = false,
  onServerMenuOpenChange,
  workbenchMenuOpen = false,
  onWorkbenchMenuOpenChange,
  resourceMonitorServers = [],
  tabLatencies,
  onToggleResourceWindow,
  onActivate,
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
  onColor,
  onClose,
  onSplit,
  onFocusPane,
  onOpenSettings,
  onHidePanel,
}: TerminalTabBarProps) => {
  const isVertical = position === "right";
  const { t } = useTranslation();
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] =
    useState<ContextMenuPosition | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const reducedMotion = useKmReducedMotion();
  // 首次测量后的下一帧再允许宽度补间：已有标签挂载时直接到位，之后新开/关闭/缩放才走弹簧
  const [widthMeasured, setWidthMeasured] = useState(false);
  useEffect(() => {
    if (containerWidth <= 0 || widthMeasured) return;
    const frame = requestAnimationFrame(() => setWidthMeasured(true));
    return () => cancelAnimationFrame(frame);
  }, [containerWidth, widthMeasured]);
  const animateTabWidth = widthMeasured && !reducedMotion;

  const clientsByUuid = useMemo(
    () => new Map(clients.map((client) => [client.uuid, client])),
    [clients],
  );

  const orderedClients = useMemo(
    () =>
      [...clients].sort(
        (left, right) => (left.weight ?? 0) - (right.weight ?? 0),
      ),
    [clients],
  );

  useEffect(() => {
    const element = tabBarRef.current;
    if (!element) return;

    const measure = () => {
      setContainerWidth(element.clientWidth);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const reservedActionsWidth =
    ACTIONS_RESERVED_WIDTH + (onOpenSettings ? 32 : 0);
  const totalAvailableForTabs = Math.max(
    0,
    containerWidth - reservedActionsWidth - 20,
  );
  const minRequiredTabsWidth = tabs.length * MIN_TAB_WIDTH;
  const hasOverflow =
    tabs.length > 0 && minRequiredTabsWidth > totalAvailableForTabs;
  const effectiveAvailableWidth = hasOverflow
    ? Math.max(0, totalAvailableForTabs - SCROLL_BUTTONS_WIDTH)
    : totalAvailableForTabs;
  const tabWidth = tabs.length
    ? hasOverflow
      ? MIN_TAB_WIDTH
      : Math.min(
          MAX_TAB_WIDTH,
          Math.max(MIN_TAB_WIDTH, effectiveAvailableWidth / tabs.length),
        )
    : MIN_TAB_WIDTH;

  const updateScrollState = useCallback(() => {
    const element = tabsScrollRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 2);
    setCanScrollRight(
      element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    if (!hasOverflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const frame = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(frame);
  }, [hasOverflow, tabWidth, tabs.length, updateScrollState]);

  useEffect(() => {
    if (isVertical) {
      if (!activeTabId || !tabsScrollRef.current) return;
      const tabEls =
        tabsScrollRef.current.querySelectorAll<HTMLElement>("[data-tab-id]");
      for (const el of tabEls) {
        if (el.dataset.tabId === activeTabId) {
          el.scrollIntoView({ block: "nearest" });
          break;
        }
      }
      return;
    }
    if (!hasOverflow || !activeTabId) return;
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (activeIndex === -1 || !tabsScrollRef.current) return;

    const element = tabsScrollRef.current;
    const tabLeft = activeIndex * tabWidth;
    const tabRight = tabLeft + tabWidth;

    if (tabLeft < element.scrollLeft) {
      element.scrollTo({ left: tabLeft, behavior: "smooth" });
    } else if (tabRight > element.scrollLeft + element.clientWidth) {
      element.scrollTo({
        left: tabRight - element.clientWidth,
        behavior: "smooth",
      });
    }
  }, [activeTabId, hasOverflow, isVertical, tabWidth, tabs]);

  const scrollTabs = useCallback(
    (direction: -1 | 1) => {
      const element = tabsScrollRef.current;
      if (!element) return;
      element.scrollBy({
        left: direction * Math.max(element.clientWidth * 0.75, tabWidth * 2),
        behavior: "smooth",
      });
    },
    [tabWidth],
  );

  const handleTabsWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!hasOverflow || (event.deltaX === 0 && event.deltaY === 0)) return;
      event.preventDefault();
      tabsScrollRef.current?.scrollBy({
        left: event.deltaX || event.deltaY,
        behavior: "auto",
      });
    },
    [hasOverflow],
  );

  const handlePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        editingTabId ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, [contenteditable='true']"))
      ) {
        return;
      }
      onFocusPane?.();
    },
    [editingTabId, onFocusPane],
  );

  const lastTab = tabs[tabs.length - 1];
  const lastTabIsActive = lastTab?.id === activeTabId;
  const showActionLeadingSeparator = tabs.length > 0 && !lastTabIsActive;
  const tabBarSurfaceClass = isVertical
    ? isTabBarDropTarget && isDraggingTab
      ? hasBackground
        ? "border-l border-white/[0.08] bg-sky-500/20 ring-1 ring-inset ring-sky-500/70 backdrop-blur-[12px]"
        : "border-l border-[#2b2b2b] bg-[#1a2634] ring-1 ring-inset ring-sky-500/70"
      : hasBackground
        ? hasMultiplePanes && !isFocusedPane
          ? "border-l border-white/[0.06] bg-[#080808]/55 backdrop-blur-[12px]"
          : "border-l border-white/[0.08] bg-[#121212]/35 backdrop-blur-[12px]"
        : hasMultiplePanes && !isFocusedPane
          ? "border-l border-[#2b2b2b] bg-[#141414]"
          : "border-l border-[#2b2b2b] bg-[#181818]"
    : isTabBarDropTarget && isDraggingTab
      ? hasBackground
        ? "border-b border-white/[0.08] bg-sky-500/20 ring-1 ring-inset ring-sky-500/70 backdrop-blur-[12px]"
        : "bg-[#1a2634] ring-1 ring-inset ring-sky-500/70"
      : hasBackground
        ? hasMultiplePanes && !isFocusedPane
          ? "border-b border-white/[0.06] bg-[#080808]/55 backdrop-blur-[12px]"
          : "border-b border-white/[0.08] bg-[#121212]/35 backdrop-blur-[12px]"
        : hasMultiplePanes && !isFocusedPane
          ? "bg-[#181818]"
          : "bg-[#1e1e1e]";

  if (isVertical) {
    return (
      <div
        ref={tabBarRef}
        data-pane-tabbar={paneId}
        data-pane-tabbar-orientation="vertical"
        onPointerDownCapture={handlePointerDownCapture}
        className={`km-terminal-tab-bar km-terminal-tab-bar-vertical relative flex h-full w-[176px] max-w-[42%] shrink-0 select-none flex-col transition-colors ${tabBarSurfaceClass}`}
        role="tablist"
        aria-orientation="vertical"
        aria-label={t("terminal.tabs.title")}
      >
        {hasMultiplePanes && isFocusedPane && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[2px] bg-sky-500/80"
            aria-hidden="true"
          />
        )}
        <div
          className={`flex h-8 shrink-0 items-center gap-1 px-2 ${
            hasBackground
              ? "border-b border-white/[0.08]"
              : "border-b border-[#2b2b2b]"
          }`}
        >
          <Terminal size={13} className="shrink-0 text-[#55a7e0]" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-300">
            {t("terminal.title", "Terminal")}
          </span>
          {singleServerMode && onCreateSingleServerTab && (
            <motion.button
              type="button"
              whileTap={CONTROL_MOTION.tap}
              transition={CONTROL_MOTION.transition}
              onClick={onCreateSingleServerTab}
              className="km-pressable inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              title={t("terminal.tabs.new_tab", "New tab")}
              aria-label={t("terminal.tabs.new_tab", "New tab")}
            >
              <Plus size={14} />
            </motion.button>
          )}
          {onHidePanel && (
            <motion.button
              type="button"
              whileTap={CONTROL_MOTION.tap}
              transition={CONTROL_MOTION.transition}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onHidePanel}
              className="km-pressable inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              title={t("common.close", "Close")}
              aria-label={t("common.close", "Close")}
            >
              <X size={14} />
            </motion.button>
          )}
        </div>

        <SortableContext
          items={tabs.map((tab) => tab.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={tabsScrollRef}
            className="km-terminal-tabs-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]"
          >
            <AnimatePresence initial={false}>
              {tabs.map((tab, index) => {
                const client = clientsByUuid.get(tab.uuid);
                const isActive = tab.id === activeTabId;

                return (
                  <SortableTabItem
                    key={tab.id}
                    paneId={paneId}
                    orientation="vertical"
                    reducedMotion={reducedMotion}
                    isFocusedPane={isFocusedPane}
                    hasBackground={hasBackground}
                    freezeSortTransform={freezeSortTransform}
                    tab={tab}
                    client={client}
                    latencyMs={tabLatencies[tab.id]}
                    index={index}
                    total={tabs.length}
                    tabWidth={tabWidth}
                    animateWidth={animateTabWidth}
                    isActive={isActive}
                    editingTabId={editingTabId}
                    renameDraft={renameDraft}
                    contextMenuTabId={contextMenuTabId}
                    contextMenuPosition={contextMenuPosition}
                    resourceWindowOpen={resourceMonitorServers.includes(
                      tab.uuid,
                    )}
                    setContextMenuTabId={setContextMenuTabId}
                    setContextMenuPosition={setContextMenuPosition}
                    onActivate={onActivate}
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
                    onSplit={onSplit}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </SortableContext>
      </div>
    );
  }

  return (
    <div
      ref={tabBarRef}
      data-pane-tabbar={paneId}
      data-pane-tabbar-orientation="horizontal"
      onPointerDownCapture={handlePointerDownCapture}
      className={`km-terminal-tab-bar relative flex h-10 min-w-0 flex-[0_0_40px] select-none items-end px-2 transition-colors ${tabBarSurfaceClass}`}
      role="tablist"
      aria-label={t("terminal.tabs.title")}
    >
      {hasMultiplePanes && isFocusedPane && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[2px] bg-sky-500/80"
          aria-hidden="true"
        />
      )}
      <AnimatePresence initial={false}>
        {hasOverflow && (
          <motion.button
            key="scroll-left"
            type="button"
            initial={CONTENT_MOTION.item.initial}
            animate={CONTENT_MOTION.item.animate}
            exit={CONTENT_MOTION.item.exit}
            transition={MOTION_SPRING.snappy}
            whileTap={CONTROL_MOTION.tap}
            className={`km-terminal-tab-scroll-button mb-1 ${TAB_SCROLL_BUTTON_CLASS_NAME}`}
            onClick={() => scrollTabs(-1)}
            disabled={!canScrollLeft}
            title={t("terminal.tabs.scroll_left", "Scroll tabs left")}
            aria-label={t("terminal.tabs.scroll_left", "Scroll tabs left")}
          >
            <ChevronLeft size={15} />
          </motion.button>
        )}
      </AnimatePresence>

      <SortableContext
        items={tabs.map((tab) => tab.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={tabsScrollRef}
          onScroll={updateScrollState}
          onWheel={handleTabsWheel}
          className="km-terminal-tabs-scroll flex h-9 min-w-0 flex-initial flex-row items-end overflow-x-auto overflow-y-hidden px-2.5 ![scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/*
            标签增删用默认同步模式：退出的标签仍占位并把宽度收到 0，
            邻居通过真实的 flex 布局顺势补位，不需要 layout/transform。
          */}
          <AnimatePresence initial={false}>
            {tabs.map((tab, index) => {
              const client = clientsByUuid.get(tab.uuid);
              const isActive = tab.id === activeTabId;
              const previousTab = tabs[index - 1];
              const showSeparator =
                index > 0 && previousTab?.id !== activeTabId && !isActive;

              return (
                <Fragment key={tab.id}>
                  {showSeparator && (
                    <div
                      className={TAB_SEPARATOR_CLASS_NAME}
                      aria-hidden="true"
                    />
                  )}
                  <SortableTabItem
                    paneId={paneId}
                    orientation="horizontal"
                    reducedMotion={reducedMotion}
                    isFocusedPane={isFocusedPane}
                    hasBackground={hasBackground}
                    freezeSortTransform={freezeSortTransform}
                    tab={tab}
                    client={client}
                    latencyMs={tabLatencies[tab.id]}
                    index={index}
                    total={tabs.length}
                    tabWidth={tabWidth}
                    animateWidth={animateTabWidth}
                    isActive={isActive}
                    editingTabId={editingTabId}
                    renameDraft={renameDraft}
                    contextMenuTabId={contextMenuTabId}
                    contextMenuPosition={contextMenuPosition}
                    resourceWindowOpen={resourceMonitorServers.includes(
                      tab.uuid,
                    )}
                    setContextMenuTabId={setContextMenuTabId}
                    setContextMenuPosition={setContextMenuPosition}
                    onActivate={onActivate}
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
                    onSplit={onSplit}
                  />
                </Fragment>
              );
            })}
          </AnimatePresence>
        </div>
      </SortableContext>

      <AnimatePresence initial={false}>
        {hasOverflow && (
          <motion.button
            key="scroll-right"
            type="button"
            initial={CONTENT_MOTION.item.initial}
            animate={CONTENT_MOTION.item.animate}
            exit={CONTENT_MOTION.item.exit}
            transition={MOTION_SPRING.snappy}
            whileTap={CONTROL_MOTION.tap}
            className={`km-terminal-tab-scroll-button mb-1 ${TAB_SCROLL_BUTTON_CLASS_NAME}`}
            onClick={() => scrollTabs(1)}
            disabled={!canScrollRight}
            title={t("terminal.tabs.scroll_right", "Scroll tabs right")}
            aria-label={t("terminal.tabs.scroll_right", "Scroll tabs right")}
          >
            <ChevronRight size={15} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="km-terminal-tab-actions mb-1 ml-1 flex h-7 shrink-0 items-center gap-1">
        {showActionLeadingSeparator && (
          <div className={TAB_SEPARATOR_CLASS_NAME} aria-hidden="true" />
        )}
        {singleServerMode && onCreateSingleServerTab ? (
          <motion.button
            type="button"
            whileTap={CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
            onClick={onCreateSingleServerTab}
            className={TAB_ACTION_CLASS_NAME}
            title={t("terminal.tabs.new_tab", "New tab")}
            aria-label={t("terminal.tabs.new_tab", "New tab")}
          >
            <Plus size={16} />
          </motion.button>
        ) : (
          <>
            {onOpenTerminalClient && (
              <DropdownMenu
                open={serverMenuOpen}
                onOpenChange={onServerMenuOpenChange}
              >
                <DropdownMenuTrigger asChild>
                  <motion.button
                    type="button"
                    whileTap={CONTROL_MOTION.tap}
                    transition={CONTROL_MOTION.transition}
                    className={TAB_ACTION_CLASS_NAME}
                    title={t("terminal.tabs.open_terminal", "Open terminal")}
                    aria-label={t("terminal.tabs.open_terminal", "Open terminal")}
                  >
                    <SquareTerminal size={16} />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  themeAppearance="dark"
                  className="min-w-[260px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
                >
                  {clientsLoading ? (
                    <DropdownMenuItem disabled>
                      <Loading compact />
                    </DropdownMenuItem>
                  ) : clients.length === 0 ? (
                    <DropdownMenuItem disabled>
                      <Server size={14} />
                      <span>{t("terminal.tabs.no_servers")}</span>
                    </DropdownMenuItem>
                  ) : (
                    orderedClients.map((client, index) => {
                      const shortcutNum =
                        index < 10 ? (index === 9 ? 0 : index + 1) : null;
                      return (
                        <DropdownMenuItem
                          key={client.uuid}
                          onSelect={() => onOpenTerminalClient(client)}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <img
                              src={getOSImage(client.os)}
                              alt=""
                              draggable={false}
                              className="h-3.5 w-3.5 shrink-0 object-contain"
                            />
                            <span className="truncate">
                              {client.name || client.uuid}
                            </span>
                          </div>
                          {shortcutNum !== null && (
                            <span className="ml-auto shrink-0 text-[10px] text-neutral-400 not-italic">
                              Ctrl+Shift+{shortcutNum}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onOpenWorkbenchClient && (
              <DropdownMenu
                open={workbenchMenuOpen}
                onOpenChange={onWorkbenchMenuOpenChange}
              >
                <DropdownMenuTrigger asChild>
                  <motion.button
                    type="button"
                    whileTap={CONTROL_MOTION.tap}
                    transition={CONTROL_MOTION.transition}
                    className={TAB_ACTION_CLASS_NAME}
                    title={t("terminal.tabs.open_workbench", "Open workbench")}
                    aria-label={t("terminal.tabs.open_workbench", "Open workbench")}
                  >
                    <Code2 size={16} />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  themeAppearance="dark"
                  className="min-w-[260px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
                >
                  {clientsLoading ? (
                    <DropdownMenuItem disabled>
                      <Loading compact />
                    </DropdownMenuItem>
                  ) : clients.length === 0 ? (
                    <DropdownMenuItem disabled>
                      <Server size={14} />
                      <span>{t("terminal.tabs.no_servers")}</span>
                    </DropdownMenuItem>
                  ) : (
                    orderedClients.map((client) => (
                      <DropdownMenuItem
                        key={client.uuid}
                        onSelect={() => onOpenWorkbenchClient(client)}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <img
                          src={getOSImage(client.os)}
                          alt=""
                          draggable={false}
                          className="h-3.5 w-3.5 shrink-0 object-contain"
                        />
                        <span className="min-w-0 truncate">
                          {client.name || client.uuid}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      {onOpenSettings && (
        <div className="km-terminal-settings-action ml-auto mb-1 flex h-7 shrink-0 items-center pl-1">
          <motion.button
            type="button"
            whileTap={CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
            onClick={onOpenSettings}
            className={TAB_ACTION_CLASS_NAME}
            title={t("terminal.settings.title", "终端设置")}
            aria-label={t("terminal.settings.title", "终端设置")}
          >
            <Settings size={16} />
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default TerminalTabBar;
