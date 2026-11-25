import {
  Children,
  cloneElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DroppableContainer,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type SortingStrategy,
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
import { PresenceBox } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Popover,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  Activity,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronDown,
  Globe,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  ListFilter,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveThemeSettings } from "@/utils/saveThemeSettings";
import { useRouteQuery } from "@/lib/routeData";
import { dashboardThemeQuery } from "@/routeQueries/dashboard";
import {
  DASHBOARD_PRESETS,
  DASHBOARD_SETTINGS_KEY,
  FIXED_WIDGET_LIMITS,
  defaultHeight,
  defaultLayout,
  defaultLimit,
  defaultWidth,
  matchDashboardPreset,
  parseDashboardConfig,
  presetLayout,
  sameLayout,
  serializeDashboardConfig,
  widgetIds,
  type DashboardLayout,
  type DashboardPresetId,
  type WidgetHeight,
  type WidgetId,
  type WidgetLimit,
  type WidgetWidth,
} from "./layout";
import {
  EMPTY_SLOT_PREFIX,
  computeGridDrop,
  findEmptySlots,
  fitRectInEmptySlot,
  getGridBottom,
  packWidgets,
  placeWidgets,
  type EmptySlot,
  type Placement,
} from "./placement";
import { WIDGET_ICONS } from "./widgetMeta";
import {
  DashboardWidgetRenderContext,
  type DashboardWidgetRenderContextValue,
} from "./widgetContext";
import { SPACE } from "@/lib/spacing";
import "./dashboard.css";

/** dnd-kit 的 easing 只接受 CSS 字符串：直接用统一 token，避免硬编码贝塞尔曲线。 */
const DRAG_EASING = MOTION_EASE_CSS.emphasized;
/** 拖拽重排/落位时长（毫秒），同样来自统一 token。 */
const DRAG_TRANSITION_MS = MOTION_MS.base;
const MAX_HISTORY_STEPS = 30;
const BOTTOM_NEW_ROW_ID = "__km_dashboard_bottom_new_row__";
const DND_MEASURING = {
  droppable: { strategy: MeasuringStrategy.BeforeDragging },
};

const WIDGET_ORDER = new Map<WidgetId, number>(widgetIds.map((id, idx) => [id, idx]));

const PRESET_ICONS: Record<DashboardPresetId, typeof LayoutDashboard> = {
  balanced: LayoutDashboard,
  panorama: Globe,
  network: Activity,
};

/** 与 dashboard.css 的 @container 断点严格同步，避免用 getComputedStyle 读到隐式列轨道 */
const columnsForWidth = (width: number) => (width <= 600 ? 1 : width <= 960 ? 4 : 6);

/** 多列模式下拖拽期间保持画布完全静止、由目标高亮与松手平滑落位呈现，禁用 dnd-kit 途中偏移 */
const noopSortingStrategy: SortingStrategy = () => null;

type WidgetProps = {
  id: WidgetId;
  children: ReactNode | ((limit: number) => ReactNode);
  supportsLimit?: boolean;
  limit?: number;
};

type AutoLimitSpec = {
  /** 标题、图表/汇总区等固定非列表区高度（按 Radix scaling=110% 校准，不含卡片外 padding） */
  chromePx: number;
  /** 单条列表项占高（含行间距） */
  rowPx: number;
  minRows: number;
  maxRows: number;
  /** 容器窄于该宽度时多列会折行堆叠，此时收敛为 minRows 防止溢出 */
  singleRowColumnsMinWidth?: number;
};

const AUTO_LIMIT_SPECS: Partial<Record<WidgetId, AutoLimitSpec>> = {
  expiry: { chromePx: 44, rowPx: 63, minRows: 1, maxRows: 12 },
  cpu: { chromePx: 44, rowPx: 71, minRows: 1, maxRows: 12 },
  memory: { chromePx: 44, rowPx: 71, minRows: 1, maxRows: 12 },
  disk: { chromePx: 44, rowPx: 68, minRows: 1, maxRows: 12 },
  trafficQuota: { chromePx: 44, rowPx: 71, minRows: 1, maxRows: 12 },
  liveBandwidth: { chromePx: 118, rowPx: 49, minRows: 1, maxRows: 12 },
  uptime: { chromePx: 84, rowPx: 58, minRows: 1, maxRows: 12 },
  traffic: { chromePx: 306, rowPx: 73, minRows: 1, maxRows: 10 },
  ping: {
    chromePx: 78,
    rowPx: 36,
    minRows: 1,
    maxRows: 12,
    singleRowColumnsMinWidth: 680,
  },
};

const DEFAULT_AUTO_SPEC: AutoLimitSpec = { chromePx: 48, rowPx: 64, minRows: 1, maxRows: 10 };

/**
 * 严格模块化网格单元：与 dashboard.css 的 grid-auto-rows: 240px / gap: 16px 一一对应。
 * - short = 1 格 (240px)
 * - normal = 2 格 (496px = 240 + 16 + 240，与两张 short 叠加严格像素级齐平)
 * - tall = 3 格 (752px = 240*3 + 16*2，与三张 short 或 normal+short 严格齐平)
 */
const GRID_UNIT_HEIGHT = 240;
const GRID_GAP = SPACE.block;

const rowUnitsFor = (height: WidgetHeight) =>
  height === "tall" ? 3 : height === "normal" ? 2 : 1;

const colSpanFor = (width: WidgetWidth, columns: number) =>
  Math.min(columns, width === "full" ? 6 : width === "wide" ? 4 : 2);

const widthSlotsFor = (width: WidgetWidth, columns: number) => {
  if (columns <= 1) return 1;
  const maxSlots = columns >= 6 ? 3 : 2;
  const slots = width === "full" ? 3 : width === "wide" ? 2 : 1;
  return Math.min(maxSlots, slots);
};

const widthForSlots = (slots: number, columns: number, preferred?: WidgetWidth): WidgetWidth => {
  if (columns <= 4) {
    if (slots <= 1) return "compact";
    return preferred === "wide" ? "wide" : "full";
  }
  return slots >= 3 ? "full" : slots === 2 ? "wide" : "compact";
};

const widthForCols = (cols: number, columns: number, preferred?: WidgetWidth): WidgetWidth => {
  if (columns <= 4) {
    if (cols < 4) return "compact";
    return preferred === "wide" ? "wide" : "full";
  }
  return cols >= 6 ? "full" : cols >= 4 ? "wide" : "compact";
};

const heightForRows = (rows: number): WidgetHeight =>
  rows >= 3 ? "tall" : rows === 2 ? "normal" : "short";

const formatSizeCode = (width: WidgetWidth, height: WidgetHeight, columns: number) =>
  `${widthSlotsFor(width, columns)}×${rowUnitsFor(height)}`;

/**
 * 指针精准碰撞检测：
 * 1. 指针落在某张卡片 / 空位 / 底部新建行区域内部时 100% 精准命中；
 * 2. 指针刚好停在 16px 网格缝隙上时，吸附到 28px 内的最近合法目标；拖离看板外则安全取消；
 * 3. 键盘拖拽无指针坐标时回退 closestCenter。
 */
const dashboardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;

  const pointer = args.pointerCoordinates;
  if (pointer) {
    let bestId: UniqueIdentifier | null = null;
    let bestContainer: DroppableContainer | null = null;
    let bestDistSq = 28 * 28;
    for (const container of args.droppableContainers) {
      const rect = args.droppableRects.get(container.id);
      if (!rect) continue;
      const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
      const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestId = container.id;
        bestContainer = container;
      }
    }
    if (bestId !== null && bestContainer !== null) {
      return [{ id: bestId, data: { droppableContainer: bestContainer, value: bestDistSq } }];
    }
    return [];
  }

  return closestCenter(args);
};

const EMPTY_SLOTS_FALLBACK: EmptySlot[] = [];

const toPlacementInputs = (list: DashboardLayout, columns: number) =>
  list.map((entry) => ({
    id: entry.id,
    colSpan: columns <= 1 ? 1 : colSpanFor(entry.width, columns),
    rows: rowUnitsFor(entry.height),
    col: entry.col,
    row: entry.row,
  }));

/** 把当前网格中每张卡片的实时坐标固化下来，后续编辑只动目标卡片，其余卡片原地不动。 */
function materializeLayoutCoords(current: DashboardLayout, columns: number): DashboardLayout {
  if (columns <= 1) return current;
  const packed = packWidgets(toPlacementInputs(current, columns), columns);
  return current.map((entry) => {
    const p = packed.get(entry.id);
    return p ? { ...entry, col: p.col, row: p.row } : entry;
  });
}

/** 根据已解算的 Placement Map 生成按阅读顺序排列的新布局数组。 */
function applyPackedCoords(
  items: DashboardLayout,
  packed: Map<string, Placement>,
): DashboardLayout {
  return items
    .map((entry) => {
      const p = packed.get(entry.id);
      return p ? { ...entry, col: p.col, row: p.row } : entry;
    })
    .sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0));
}

