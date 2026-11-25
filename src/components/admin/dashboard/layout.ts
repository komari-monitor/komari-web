import { packWidgets } from "./placement";

/**
 * 仪表盘排版与预设保存在当前主题的未声明配置键中（不写入 komari-theme.json 清单），
 * 因此不会出现在「默认主题设置」表单里，但会跟随主题设置自动持久化。
 */
export const DASHBOARD_SETTINGS_KEY = "_komari_dashboard_v1";

export const widgetIds = [
  "overview",
  "globe",
  "trafficQuota",
  "billing",
  "expiry",
  "liveBandwidth",
  "traffic",
  "cpu",
  "memory",
  "disk",
  "uptime",
  "ping",
  "resources",
  "database",
  "shortcuts",
] as const;

export type WidgetId = (typeof widgetIds)[number];
export type WidgetWidth = "compact" | "wide" | "full";
export type WidgetHeight = "short" | "normal" | "tall";
export const FIXED_WIDGET_LIMITS = [2, 3, 4, 5, 8, 10] as const;
export type WidgetLimit = (typeof FIXED_WIDGET_LIMITS)[number] | "auto";

export type DashboardLayoutItem = {
  id: WidgetId;
  width: WidgetWidth;
  height: WidgetHeight;
  limit: WidgetLimit;
  /** 可选显式网格列坐标（0 起，基于 6 列基准网格）；未设置时由摆放算法自动紧密排布 */
  col?: number;
  /** 可选显式网格行坐标（0 起）；未设置时由摆放算法自动紧密排布 */
  row?: number;
};
export type DashboardLayout = DashboardLayoutItem[];

export const DASHBOARD_PRESET_IDS = [
  "balanced",
  "panorama",
  "network",
] as const;

export type DashboardPresetId = (typeof DASHBOARD_PRESET_IDS)[number];

export type DashboardPreset = {
  id: DashboardPresetId;
  items: DashboardLayout;
};

export type DashboardStoredConfig = {
  preset: DashboardPresetId | "custom";
  items: DashboardLayout;
};

export function defaultWidth(id: WidgetId): WidgetWidth {
  if (id === "traffic" || id === "globe") return "wide";
  if (id === "ping") return "full";
  return "compact";
}

export function defaultHeight(id: WidgetId): WidgetHeight {
  if (id === "traffic" || id === "globe") return "normal";
  return "short";
}

export function defaultLimit(): WidgetLimit {
  return "auto";
}

const item = (
  id: WidgetId,
  width: WidgetWidth = defaultWidth(id),
  height: WidgetHeight = defaultHeight(id),
  limit: WidgetLimit = defaultLimit(),
): DashboardLayoutItem => ({ id, width, height, limit });

/**
 * 3 套精选预设（6 列桌面下均无空洞且像素级齐平；列表型卡片默认使用 `limit: "auto"` 自适应高度）：
 * 1. balanced（经典默认）：沿用原版默认 7 张卡片布局
 * 2. panorama（资产与全景）：资源容量、持机成本、流量配额、24h 流量、3D 地球、到期与网络质量
 * 3. network（流量与网络）：24h 流量、实时带宽、流量配额、整行 3D 地球与网络质量
 */
export const DASHBOARD_PRESETS: readonly DashboardPreset[] = [
  {
    id: "balanced",
    items: [
      item("overview", "compact", "short"),
      item("database", "compact", "short"),
      item("expiry", "compact", "short", "auto"),
      item("traffic", "wide", "tall", "auto"),
      item("cpu", "compact", "normal", "auto"),
      item("memory", "compact", "short", "auto"),
      item("ping", "full", "short", "auto"),
    ],
  },
  {
    id: "panorama",
    items: [
      item("resources", "compact", "short"),
      item("billing", "compact", "short"),
      item("trafficQuota", "compact", "short", "auto"),
      item("traffic", "compact", "normal", "auto"),
      item("globe", "wide", "normal"),
      item("expiry", "compact", "short", "auto"),
      item("ping", "wide", "short", "auto"),
    ],
  },
  {
    id: "network",
    items: [
      item("traffic", "wide", "normal", "auto"),
      item("liveBandwidth", "compact", "short", "auto"),
      item("trafficQuota", "compact", "short", "auto"),
      item("globe", "full", "normal"),
      item("ping", "full", "short", "auto"),
    ],
  },
];

export const DEFAULT_PRESET_ID: DashboardPresetId = "balanced";

export function presetLayout(id: DashboardPresetId): DashboardLayout {
  const found = DASHBOARD_PRESETS.find((preset) => preset.id === id) ?? DASHBOARD_PRESETS[0];
  return found.items.map((entry) => ({ ...entry }));
}

