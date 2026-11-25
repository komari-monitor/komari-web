/**
 * 仪表盘网格摆放：在 CSS Grid 的 8px 细行上模拟 `grid-auto-flow: row dense`，再做对齐：
 * - 并排卡片的顶边/底边「差一点没对齐」（相差 1..snapRows 行）最显眼，像是排版出错；
 *   差得多则读作有意的错落。于是尝试把矮的卡片拉高到邻居底边，挑代价最低的方案；
 * - 代价 = 差一点没对齐的边 > 留下的空洞 > 总高度；
 * - 最后卡片正下方到网格底部之间若是空的，就延伸过去补满，底边齐平。
 */
export type PlacementInput = {
  id: string;
  colSpan: number;
  rows: number;
  /** 可选显式列起点（0 起）；存在时优先固定在该格，避免编辑时其余卡片乱跳 */
  col?: number;
  /** 可选显式行起点（0 起）；存在时优先固定在该行 */
  row?: number;
};
export type Placement = { col: number; row: number; colSpan: number; rowSpan: number };
export type EmptySlot = {
  id: string;
  row: number;
  col: number;
  colSpan: number;
  rowSpan: number;
  /** 从该空位起在同一行连续可用的列宽 */
  availCols: number;
  /** 从该空位起在当前总行高内向下连续可用的行数 */
  availRows: number;
};
export const EMPTY_SLOT_PREFIX = "slot:";
type Layout = Map<string, Placement>;

const hasExplicitPos = (item: PlacementInput): item is PlacementInput & { col: number; row: number } =>
  typeof item.col === "number" &&
  Number.isInteger(item.col) &&
  item.col >= 0 &&
  typeof item.row === "number" &&
  Number.isInteger(item.row) &&
  item.row >= 0;

/** 折叠整行全空的横条（保留卡片旁边的局部空位），避免页面出现一整行完全空白的断层。 */
function collapseEmptyRows(result: Layout) {
  if (result.size === 0) return;
  let bottom = 0;
  const rowUsed = new Set<number>();
  for (const p of result.values()) {
    bottom = Math.max(bottom, p.row + p.rowSpan);
    for (let r = p.row; r < p.row + p.rowSpan; r += 1) rowUsed.add(r);
  }
  const shift = new Map<number, number>();
  let emptyAbove = 0;
  for (let r = 0; r < bottom; r += 1) {
    shift.set(r, emptyAbove);
    if (!rowUsed.has(r)) emptyAbove += 1;
  }
  if (emptyAbove === 0) return;
  for (const p of result.values()) {
    p.row -= shift.get(p.row) ?? 0;
  }
}

