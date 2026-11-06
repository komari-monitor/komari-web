import type { Driver, Summary } from "./types";

export const API_BASE = "/api/admin/database-migration";
export const LEGACY_I18N = "settings.update_1_2_7";
export const STRUCTURE_I18N = "metric_store_restructure";
export const COMMON_I18N = "database_migration";
export const RECLAIM_START_PROGRESS = 80;
export const RECLAIM_PROGRESS_CAP = 99;
export const RECLAIM_STEP_MS = 30_000;
export const NORMAL_ROUTER_PROBE_MS = 1_000;

/** 状态未到时，用真实的 LegacySetup 渲染骨架（数字位数接近常见数据量） */
export const PLACEHOLDER_SUMMARY: Summary = {
  load_rows: 1_000_000,
  gpu_rows: 0,
  latency_rows: 1_000_000,
  monitoring_rows: 0,
  estimated_points: 10_000_000,
  server_count: 10,
  retention_days: 30,
};

export const examples: Record<Driver, string> = {
  sqlite: "./data/metrics.db",
  mysql: "user:password@tcp(127.0.0.1:3306)/komari?parseTime=true",
  postgresql:
    "host=127.0.0.1 port=5432 user=komari password=secret dbname=komari sslmode=disable",
};

export function formatBytes(value: number, locale: string): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** exponent;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(amount)} ${units[exponent]}`;
}
