import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import type { useTranslation } from "react-i18next";
import type { MetricDefinition } from "./types";

/** 指标表的占位行数：常见的系统指标数量 */
export const METRIC_PLACEHOLDER_ROWS = 6;

export const SAFE_RAW_RETENTION_DAYS = 1;

export const DEFAULT_ROLLUP_RETENTION = {
  minute: 600,
  fiveMinute: 3000,
  hour: 600,
};

export const ROLLUP_RETENTION_KEYS = {
  minute: "metric_rollup_minute_retention_minutes",
  fiveMinute: "metric_rollup_five_minute_retention_minutes",
  hour: "metric_rollup_hour_retention_hours",
} as const;

type MetricTextField = "name" | "description";
type TranslationFunction = ReturnType<typeof useTranslation>["t"];

export const DSN_PLACEHOLDER =
  "./data/metrics.db 或 user:password@tcp(host:3306)/metrics?charset=utf8mb4&parseTime=True";

export function toNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function isI18nTextDict(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function parseI18nText(value: unknown): I18nText | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return undefined;
    try {
      const parsed = JSON.parse(text);
      if (isI18nTextDict(parsed)) return parsed;
    } catch {
      // Plain strings are valid metric descriptions.
    }
    return value;
  }
  if (isI18nTextDict(value)) return value;
  return undefined;
}

function metadataText(
  metadata: Record<string, string> | undefined,
  keys: string[],
): I18nText | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = parseI18nText(metadata[key]);
    if (value) return value;
  }
  return undefined;
}

function systemMetricText(
  t: TranslationFunction,
  metricName: string,
  field: MetricTextField,
): string | undefined {
  const key = `settings.metrics.system.${metricName}.${field}`;
  const text = t(key, { defaultValue: "" });
  return typeof text === "string" && text ? text : undefined;
}

export function metricDisplayName(
  metric: MetricDefinition,
  language: string,
  t: TranslationFunction,
): string {
  const system = systemMetricText(t, metric.name, "name");
  const custom = metadataText(metric.metadata, ["display_name", "name", "title"]);
  return system ?? resolveI18nText(custom, language) ?? metric.name;
}

export function metricDescription(
  metric: MetricDefinition,
  language: string,
  t: TranslationFunction,
): string {
  const system = systemMetricText(t, metric.name, "description");
  const custom =
    parseI18nText(metric.description) ??
    metadataText(metric.metadata, ["description", "desc", "help"]);
  return system ?? resolveI18nText(custom, language) ?? "";
}

export function parseInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
