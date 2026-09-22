export const DASHBOARD_SETTINGS_KEY = "_komari_dashboard_v1";

export const widgetIds = [
  "overview", "database", "expiry", "traffic", "cpu", "memory",
  "resources", "disk", "ping", "shortcuts",
] as const;
export type WidgetId = typeof widgetIds[number];
export type WidgetWidth = "compact" | "wide" | "full";
export type WidgetHeight = "short" | "normal" | "tall";
export type DashboardLayout = { id: WidgetId; width: WidgetWidth; height: WidgetHeight; limit: number }[];

export function defaultWidth(id: WidgetId): WidgetWidth {
  return id === "traffic" ? "wide" : id === "ping" ? "full" : "compact";
}

export function defaultHeight(id: WidgetId): WidgetHeight {
  return id === "traffic" ? "normal" : "short";
}

export function defaultLimit(id: WidgetId): number {
  if (id === "cpu" || id === "memory") return 4;
  if (id === "ping") return 3;
  return 5;
}

export function defaultLayout(): DashboardLayout {
  return widgetIds.filter((id) =>
    id !== "resources" && id !== "disk" && id !== "shortcuts",
  )
    .map((id) => ({ id, width: defaultWidth(id), height: defaultHeight(id), limit: defaultLimit(id) }));
}

export function parseDashboardLayout(value: unknown): DashboardLayout {
  if (!Array.isArray(value)) return defaultLayout();
  const seen = new Set<WidgetId>();
  const result: DashboardLayout = [];
  for (const item of value) {
    if (!item || typeof item !== "object" ||
      !widgetIds.includes(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push({
      id: item.id,
      width: ["compact", "wide", "full"].includes(item.width)
        ? item.width : defaultWidth(item.id),
      height: ["short", "normal", "tall"].includes(item.height)
        ? item.height : defaultHeight(item.id),
      limit: [2, 3, 4, 5, 8, 10].includes(item.limit)
        ? item.limit : defaultLimit(item.id),
    });
  }
  return value.length > 0 && result.length === 0 ? defaultLayout() : result;
}
