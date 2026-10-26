export const pluginCategories = [
  "notification",
  "monitoring",
  "network",
  "security",
  "integration",
  "utility",
  "uncategorized",
] as const;

export type PluginCategory = (typeof pluginCategories)[number];

export function normalizePluginCategory(category: unknown): PluginCategory {
  return typeof category === "string" &&
    pluginCategories.includes(category as PluginCategory)
    ? (category as PluginCategory)
    : "uncategorized";
}