/** 按给定优先级解析网格坐标并按阅读顺序 (row, col) 整理数组，保证无重叠、无越界、无整行空带。 */
function resolveAndSortLayout(priorityItems: DashboardLayout, columns: number): DashboardLayout {
  if (columns <= 1) return priorityItems;
  const packed = packWidgets(toPlacementInputs(priorityItems, columns), columns);
  return applyPackedCoords(priorityItems, packed);
}

/** 一键整理：保留当前阅读顺序，清除零散坐标空洞并紧密排齐。 */
function tidyLayout(current: DashboardLayout, columns: number): DashboardLayout {
  const stripCoords = (entry: DashboardLayout[number]): DashboardLayout[number] => ({
    id: entry.id,
    width: entry.width,
    height: entry.height,
    limit: entry.limit,
  });
  if (columns <= 1) {
    return current.map(stripCoords);
  }
  const ordered = materializeLayoutCoords(current, columns).sort(
    (a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0),
  );
  return ordered.map(stripCoords);
}

/**
 * 计算卡片放入空位后的精确无冲突位置与尺寸（支持在包含鼠标所指空位格的前提下自动微调左上角，
 * 让 2×2 卡片拖到 2×2 空位的任意一格都能完整落位，且周围任何卡片 0 变动）。
 */
function computeSlotFit(
  current: DashboardLayout,
  item: DashboardLayout[number],
  slot: EmptySlot,
  columns: number,
) {
  const materialized = materializeLayoutCoords(current, columns);
  const others = materialized.filter((entry) => entry.id !== item.id);
  const origCols = colSpanFor(item.width, columns);
  const origRows = rowUnitsFor(item.height);
  const fitted = fitRectInEmptySlot(
    toPlacementInputs(others, columns),
    slot.row,
    slot.col,
    origCols,
    origRows,
    columns,
  );
  const width = widthForCols(fitted.colSpan, columns, item.width);
  const height = heightForRows(fitted.rowSpan);
  return {
    others,
    col: fitted.col,
    row: fitted.row,
    colSpan: fitted.colSpan,
    rowSpan: fitted.rowSpan,
    width,
    height,
    resized: width !== item.width || height !== item.height,
  };
}

/**
 * 将卡片（已有卡片拖放或点击空位加号新增）严丝合缝放入目标空位区域：
 * 周围卡片 0 变动，落位结果与悬停预览 100% 一致。
 */
function placeWidgetIntoSlot(
  current: DashboardLayout,
  item: DashboardLayout[number],
  slot: EmptySlot,
  columns: number,
): DashboardLayout {
  const fit = computeSlotFit(current, item, slot, columns);
  const placedItem: DashboardLayout[number] = {
    ...item,
    width: fit.width,
    height: fit.height,
    col: fit.col,
    row: fit.row,
  };
  return resolveAndSortLayout([placedItem, ...fit.others], columns);
}

/** 将卡片放到网格最底部新开的一行（保持卡片原尺寸，其余卡片完全不动）。 */
function placeWidgetOnNewBottomRow(
  current: DashboardLayout,
  activeId: WidgetId,
  columns: number,
): DashboardLayout {
  if (columns <= 1) {
    const target = current.find((entry) => entry.id === activeId);
    if (!target) return current;
    return [...current.filter((entry) => entry.id !== activeId), target];
  }
  const materialized = materializeLayoutCoords(current, columns);
  const target = materialized.find((entry) => entry.id === activeId);
  if (!target) return current;
  const others = materialized.filter((entry) => entry.id !== activeId);
  const othersBottom = getGridBottom(packWidgets(toPlacementInputs(others, columns), columns));
  const placedItem: DashboardLayout[number] = {
    ...target,
    col: 0,
    row: othersBottom,
  };
  return resolveAndSortLayout([...others, placedItem], columns);
}

/** 将卡片放到另一张已有卡片上：同尺寸原地 1 对 1 互换（其余 0 变动），不同尺寸按 2D 求解器最小扰动落位。 */
function moveWidgetOntoWidget(
  current: DashboardLayout,
  activeId: WidgetId,
  overId: WidgetId,
  columns: number,
): DashboardLayout {
  if (columns <= 1) {
    const from = current.findIndex((item) => item.id === activeId);
    const to = current.findIndex((item) => item.id === overId);
    if (from < 0 || to < 0) return current;
    return arrayMove(current, from, to);
  }
  const materialized = materializeLayoutCoords(current, columns);
  const overItem = materialized.find((entry) => entry.id === overId);
  if (!overItem) return current;
  const packed = computeGridDrop(
    toPlacementInputs(materialized, columns),
    activeId,
    overItem.col ?? 0,
    overItem.row ?? 0,
    columns,
  );
  return applyPackedCoords(materialized, packed);
}

/** 隐藏某张卡片时保留其余卡片坐标，原地露出可再拖入/点击加号的空位（仅折叠整行全空的横条）。 */
function removeWidgetKeepPositions(
  current: DashboardLayout,
  id: WidgetId,
  columns: number,
): DashboardLayout {
  if (columns <= 1) return current.filter((entry) => entry.id !== id);
  const remaining = materializeLayoutCoords(current, columns).filter((entry) => entry.id !== id);
  return resolveAndSortLayout(remaining, columns);
}

/** 调整卡片宽/高时原地更新（若变宽自动向左侧夹紧，避免超出屏幕），冲突卡片平滑下移。 */
function resizeWidgetKeepPositions(
  current: DashboardLayout,
  id: WidgetId,
  patch: Partial<Pick<DashboardLayout[number], "width" | "height">>,
  columns: number,
): DashboardLayout {
  if (columns <= 1) {
    return current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  }
  const materialized = materializeLayoutCoords(current, columns);
  const target = materialized.find((entry) => entry.id === id);
  if (!target) return current;
  const nextWidth = patch.width ?? target.width;
  const nextHeight = patch.height ?? target.height;
  if (nextWidth === target.width && nextHeight === target.height) return current;
  const nextColSpan = colSpanFor(nextWidth, columns);
  const clampedCol = Math.min(target.col ?? 0, Math.max(0, columns - nextColSpan));
  const updated: DashboardLayout[number] = {
    ...target,
    width: nextWidth,
    height: nextHeight,
    col: clampedCol,
  };
  const others = materialized.filter((entry) => entry.id !== id);
  return resolveAndSortLayout([updated, ...others], columns);
}

/** 可视化 3×3（平板 2×3 / 移动端 1×3）尺寸矩阵选择器，一次点击同时设定宽与高。 */
const WidgetSizePopover = memo(function WidgetSizePopover({
  id,
  width,
  height,
  columns,
  onResize,
}: {
  id: WidgetId;
  width: WidgetWidth;
  height: WidgetHeight;
  columns: number;
  onResize: (id: WidgetId, patch: { width?: WidgetWidth; height?: WidgetHeight }) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<{ cols: number; rows: number } | null>(null);

  const isSingleCol = columns <= 1;
  const widthChoices: readonly WidgetWidth[] =
    columns >= 6 ? (["compact", "wide", "full"] as const) : (["compact", "full"] as const);
  const heightChoices: readonly WidgetHeight[] = ["short", "normal", "tall"] as const;

  const activeSlots = widthSlotsFor(width, columns);
  const activeRows = rowUnitsFor(height);
  const previewCols = hovered?.cols ?? activeSlots;
  const previewRows = hovered?.rows ?? activeRows;
  const previewWidth = widthForSlots(previewCols, columns, width);
  const previewHeight = heightForRows(previewRows);

  const triggerLabel = isSingleCol
    ? t(`dashboardLayout.${height}`)
    : formatSizeCode(width, height, columns);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setHovered(null);
      }}
    >
      <Tooltip content={t("dashboardLayout.sizeTooltip")}>
        <Popover.Trigger>
          <Button
            size="1"
            variant="soft"
            color="gray"
            className="km-dashboard-tool-pill"
            aria-label={t("dashboardLayout.sizeTooltip")}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <LayoutGrid size={12} />
            <span>{triggerLabel}</span>
          </Button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Content
        align="end"
        sideOffset={6}
        className="km-size-popover"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isSingleCol ? (
          <Flex direction="column" gap="2">
            <Text size="1" weight="medium" color="gray">
              {t("dashboardLayout.height")}
            </Text>
            <Flex gap="1">
              {heightChoices.map((option) => (
                <Button
                  key={option}
                  size="1"
                  variant={height === option ? "solid" : "soft"}
                  color={height === option ? undefined : "gray"}
                  onClick={() => {
                    onResize(id, { height: option });
                    setOpen(false);
                  }}
                >
                  {t(`dashboardLayout.${option}`)}
                </Button>
              ))}
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="2">
            <Flex align="center" justify="between" gap="3">
              <Text size="1" weight="medium">
                {t("dashboardLayout.sizeTitle")}
              </Text>
              <Badge size="1" variant="soft">
                {previewCols}×{previewRows}
              </Badge>
            </Flex>
            <div
              className="km-size-matrix"
              style={{
                gridTemplateColumns: `repeat(${widthChoices.length}, 1fr)`,
              }}
              onMouseLeave={() => setHovered(null)}
            >
              {heightChoices.map((hChoice, rIdx) =>
                widthChoices.map((wChoice, cIdx) => {
                  const cellCols = cIdx + 1;
                  const cellRows = rIdx + 1;
                  const isHighlighted = cellCols <= previewCols && cellRows <= previewRows;
                  const isCurrent = cellCols <= activeSlots && cellRows <= activeRows;
                  const isExact = cellCols === activeSlots && cellRows === activeRows;
                  return (
                    <button
                      key={`${wChoice}-${hChoice}`}
                      type="button"
                      className={`km-size-matrix-cell${isHighlighted ? " is-highlighted" : ""}${isCurrent ? " is-current" : ""}${isExact ? " is-exact" : ""}`}
                      onMouseEnter={() => setHovered({ cols: cellCols, rows: cellRows })}
                      onFocus={() => setHovered({ cols: cellCols, rows: cellRows })}
                      onClick={() => {
                        onResize(id, {
                          width: widthForSlots(cellCols, columns, width),
                          height: hChoice,
                        });
                        setOpen(false);
                      }}
                      aria-label={`${t(`dashboardLayout.${wChoice}`)} · ${t(`dashboardLayout.${hChoice}`)}`}
                    />
                  );
                }),
              )}
            </div>
            <Text size="1" color="gray" className="km-size-readout">
              {t("dashboardLayout.sizeSummary", {
                width: t(`dashboardLayout.${previewWidth}`),
                height: t(`dashboardLayout.${previewHeight}`),
              })}
            </Text>
          </Flex>
        )}
      </Popover.Content>
    </Popover.Root>
  );
});

