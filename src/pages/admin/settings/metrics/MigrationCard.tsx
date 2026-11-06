import { Skeletonize } from "@/components/ui/skeleton";
import { SettingCard, GapCollapse } from "@/components/admin/SettingCard";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRouteQuery } from "@/lib/routeData";
import { metricMigrationStatusQuery } from "@/routeQueries/settings";
import { Badge, Button, Callout, Flex, Progress, Text, TextField } from "@radix-ui/themes";
import { AlertTriangle, Database, RefreshCw, X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatedNumber, StatusFeedback, Swap } from "@/components/motion";
import type { MigrationStatus, MigrationStatusResponse } from "./types";

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
  // feedback 性格：迁移状态只在 status 真的翻转时换内容，轮询刷新不会触发动画
  return (
    <StatusFeedback state={status}>
      <Badge color={colorMap[status]} variant="soft">
        {t(`settings.metrics.status.${status}`)}
      </Badge>
    </StatusFeedback>
  );
}

export function MigrationCard() {
  const { t } = useTranslation();
  const { call } = useRPC2Call();

  // 首次读取已由 routePreload 与设置并行预取（原来是挂载后静默请求，失败不提示）；之后的刷新、轮询仍走 fetchStatus
  const initialStatus = useRouteQuery(metricMigrationStatusQuery);
  const [statusData, setStatusData] =
    React.useState<MigrationStatusResponse | null>(initialStatus.data ?? null);
  const [syncedFrom, setSyncedFrom] = React.useState(initialStatus.data);
  if (initialStatus.data !== syncedFrom) {
    setSyncedFrom(initialStatus.data);
    if (initialStatus.data) setStatusData(initialStatus.data);
  }
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  // 首次状态请求结束前，状态徽标显示骨架（而不是先显示「空闲」再跳成真实状态）
  const [fetchedOnce, setFetchedOnce] = React.useState(false);
  const statusReady = fetchedOnce || !initialStatus.loading;
  const [starting, setStarting] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [sourceDsn, setSourceDsn] = React.useState("");

  const fetchStatus = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoadingStatus(true);
      try {
        const data = await call<unknown, MigrationStatusResponse>(
          "admin:getMetricMigrationStatus",
          {},
        );
        setStatusData(data);
      } catch (e) {
        if (!silent) {
          toast.error(
            t("settings.metrics.fetch_status_failed") +
              ": " +
              (e instanceof Error ? e.message : String(e)),
          );
        }
      } finally {
        if (!silent) setLoadingStatus(false);
        setFetchedOnce(true);
      }
    },
    [call, t],
  );

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
          (e instanceof Error ? e.message : String(e)),
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
          (e instanceof Error ? e.message : String(e)),
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
      className="km-setting-card"
    >
      {/* 状态行、徽标、进度、提示、源 DSN 是卡片内的并列字段：block；GapCollapse 默认按 SPACE.block 收回 */}
      <Flex direction="column" gap="4" className="w-full pt-km-group">
        {/* 状态行 */}
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="2" weight="medium">
            {t("settings.metrics.current_status")}:
          </Text>
          <Skeletonize loading={!statusReady} as="span">
            <StatusBadge status={status} />
          </Skeletonize>
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

        {/* 源库 / 目标库信息：出现时高度展开，不把下方内容顶跳 */}
        <GapCollapse
          show={Boolean(statusData && (statusData.source_driver || statusData.target_driver))}
        >
          {statusData && (
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
        </GapCollapse>

        {/* 进度条：开始/结束迁移时高度展开/收起 */}
        <GapCollapse show={showProgress}>
          <Flex direction="column" gap="1">
            <Flex justify="between" align="center">
              <Text size="1" color="gray">
                {t("settings.metrics.migration_progress")}:{" "}
                {/* feedback 性格：迁移计数与百分比会随轮询真实增长，用滚动数字过渡 */}
                <AnimatedNumber value={metricsDone} /> /{" "}
                <AnimatedNumber value={totalMetrics} />
                {statusData?.current_metric
                  ? ` · ${statusData.current_metric}`
                  : ""}
              </Text>
              <Text size="1" color="gray">
                <AnimatedNumber value={progressPercent} format={(value) => `${value}%`} />
              </Text>
            </Flex>
            <Progress value={progressPercent} size="2" />
            <Text size="1" color="gray">
              {t("settings.metrics.migrated_points")}:{" "}
              <AnimatedNumber value={migratedPoints} />
            </Text>
          </Flex>
        </GapCollapse>

        {/* 状态 Callout */}
        {/*
          feedback 性格：状态 Callout 只在迁移状态真的切换时换内容（轮询不触发）。
          Swap：旧提示快速淡出脱离文档流、新提示淡入上浮，高度弹簧过渡。
          idle 时没有提示：外层 GapCollapse 连同它占的那份 block gap 一起收起，
          否则 0 高的空块会让上下两份 gap 叠成 32，比卡片之间还远。
        */}
        <GapCollapse show={status !== "idle"}>
        <Swap swapKey={status}>
        {status === "idle" && <div />}
        {status === "running" && (
          <div>
            <Callout.Root color="blue" variant="surface">
              <Callout.Icon>
                <RefreshCw size={16} className="animate-spin" />
              </Callout.Icon>
              <Callout.Text>
                {t("settings.metrics.migration_in_progress_hint")}
              </Callout.Text>
            </Callout.Root>
          </div>
        )}

        {status === "completed" && (
          <div>
            <Callout.Root color="green" variant="surface">
              <Callout.Icon>
                <Database size={16} />
              </Callout.Icon>
              <Callout.Text>
                {t("settings.metrics.migration_completed_hint")}
              </Callout.Text>
            </Callout.Root>
          </div>
        )}

        {status === "canceled" && (
          <div>
            <Callout.Root color="amber" variant="surface">
              <Callout.Icon>
                <AlertTriangle size={16} />
              </Callout.Icon>
              <Callout.Text>
                {t("settings.metrics.migration_canceled_hint")}
              </Callout.Text>
            </Callout.Root>
          </div>
        )}

        {status === "failed" && (
          <div>
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
          </div>
        )}
        </Swap>
        </GapCollapse>

        {/* 源 DSN + 操作按钮 */}
        <Flex direction="column" gap="2" className="w-full">
          {/* 字段名 + 说明是同一元素内部（inline），与输入行之间 group */}
          <Flex direction="column" gap="1">
            <label className="text-sm font-medium">
              {t("settings.metrics.source_dsn_title")}
            </label>
            <Text size="1" color="gray">
              {t("settings.metrics.source_dsn_description")}
            </Text>
          </Flex>
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
