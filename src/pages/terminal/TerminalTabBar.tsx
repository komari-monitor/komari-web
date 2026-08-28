import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  WheelEvent as ReactWheelEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Server,
  SquareTerminal,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getOSImage } from "@/utils/osImageHelper";
import TabButton from "./TabButton";
import TabMenu from "./TabMenu";
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
  tabs: TerminalTab[];
  clients: TerminalClient[];
  clientsLoading: boolean;
  activeTabId: string | null;
  editingTabId: string | null;
  renameDraft: string;
  serverMenuOpen: boolean;
  onServerMenuOpenChange: (open: boolean) => void;
  workbenchMenuOpen: boolean;
  onWorkbenchMenuOpenChange: (open: boolean) => void;
  onActivate: (id: string) => void;
  onOpenTerminalClient: (client: TerminalClient) => void;
  onOpenWorkbenchClient: (client: TerminalClient) => void;
  onStartRename: (id: string) => void;
  onDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (id: string) => void;
  onExportText: (id: string) => void;
  onFind: (id: string) => void;
  onOpenFileManager: (id: string) => void;
  onOpenEditor: (id: string) => void;
  resourceMonitorServers: string[];
  onToggleResourceWindow: (uuid: string) => void;
  onColor: (id: string, color: string | null) => void;
  onClose: (id: string, mode: CloseMode) => void;
  onReorder: (sourceId: string, targetId: string) => void;
}

interface SortableTabItemProps {
  tab: TerminalTab;
  client: TerminalClient | undefined;
  index: number;
  total: number;
  tabWidth: number;
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
  onOpenFileManager: (id: string) => void;
  onOpenEditor: (id: string) => void;
  resourceWindowOpen: boolean;
  onToggleResourceWindow: (uuid: string) => void;
  onColor: (id: string, color: string | null) => void;
  onClose: (id: string, mode: CloseMode) => void;
}

const SortableTabItem = ({
  tab,
  client,
  index,
  total,
  tabWidth,
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
}: SortableTabItemProps) => {
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
  });

  const style = {
    width: `${tabWidth}px`,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : isActive ? 3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative h-full shrink-0"
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
        onOpenFileManager={() => onOpenFileManager(tab.id)}
        onOpenEditor={() => onOpenEditor(tab.id)}
        onToggleResourceWindow={() => onToggleResourceWindow(tab.uuid)}
        onColor={(color) => onColor(tab.id, color)}
        onClose={(mode) => onClose(tab.id, mode)}
      />
      <TabButton
        tab={tab}
        client={client}
        index={index}
        active={isActive}
        editing={editingTabId === tab.id}
        draft={renameDraft}
        onActivate={() => onActivate(tab.id)}
        onStartRename={() => onStartRename(tab.id)}
        onDraftChange={onDraftChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onClose={() => onClose(tab.id, "current")}
      />
    </div>
  );
};

const TerminalTabBar = ({
  tabs,
  clients,
  clientsLoading,
  activeTabId,
  editingTabId,
  renameDraft,
  serverMenuOpen,
  onServerMenuOpenChange,
  workbenchMenuOpen,
  onWorkbenchMenuOpenChange,
  resourceMonitorServers,
  onToggleResourceWindow,
  onActivate,
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
  onReorder,
}: TerminalTabBarProps) => {
  const { t } = useTranslation();
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] =
    useState<ContextMenuPosition | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

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

  const totalAvailableForTabs = Math.max(
    0,
    containerWidth - ACTIONS_RESERVED_WIDTH - 20,
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
  }, [activeTabId, hasOverflow, tabWidth, tabs]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  const lastTab = tabs[tabs.length - 1];
  const lastTabIsActive = lastTab?.id === activeTabId;
  const showActionLeadingSeparator = tabs.length > 0 && !lastTabIsActive;

  return (
    <div
      ref={tabBarRef}
      className="km-terminal-tab-bar flex h-10 min-w-0 flex-[0_0_40px] select-none items-end bg-[#1e1e1e] px-2"
      role="tablist"
      aria-label={t("terminal.tabs.title")}
    >
      {hasOverflow && (
        <button
          type="button"
          className={`km-terminal-tab-scroll-button mb-1 ${TAB_SCROLL_BUTTON_CLASS_NAME}`}
          onClick={() => scrollTabs(-1)}
          disabled={!canScrollLeft}
          title={t("terminal.tabs.scroll_left", "Scroll tabs left")}
          aria-label={t("terminal.tabs.scroll_left", "Scroll tabs left")}
        >
          <ChevronLeft size={15} />
        </button>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
      >
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
                    tab={tab}
                    client={client}
                    index={index}
                    total={tabs.length}
                    tabWidth={tabWidth}
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
                  />
                </Fragment>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {hasOverflow && (
        <button
          type="button"
          className={`km-terminal-tab-scroll-button mb-1 ${TAB_SCROLL_BUTTON_CLASS_NAME}`}
          onClick={() => scrollTabs(1)}
          disabled={!canScrollRight}
          title={t("terminal.tabs.scroll_right", "Scroll tabs right")}
          aria-label={t("terminal.tabs.scroll_right", "Scroll tabs right")}
        >
          <ChevronRight size={15} />
        </button>
      )}

      <div className="km-terminal-tab-actions mb-1 ml-1 flex h-7 shrink-0 items-center gap-1">
        {showActionLeadingSeparator && (
          <div className={TAB_SEPARATOR_CLASS_NAME} aria-hidden="true" />
        )}
        <DropdownMenu
          open={serverMenuOpen}
          onOpenChange={onServerMenuOpenChange}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={TAB_ACTION_CLASS_NAME}
              title={t("terminal.tabs.open_terminal", "Open terminal")}
              aria-label={t("terminal.tabs.open_terminal", "Open terminal")}
            >
              <SquareTerminal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            themeAppearance="dark"
            className="min-w-[260px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
          >
            {clientsLoading ? (
              <DropdownMenuItem disabled>
                <Server size={14} />
                <span>{t("terminal.tabs.loading_servers", "Loading servers...")}</span>
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

        <DropdownMenu
          open={workbenchMenuOpen}
          onOpenChange={onWorkbenchMenuOpenChange}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={TAB_ACTION_CLASS_NAME}
              title={t("terminal.tabs.open_workbench", "Open workbench")}
              aria-label={t("terminal.tabs.open_workbench", "Open workbench")}
            >
              <Code2 size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            themeAppearance="dark"
            className="min-w-[260px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
          >
            {clientsLoading ? (
              <DropdownMenuItem disabled>
                <Server size={14} />
                <span>{t("terminal.tabs.loading_servers", "Loading servers...")}</span>
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
      </div>
    </div>
  );
};

export default TerminalTabBar;
