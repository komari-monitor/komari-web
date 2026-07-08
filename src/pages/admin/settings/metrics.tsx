import Loading from "@/components/loading";
import {
  SettingCard,
  SettingCardLabel,
  SettingCardShortTextInput,
} from "@/components/admin/SettingCard";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import type { SettingsResponse } from "@/lib/api";
import { useRPC2Call } from "@/contexts/RPC2Context";
import {
  Badge,
  Button,
  Callout,
  Flex,
  Progress,
  Text,
  TextField,
} from "@radix-ui/themes";
import { AlertTriangle, Database, Info, RefreshCw, X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// store-to-store 迁移状态。旧的 not_started/in_progress/paused 已废弃，
// 后端语义改为：把某个 metrics 源库的数据搬运到当前运行中的 metrics 目标库。
type MigrationStatus = "idle" | "running" | "completed" | "failed" | "canceled";

interface MigrationStatusResponse {
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

const DSN_PLACEHOLDER =
  "./data/metrics.db 或 user:password@tcp(host:3306)/metrics?charset=utf8mb4&parseTime=True";

function toNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export default function MetricsSettings() {
  const { t } = useTranslation();
  const { settings, loading, error } = useSettings();
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const saveMetricSettings = React.useCallback(
    async (changes: Partial<SettingsResponse>) => {
      try {
        await updateSettingsWithToast(changes, t);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    [t]
  );

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <Flex direction="column" gap="3">
      <SettingCardLabel>{t("settings.metrics.title")}</SettingCardLabel>

      <Callout.Root color="blue" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.intro")}</Callout.Text>
      </Callout.Root>

      {saveError && (
        <Callout.Root color="red" variant="surface">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>{saveError}</Callout.Text>
        </Callout.Root>
      )}

      <SettingCardShortTextInput
        title={t("settings.metrics.dsn_title")}
        description={t("settings.metrics.dsn_description")}
        descriptionPlacement="footer"
        defaultValue={String(settings.metric_db_dsn || "")}
        placeholder={DSN_PLACEHOLDER}
        OnSave={async (value) => {
          await saveMetricSettings({ metric_db_dsn: value.trim() });
        }}
      />

      <SettingCardLabel>
        {t("settings.metrics.advanced_title")}
      </SettingCardLabel>

      <SettingCardShortTextInput
        title={t("settings.metrics.retention_title")}
        description={t("settings.metrics.retention_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_retention_days, 30))}
        placeholder="30"
        OnSave={async (value) => {
          const days = parseInt(value, 10);
          if (isNaN(days) || days <= 0) {
            toast.error(t("settings.metrics.retention_invalid"));
            return;
          }
          await saveMetricSettings({ metric_retention_days: days });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.table_prefix_title")}
        description={t("settings.metrics.table_prefix_description")}
        descriptionPlacement="footer"
        defaultValue={String(settings.metric_table_prefix || "metric_")}
        placeholder="metric_"
        OnSave={async (value) => {
          await saveMetricSettings({
            metric_table_prefix: value.trim() || "metric_",
          });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.max_open_conns_title")}
        description={t("settings.metrics.max_open_conns_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_max_open_conns, 25))}
        placeholder="25"
        OnSave={async (value) => {
          const n = parseInt(value, 10);
          if (isNaN(n) || n <= 0) {
            toast.error(t("settings.metrics.conns_invalid"));
            return;
          }
          await saveMetricSettings({ metric_max_open_conns: n });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.max_idle_conns_title")}
        description={t("settings.metrics.max_idle_conns_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_max_idle_conns, 5))}
        placeholder="5"
        OnSave={async (value) => {
          const n = parseInt(value, 10);
          if (isNaN(n) || n < 0) {
            toast.error(t("settings.metrics.conns_invalid"));
            return;
          }
          await saveMetricSettings({ metric_max_idle_conns: n });
        }}
      />

      <Callout.Root color="green" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.restart_hint")}</Callout.Text>
      </Callout.Root>

      <SettingCardLabel>
        {t("settings.metrics.migration_title")}
      </SettingCardLabel>
      <MigrationCard />
    </Flex>
  );
}

function StatusBadge({ status }: { status: MigrationStatus }) {
  const { t } = useTranslation();
  const colorMap: Record<
    MigrationStatus,
    "gray" | "blue" | "green" | "red" | "amber"
  > = {
    idle: "gray",
    running: "blue",
    completed: "green",
    failed: "red",
    canceled: "amber",
  };
  return (
    <Badge color={colorMap[status]} variant="soft">
      {t(`settings.metrics.status.${status}`)}
    </Badge>
  );
}

function MigrationCard() {
  const { t } = useTranslation();
  const { call } = useRPC2Call();

  const [statusData, setStatusData] =
    React.useState<MigrationStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [sourceDsn, setSourceDsn] = React.useState("");

  const fetchStatus = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoadingStatus(true);
      try {
        const data = await call<unknown, MigrationStatusResponse>(
          "admin:getMetricMigrationStatus",
          {}
        );
        setStatusData(data);
      } catch (e) {
        if (!silent) {
          toast.error(
            t("settings.metrics.fetch_status_failed") +
              ": " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      } finally {
        if (!silent) setLoadingStatus(false);
      }
    },
    [call, t]
  );

  React.useEffect(() => {
    void fetchStatus(true);
  }, [fetchStatus]);

  // 迁移进行中时轮询刷新状态。
  React.useEffect(() => {
    const shouldPoll =
      statusData?.status === "running" || statusData?.is_running;
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      void fetchStatus(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [statusData?.status, statusData?.is_running, fetchStatus]);

  const status: MigrationStatus = statusData?.status ?? "idle";
  const isRunning = statusData?.is_running ?? false;
  const canStart = !isRunning && !starting;

  const totalMetrics = statusData?.total_metrics ?? 0;
  const metricsDone = statusData?.metrics_done ?? 0;
  const migratedPoints = statusData?.migrated_points ?? 0;
  const progressPercent =
    totalMetrics > 0
      ? Math.min(100, Math.round((metricsDone / totalMetrics) * 100))
      : 0;
  const showProgress = isRunning || status === "running";

  const handleStart = async () => {
    setStarting(true);
    try {
      const params: { source_dsn?: string } = {};
      const dsn = sourceDsn.trim();
      if (dsn) params.source_dsn = dsn;
      await call("admin:startMetricMigration", params);
      toast.success(t("settings.metrics.migration_started"));
      await fetchStatus(true);
    } catch (e) {
      toast.error(
        t("settings.metrics.migration_start_failed") +
          ": " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await call("admin:cancelMetricMigration", {});
      toast.success(t("settings.metrics.migration_canceled"));
      await fetchStatus(true);
    } catch (e) {
      toast.error(
        t("settings.metrics.migration_cancel_failed") +
          ": " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setCanceling(false);
    }
  };

  return (
    <SettingCard
      title={t("settings.metrics.migration_card_title")}
      description={t("settings.metrics.migration_card_description")}
      direction="column"
    >
      <Flex direction="column" gap="3" className="w-full pt-3">
        {/* 状态行 */}
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="2" weight="medium">
            {t("settings.metrics.current_status")}:
          </Text>
          <StatusBadge status={status} />
          <Button
            variant="ghost"
            size="1"
            disabled={loadingStatus}
            onClick={() => void fetchStatus()}
          >
            <RefreshCw
              size={14}
              className={loadingStatus ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </Button>
        </Flex>

        {/* 源库 / 目标库信息 */}
        {statusData && (statusData.source_driver || statusData.target_driver) && (
          <Flex gap="2" wrap="wrap">
            {statusData.target_driver && (
              <Badge variant="soft" color="green">
                {t("settings.metrics.migration_target")}:{" "}
                {statusData.target_driver}
                {statusData.target_dsn ? ` (${statusData.target_dsn})` : ""}
              </Badge>
            )}
            {statusData.source_driver && (
              <Badge variant="soft" color="gray">
                {t("settings.metrics.migration_source")}:{" "}
                {statusData.source_driver}
                {statusData.source_dsn ? ` (${statusData.source_dsn})` : ""}
              </Badge>
            )}
          </Flex>
        )}

        {/* 进度条 */}
        {showProgress && (
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray">
                {t("settings.metrics.migration_progress")}: {metricsDone} /{" "}
                {totalMetrics}
                {statusData?.current_metric
                  ? ` · ${statusData.current_metric}`
                  : ""}
              </Text>
              <Text size="1" color="gray">
                {progressPercent}%
              </Text>
            </Flex>
            <Progress value={progressPercent} size="2" />
            <Text size="1" color="gray">
              {t("settings.metrics.migrated_points")}:{" "}
              {migratedPoints.toLocaleString()}
            </Text>
          </Flex>
        )}

        {/* 状态 Callout */}
        {status === "running" && (
          <Callout.Root color="blue" variant="surface">
            <Callout.Icon>
              <RefreshCw size={16} className="animate-spin" />
            </Callout.Icon>
            <Callout.Text>
              {t("settings.metrics.migration_in_progress_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        {status === "completed" && (
          <Callout.Root color="green" variant="surface">
            <Callout.Icon>
              <Info size={16} />
            </Callout.Icon>
            <Callout.Text>
              {t("settings.metrics.migration_completed_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        {status === "canceled" && (
          <Callout.Root color="amber" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text>
              {t("settings.metrics.migration_canceled_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        {status === "failed" && (
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text>
              {statusData?.error
                ? statusData.error
                : t("settings.metrics.migration_failed_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* 源 DSN + 操作按钮 */}
        <Flex direction="column" gap="2" className="w-full">
          <label className="text-sm font-medium">
            {t("settings.metrics.source_dsn_title")}
          </label>
          <Text size="1" color="gray">
            {t("settings.metrics.source_dsn_description")}
          </Text>
          <Flex gap="2" align="center" wrap="wrap">
            <TextField.Root
              value={sourceDsn}
              onChange={(e) => setSourceDsn(e.target.value)}
              placeholder={t("settings.metrics.source_dsn_placeholder")}
              style={{ minWidth: "260px", flex: 1 }}
              disabled={isRunning}
            />
            {canStart && (
              <Button disabled={starting} onClick={() => void handleStart()}>
                <Database size={14} />
                {starting
                  ? t("settings.metrics.starting")
                  : status === "completed"
                    ? t("settings.metrics.start_again")
                    : t("settings.metrics.start_migration")}
              </Button>
            )}
            {isRunning && (
              <Button
                color="amber"
                variant="soft"
                disabled={canceling}
                onClick={() => void handleCancel()}
              >
                <X size={14} />
                {canceling
                  ? t("settings.metrics.canceling")
                  : t("settings.metrics.cancel_migration")}
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>
    </SettingCard>
  );
}
