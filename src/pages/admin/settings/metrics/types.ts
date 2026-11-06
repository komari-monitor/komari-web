import type { I18nText } from "@/utils/i18nText";

// store-to-store 迁移状态。旧的 not_started/in_progress/paused 已废弃，
// 后端语义改为：把某个 metrics 源库的数据搬运到当前运行中的 metrics 目标库。
export type MigrationStatus = "idle" | "running" | "completed" | "failed" | "canceled";

export interface MigrationStatusResponse {
  status: MigrationStatus;
  is_running: boolean;
  source_driver: string;
  source_dsn: string;
  target_driver: string;
  target_dsn: string;
  total_metrics: number;
  metrics_done: number;
  current_metric: string;
  migrated_points: number;
  start_time?: string;
  end_time?: string;
  error?: string;
}

export interface MetricDefinition {
  name: string;
  description?: I18nText | null;
  type: string;
  unit?: string;
  retention_days: number;
  metadata?: Record<string, string>;
}

export type MetricRetentionChange = {
  name: string;
  retention_days: number;
};