const EmptySlotTile = memo(function EmptySlotTile({
  slot,
  canAdd,
  dragging,
  coveredByGhost,
  disabled,
  onAdd,
}: {
  slot: EmptySlot;
  canAdd: boolean;
  dragging: boolean;
  coveredByGhost: boolean;
  disabled: boolean;
  onAdd: (slot: EmptySlot) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: slot.id,
    data: { slot },
    disabled,
  });

  const primaryLabel = canAdd
    ? t("dashboardLayout.emptySlotAdd", "Add card")
    : t("dashboardLayout.emptySlotDropOnly", "Drop a card here");

  const clickable = canAdd && !disabled && !dragging;

  return (
    <div
      ref={setNodeRef}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`km-dashboard-empty-slot${coveredByGhost ? " is-covered" : ""}${dragging ? " is-drag-target" : ""}`}
      data-clickable={clickable}
      onClick={() => clickable && onAdd(slot)}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onAdd(slot);
        }
      }}
      aria-label={primaryLabel}
      style={{
        gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
        gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
      }}
    >
      <span className="km-dashboard-empty-slot-icon" aria-hidden="true">
        <Plus size={18} />
      </span>
      <Text size="2" weight="medium">
        {dragging ? t("dashboardLayout.emptySlotDropOnly", "Drop a card here") : primaryLabel}
      </Text>
      {canAdd && !dragging && (
        <Text size="1" color="gray">
          {t("dashboardLayout.emptySlotHint", "Click to add or drop a card")}
        </Text>
      )}
    </div>
  );
});

/**
 * 始终挂载在编辑态底部的工具/投放区：
 * 平时作为「+ 添加更多卡片」快捷条，拖拽时原地变为「放到新的一行」投放区，
 * 避免拖起中途临时挂载 DOM 引发 dnd-kit 重新测量抖动。
 */
const BottomBoardActionBar = memo(function BottomBoardActionBar({
  dragging,
  isMultiCol,
  remainingCount,
  disabled,
  onOpenCatalog,
}: {
  dragging: boolean;
  isMultiCol: boolean;
  remainingCount: number;
  disabled: boolean;
  onOpenCatalog: () => void;
}) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({
    id: BOTTOM_NEW_ROW_ID,
    disabled: disabled || !isMultiCol,
  });

  if (!dragging && remainingCount === 0 && !isMultiCol) return null;

  return (
    <div ref={setNodeRef} className="km-dashboard-bottom-bar">
      {dragging && isMultiCol ? (
        <div className={`km-dashboard-bottom-drop-zone${isOver ? " is-over" : ""}`}>
          <Plus size={16} />
          <Text size="2" weight="medium">
            {isOver
              ? t("dashboardLayout.newRowDropActive")
              : t("dashboardLayout.newRowDropHint")}
          </Text>
        </div>
      ) : remainingCount > 0 ? (
        <button
          type="button"
          className="km-dashboard-bottom-add"
          disabled={disabled}
          onClick={onOpenCatalog}
        >
          <Plus size={16} />
          <Text size="2" weight="medium">
            {t("dashboardLayout.bottomAddCard")}
          </Text>
          <Badge size="1" variant="soft" color="gray">
            {t("dashboardLayout.remainingCount", { count: remainingCount })}
          </Badge>
        </button>
      ) : (
        <div className="km-dashboard-bottom-drop-zone is-idle">
          <Text size="1" color="gray">
            {t("dashboardLayout.newRowDropHint")}
          </Text>
        </div>
      )}
    </div>
  );
});

export function DashboardWidget({ children, limit = 5 }: WidgetProps) {
  return <>{typeof children === "function" ? children(limit) : children}</>;
}

/** 隔离开销较大的卡片内容（Recharts SVG / 3D Canvas），拖拽悬停切换高亮时绝不触发重绘。 */
const MemoWidgetContent = memo(function MemoWidgetContent({
  widget,
  limit,
  widgetCtx,
}: {
  widget: ReactElement<WidgetProps>;
  limit: number;
  widgetCtx: DashboardWidgetRenderContextValue;
}) {
  return (
    <DashboardWidgetRenderContext.Provider value={widgetCtx}>
      {cloneElement(widget, { limit })}
    </DashboardWidgetRenderContext.Provider>
  );
});