function pack(items: PlacementInput[], rows: Map<string, number>, columns: number): Layout {
  const result: Layout = new Map();
  if (columns <= 1) {
    const ordered = items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const ra = hasExplicitPos(a.item) ? a.item.row : Number.MAX_SAFE_INTEGER;
        const rb = hasExplicitPos(b.item) ? b.item.row : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        const ca = hasExplicitPos(a.item) ? a.item.col : Number.MAX_SAFE_INTEGER;
        const cb = hasExplicitPos(b.item) ? b.item.col : Number.MAX_SAFE_INTEGER;
        if (ca !== cb) return ca - cb;
        return a.index - b.index;
      });
    let cursor = 0;
    for (const { item } of ordered) {
      const rowSpan = Math.max(1, rows.get(item.id) ?? item.rows);
      result.set(item.id, { col: 0, row: cursor, colSpan: 1, rowSpan });
      cursor += rowSpan;
    }
    return result;
  }

  const occupied: boolean[][] = [];
  const free = (row: number, col: number, colSpan: number, rowSpan: number) => {
    if (col < 0 || col + colSpan > columns || row < 0) return false;
    for (let r = row; r < row + rowSpan; r += 1) {
      const line = occupied[r];
      if (!line) continue;
      for (let c = col; c < col + colSpan; c += 1) if (line[c]) return false;
    }
    return true;
  };
  const occupy = (row: number, col: number, colSpan: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r += 1) {
      const line = occupied[r] ?? (occupied[r] = []);
      for (let c = col; c < col + colSpan; c += 1) line[c] = true;
    }
  };

  const pinned: PlacementInput[] = [];
  const floating: PlacementInput[] = [];
  for (const item of items) {
    if (hasExplicitPos(item)) pinned.push(item);
    else floating.push(item);
  }

  // 1. 先按显式坐标摆放已定位卡片：优先保留原格，冲突时向下顺延且严格保证 col + colSpan <= columns
  for (const item of pinned) {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns);
    const rowSpan = Math.max(1, rows.get(item.id) ?? item.rows);
    const colStep = columns >= 4 && colSpan % 2 === 0 ? 2 : 1;
    const maxCol = Math.max(0, columns - colSpan);
    const rawCol = Math.min(Math.max(0, item.col!), maxCol);
    const prefCol = colStep > 1 ? Math.floor(rawCol / colStep) * colStep : rawCol;
    let row = Math.max(0, item.row!);
    let col = -1;
    while (col < 0) {
      if (free(row, prefCol, colSpan, rowSpan)) {
        col = prefCol;
      } else {
        for (let c = 0; c + colSpan <= columns; c += colStep) {
          if (free(row, c, colSpan, rowSpan)) { col = c; break; }
        }
      }
      if (col < 0) row += 1;
    }
    occupy(row, col, colSpan, rowSpan);
    result.set(item.id, { col, row, colSpan, rowSpan });
  }

  // 2. 再为未指定坐标的卡片（预设、旧布局、工具栏勾选的新卡）从上到下找首个可容纳空位
  for (const item of floating) {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns);
    const rowSpan = Math.max(1, rows.get(item.id) ?? item.rows);
    const colStep = columns >= 4 && colSpan % 2 === 0 ? 2 : 1;
    let row = 0;
    let col = -1;
    while (col < 0) {
      for (let c = 0; c + colSpan <= columns; c += colStep) {
        if (free(row, c, colSpan, rowSpan)) { col = c; break; }
      }
      if (col < 0) row += 1;
    }
    occupy(row, col, colSpan, rowSpan);
    result.set(item.id, { col, row, colSpan, rowSpan });
  }

  collapseEmptyRows(result);
  return result;
}

/** 仅按卡片真实宽/高紧密摆放（不做底部自动拉伸），用于编辑模式露出空位与拖放仿真。 */
export function packWidgets(items: PlacementInput[], columns: number): Layout {
  const rows = new Map(items.map((item) => [item.id, Math.max(1, item.rows)]));
  return pack(items, rows, columns);
}

/** 计算当前布局的总行高（用于支持拖到最底部新建行）。 */
export function getGridBottom(layout: Layout): number {
  let bottom = 0;
  for (const p of layout.values()) {
    bottom = Math.max(bottom, p.row + p.rowSpan);
  }
  return bottom;
}

const spansOverlap = (
  a: { col: number; row: number; colSpan: number; rows: number },
  b: { col: number; row: number; colSpan: number; rows: number },
) =>
  a.col < b.col + b.colSpan &&
  b.col < a.col + a.colSpan &&
  a.row < b.row + b.rows &&
  b.row < a.row + a.rows;

/**
 * 在不动用其余任何卡片的前提下，为要放入指定空位 (slotRow, slotCol) 的卡片求解最大无冲突落位与尺寸：
 * - 优先完整保留原尺寸 (origColSpan × origRows)，并自动在覆盖 (slotRow, slotCol) 的范围内微调左上角起点
 *   （因此把 2×2 卡片拖到 2×2 空位的任意一角都能完整放入，无需精准瞄准左上角）；
 * - 仅当完整尺寸在任何包含该格的起点都无法无冲突放下时，才退化为最大可严丝合缝放入该空位的矩形，
 *   绝对保证落位后周围卡片 0 变动。
 */
