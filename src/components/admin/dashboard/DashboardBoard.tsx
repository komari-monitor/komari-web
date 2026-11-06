import { Children, cloneElement, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  useSensor, useSensors, defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import {
  CONTENT_MOTION,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_EASE_CSS,
  MOTION_MS,
  MOTION_SPRING,
} from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { AutoHeight, PresenceBox } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import { Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { ArrowDownUp, Check, GripVertical, LayoutDashboard, Maximize2, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveThemeSettings } from "@/utils/saveThemeSettings";
import { useRouteQuery } from "@/lib/routeData";
import { dashboardThemeQuery } from "@/routeQueries/dashboard";
import { DASHBOARD_SETTINGS_KEY, defaultHeight, defaultLayout, defaultLimit, defaultWidth, parseDashboardLayout, widgetIds, type DashboardLayout, type WidgetHeight, type WidgetId, type WidgetWidth } from "./layout";
import { placeWidgets, type Placement } from "./placement";
import { SPACE } from "@/lib/spacing";
import "./dashboard.css";

/** dnd-kit 的 easing 只接受 CSS 字符串：直接用统一 token，避免硬编码贝塞尔曲线。 */
const DRAG_EASING = MOTION_EASE_CSS.emphasized;
/** 拖拽重排/落位时长（毫秒），同样来自统一 token。 */
const DRAG_TRANSITION_MS = MOTION_MS.base;

type WidgetProps = {
  id: WidgetId;
  children: ReactNode | ((limit: number) => ReactNode);
  supportsLimit?: boolean;
  limit?: number;
};

const GRID_ROW_HEIGHT = 8;
// 与 dashboard.css 的 gap: var(--space-4) 一致；运行时以 getComputedStyle 读到的值为准
const GRID_GAP = SPACE.block;
/** 并排卡片边缘相差不超过这么多行（约 120px）就视为「本该对齐」，拉齐它们。 */
const SNAP_ROWS = 5;

const minimumWidgetHeight = (height: WidgetHeight) => {
  if (height === "normal") return 360;
  if (height === "tall") return 488;
  return 176;
};

const rowSpanFor = (height: number, gap = GRID_GAP) =>
  Math.max(1, Math.ceil((height + gap) / (GRID_ROW_HEIGHT + gap)));

const colSpanFor = (width: WidgetWidth, columns: number) =>
  Math.min(columns, width === "full" ? 6 : width === "wide" ? 4 : 2);

type PlacementItem = { id: WidgetId; width: WidgetWidth; height: WidgetHeight };

/**
 * 网格摆放的小型外部 store：各卡片上报自然高度，store 统一算出对齐后的格子位置。
 * 卡片按 id 订阅，只有自己的位置变了才重渲染（内容 children 引用不变，不会连带重画图表）。
 */
function createPlacementStore() {
  const listeners = new Set<() => void>();
  const heights = new Map<WidgetId, number>();
  /** 已挂载的卡片：移除后还在播退场动画的卡片继续占着原来的格子，等卸载后其它卡片再补位。 */
  const mounted = new Set<WidgetId>();
  let items: PlacementItem[] = [];
  let columns = 0;
  let gap = GRID_GAP;
  let key = "";
  let placements = new Map<WidgetId, Placement>();
  const recompute = () => {
    if (columns === 0) return;
    const input = items.filter((item) => mounted.has(item.id)).map((item) => ({
      id: item.id,
      colSpan: columns === 1 ? 1 : colSpanFor(item.width, columns),
      rows: rowSpanFor(Math.max(minimumWidgetHeight(item.height), heights.get(item.id) ?? 0), gap),
    }));
    const nextKey = `${columns}|${input.map((item) => `${item.id}:${item.colSpan}:${item.rows}`).join(",")}`;
    if (nextKey === key) return;
    key = nextKey;
    const next = new Map<WidgetId, Placement>();
    let changed = false;
    for (const [id, placement] of placeWidgets(input, columns, SNAP_ROWS)) {
      const previous = placements.get(id as WidgetId);
      const same = previous && previous.col === placement.col && previous.row === placement.row
        && previous.colSpan === placement.colSpan && previous.rowSpan === placement.rowSpan;
      next.set(id as WidgetId, same ? previous : placement);
      if (!same) changed = true;
    }
    if (next.size !== placements.size) changed = true;
    placements = next;
    if (changed) listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    get: (id: WidgetId) => placements.get(id),
    mount(id: WidgetId) { mounted.add(id); recompute(); },
    unmount(id: WidgetId) { mounted.delete(id); heights.delete(id); items = items.filter((item) => item.id !== id); recompute(); },
    setHeight(id: WidgetId, height: number) {
      if (heights.get(id) === height) return;
      heights.set(id, height);
      recompute();
    },
    setItems(next: PlacementItem[]) {
      // 正在退场的卡片（不在新布局里但仍挂载）保留在原来的次序位置
      const merged = [...next];
      items.forEach((item, index) => {
        if (mounted.has(item.id) && !next.some((entry) => entry.id === item.id)) merged.splice(Math.min(index, merged.length), 0, item);
      });
      items = merged;
      recompute();
    },
    setGrid(nextColumns: number, nextGap: number) {
      if (nextColumns === columns && nextGap === gap) return;
      columns = nextColumns;
      gap = nextGap;
      recompute();
    },
  };
}
type PlacementStore = ReturnType<typeof createPlacementStore>;

export function DashboardWidget({ children, limit = 5 }: WidgetProps) {
  return <>{typeof children === "function" ? children(limit) : children}</>;
}

function SortableWidget({ item, store, editing, title, supportsLimit, onRemove, onWidth, onHeight, onLimit, children }: {
  item: DashboardLayout[number]; store: PlacementStore; editing: boolean; title: string;
  supportsLimit: boolean; onRemove: () => void; onWidth: (width: WidgetWidth) => void;
  onHeight: (height: WidgetHeight) => void; onLimit: (limit: number) => void; children: ReactNode;
}) {
  const { t } = useTranslation();
  const reduced = useKmReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const placement = useSyncExternalStore(store.subscribe, () => store.get(item.id));
  useLayoutEffect(() => {
    store.mount(item.id);
    return () => store.unmount(item.id);
  }, [store, item.id]);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // 只上报内容的自然高度；卡片被拉齐后多出来的高度不影响 body 的 scrollHeight，不会形成反馈环。
    // 在 ResizeObserver 回调里同步上报：位置更新在同一帧绘制前完成，不会先错位再跳正。
    const measure = () => store.setHeight(item.id, body.scrollHeight + (toolsRef.current?.offsetHeight ?? 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    // 同时观察 AutoHeight 外层（它的高度逐帧弹簧变化），格子高度才能一路跟上去。
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [store, item.id, item.height, item.limit, editing]);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, disabled: !editing,
    // content 层：与其它列表共用同一条缓动与时长（由 token 输出，避免硬编码）
    transition: { duration: reduced ? 0 : DRAG_TRANSITION_MS, easing: DRAG_EASING },
  });
  return (
    // content 层：新增/移除只做淡入淡出，重排完全交给 dnd-kit 自己的 transition。
    // 不能再给这个 useSortable 节点加 motion 的 layout：dnd-kit 通过内联 transform 做让位与落位，
    // motion 的布局投影也写同一个 transform——松手提交新顺序时 motion 会把「旧格子 -> 新格子」
    // 再补间一次（dnd-kit 已经移过去了），卡片看起来落下后又被拽回再滑一遍。
    // 编辑态工具栏出现导致的跨行变化本身就是网格重排，瞬时生效比让整块大卡片滑动更清楚。
    <motion.section ref={setNodeRef}
      data-widget={item.id} data-width={item.width} data-height={item.height}
      className={`km-dashboard-widget${isDragging ? " is-dragging" : ""}`}
      aria-label={title}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{
        opacity: CONTENT_MOTION.transition.opacity,
        scale: CONTENT_MOTION.exitTransition,
      }}
      style={{
        transform: CSS.Translate.toString(transform), transition,
        ...(placement ? {
          gridColumn: `${placement.col + 1} / span ${placement.colSpan}`,
          gridRow: `${placement.row + 1} / span ${placement.rowSpan}`,
        } : { gridRowEnd: `span ${rowSpanFor(minimumWidgetHeight(item.height))}` }),
      }}>
      <Card className="km-dashboard-widget-card">
        {editing && <div ref={toolsRef} className="km-dashboard-widget-tools">
          <Tooltip content={t("dashboardLayout.move", { name: title })}>
            <IconButton ref={setActivatorNodeRef} {...attributes} {...listeners}
              className="km-dashboard-grip" variant="ghost" color="gray"
              aria-label={t("dashboardLayout.move", { name: title })}>
              <GripVertical size={16} />
            </IconButton>
          </Tooltip>
          <Text size="1" color="gray" className="km-dashboard-tool-title">{title}</Text>
          <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.width")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.width")}>
                  <Maximize2 size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={item.width} onValueChange={(value) => onWidth(value as WidgetWidth)}>
                {(["compact", "wide", "full"] as const).map((width) =>
                  <DropdownMenu.RadioItem key={width} value={width}>{t(`dashboardLayout.${width}`)}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {supportsLimit && <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.visibleNodes")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.visibleNodes")}>
                  <Settings2 size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={String(item.limit)} onValueChange={(value) => onLimit(Number(value))}>
                {[2, 3, 4, 5, 8, 10].map((limit) =>
                  <DropdownMenu.RadioItem key={limit} value={String(limit)}>{t("dashboardLayout.visibleNodesCount", { count: limit })}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>}
          <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.height")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.height")}>
                  <ArrowDownUp size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={item.height} onValueChange={(value) => onHeight(value as WidgetHeight)}>
                {(["short", "normal", "tall"] as const).map((height) =>
                  <DropdownMenu.RadioItem key={height} value={height}>{t(`dashboardLayout.${height}`)}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <Tooltip content={t("dashboardLayout.hide", { name: title })}>
            <IconButton variant="ghost" color="gray" onClick={onRemove} aria-label={t("dashboardLayout.hide", { name: title })}>
              <X size={15} />
            </IconButton>
          </Tooltip>
        </div>}
        {/*
          content 层：widget 内容高度变化（骨架 -> 数据、排行条数变化）由 AutoHeight 弹簧跟随；
          body 的 ResizeObserver 随之逐帧更新 rowSpan，卡片是「长」过去而不是一下跳高。
          AutoHeight 只改 body 内部高度，不碰 useSortable 节点的 transform；拖拽中暂停跟随。
        */}
        <div ref={bodyRef} className="km-dashboard-widget-body">
          <AutoHeight ref={contentRef} disabled={isDragging}>{children}</AutoHeight>
        </div>
      </Card>
    </motion.section>
  );
}

