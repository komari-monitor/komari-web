import type { LoginMethods, Me } from "../api";

export type Mode = "legacy_monitoring" | "metric_store_restructure";
export type Driver = "sqlite" | "mysql" | "postgresql";

export type Summary = {
  load_rows: number;
  gpu_rows: number;
  latency_rows: number;
  monitoring_rows: number;
  estimated_points: number;
  server_count: number;
  retention_days: number;
};

export type MigrationStatus = {
  mode: Mode;
  state:
    | "idle"
    | "ready"
    | "migrating"
    | "copying"
    | "discarding"
    | "reclaiming"
    | "completed"
    | "failed";
  phase: string;
  progress: number;
  error?: string;
  summary?: Summary;
  table?: string;
  source_rows_done?: number;
  source_rows_total?: number;
  written_points?: number;
  target_driver?: Driver;
  current_metric?: string;
  rows_done?: number;
  rows_total?: number;
  metrics_done?: number;
  metrics_total?: number;
  before_bytes?: number;
  after_bytes?: number;
  saved_bytes?: number;
  saved_percent?: number;
};

export type MigrationLoginMethods = LoginMethods & { mode: Mode };
export type AuthStatus = MigrationLoginMethods & Me;