export function fitRectInEmptySlot(
  others: PlacementInput[],
  slotRow: number,
  slotCol: number,
  origColSpan: number,
  origRows: number,
  columns: number,
): { col: number; row: number; colSpan: number; rowSpan: number } {
  if (columns <= 1) {
    return { col: 0, row: slotRow, colSpan: 1, rowSpan: Math.max(1, origRows) };
  }
  const unitCol = columns >= 4 ? 2 : 1;
  const maxColSpan = Math.min(Math.max(unitCol, origColSpan), columns);
  const maxRowSpan = Math.max(1, Math.min(3, origRows));

  const othersRects = others.map((item) => {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns);
    const rows = Math.max(1, item.rows);
    const col = Math.min(Math.max(0, item.col ?? 0), Math.max(0, columns - colSpan));
    const row = Math.max(0, item.row ?? 0);
    return { col, row, colSpan, rows };
  });

  const rectIsFree = (row: number, col: number, colSpan: number, rows: number) => {
    if (col < 0 || col + colSpan > columns || row < 0) return false;
    const candidate = { col, row, colSpan, rows };
    return !othersRects.some((other) => spansOverlap(candidate, other));
  };

  const sizeCandidates: Array<{ colSpan: number; rowSpan: number; area: number }> = [];
  for (let c = maxColSpan; c >= unitCol; c -= unitCol) {
    for (let r = maxRowSpan; r >= 1; r -= 1) {
      sizeCandidates.push({ colSpan: c, rowSpan: r, area: c * r });
    }
  }
  sizeCandidates.sort((a, b) => b.area - a.area || b.colSpan - a.colSpan || b.rowSpan - a.rowSpan);

  for (const size of sizeCandidates) {
    const minCol = Math.max(0, slotCol - size.colSpan + unitCol);
    const maxCol = Math.min(slotCol, columns - size.colSpan);
    const minRow = Math.max(0, slotRow - size.rowSpan + 1);
    const maxRow = slotRow;

    const origins: Array<{ col: number; row: number; dist: number }> = [];
    for (let r = maxRow; r >= minRow; r -= 1) {
      for (let c = maxCol; c >= minCol; c -= unitCol) {
        if (c < 0 || c + size.colSpan > columns) continue;
        if (slotCol < c || slotCol >= c + size.colSpan) continue;
        if (slotRow < r || slotRow >= r + size.rowSpan) continue;
        origins.push({
          col: c,
          row: r,
          dist: Math.abs(slotRow - r) * 10 + Math.abs(slotCol - c),
        });
      }
    }
    origins.sort((a, b) => a.dist - b.dist || a.row - b.row || a.col - b.col);
    for (const origin of origins) {
      if (rectIsFree(origin.row, origin.col, size.colSpan, size.rowSpan)) {
        return {
          col: origin.col,
          row: origin.row,
          colSpan: size.colSpan,
          rowSpan: size.rowSpan,
        };
      }
    }
  }

  return { col: slotCol, row: slotRow, colSpan: unitCol, rowSpan: 1 };
}

/**
 * 纯函数 2D 网格拖放求解器（基于拖拽开始时的固化快照计算，绝无回弹/抖动）：
 * 1. 目标位恰有单张同尺寸卡片 -> 原地 1 对 1 交换，其余卡片纹丝不动；
 * 2. 目标位为空 -> 直接落位，其余卡片纹丝不动；
 * 3. 同列向下拖过不同高度的卡片 -> 将经过的同列卡片顺滑上提至原位，被拖卡片落到其下方（零空洞、零拉高）；
 * 4. 其余跨列/向上拖拽 -> 目标位优先，冲突项优先同排换边（如宽卡与两张小卡左右互换），其余项保位或平滑顺延。
 */