const SortableWidget = memo(function SortableWidget({
  item,
  index,
  total,
  placement,
  columns,
  gap,
  editing,
  boardDragging,
  isResizing,
  resizingAny,
  dropTargetMode,
  title,
  supportsLimit,
  onRemove,
  onResize,
  onStartResize,
  onMoveStep,
  onLimit,
  widget,
}: {
  item: DashboardLayout[number];
  index: number;
  total: number;
  placement: Placement | undefined;
  columns: number;
  gap: number;
  editing: boolean;
  boardDragging: boolean;
  isResizing: boolean;
  resizingAny: boolean;
  dropTargetMode: "swap" | "place" | null;
  title: string;
  supportsLimit: boolean;
  onRemove: (id: WidgetId) => void;
  onResize: (id: WidgetId, patch: { width?: WidgetWidth; height?: WidgetHeight }) => void;
  onStartResize: (id: WidgetId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveStep: (id: WidgetId, delta: -1 | 1) => void;
  onLimit: (id: WidgetId, limit: WidgetLimit) => void;
  widget: ReactElement<WidgetProps>;
}) {
  const { t } = useTranslation();
  const reduced = useKmReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const isAuto = supportsLimit && item.limit === "auto";
  const spec = AUTO_LIMIT_SPECS[item.id] ?? DEFAULT_AUTO_SPEC;
  const rowSpan = placement?.rowSpan ?? rowUnitsFor(item.height);
  const allocatedCardPx = rowSpan * GRID_UNIT_HEIGHT + Math.max(0, rowSpan - 1) * gap;
  const [bodyBox, setBodyBox] = useState({ width: 0, height: 0 });

  // 由卡片在网格中实际获得的高度单向推导自适应条数（0 反馈环、精准填满格子且绝不溢出/不出滚动条）
  const estimatedLimit = useMemo(() => {
    if (!isAuto) {
      return typeof item.limit === "number" ? item.limit : spec.minRows;
    }
    if (
      spec.singleRowColumnsMinWidth &&
      bodyBox.width > 0 &&
      bodyBox.width < spec.singleRowColumnsMinWidth
    ) {
      return spec.minRows;
    }
    const padY = editing ? 24 : 36;
    const toolsH = editing ? 38 : 0;
    const usableBodyPx =
      columns === 1 || bodyBox.height <= 0
        ? allocatedCardPx - toolsH - padY
        : bodyBox.height - padY;
    const available = usableBodyPx - spec.chromePx;
    const fitted = Math.floor(available / spec.rowPx);
    return Math.max(spec.minRows, Math.min(spec.maxRows, fitted));
  }, [
    isAuto,
    item.limit,
    spec,
    bodyBox.width,
    bodyBox.height,
    columns,
    allocatedCardPx,
    editing,
  ]);

  // 单调向下溢出保护：即使 overflow: hidden 也能精确读取 scrollHeight，确保 1px 都不被裁切且零滚动条
  const heightBucket = columns > 1 ? Math.round(bodyBox.height / 16) : 0;
  const fitContextKey = `${rowSpan}|${item.width}|${columns}|${heightBucket}|${editing}|${item.limit}`;
  const [shrinkState, setShrinkState] = useState({ key: fitContextKey, delta: 0 });
  const shrinkDelta = shrinkState.key === fitContextKey ? shrinkState.delta : 0;
  const effectiveLimit = isAuto
    ? Math.max(spec.minRows, estimatedLimit - shrinkDelta)
    : estimatedLimit;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const maxDelta = Math.max(0, estimatedLimit - spec.minRows);
    const measure = () => {
      const w = Math.round(body.offsetWidth);
      const h = columns > 1 ? Math.round(body.offsetHeight) : 0;
      setBodyBox((prev) =>
        Math.abs(prev.width - w) >= 16 || Math.abs(prev.height - h) >= 16
          ? { width: w, height: h }
          : prev,
      );
      if (
        isAuto &&
        columns > 1 &&
        h > 0 &&
        effectiveLimit > spec.minRows &&
        body.scrollHeight > body.clientHeight + 2
      ) {
        setShrinkState((prev) => {
          const currentDelta = prev.key === fitContextKey ? prev.delta : 0;
          const nextDelta = Math.min(maxDelta, currentDelta + 1);
          if (prev.key === fitContextKey && prev.delta === nextDelta) return prev;
          return { key: fitContextKey, delta: nextDelta };
        });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (innerRef.current) observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, [isAuto, columns, estimatedLimit, effectiveLimit, spec.minRows, fitContextKey]);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !editing || resizingAny,
    transition: { duration: reduced ? 0 : DRAG_TRANSITION_MS, easing: DRAG_EASING },
  });

  const effectiveHeightTier: WidgetHeight =
    rowSpan >= 3 ? "tall" : rowSpan === 2 ? "normal" : "short";
  // 注意：编辑模式下不再随 boardDragging 变动重建 widgetCtx，避免拖起/放下瞬间重绘所有图表与 3D 地球
  const widgetCtx = useMemo<DashboardWidgetRenderContextValue>(
    () => ({
      editing,
      dragging: editing || isDragging || resizingAny,
      isDragPreview: false,
      width: item.width,
      height: effectiveHeightTier,
    }),
    [editing, isDragging, resizingAny, item.width, effectiveHeightTier],
  );

  const isMultiCol = columns > 1;
  const gridPlacementStyle = !isMultiCol
    ? {}
    : placement
      ? (() => {
          const safeColSpan = Math.min(Math.max(1, placement.colSpan), columns);
          const safeCol = Math.min(
            Math.max(0, placement.col),
            Math.max(0, columns - safeColSpan),
          );
          return {
            gridColumn: `${safeCol + 1} / span ${safeColSpan}`,
            gridRow: `${placement.row + 1} / span ${placement.rowSpan}`,
          };
        })()
      : { gridRowEnd: `span ${rowUnitsFor(item.height)}` };

  // 拖拽过程中网格保持绝对静止（避免任何误排与滚动补偿）；松手后与角落缩放时再平滑滑移落位
  const animateLayoutPosition =
    editing && isMultiCol && !boardDragging && !isResizing && !reduced ? "position" : false;
  const sizeCode = formatSizeCode(item.width, item.height, columns || 6);
  const handleDragPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    (listeners?.onPointerDown as ((e: ReactPointerEvent<HTMLElement>) => void) | undefined)?.(
      event,
    );
  };
  const handleDragKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    (listeners?.onKeyDown as ((e: ReactKeyboardEvent<HTMLElement>) => void) | undefined)?.(event);
  };

  return (
    <motion.section
      ref={setNodeRef}
      layout={animateLayoutPosition}
      data-widget={item.id}
      data-width={item.width}
      data-height={item.height}
      className={`km-dashboard-widget${isDragging ? " is-dragging" : ""}${isResizing ? " is-resizing" : ""}${dropTargetMode ? " is-drop-target" : ""}`}
      aria-label={title}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{
        layout: { duration: MOTION_DURATION.base, ease: MOTION_EASE.emphasized },
        opacity: CONTENT_MOTION.transition.opacity,
        scale: CONTENT_MOTION.exitTransition,
      }}
      style={{
        ...(isMultiCol ? {} : { transform: CSS.Translate.toString(transform), transition }),
        ...gridPlacementStyle,
      }}
    >
      <Card className="km-dashboard-widget-card">
        {editing && (
          <div className="km-dashboard-widget-tools">
            <div
              className="km-dashboard-drag-zone"
              onPointerDown={handleDragPointerDown}
              title={t("dashboardLayout.move", { name: title })}
            >
              <Tooltip content={t("dashboardLayout.move", { name: title })}>
                <IconButton
                  ref={setActivatorNodeRef}
                  {...attributes}
                  onKeyDown={handleDragKeyDown}
                  size="1"
                  className="km-dashboard-grip"
                  variant="ghost"
                  color="gray"
                  aria-label={t("dashboardLayout.move", { name: title })}
                >
                  <GripVertical size={15} />
                </IconButton>
              </Tooltip>
              <Text size="1" weight="medium" color="gray" className="km-dashboard-tool-title">
                {title}
              </Text>
            </div>
            <Flex
              align="center"
              gap="1"
              className="km-dashboard-tool-actions"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {!isMultiCol && (
                <>
                  <Tooltip content={t("dashboardLayout.moveUp")}>
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="gray"
                      disabled={index === 0}
                      aria-label={t("dashboardLayout.moveUp")}
                      onClick={() => onMoveStep(item.id, -1)}
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t("dashboardLayout.moveDown")}>
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="gray"
                      disabled={index >= total - 1}
                      aria-label={t("dashboardLayout.moveDown")}
                      onClick={() => onMoveStep(item.id, 1)}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <WidgetSizePopover
                id={item.id}
                width={item.width}
                height={item.height}
                columns={columns || 6}
                onResize={onResize}
              />
              {supportsLimit && (
                <DropdownMenu.Root>
                  <Tooltip
                    content={
                      isAuto
                        ? t("dashboardLayout.autoNodesActive", { count: effectiveLimit })
                        : t("dashboardLayout.visibleNodes")
                    }
                  >
                    <DropdownMenu.Trigger>
                      <Button
                        size="1"
                        variant="soft"
                        color="gray"
                        className="km-dashboard-tool-pill"
                        aria-label={t("dashboardLayout.visibleNodes")}
                      >
                        <ListFilter size={12} />
                        <span>
                          {isAuto ? t("dashboardLayout.autoShort") : effectiveLimit}
                        </span>
                      </Button>
                    </DropdownMenu.Trigger>
                  </Tooltip>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Label>{t("dashboardLayout.visibleNodes")}</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup
                      value={String(item.limit)}
                      onValueChange={(value) =>
                        onLimit(
                          item.id,
                          value === "auto"
                            ? "auto"
                            : (Number(value) as (typeof FIXED_WIDGET_LIMITS)[number]),
                        )
                      }
                    >
                      <DropdownMenu.RadioItem value="auto">
                        {t("dashboardLayout.autoNodes")}
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.Separator />
                      {FIXED_WIDGET_LIMITS.map((limit) => (
                        <DropdownMenu.RadioItem key={limit} value={String(limit)}>
                          {t("dashboardLayout.visibleNodesCount", { count: limit })}
                        </DropdownMenu.RadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              )}
              <Tooltip content={t("dashboardLayout.hide", { name: title })}>
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  className="km-dashboard-remove-btn"
                  onClick={() => onRemove(item.id)}
                  aria-label={t("dashboardLayout.hide", { name: title })}
                >
                  <X size={14} />
                </IconButton>
              </Tooltip>
            </Flex>
          </div>
        )}
        <div className="km-dashboard-widget-body-wrap">
          <div ref={bodyRef} className="km-dashboard-widget-body">
            <div ref={innerRef} className="km-dashboard-widget-content">
              <MemoWidgetContent widget={widget} limit={effectiveLimit} widgetCtx={widgetCtx} />
            </div>
          </div>
          {editing && isMultiCol && (
            <div
              className="km-dashboard-body-drag-shield"
              onPointerDown={handleDragPointerDown}
              aria-hidden="true"
            />
          )}
        </div>
        {editing && isMultiCol && (
          <Tooltip content={t("dashboardLayout.dragResizeHint")}>
            <button
              type="button"
              className="km-dashboard-resize-handle"
              aria-label={t("dashboardLayout.dragResizeHint")}
              onPointerDown={(event) => onStartResize(item.id, event)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M10.5 3.5L3.5 10.5M10.5 7.5L7.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </Tooltip>
        )}
        {isResizing && (
          <div className="km-dashboard-resize-badge" aria-live="polite">
            <Badge size="2" variant="solid">
              {sizeCode} · {t(`dashboardLayout.${item.width}`)} ·{" "}
              {t(`dashboardLayout.${item.height}`)}
            </Badge>
          </div>
        )}
      </Card>
      {dropTargetMode && isMultiCol && (
        <div className="km-dashboard-card-drop-overlay" aria-hidden="true">
          <div className="km-dashboard-card-drop-pill">
            {dropTargetMode === "swap" ? <ArrowLeftRight size={14} /> : <Move size={14} />}
            <Text size="2" weight="medium">
              {dropTargetMode === "swap"
                ? t("dashboardLayout.dropSwapCard", { name: title })
                : t("dashboardLayout.dropMoveCard")}
            </Text>
          </div>
        </div>
      )}
    </motion.section>
  );
});

const BOARD_PLACEHOLDER_BLOCKS = [
  { span: "wide", rows: 2 },
  { span: "compact", rows: 1 },
  { span: "compact", rows: 1 },
  { span: "wide", rows: 2 },
  { span: "compact", rows: 1 },
  { span: "compact", rows: 1 },
] as const;

function BoardPlaceholder() {
  return (
    <div className="km-dashboard-placeholder" aria-hidden="true">
      {BOARD_PLACEHOLDER_BLOCKS.map((block, index) => (
        <Skeletonize
          key={index}
          loading
          className={`km-dashboard-placeholder-block is-${block.span}`}
          style={{ gridRow: `span ${block.rows}` }}
        >
          <div />
        </Skeletonize>
      ))}
    </div>
  );
}

export type DashboardBoardState = {
  visibleIds: ReadonlySet<WidgetId>;
  editing: boolean;
  dragging: boolean;
};

type LayoutHistoryState = {
  past: DashboardLayout[];
  present: DashboardLayout;
  future: DashboardLayout[];
};

type ResizeSession = {
  id: WidgetId;
  pointerId: number;
  handleEl: HTMLButtonElement;
  baseLayout: DashboardLayout;
  columns: number;
  gap: number;
  colWidth: number;
  slotStride: number;
  rowStep: number;
  startX: number;
  startY: number;
  origWidthPx: number;
  origHeightPx: number;
  origWidth: WidgetWidth;
  origHeight: WidgetHeight;
  nextWidth: WidgetWidth;
  nextHeight: WidgetHeight;
  previewLayout: DashboardLayout;
};

export function DashboardBoard({
  children,
  onStateChange,
}: {
  children: ReactElement<WidgetProps>[];
  onStateChange?: (state: DashboardBoardState) => void;
}) {
  const { t } = useTranslation();
  const reduced = useKmReducedMotion();
  const themeResult = useRouteQuery(dashboardThemeQuery);
  const themeData = themeResult.data;

  const initialItems = themeData
    ? parseDashboardConfig(themeData.settings[DASHBOARD_SETTINGS_KEY]).items
    : defaultLayout();
  const [history, setHistory] = useState<LayoutHistoryState>(() => ({
    past: [],
    present: initialItems,
    future: [],
  }));
  const [saved, setSaved] = useState<DashboardLayout>(() => initialItems);
  const [appliedTheme, setAppliedTheme] = useState(themeData);
  if (themeData && themeData !== appliedTheme) {
    const next = parseDashboardConfig(themeData.settings[DASHBOARD_SETTINGS_KEY]).items;
    setAppliedTheme(themeData);
    setSaved(next);
    setHistory({ past: [], present: next, future: [] });
  }

  const layout = history.present;
  const theme = themeData?.theme ?? null;
  const loadError = Boolean(themeResult.error) && !themeResult.loading;
  const layoutReady = themeData !== undefined || themeResult.error !== undefined;
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [slotTarget, setSlotTarget] = useState<EmptySlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<WidgetId | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [resizeSession, setResizeSession] = useState<ResizeSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [boardGrid, setBoardGrid] = useState({ columns: 0, gap: GRID_GAP });

  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const pushLayout = useCallback(
    (nextOrUpdater: DashboardLayout | ((current: DashboardLayout) => DashboardLayout)) => {
      setHistory((prev) => {
        const next =
          typeof nextOrUpdater === "function" ? nextOrUpdater(prev.present) : nextOrUpdater;
        if (sameLayout(next, prev.present)) return prev;
        return {
          past: [...prev.past.slice(-(MAX_HISTORY_STEPS - 1)), prev.present],
          present: next,
          future: [],
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future.slice(0, MAX_HISTORY_STEPS - 1)],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...rest] = prev.future;
      return {
        past: [...prev.past.slice(-(MAX_HISTORY_STEPS - 1)), prev.present],
        present: next,
        future: rest,
      };
    });
  }, []);

  const hasChanges = useMemo(() => !sameLayout(layout, saved), [layout, saved]);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const effectiveLayout = resizeSession?.previewLayout ?? layout;
  const activePreset = useMemo(() => matchDashboardPreset(layout), [layout]);
  const availableWidgetIds = useMemo(
    () => widgetIds.filter((id) => !layout.some((entry) => entry.id === id)),
    [layout],
  );

  // 纯派生网格坐标与空位：彻底杜绝外部可变 store 丢项、StrictMode/HMR 错位与空位不同步
  const { placements, emptySlots } = useMemo(() => {
    if (!layoutReady || boardGrid.columns <= 0) {
      return {
        placements: new Map<WidgetId, Placement>(),
        emptySlots: EMPTY_SLOTS_FALLBACK,
      };
    }
    const input = toPlacementInputs(effectiveLayout, boardGrid.columns);
    const computed = placeWidgets(input, boardGrid.columns, 0, !editing) as Map<
      WidgetId,
      Placement
    >;
    const slots =
      editing && boardGrid.columns > 1
        ? findEmptySlots(computed, boardGrid.columns)
        : EMPTY_SLOTS_FALLBACK;
    return { placements: computed, emptySlots: slots };
  }, [layoutReady, effectiveLayout, boardGrid.columns, editing]);

  const canTidy = useMemo(() => {
    if (!editing || boardGrid.columns <= 1 || layout.length <= 1) return false;
    if (emptySlots.length > 0) return true;
    return layout.some((entry) => entry.col !== undefined || entry.row !== undefined);
  }, [editing, boardGrid.columns, layout, emptySlots.length]);

  const visibleIdsKey = layoutReady ? layout.map((entry) => entry.id).join(",") : "";
  useEffect(() => {
    if (!onStateChange) return;
    const ids = new Set<WidgetId>(
      visibleIdsKey ? (visibleIdsKey.split(",") as WidgetId[]) : [],
    );
    // 编辑模式下已暂停实时轮询，不再因拖拽态变化触发父级页面全量重渲染
    onStateChange({ visibleIds: ids, editing, dragging: false });
  }, [onStateChange, visibleIdsKey, editing]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const grid = gridRef.current;
    if (!board || !grid) return;
    const read = (entry?: ResizeObserverEntry) => {
      const inlineWidth =
        entry?.contentBoxSize?.[0]?.inlineSize ?? board.getBoundingClientRect().width;
      if (inlineWidth <= 0) return;
      const columns = columnsForWidth(inlineWidth);
      const rowGap = parseFloat(getComputedStyle(grid).rowGap) || GRID_GAP;
      setBoardGrid((prev) =>
        prev.columns === columns && prev.gap === rowGap ? prev : { columns, gap: rowGap },
      );
    };
    read();
    const observer = new ResizeObserver((entries) => {
      read(entries[0]);
    });
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const persistLayout = useCallback(
    async (next: DashboardLayout, toastMessage: string) => {
      if (theme === null) return false;
      setSaving(true);
      try {
        await saveThemeSettings(theme, {
          [DASHBOARD_SETTINGS_KEY]: serializeDashboardConfig(next),
        });
        setSaved(next);
        toast.success(toastMessage);
        return true;
      } catch {
        toast.error(t("dashboardLayout.saveFailed"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [theme, t],
  );

  const save = useCallback(async () => {
    if (!hasChanges) {
      setEditing(false);
      return;
    }
    const ok = await persistLayout(layout, t("dashboardLayout.saved"));
    if (ok) {
      setHistory({ past: [], present: layout, future: [] });
      setEditing(false);
    }
  }, [hasChanges, persistLayout, layout, t]);

  // 编辑模式键盘快捷键：Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z / Ctrl+Y 重做、Ctrl/Cmd+S 保存
  useEffect(() => {
    if (!editing || choosing || saving) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape" && resizeSessionRef.current) {
        event.preventDefault();
        const current = resizeSessionRef.current;
        try {
          current.handleEl.releasePointerCapture(current.pointerId);
        } catch {
          // ignore if capture already released
        }
        resizeSessionRef.current = null;
        setResizeSession(null);
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      } else if (key === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, choosing, saving, undo, redo, save]);

  // 拖拽卡片右下角直接调整尺寸的全局指针追踪
  useEffect(() => {
    if (!resizeSession) return;
    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      const maxSlots = session.columns >= 6 ? 3 : 2;
      const rawSlots = Math.round((session.origWidthPx + dx + session.gap) / session.slotStride);
      const snappedSlots = Math.min(maxSlots, Math.max(1, rawSlots));
      const nextWidth = widthForSlots(snappedSlots, session.columns, session.origWidth);

      const rawRows = Math.round((session.origHeightPx + dy + session.gap) / session.rowStep);
      const snappedRows = Math.min(3, Math.max(1, rawRows));
      const nextHeight = heightForRows(snappedRows);

      if (nextWidth === session.nextWidth && nextHeight === session.nextHeight) return;
      const previewLayout = resizeWidgetKeepPositions(
        session.baseLayout,
        session.id,
        { width: nextWidth, height: nextHeight },
        session.columns,
      );
      const updated: ResizeSession = {
        ...session,
        nextWidth,
        nextHeight,
        previewLayout,
      };
      resizeSessionRef.current = updated;
      setResizeSession(updated);
    };

    const finishResize = (commit: boolean) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      try {
        session.handleEl.releasePointerCapture(session.pointerId);
      } catch {
        // ignore if already released
      }
      resizeSessionRef.current = null;
      setResizeSession(null);
      if (
        commit &&
        (session.nextWidth !== session.origWidth || session.nextHeight !== session.origHeight)
      ) {
        pushLayout(session.previewLayout);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (resizeSessionRef.current && event.pointerId === resizeSessionRef.current.pointerId) {
        finishResize(true);
      }
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (resizeSessionRef.current && event.pointerId === resizeSessionRef.current.pointerId) {
        finishResize(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [resizeSession !== null, pushLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  const columnsRef = useRef(boardGrid.columns || 6);
  columnsRef.current = boardGrid.columns || 6;

  const handleRemoveWidget = useCallback(
    (id: WidgetId) => {
      pushLayout((current) => removeWidgetKeepPositions(current, id, columnsRef.current));
    },
    [pushLayout],
  );

  const handleResizeWidget = useCallback(
    (id: WidgetId, patch: { width?: WidgetWidth; height?: WidgetHeight }) => {
      pushLayout((current) => resizeWidgetKeepPositions(current, id, patch, columnsRef.current));
    },
    [pushLayout],
  );

  const handleMoveStepWidget = useCallback(
    (id: WidgetId, delta: -1 | 1) => {
      pushLayout((current) => {
        const idx = current.findIndex((entry) => entry.id === id);
        const nextIdx = idx + delta;
        if (idx < 0 || nextIdx < 0 || nextIdx >= current.length) return current;
        return arrayMove(current, idx, nextIdx);
      });
    },
    [pushLayout],
  );

  const handleLimitWidget = useCallback(
    (id: WidgetId, limit: WidgetLimit) => {
      pushLayout((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, limit } : entry)),
      );
    },
    [pushLayout],
  );

  const handleAddFromSlot = useCallback((target: EmptySlot) => {
    setSlotTarget(target);
    setChoosing(true);
  }, []);

  const handleOpenCatalog = useCallback(() => {
    setSlotTarget(null);
    setChoosing(true);
  }, []);

  const startResize = useCallback(
    (id: WidgetId, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const columns = boardGrid.columns || 6;
      const gridEl = gridRef.current;
      if (columns <= 1 || !gridEl) return;
      const gridRect = gridEl.getBoundingClientRect();
      if (gridRect.width <= 0) return;

      const baseLayout = materializeLayoutCoords(layout, columns);
      const target = baseLayout.find((entry) => entry.id === id);
      if (!target) return;

      const gap = boardGrid.gap || GRID_GAP;
      const unitCol = columns >= 4 ? 2 : 1;
      const colWidth = (gridRect.width - (columns - 1) * gap) / columns;
      const slotStride = unitCol * (colWidth + gap);
      const rowStep = GRID_UNIT_HEIGHT + gap;
      const origColSpan = colSpanFor(target.width, columns);
      const origRows = rowUnitsFor(target.height);
      const origWidthPx = origColSpan * colWidth + (origColSpan - 1) * gap;
      const origHeightPx = origRows * GRID_UNIT_HEIGHT + (origRows - 1) * gap;

      const handleEl = event.currentTarget;
      try {
        handleEl.setPointerCapture(event.pointerId);
      } catch {
        // fallback to window listeners
      }

      const session: ResizeSession = {
        id,
        pointerId: event.pointerId,
        handleEl,
        baseLayout,
        columns,
        gap,
        colWidth,
        slotStride,
        rowStep,
        startX: event.clientX,
        startY: event.clientY,
        origWidthPx,
        origHeightPx,
        origWidth: target.width,
        origHeight: target.height,
        nextWidth: target.width,
        nextHeight: target.height,
        previewLayout: baseLayout,
      };
      resizeSessionRef.current = session;
      setResizeSession(session);
    },
    [boardGrid.columns, boardGrid.gap, layout],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const widgets = useMemo(
    () =>
      new Map(
        (Children.toArray(children) as ReactElement<WidgetProps>[]).map((child) => [
          child.props.id,
          child,
        ]),
      ),
    [children],
  );
  const title = (id: WidgetId) => t(`dashboardLayout.widgets.${id}`);
  const widgetDesc = (id: WidgetId) => t(`dashboardLayout.widgetDescs.${id}`);
  const presetName = (id: DashboardPresetId | "custom") =>
    id === "custom"
      ? t("dashboardLayout.customPreset", "Custom")
      : t(`dashboardLayout.presets.${id}.name`);

  const handleDragStart = (event: DragStartEvent) => {
    setActive(event.active.id as WidgetId);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const nextOver = event.over ? String(event.over.id) : null;
    setOverId((prev) => (prev === nextOver ? prev : nextOver));
  };

  const handleDragCancel = () => {
    setActive(null);
    setOverId(null);
  };

  const handleDragEnd = ({ active: dragActive, over }: DragEndEvent) => {
    setActive(null);
    setOverId(null);
    if (!over || dragActive.id === over.id) return;

    const cols = boardGrid.columns || 6;
    const targetId = String(over.id);

    if (targetId === BOTTOM_NEW_ROW_ID) {
      pushLayout((current) => placeWidgetOnNewBottomRow(current, dragActive.id as WidgetId, cols));
      return;
    }

    if (targetId.startsWith(EMPTY_SLOT_PREFIX)) {
      const slot = (over.data.current as { slot?: EmptySlot } | undefined)?.slot;
      if (slot) {
        pushLayout((current) => {
          const target = current.find((entry) => entry.id === dragActive.id);
          if (!target) return current;
          return placeWidgetIntoSlot(current, target, slot, cols);
        });
      }
      return;
    }

    pushLayout((current) =>
      moveWidgetOntoWidget(current, dragActive.id as WidgetId, over.id as WidgetId, cols),
    );
  };

  const isMultiCol = boardGrid.columns > 1;
  const dialogCols = boardGrid.columns || 6;
  const activeWidgetItem = active ? effectiveLayout.find((entry) => entry.id === active) : undefined;

  // 当指针悬停在某个空位上时，精确计算即将落位的无冲突坐标与尺寸（与松手结果 100% 相同）
  const hoveredSlotGhost = useMemo(() => {
    if (!active || !activeWidgetItem || !overId || !isMultiCol) return null;
    if (!overId.startsWith(EMPTY_SLOT_PREFIX)) return null;
    const slot = emptySlots.find((entry) => entry.id === overId);
    if (!slot) return null;
    const fit = computeSlotFit(layout, activeWidgetItem, slot, boardGrid.columns || 6);
    return {
      col: fit.col,
      row: fit.row,
      colSpan: fit.colSpan,
      rowSpan: fit.rowSpan,
      width: fit.width,
      height: fit.height,
      resized: fit.resized,
    };
  }, [active, activeWidgetItem, overId, isMultiCol, emptySlots, layout, boardGrid.columns]);

  // 多列网格下以固定 widgetIds 顺序渲染 DOM（视觉位置完全由 gridColumn/gridRow 决定），
  // 杜绝松手后 React 对 DOM 执行 insertBefore 重排导致 Canvas/Recharts 重挂闪烁
  const visibleLayout = useMemo(() => {
    if (!layoutReady) return [];
    if (!isMultiCol) return effectiveLayout;
    return [...effectiveLayout].sort(
      (a, b) => (WIDGET_ORDER.get(a.id) ?? 0) - (WIDGET_ORDER.get(b.id) ?? 0),
    );
  }, [layoutReady, isMultiCol, effectiveLayout]);

  const renderedWidgets = visibleLayout.map((item, index) => {
    const widget = widgets.get(item.id);
    if (!widget) return null;
    let dropTargetMode: "swap" | "place" | null = null;
    if (
      active &&
      activeWidgetItem &&
      overId === item.id &&
      active !== item.id &&
      isMultiCol
    ) {
      const cols = boardGrid.columns || 6;
      const sameSize =
        colSpanFor(activeWidgetItem.width, cols) === colSpanFor(item.width, cols) &&
        rowUnitsFor(activeWidgetItem.height) === rowUnitsFor(item.height);
      dropTargetMode = sameSize ? "swap" : "place";
    }

    return (
      <SortableWidget
        key={item.id}
        item={item}
        index={index}
        total={visibleLayout.length}
        placement={placements.get(item.id)}
        columns={boardGrid.columns}
        gap={boardGrid.gap}
        title={title(item.id)}
        editing={editing && !saving}
        boardDragging={active !== null}
        isResizing={resizeSession?.id === item.id}
        resizingAny={resizeSession !== null}
        dropTargetMode={dropTargetMode}
        supportsLimit={Boolean(widget.props.supportsLimit)}
        onRemove={handleRemoveWidget}
        onResize={handleResizeWidget}
        onStartResize={startResize}
        onMoveStep={handleMoveStepWidget}
        onLimit={handleLimitWidget}
        widget={widget}
      />
    );
  });

  const applyPreset = async (presetId: DashboardPresetId) => {
    const next = presetLayout(presetId);
    if (editing) {
      pushLayout(next);
      return;
    }
    const previous = layout;
    setHistory({ past: [], present: next, future: [] });
    const ok = await persistLayout(
      next,
      t("dashboardLayout.presetApplied", { name: presetName(presetId) }),
    );
    if (!ok) setHistory({ past: [], present: previous, future: [] });
  };

  const presetMenu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="soft" color="gray" disabled={theme === null || saving}>
          <LayoutTemplate size={15} />
          {editing ? t("dashboardLayout.applyPreset") : presetName(activePreset)}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="km-dashboard-preset-menu">
        <DropdownMenu.Label>{t("dashboardLayout.presetsLabel")}</DropdownMenu.Label>
        {DASHBOARD_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.id];
          const selected = activePreset === preset.id;
          return (
            <DropdownMenu.Item
              key={preset.id}
              onSelect={() => void applyPreset(preset.id)}
              className="km-dashboard-preset-item"
            >
              <Flex align="start" gap="2" className="w-full py-0.5">
                <Icon size={15} className="mt-0.5 shrink-0" />
                <Flex direction="column" gap="0" className="min-w-0 flex-1">
                  <Flex align="center" justify="between" gap="2">
                    <Text size="2" weight="medium">
                      {t(`dashboardLayout.presets.${preset.id}.name`)}
                    </Text>
                    <Flex align="center" gap="1" className="shrink-0">
                      <Badge size="1" variant="soft" color="gray">
                        {preset.items.length}
                      </Badge>
                      {selected && <Check size={14} color="var(--accent-11)" />}
                    </Flex>
                  </Flex>
                  <Text size="1" color="gray" className="whitespace-normal leading-snug">
                    {t(`dashboardLayout.presets.${preset.id}.desc`)}
                  </Text>
                </Flex>
              </Flex>
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );

  const ActiveDragIcon = active ? WIDGET_ICONS[active] : null;
  const sortableIds = useMemo(() => visibleLayout.map((item) => item.id), [visibleLayout]);

  return (
    <div
      ref={boardRef}
      className="km-dashboard-board"
      data-editing={editing}
      data-dragging={active !== null}
      data-resizing={resizeSession !== null}
    >
      <Flex
        align="center"
        justify="between"
        gap="3"
        wrap="wrap"
        className="km-dashboard-board-toolbar"
      >
        <Flex gap="2" align="center" wrap="wrap">
          <LayoutDashboard size={16} color="var(--gray-10)" />
          <Text size="2" weight="medium">
            {t(editing ? "dashboardLayout.editing" : "dashboardLayout.workspace")}
          </Text>
          <Skeletonize as="span" loading={theme === null && !loadError}>
            <Badge color="gray" variant="soft">
              {layout.length} / {widgetIds.length}
            </Badge>
          </Skeletonize>
          {editing && hasChanges && (
            <Badge variant="soft" size="1">
              {t("dashboardLayout.unsaved")}
            </Badge>
          )}
        </Flex>
        <Flex gap="2" align="center" wrap="wrap">
          {loadError ? (
            <Button
              size="2"
              variant="soft"
              color="red"
              onClick={() => void themeResult.reload()}
            >
              <RotateCcw size={14} />
              {t("dashboardLayout.loadFailed")}
            </Button>
          ) : editing ? (
            <>
              <Flex gap="1" align="center">
                <Tooltip content={t("dashboardLayout.undo")}>
                  <IconButton
                    variant="soft"
                    color="gray"
                    disabled={!canUndo || saving}
                    aria-label={t("dashboardLayout.undo")}
                    onClick={undo}
                  >
                    <Undo2 size={15} />
                  </IconButton>
                </Tooltip>
                <Tooltip content={t("dashboardLayout.redo")}>
                  <IconButton
                    variant="soft"
                    color="gray"
                    disabled={!canRedo || saving}
                    aria-label={t("dashboardLayout.redo")}
                    onClick={redo}
                  >
                    <Redo2 size={15} />
                  </IconButton>
                </Tooltip>
              </Flex>
              {isMultiCol && (
                <Tooltip content={t("dashboardLayout.tidyTooltip")}>
                  <Button
                    variant="soft"
                    color="gray"
                    disabled={!canTidy || saving}
                    onClick={() =>
                      pushLayout((current) => tidyLayout(current, boardGrid.columns || 6))
                    }
                  >
                    <Sparkles size={14} />
                    {t("dashboardLayout.tidy")}
                  </Button>
                </Tooltip>
              )}
              {presetMenu}
              <Button variant="soft" disabled={saving} onClick={handleOpenCatalog}>
                <Plus size={15} />
                {t("dashboardLayout.cards")}
              </Button>
              <Tooltip content={t("dashboardLayout.reset")}>
                <IconButton
                  variant="ghost"
                  color="gray"
                  disabled={saving}
                  aria-label={t("dashboardLayout.reset")}
                  onClick={() => pushLayout(defaultLayout())}
                >
                  <RotateCcw size={15} />
                </IconButton>
              </Tooltip>
              <Button
                variant="soft"
                color="gray"
                disabled={saving}
                onClick={() => {
                  setHistory({ past: [], present: saved, future: [] });
                  setEditing(false);
                }}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                <Check size={15} />
                {hasChanges ? t("common.save", "Save") : t("common.done", "Done")}
              </Button>
            </>
          ) : (
            <>
              {presetMenu}
              <Button
                variant="soft"
                disabled={theme === null}
                onClick={() => {
                  setHistory({ past: [], present: layout, future: [] });
                  setEditing(true);
                }}
              >
                <Settings2 size={15} />
                {t("dashboardLayout.customize")}
              </Button>
            </>
          )}
        </Flex>
      </Flex>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="km-dashboard-edit-guide"
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard }}
            className="km-dashboard-edit-guide"
          >
            <Text size="1" color="gray">
              {isMultiCol
                ? t("dashboardLayout.editGuideDesktop")
                : t("dashboardLayout.editGuideMobile")}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        measuring={DND_MEASURING}
        collisionDetection={dashboardCollisionDetection}
        accessibility={{
          screenReaderInstructions: { draggable: t("dashboardLayout.keyboard") },
          announcements: {
            onDragStart: ({ active: dragActive }) =>
              t("dashboardLayout.picked", { name: title(dragActive.id as WidgetId) }),
            onDragOver: ({ active: dragActive, over }) => {
              if (!over) return undefined;
              const target = String(over.id);
              if (target === BOTTOM_NEW_ROW_ID) {
                return t("dashboardLayout.newRowDropActive");
              }
              if (target.startsWith(EMPTY_SLOT_PREFIX)) {
                return t("dashboardLayout.emptySlotDropActive", "Release to place here");
              }
              return t("dashboardLayout.moved", {
                name: title(dragActive.id as WidgetId),
                position: effectiveLayout.findIndex((item) => item.id === over.id) + 1,
              });
            },
            onDragEnd: () => t("dashboardLayout.dropped"),
            onDragCancel: () => t("dashboardLayout.cancelled"),
          },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={isMultiCol ? noopSortingStrategy : verticalListSortingStrategy}
        >
          <div className="km-dashboard-stage">
            <AnimatePresence initial={false} mode="popLayout">
              {!layoutReady && (
                <motion.div
                  key="km-dashboard-placeholder"
                  className="km-dashboard-placeholder-layer"
                  initial={false}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: reduced ? { duration: 0 } : CONTENT_MOTION.exitTransition,
                  }}
                >
                  <BoardPlaceholder />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={gridRef} className="km-dashboard-grid">
              <AnimatePresence initial={false}>{renderedWidgets}</AnimatePresence>
              {layoutReady &&
                editing &&
                isMultiCol &&
                emptySlots.map((slot) => {
                  const coveredByGhost = Boolean(
                    hoveredSlotGhost &&
                      slot.col >= hoveredSlotGhost.col &&
                      slot.col < hoveredSlotGhost.col + hoveredSlotGhost.colSpan &&
                      slot.row >= hoveredSlotGhost.row &&
                      slot.row < hoveredSlotGhost.row + hoveredSlotGhost.rowSpan,
                  );
                  return (
                    <EmptySlotTile
                      key={slot.id}
                      slot={slot}
                      canAdd={availableWidgetIds.length > 0}
                      dragging={active !== null}
                      coveredByGhost={coveredByGhost}
                      disabled={saving || resizeSession !== null}
                      onAdd={handleAddFromSlot}
                    />
                  );
                })}
              {hoveredSlotGhost && active && ActiveDragIcon && (
                <div
                  className="km-dashboard-slot-ghost"
                  aria-hidden="true"
                  style={{
                    gridColumn: `${hoveredSlotGhost.col + 1} / span ${hoveredSlotGhost.colSpan}`,
                    gridRow: `${hoveredSlotGhost.row + 1} / span ${hoveredSlotGhost.rowSpan}`,
                  }}
                >
                  <Flex align="center" gap="2" wrap="wrap" justify="center">
                    <ActiveDragIcon size={16} />
                    <Text size="2" weight="medium">
                      {t("dashboardLayout.emptySlotDropActive", "Release to place here")}
                    </Text>
                  </Flex>
                  <Flex align="center" gap="1" wrap="wrap" justify="center">
                    <Text size="1" color="gray">
                      {title(active)}
                    </Text>
                    {hoveredSlotGhost.resized && (
                      <Badge size="1" variant="soft">
                        {t("dashboardLayout.dropFitSize", {
                          size: formatSizeCode(
                            hoveredSlotGhost.width,
                            hoveredSlotGhost.height,
                            boardGrid.columns || 6,
                          ),
                        })}
                      </Badge>
                    )}
                  </Flex>
                </div>
              )}
            </div>
          </div>
        </SortableContext>

        {layoutReady && editing && layout.length > 0 && (
          <BottomBoardActionBar
            dragging={active !== null}
            isMultiCol={isMultiCol}
            remainingCount={availableWidgetIds.length}
            disabled={saving}
            onOpenCatalog={handleOpenCatalog}
          />
        )}

        <DragOverlay
          adjustScale={false}
          modifiers={isMultiCol ? [snapCenterToCursor] : undefined}
          dropAnimation={null}
        >
          {active && ActiveDragIcon && activeWidgetItem && (
            <div className="km-dashboard-drag-chip">
              <GripVertical size={15} color="var(--gray-9)" className="shrink-0" />
              <span className="km-dashboard-drag-chip-icon" aria-hidden="true">
                <ActiveDragIcon size={15} />
              </span>
              <Text size="2" weight="medium" className="truncate flex-1">
                {title(active)}
              </Text>
              {isMultiCol && (
                <Badge size="1" variant="soft" className="shrink-0">
                  {formatSizeCode(
                    activeWidgetItem.width,
                    activeWidgetItem.height,
                    boardGrid.columns || 6,
                  )}
                </Badge>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AnimatePresence initial={false}>
        {layoutReady && layout.length === 0 && (
          <PresenceBox key="km-dashboard-empty" className="km-dashboard-empty">
            <LayoutDashboard size={28} color="var(--gray-9)" />
            <Text size="2" color="gray">
              {t("dashboardLayout.empty")}
            </Text>
            <Button
              variant="soft"
              disabled={theme === null}
              onClick={() => {
                setEditing(true);
                setChoosing(true);
              }}
            >
              <Plus size={15} />
              {t("dashboardLayout.cards")}
            </Button>
          </PresenceBox>
        )}
      </AnimatePresence>

      <Dialog.Root
        open={choosing}
        onOpenChange={(open) => {
          setChoosing(open);
          if (!open) setSlotTarget(null);
        }}
      >
        <Dialog.Content maxWidth="540px">
          <Dialog.Title>
            {slotTarget
              ? t("dashboardLayout.addToSlotTitle", "Add card to this space")
              : t("dashboardLayout.cards")}
          </Dialog.Title>
          <Dialog.Description size="2" color="gray">
            {slotTarget
              ? t(
                  "dashboardLayout.addToSlotDesc",
                  "Pick a hidden card. Its size will fit this empty space automatically.",
                )
              : t("dashboardLayout.selection", { count: layout.length })}
          </Dialog.Description>
          {slotTarget ? (
            <div className="km-dashboard-catalog">
              {availableWidgetIds.length === 0 ? (
                <Flex align="center" justify="center" py="6">
                  <Text size="2" color="gray">
                    {t(
                      "dashboardLayout.allCardsAdded",
                      "All available cards are already on the board",
                    )}
                  </Text>
                </Flex>
              ) : (
                availableWidgetIds.map((id) => {
                  const Icon = WIDGET_ICONS[id];
                  const candidate: DashboardLayout[number] = {
                    id,
                    width: defaultWidth(id),
                    height: defaultHeight(id),
                    limit: defaultLimit(),
                  };
                  const fit = computeSlotFit(layout, candidate, slotTarget, dialogCols);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="km-dashboard-slot-picker-row"
                      onClick={() => {
                        pushLayout((current) =>
                          placeWidgetIntoSlot(current, candidate, slotTarget, dialogCols),
                        );
                        setChoosing(false);
                        setSlotTarget(null);
                      }}
                    >
                      <span className="km-dashboard-catalog-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="km-dashboard-catalog-meta">
                        <Text size="2" weight="medium">
                          {title(id)}
                        </Text>
                        <Text size="1" color="gray" className="km-dashboard-catalog-desc">
                          {widgetDesc(id)}
                        </Text>
                      </div>
                      <Flex align="center" gap="2" className="shrink-0">
                        <Badge size="1" variant="soft" color="gray">
                          {formatSizeCode(fit.width, fit.height, dialogCols)}
                        </Badge>
                        <Plus size={15} color="var(--accent-11)" />
                      </Flex>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <motion.div
              className="km-dashboard-catalog"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={{
                initial: {},
                animate: {
                  transition: {
                    staggerChildren: CONTENT_MOTION.stagger(1),
                    delayChildren: MOTION_DURATION.instant,
                  },
                },
                exit: {},
              }}
            >
              {widgetIds.map((id) => {
                const Icon = WIDGET_ICONS[id];
                const checked = layout.some((item) => item.id === id);
                return (
                  <motion.label
                    key={id}
                    className={`km-dashboard-catalog-row${checked ? " is-selected" : ""}`}
                    variants={{
                      initial: { opacity: 0, y: 6 },
                      animate: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          y: MOTION_SPRING.snappy,
                          opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
                        },
                      },
                      exit: { opacity: 0, y: 4 },
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        pushLayout((current) => {
                          const cols = boardGrid.columns || 6;
                          if (nextChecked === true) {
                            const existing = materializeLayoutCoords(
                              current.filter((item) => item.id !== id),
                              cols,
                            );
                            return resolveAndSortLayout(
                              [
                                ...existing,
                                {
                                  id,
                                  width: defaultWidth(id),
                                  height: defaultHeight(id),
                                  limit: defaultLimit(),
                                },
                              ],
                              cols,
                            );
                          }
                          return removeWidgetKeepPositions(current, id, cols);
                        })
                      }
                    />
                    <span className="km-dashboard-catalog-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div className="km-dashboard-catalog-meta">
                      <Text size="2" weight="medium">
                        {title(id)}
                      </Text>
                      <Text size="1" color="gray" className="km-dashboard-catalog-desc">
                        {widgetDesc(id)}
                      </Text>
                    </div>
                    {dialogCols > 1 && (
                      <Badge size="1" variant="soft" color="gray" className="shrink-0">
                        {formatSizeCode(defaultWidth(id), defaultHeight(id), dialogCols)}
                      </Badge>
                    )}
                  </motion.label>
                );
              })}
            </motion.div>
          )}
          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant={slotTarget ? "soft" : "solid"} color={slotTarget ? "gray" : undefined}>
                {slotTarget ? t("common.cancel", "Cancel") : t("common.done", "Done")}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
