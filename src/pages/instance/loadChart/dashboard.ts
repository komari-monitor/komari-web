import { DEFAULT_DASHBOARD } from "./constants";
import type { DashboardChart } from "./types";

export const normalizeDashboard = (value: unknown): DashboardChart[] => {
  if (!Array.isArray(value)) return DEFAULT_DASHBOARD;
  return value
    .filter((chart): chart is Partial<DashboardChart> => {
      return typeof chart === "object" && chart !== null;
    })
    .map((chart, index) => ({
      id: typeof chart.id === "string" && chart.id ? chart.id : `chart-${index}`,
      title:
        typeof chart.title === "string" && chart.title
          ? chart.title
          : `Chart ${index + 1}`,
      metrics: Array.isArray(chart.metrics)
        ? chart.metrics.filter((metric): metric is string => typeof metric === "string")
        : [],
      size:
        chart.size === "medium" || chart.size === "large" ? chart.size : "small",
    }));
};

export const parseDashboardTemplate = (value: unknown): DashboardChart[] => {
  if (Array.isArray(value)) return normalizeDashboard(value);
  if (typeof value !== "string" || value.trim() === "") return DEFAULT_DASHBOARD;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeDashboard(parsed) : DEFAULT_DASHBOARD;
  } catch {
    return DEFAULT_DASHBOARD;
  }
};