export function computeGridDrop(
  baseItems: PlacementInput[],
  activeId: string,
  targetCol: number,
  targetRow: number,
  columns: number,
): Layout {
  if (columns <= 1) return packWidgets(baseItems, columns);

  const normalized = baseItems.map((item) => {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns);
    const rows = Math.max(1, item.rows);
    const col = Math.min(Math.max(0, item.col ?? 0), Math.max(0, columns - colSpan));
    const row = Math.max(0, item.row ?? 0);
    return { ...item, col, row, colSpan, rows };
  });

  const active = normalized.find((item) => item.id === activeId);
  if (!active) return packWidgets(normalized, columns);

  const destCol = Math.min(Math.max(0, targetCol), Math.max(0, columns - active.colSpan));
  const destRow = Math.max(0, targetRow);
  if (destCol === active.col && destRow === active.row) {
    return packWidgets(normalized, columns);
  }

  const others = normalized.filter((item) => item.id !== activeId);
  const destRect = { col: destCol, row: destRow, colSpan: active.colSpan, rows: active.rows };
  const colliding = others.filter((item) => spansOverlap(destRect, item));

  // 1. 同尺寸 1 对 1 原地交换
  if (colliding.length === 1) {
    const occ = colliding[0];
    if (occ.colSpan === active.colSpan && occ.rows === active.rows) {
      const occSwapRect = { col: active.col, row: active.row, colSpan: occ.colSpan, rows: occ.rows };
      const rest = others.filter((item) => item.id !== occ.id);
      if (!rest.some((item) => spansOverlap(occSwapRect, item))) {
        return packWidgets(
          [
            { ...active, col: destCol, row: destRow },
            { ...occ, col: active.col, row: active.row },
            ...rest,
          ],
          columns,
        );
      }
    }
  }

  // 2. 目标区域完全空闲：直接放入，周围卡片完全不动
  if (colliding.length === 0) {
    return packWidgets([{ ...active, col: destCol, row: destRow }, ...others], columns);
  }

  // 3. 同列向下拖过不同高度卡片：将同列被跨过的卡片顺滑上提，自身落到其下方
  const laneLeft = active.col;
  const laneRight = active.col + active.colSpan;
  const inLane = (item: (typeof normalized)[number]) =>
    item.col >= laneLeft && item.col + item.colSpan <= laneRight;

  if (
    destCol === active.col &&
    destRow > active.row &&
    colliding.every((item) => item.row >= active.row + active.rows && inLane(item))
  ) {
    const bandTop = active.row + active.rows;
    let bandBottom = Math.max(...colliding.map((item) => item.row + item.rows));
    // 向外检查同列是否仍有半截被截断的卡片，避免上提后与下方重叠
    let validLane = true;
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of others) {
        if (item.row >= bandTop && item.row < bandBottom) {
          const overlapsLaneX = item.col < laneRight && item.col + item.colSpan > laneLeft;
          if (!overlapsLaneX) continue;
          if (!inLane(item)) {
            validLane = false;
            break;
          }
          if (item.row + item.rows > bandBottom) {
            bandBottom = item.row + item.rows;
            grew = true;
          }
        }
      }
      if (!validLane) break;
    }

    if (validLane) {
      const liftedIds = new Set<string>();
      let minBandRow = Infinity;
      for (const item of others) {
        if (inLane(item) && item.row >= bandTop && item.row < bandBottom) {
          liftedIds.add(item.id);
          minBandRow = Math.min(minBandRow, item.row);
        }
      }
      if (liftedIds.size > 0 && Number.isFinite(minBandRow)) {
        const liftDelta = minBandRow - active.row;
        const liftedItems = others
          .filter((item) => liftedIds.has(item.id))
          .map((item) => ({ ...item, row: Math.max(0, item.row - liftDelta) }));
        const untouched = others.filter((item) => !liftedIds.has(item.id));
        const activeNewRow = active.row + (bandBottom - minBandRow);
        return packWidgets(
          [...liftedItems, { ...active, col: destCol, row: activeNewRow }, ...untouched],
          columns,
        );
      }
    }
  }

  // 4. 通用 2D 排布：目标卡片优先 -> 目标行以上未冲突项保持不动 -> 冲突项优先同排换边 -> 其余按阅读顺序顺延
  const collidingIds = new Set(colliding.map((item) => item.id));
  const above = others
    .filter((item) => !collidingIds.has(item.id) && item.row + item.rows <= destRow)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const collidingSorted = [...colliding].sort((a, b) => a.row - b.row || a.col - b.col);
  const remaining = others
    .filter((item) => !collidingIds.has(item.id) && item.row + item.rows > destRow)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  return packWidgets(
    [{ ...active, col: destCol, row: destRow }, ...above, ...collidingSorted, ...remaining],
    columns,
  );
}

/** 计算当前摆放中每个空洞格（按标准单栏 2 列 × 1 行切分），返回可供拖入与点击添加的空位列表。 */
export function findEmptySlots(layout: Layout, columns: number): EmptySlot[] {
  if (columns <= 1 || layout.size === 0) return [];
  const occupied: boolean[][] = [];
  let bottom = 0;
  for (const p of layout.values()) {
    bottom = Math.max(bottom, p.row + p.rowSpan);
    for (let r = p.row; r < p.row + p.rowSpan; r += 1) {
      const line = occupied[r] ?? (occupied[r] = []);
      for (let c = p.col; c < p.col + p.colSpan; c += 1) line[c] = true;
    }
  }
  const unitCol = columns >= 4 ? 2 : 1;
  const isCellFree = (r: number, c: number) => {
    const line = occupied[r];
    if (!line) return true;
    for (let k = c; k < c + unitCol; k += 1) {
      if (line[k]) return false;
    }
    return true;
  };
  const slots: EmptySlot[] = [];
  for (let r = 0; r < bottom; r += 1) {
    for (let c = 0; c + unitCol <= columns; c += unitCol) {
      if (!isCellFree(r, c)) continue;
      let availCols = unitCol;
      while (c + availCols + unitCol <= columns && isCellFree(r, c + availCols)) {
        availCols += unitCol;
      }
      let availRows = 1;
      while (availRows < 3 && r + availRows < bottom && isCellFree(r + availRows, c)) {
        availRows += 1;
      }
      slots.push({
        id: `${EMPTY_SLOT_PREFIX}${r}:${c}`,
        row: r,
        col: c,
        colSpan: unitCol,
        rowSpan: 1,
        availCols,
        availRows,
      });
    }
  }
  return slots;
}