export function defaultLayout(): DashboardLayout {
  return presetLayout(DEFAULT_PRESET_ID);
}

export const sameLayout = (left: DashboardLayout, right: DashboardLayout) =>
  left.length === right.length &&
  left.every(
    (entry, index) =>
      entry.id === right[index].id &&
      entry.width === right[index].width &&
      entry.height === right[index].height &&
      entry.limit === right[index].limit &&
      entry.col === right[index].col &&
      entry.row === right[index].row,
  );

const pack6 = (items: DashboardLayout) =>
  packWidgets(
    items.map((entry) => ({
      id: entry.id,
      colSpan: entry.width === "full" ? 6 : entry.width === "wide" ? 4 : 2,
      rows: entry.height === "tall" ? 3 : entry.height === "normal" ? 2 : 1,
      col: entry.col,
      row: entry.row,
    })),
    6,
  );

const sameEffectiveLayout = (left: DashboardLayout, right: DashboardLayout) => {
  if (left.length !== right.length) return false;
  if (sameLayout(left, right)) return true;
  const rightMap = new Map(right.map((entry) => [entry.id, entry]));
  for (const entry of left) {
    const peer = rightMap.get(entry.id);
    if (
      !peer ||
      peer.width !== entry.width ||
      peer.height !== entry.height ||
      peer.limit !== entry.limit
    ) {
      return false;
    }
  }
  const packedLeft = pack6(left);
  const packedRight = pack6(right);
  for (const entry of left) {
    const pl = packedLeft.get(entry.id);
    const pr = packedRight.get(entry.id);
    if (!pl || !pr || pl.col !== pr.col || pl.row !== pr.row) return false;
  }
  return true;
};

export function matchDashboardPreset(items: DashboardLayout): DashboardPresetId | "custom" {
  for (const preset of DASHBOARD_PRESETS) {
    if (sameEffectiveLayout(items, preset.items)) return preset.id;
  }
  return "custom";
}

function parseLimit(value: unknown): WidgetLimit {
  if (value === "auto") return "auto";
  if (
    typeof value === "number" &&
    (FIXED_WIDGET_LIMITS as readonly number[]).includes(value)
  ) {
    return value as (typeof FIXED_WIDGET_LIMITS)[number];
  }
  return defaultLimit();
}

function parseLayoutArray(value: unknown): DashboardLayout | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<WidgetId>();
  const result: DashboardLayout = [];
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !widgetIds.includes((entry as { id?: WidgetId }).id as WidgetId) ||
      seen.has((entry as { id: WidgetId }).id)
    ) {
      continue;
    }
    const raw = entry as Partial<DashboardLayoutItem> & { id: WidgetId };
    seen.add(raw.id);
    const hasCoords =
      typeof raw.col === "number" &&
      Number.isInteger(raw.col) &&
      raw.col >= 0 &&
      typeof raw.row === "number" &&
      Number.isInteger(raw.row) &&
      raw.row >= 0;
    result.push({
      id: raw.id,
      width: (["compact", "wide", "full"] as const).includes(raw.width as WidgetWidth)
        ? (raw.width as WidgetWidth)
        : defaultWidth(raw.id),
      height: (["short", "normal", "tall"] as const).includes(raw.height as WidgetHeight)
        ? (raw.height as WidgetHeight)
        : defaultHeight(raw.id),
      limit: parseLimit(raw.limit),
      ...(hasCoords ? { col: raw.col, row: raw.row } : {}),
    });
  }
  if (value.length > 0 && result.length === 0) return null;
  return result;
}

export function parseDashboardLayout(value: unknown): DashboardLayout {
  return parseDashboardConfig(value).items;
}

/**
 * 兼容旧版裸数组与新版 `{ preset, items }` 对象结构。
 */
export function parseDashboardConfig(value: unknown): DashboardStoredConfig {
  const fromArray = parseLayoutArray(value);
  if (fromArray) {
    return { preset: matchDashboardPreset(fromArray), items: fromArray };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { preset?: unknown; items?: unknown };
    const items = parseLayoutArray(record.items);
    if (items) {
      const matched = matchDashboardPreset(items);
      return { preset: matched, items };
    }
    if (
      typeof record.preset === "string" &&
      (DASHBOARD_PRESET_IDS as readonly string[]).includes(record.preset)
    ) {
      const presetId = record.preset as DashboardPresetId;
      return { preset: presetId, items: presetLayout(presetId) };
    }
  }
  const fallback = defaultLayout();
  return { preset: DEFAULT_PRESET_ID, items: fallback };
}

export function serializeDashboardConfig(items: DashboardLayout): DashboardStoredConfig {
  return {
    preset: matchDashboardPreset(items),
    items,
  };
}