/**
 * 布局还没读到时的占位：几块不同宽度的大色块（不按默认布局画 widget，用户的布局不一定是默认的）。
 * 高度贴近常见 widget（short 约 176px 起），网格列数随容器查询与真实网格一致（6/4/1 列）。
 */
const BOARD_PLACEHOLDER_BLOCKS = [
  { span: "compact", height: 220 },
  { span: "wide", height: 220 },
  { span: "wide", height: 360 },
  { span: "compact", height: 360 },
] as const;

function BoardPlaceholder() {
  return (
    <div className="km-dashboard-placeholder" aria-hidden="true">
      {BOARD_PLACEHOLDER_BLOCKS.map((block, index) => (
        // 复用 Skeletonize 的色卡视觉：挂载即加载（稍后浮现、呼吸），读到布局后由外层整体淡出
        <Skeletonize key={index} loading className={`km-dashboard-placeholder-block is-${block.span}`}
          style={{ height: block.height }}>
          <div />
        </Skeletonize>
      ))}
    </div>
  );
}

export function DashboardBoard({ children }: { children: ReactElement<WidgetProps>[] }) {
  const { t } = useTranslation();
  const reduced = useKmReducedMotion();
  // 布局在主题设置里：切换页面时由 routePreload 预取，等待预算内读到就直接按读到的布局渲染
  const themeResult = useRouteQuery(dashboardThemeQuery);
  const themeData = themeResult.data;
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    themeData ? parseDashboardLayout(themeData.settings[DASHBOARD_SETTINGS_KEY]) : defaultLayout());
  const [saved, setSaved] = useState<DashboardLayout>(() =>
    themeData ? parseDashboardLayout(themeData.settings[DASHBOARD_SETTINGS_KEY]) : defaultLayout());
  const [appliedTheme, setAppliedTheme] = useState(themeData);
  // 读到（或重试读到）主题设置：渲染期同步应用，不会先用默认布局画一帧
  if (themeData && themeData !== appliedTheme) {
    const next = parseDashboardLayout(themeData.settings[DASHBOARD_SETTINGS_KEY]);
    setAppliedTheme(themeData);
    setSaved(next);
    setLayout(next);
  }
  const theme = themeData?.theme ?? null;
  // 与原实现一致：重试期间不显示失败按钮（徽标回到骨架），失败后显示重试按钮
  const loadError = Boolean(themeResult.error) && !themeResult.loading;
  // 布局是否可以渲染：读到了，或者读取失败过（失败沿用默认布局 + 重试按钮，重试期间不再回到色块）
  const layoutReady = themeData !== undefined || themeResult.error !== undefined;
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<WidgetId | null>(null);
  const [placementStore] = useState(createPlacementStore);
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    placementStore.setItems(layout.map(({ id, width, height }) => ({ id, width, height })));
  }, [placementStore, layout]);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // 列数和间距由容器查询决定（6/4/1 列），直接读计算后的样式，和 CSS 保持一致
    const read = () => {
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(" ").filter(Boolean).length;
      placementStore.setGrid(Math.max(1, columns), parseFloat(style.rowGap) || GRID_GAP);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [placementStore]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const widgets = new Map((Children.toArray(children) as ReactElement<WidgetProps>[]).map((child) => [child.props.id, child]));
  const title = (id: WidgetId) => t(`dashboardLayout.widgets.${id}`);
  // 布局没读到前不渲染任何 widget（也不挂进摆放 store），网格区域显示占位色块
  const visibleLayout = layoutReady ? layout : [];
  const renderedWidgets = visibleLayout.map((item) => {
    const widget = widgets.get(item.id);
    if (!widget) return null;
    return <SortableWidget key={item.id} item={item} store={placementStore} title={title(item.id)}
      editing={editing && !saving}
      supportsLimit={Boolean(widget.props.supportsLimit)}
      onRemove={() => setLayout((current) => current.filter((entry) => entry.id !== item.id))}
      onWidth={(width) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, width } : entry))}
      onHeight={(height) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, height } : entry))}
      onLimit={(limit) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, limit } : entry))}>
      {cloneElement(widget, { limit: item.limit })}
    </SortableWidget>;
  });

  const save = async () => {
    if (theme === null) return;
    setSaving(true);
    try {
      await saveThemeSettings(theme, { [DASHBOARD_SETTINGS_KEY]: layout });
      setSaved(layout);
      setEditing(false);
      toast.success(t("dashboardLayout.saved"));
    } catch {
      toast.error(t("dashboardLayout.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="km-dashboard-board" data-editing={editing}>
      <Flex align="center" justify="between" gap="3" wrap="wrap" className="km-dashboard-board-toolbar">
        <Flex gap="2" align="center">
          <LayoutDashboard size={16} color="var(--gray-10)" />
          <Text size="2" weight="medium">{t(editing ? "dashboardLayout.editing" : "dashboardLayout.workspace")}</Text>
          {/* 布局还在读取：数量徽标是骨架（读到后同位淡成真实数字） */}
          <Skeletonize as="span" loading={theme === null && !loadError}>
            <Badge color="gray" variant="soft">{layout.length} / {widgetIds.length}</Badge>
          </Skeletonize>
        </Flex>
        <Flex gap="2" align="center" wrap="wrap">
          {loadError ? <Button size="2" variant="soft" color="red" onClick={() => void themeResult.reload()}>
            <RotateCcw size={14} />{t("dashboardLayout.loadFailed")}
          </Button> : editing ? <>
            <Tooltip content={t("dashboardLayout.reset")}>
              <IconButton variant="ghost" color="gray" disabled={saving} aria-label={t("dashboardLayout.reset")}
                onClick={() => setLayout(defaultLayout())}><RotateCcw size={16} /></IconButton>
            </Tooltip>
            <Button variant="soft" disabled={saving} onClick={() => setChoosing(true)}><Plus size={15} />{t("dashboardLayout.cards")}</Button>
            <Button variant="soft" color="gray" disabled={saving} onClick={() => { setLayout(saved); setEditing(false); }}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button loading={saving} onClick={() => void save()}><Check size={15} />{t("common.save", "Save")}</Button>
          </> : <Button variant="soft" disabled={theme === null} onClick={() => setEditing(true)}>
            <Settings2 size={15} />{t("dashboardLayout.customize")}
          </Button>}
        </Flex>
      </Flex>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: { draggable: t("dashboardLayout.keyboard") },
          announcements: {
            onDragStart: ({ active }) => t("dashboardLayout.picked", { name: title(active.id as WidgetId) }),
            onDragOver: ({ active, over }) => over ? t("dashboardLayout.moved", { name: title(active.id as WidgetId), position: layout.findIndex((item) => item.id === over.id) + 1 }) : undefined,
            onDragEnd: () => t("dashboardLayout.dropped"),
            onDragCancel: () => t("dashboardLayout.cancelled"),
          },
        }}
        onDragStart={({ active }) => setActive(active.id as WidgetId)}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active, over }) => {
          setActive(null);
          if (over && active.id !== over.id) setLayout((current) =>
            arrayMove(current, current.findIndex((item) => item.id === active.id), current.findIndex((item) => item.id === over.id)));
        }}>
        <SortableContext items={visibleLayout.map((item) => item.id)} strategy={rectSortingStrategy}>
          <div className="km-dashboard-stage">
            {/*
              布局读到前：占位色块。读到后色块以 popLayout 原位脱离文档流淡出，
              widget 在它下面淡入（交叉淡化，网格高度由真实 widget 撑起，不跳动）。
              色块只是普通 motion.div，不在 useSortable 节点上，不影响 dnd-kit 的 transform。
            */}
            <AnimatePresence initial={false} mode="popLayout">
              {!layoutReady && (
                <motion.div key="km-dashboard-placeholder" className="km-dashboard-placeholder-layer"
                  initial={false}
                  exit={{ opacity: 0 }}
                  transition={{ opacity: reduced ? { duration: 0 } : CONTENT_MOTION.exitTransition }}>
                  <BoardPlaceholder />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={gridRef} className="km-dashboard-grid">
              {/* content 层：widget 增删走 AnimatePresence 淡入淡出，重排交给 dnd-kit；格子位置由 placementStore 对齐 */}
              <AnimatePresence initial={false}>{renderedWidgets}</AnimatePresence>
            </div>
          </div>
        </SortableContext>
        {/* overlay 层：拖拽中的预览卡片抬起并淡入 */}
        <DragOverlay adjustScale={false} dropAnimation={reduced ? null : {
          duration: DRAG_TRANSITION_MS, easing: DRAG_EASING,
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
        }}>
          {active && <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              scale: MOTION_SPRING.soft,
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
            }}
          >
            <Card className="km-dashboard-drag-preview">
              <div className="km-dashboard-widget-tools"><GripVertical size={16} /><Text size="1">{title(active)}</Text></div>
              <div className="km-dashboard-widget-body">{widgets.get(active)}</div>
            </Card>
          </motion.div>}
        </DragOverlay>
      </DndContext>
      {/* surface 层：空状态整块淡入，不整页抖动 */}
      <AnimatePresence initial={false}>
        {layoutReady && layout.length === 0 && (
          <PresenceBox key="km-dashboard-empty" className="km-dashboard-empty">
            <LayoutDashboard size={28} color="var(--gray-9)" />
            <Text size="2" color="gray">{t("dashboardLayout.empty")}</Text>
            <Button variant="soft" disabled={theme === null} onClick={() => { setEditing(true); setChoosing(true); }}>
              <Plus size={15} />{t("dashboardLayout.cards")}
            </Button>
          </PresenceBox>
        )}
      </AnimatePresence>
      <Dialog.Root open={choosing} onOpenChange={setChoosing}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>{t("dashboardLayout.cards")}</Dialog.Title>
          <Dialog.Description size="2" color="gray">{t("dashboardLayout.selection", { count: layout.length })}</Dialog.Description>
          {/* overlay 层：清单随弹层打开依次落下（错峰跟随） */}
          <motion.div
            className="km-dashboard-catalog"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{ initial: {}, animate: { transition: { staggerChildren: CONTENT_MOTION.stagger(1), delayChildren: MOTION_DURATION.instant } }, exit: {} }}
          >
            {widgetIds.map((id) => <motion.label
              key={id}
              className="km-dashboard-catalog-row"
              variants={{
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0, transition: { y: MOTION_SPRING.snappy, opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard } } },
                exit: { opacity: 0, y: 4 },
              }}
              // hover 底色交给 CSS（.km-dashboard-catalog-row:hover）：whileHover 写内联背景色，
              // 弹层关闭/列表重渲染时指针已离开，内联值却可能残留。
            >
              <Checkbox checked={layout.some((item) => item.id === id)} onCheckedChange={(checked) =>
                setLayout((current) => checked === true
                  ? [...current.filter((item) => item.id !== id), { id, width: defaultWidth(id), height: defaultHeight(id), limit: defaultLimit(id) }]
                  : current.filter((item) => item.id !== id))} />
              <Text size="2">{title(id)}</Text>
            </motion.label>)}
          </motion.div>
          <Flex justify="end" mt="4"><Dialog.Close><Button>{t("common.done", "Done")}</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
