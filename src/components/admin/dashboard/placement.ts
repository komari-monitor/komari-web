/**
 * 仪表盘网格摆放：在 CSS Grid 的 8px 细行上模拟 `grid-auto-flow: row dense`，再做对齐：
 * - 并排卡片的顶边/底边「差一点没对齐」（相差 1..snapRows 行）最显眼，像是排版出错；
 *   差得多则读作有意的错落。于是尝试把矮的卡片拉高到邻居底边，挑代价最低的方案；
 * - 代价 = 差一点没对齐的边 > 留下的空洞 > 总高度；
 * - 最后卡片正下方到网格底部之间若是空的，就延伸过去补满，底边齐平。
 */
export type PlacementInput = { id: string; colSpan: number; rows: number };
export type Placement = { col: number; row: number; colSpan: number; rowSpan: number };
type Layout = Map<string, Placement>;

function pack(items: PlacementInput[], rows: Map<string, number>, columns: number): Layout {
  const occupied: boolean[][] = [];
  const free = (row: number, col: number, colSpan: number, rowSpan: number) => {
    for (let r = row; r < row + rowSpan; r += 1) {
      const line = occupied[r];
      if (!line) continue;
      for (let c = col; c < col + colSpan; c += 1) if (line[c]) return false;
    }
    return true;
  };
  const result: Layout = new Map();
  for (const item of items) {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns);
    const rowSpan = Math.max(1, rows.get(item.id) ?? item.rows);
    let row = 0;
    let col = -1;
    while (col < 0) {
      for (let c = 0; c + colSpan <= columns; c += 1) {
        if (free(row, c, colSpan, rowSpan)) { col = c; break; }
      }
      if (col < 0) row += 1;
    }
    for (let r = row; r < row + rowSpan; r += 1) {
      const line = occupied[r] ?? (occupied[r] = []);
      for (let c = col; c < col + colSpan; c += 1) line[c] = true;
    }
    result.set(item.id, { col, row, colSpan, rowSpan });
  }
  return result;
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

export function placeWidgets(items: PlacementInput[], columns: number, snapRows: number): Layout {
  const rows = new Map(items.map((item) => [item.id, Math.max(1, item.rows)]));
  let best = evaluate(items, rows, columns, snapRows);
  if (columns <= 1) return best.layout;
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