/** 卡片下方直到网格底部的空行归它自己：向下延伸补满，返回剩下补不上的空格数。 */
function fill(layout: Layout, columns: number) {
  const occupied: boolean[][] = [];
  let bottom = 0;
  for (const p of layout.values()) {
    bottom = Math.max(bottom, p.row + p.rowSpan);
    for (let r = p.row; r < p.row + p.rowSpan; r += 1) {
      const line = occupied[r] ?? (occupied[r] = []);
      for (let c = p.col; c < p.col + p.colSpan; c += 1) line[c] = true;
    }
  }
  for (const p of layout.values()) {
    let end = p.row + p.rowSpan;
    while (end < bottom) {
      const line = occupied[end] ?? (occupied[end] = []);
      let blocked = false;
      for (let c = p.col; c < p.col + p.colSpan; c += 1) if (line[c]) { blocked = true; break; }
      if (blocked) break;
      for (let c = p.col; c < p.col + p.colSpan; c += 1) line[c] = true;
      end += 1;
    }
    p.rowSpan = end - p.row;
  }
  let holes = 0;
  for (let r = 0; r < bottom; r += 1) for (let c = 0; c < columns; c += 1) if (!occupied[r]?.[c]) holes += 1;
  return { bottom, holes };
}

const sideBySide = (a: Placement, b: Placement) =>
  a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan
  && (a.col + a.colSpan <= b.col || b.col + b.colSpan <= a.col);

function evaluate(items: PlacementInput[], rows: Map<string, number>, columns: number, snapRows: number) {
  const layout = pack(items, rows, columns);
  const { bottom, holes } = fill(layout, columns);
  const placed = [...layout.values()];
  let nearMisses = 0;
  for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) {
    const a = placed[i]; const b = placed[j];
    if (!sideBySide(a, b)) continue;
    const top = Math.abs(a.row - b.row);
    const end = Math.abs(a.row + a.rowSpan - b.row - b.rowSpan);
    if (top > 0 && top <= snapRows) nearMisses += 1;
    if (end > 0 && end <= snapRows) nearMisses += 1;
  }
  return { layout, cost: nearMisses * 100 + holes * 10 + bottom };
}

export function placeWidgets(
  items: PlacementInput[],
  columns: number,
  snapRows: number,
  fillGaps = true,
): Layout {
  const rows = new Map(items.map((item) => [item.id, Math.max(1, item.rows)]));
  if (!fillGaps || columns <= 1) return pack(items, rows, columns);
  let best = evaluate(items, rows, columns, snapRows);
  for (let pass = 0; pass < 16; pass += 1) {
    // 候选：把某张卡片拉高到并排邻居的底边（只长不缩，保证收敛）
    const placed = [...pack(items, rows, columns).entries()];
    let next: { rows: Map<string, number>; result: ReturnType<typeof evaluate> } | null = null;
    for (const [id, a] of placed) {
      for (const [otherId, b] of placed) {
        if (otherId === id || !sideBySide(a, b)) continue;
        const grow = b.row + b.rowSpan - (a.row + a.rowSpan);
        if (grow <= 0 || grow > snapRows) continue;
        const trial = new Map(rows);
        trial.set(id, (rows.get(id) ?? a.rowSpan) + grow);
        const result = evaluate(items, trial, columns, snapRows);
        if (result.cost < (next?.result.cost ?? best.cost)) next = { rows: trial, result };
      }
    }
    if (!next) break;
    for (const [id, value] of next.rows) rows.set(id, value);
    best = next.result;
  }
  return best.layout;
}
