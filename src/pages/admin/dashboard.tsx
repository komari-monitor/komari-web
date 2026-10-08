import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Flex,
  IconButton,
  Popover,
  Separator,
  Text,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { useNodeList, type NodeBasicInfo } from "@/contexts/NodeListContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { formatBytes } from "@/utils/unitHelper";
import Loading from "@/components/loading";
import { DashboardBoard, DashboardWidget } from "@/components/admin/dashboard/DashboardBoard";
import { ExtraWidget } from "@/components/admin/dashboard/ExtraWidgets";
import Tips from "@/components/ui/tips";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CalendarClock,
  ChartNoAxesCombined,
  Cpu,
  Database,
  Gauge,
  List,
  MemoryStick,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type {
  DashboardSummaryResponse,
  DashboardTrafficSummary,
  MetricSeries,
  MetricTags,
  PingMetricStat,
  PingMetricStatsResponse,
  PublicPingTask,
  QueryMetricsResponse,
} from "@/types/metrics";
import {
  PING_LATENCY_METRIC,
  metricSeriesColor,
  normalizeMetricSeriesList,
  pingMetricStatKey,
  pingTaskName,
} from "@/utils/metricSeries";

const formatSpeed = (bytes: number): string => {
  if (bytes === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  let decimals = 2;
  if (i >= 3) decimals = 1;
  if (i <= 1) decimals = 0;
  if (size >= 100) decimals = 0;
  return `${size.toFixed(decimals)} ${units[i]}`;
};

const formatPeakTime = (t: TFunction, timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (timestamp >= startOfToday) {
    return `${t("dashboard.today", "Today")} ${time}`;
  }
  if (timestamp >= startOfToday - DAY_MS) {
    return `${t("dashboard.yesterday", "Yesterday")} ${time}`;
  }
  return `${date.toLocaleDateString()} ${time}`;
};

const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

const latencyColor = (ms: number): "green" | "yellow" | "red" =>
  ms < 100 ? "green" : ms <= 280 ? "yellow" : "red";

const volatilityColor = (value: number): "green" | "yellow" | "red" =>
  value < 0.3 ? "green" : value <= 1 ? "yellow" : "red";

// 与后端 utils/renewal 保持一致：
// 27-32 按自然月 +1 月，87-95 +3 月，175-185 +6 月，
// 360-370 +1 年，720-750 +2 年，1080-1150 +3 年，1800-1850 +5 年，其余 +天数。
const computeRenewalDate = (
  expiredAt: Date,
  billingCycle: number,
): Date | null => {
  if (!billingCycle || billingCycle <= 0) return null;
  const now = new Date();
  let base = new Date(expiredAt);
  if (expiredAt.getTime() < now.getTime() - 30 * DAY_MS) {
    base = now;
  }
  const result = new Date(base);
  if (billingCycle >= 27 && billingCycle <= 32) {
    result.setMonth(result.getMonth() + 1);
  } else if (billingCycle >= 87 && billingCycle <= 95) {
    result.setMonth(result.getMonth() + 3);
  } else if (billingCycle >= 175 && billingCycle <= 185) {
    result.setMonth(result.getMonth() + 6);
  } else if (billingCycle >= 360 && billingCycle <= 370) {
    result.setFullYear(result.getFullYear() + 1);
  } else if (billingCycle >= 720 && billingCycle <= 750) {
    result.setFullYear(result.getFullYear() + 2);
  } else if (billingCycle >= 1080 && billingCycle <= 1150) {
    result.setFullYear(result.getFullYear() + 3);
  } else if (billingCycle >= 1800 && billingCycle <= 1850) {
    result.setFullYear(result.getFullYear() + 5);
  } else {
    result.setDate(result.getDate() + billingCycle);
  }
  return result;
};

type TopRankItem = {
  uuid: string;
  name: string;
  value: number;
  peak: number;
  peakTime: number;
};

type PingRankItem = {
  key: string;
  entityId: string;
  taskId: string;
  label: string;
  p95: number | null;
  volatility: number;
  loss: number;
  valid: number;
};

const CPU_METRIC_KEYS = ["cpu.usage"];
const MEM_METRIC_KEYS = ["memory.used"];
const NET_METRIC_KEYS = ["net.in.rate", "net.out.rate"];
const PING_METRIC_KEYS = [PING_LATENCY_METRIC];

const miniChartCache = new Map<string, MetricSeries[]>();

const Dashboard = () => {
  return <DashboardContent />;
};

const DashboardContent = () => {
  const { t } = useTranslation();
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const { call } = useRPC2Call();

  const [latest, setLatest] = useState<Record<string, any> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dbInfo, setDbInfo] = useState<{
    main: number | null;
    monitoring: number | null;
  } | null>(null);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryResponse | null>(null);
  const [pingStats, setPingStats] = useState<PingMetricStat[]>([]);
  const [pingTasks, setPingTasks] = useState<PublicPingTask[]>([]);
  const [renewingUuid, setRenewingUuid] = useState<string | null>(null);
  const [renewedUuids, setRenewedUuids] = useState<Set<string>>(new Set());

  const onlineSet = useMemo(() => {
    const out = new Set<string>();
    if (latest) {
      for (const [uuid, value] of Object.entries(latest)) {
        if ((value as any)?.online) out.add(uuid);
      }
    }
    return out;
  }, [latest]);

  const stats = useMemo(() => {
    const nodes = nodeList ?? [];
    const online = onlineSet.size;
    const total = nodes.length;
    return {
      total,
      online,
      offline: total - online,
      onlineRate: total ? (online / total) * 100 : 0,
    };
  }, [nodeList, onlineSet]);

  const offlineNodes = useMemo(
    () => (nodeList ?? []).filter((node) => !onlineSet.has(node.uuid)),
    [nodeList, onlineSet],
  );

  const nodeNameMap = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node.name])),
    [nodeList],
  );

  const memTotalMap = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node.mem_total])),
    [nodeList],
  );

  const expiringNodes = useMemo(() => {
    const now = Date.now();
    const deadline = now + EXPIRING_SOON_DAYS * DAY_MS;
    return (nodeList ?? [])
      .filter((node) => {
        if (!node.expired_at) return false;
        if (renewedUuids.has(node.uuid)) return false;
        const ts = new Date(node.expired_at).getTime();
        return ts >= now && ts <= deadline;
      })
      .sort(
        (a, b) =>
          new Date(a.expired_at).getTime() - new Date(b.expired_at).getTime(),
      );
  }, [nodeList, renewedUuids]);

  const fetchLatest = useCallback(async () => {
    try {
      const result = await call<unknown, Record<string, any>>(
        "common:getNodesLatestStatus",
      );
      setLatest(result ?? null);
    } catch (e) {
      console.error("Failed to fetch latest status:", e);
    }
  }, [call]);

  const fetchDashboardSummary = useCallback(async () => {
    const empty: DashboardSummaryResponse = {
      start: "",
      end: "",
      traffic: { points: [], nodeTotals: [], totalUp: 0, totalDown: 0 },
      top_cpu: [],
      top_mem: [],
    };
    try {
      const res = await call<unknown, DashboardSummaryResponse>(
        "public:getDashboardSummary",
        { hours: 24 },
      );
      setDashboardSummary(res ?? empty);
    } catch (e) {
      console.error("Failed to fetch dashboard summary:", e);
      setDashboardSummary(empty);
    }
  }, [call]);

  const fetchDbSize = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/database/size");
      const data = await res.json();
      const payload = data?.data;
      setDbInfo({
        main: payload?.main?.size ?? null,
        monitoring: payload?.monitoring?.size ?? null,
      });
    } catch (e) {
      console.error("Failed to fetch database size:", e);
    }
  }, []);

  const fetchPingStats = useCallback(async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        call<unknown, PingMetricStatsResponse>("public:getPingMetricStats", {
          hours: 24,
        }),
        call<unknown, PublicPingTask[]>("public:getPublicPingTasks").catch(
          () => [],
        ),
      ]);
      setPingStats(Array.isArray(statsRes?.stats) ? statsRes.stats : []);
      setPingTasks(Array.isArray(tasksRes) ? tasksRes : []);
    } catch (e) {
      console.error("Failed to fetch ping stats:", e);
    }
  }, [call]);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    miniChartCache.clear();
    try {
      await Promise.allSettled([
        refresh(),
        fetchLatest(),
        fetchDashboardSummary(),
        fetchDbSize(),
        fetchPingStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, fetchLatest, fetchDashboardSummary, fetchDbSize, fetchPingStats]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Overview cards use server-side summaries only. Full series are fetched
  // per entity when a MiniChartButton is opened.
  const traffic = useMemo<DashboardTrafficSummary | null>(
    () => dashboardSummary?.traffic ?? null,
    [dashboardSummary],
  );

  const topCpu = useMemo<TopRankItem[]>(() => {
    return (dashboardSummary?.top_cpu ?? [])
      .map((item) => ({
        uuid: item.uuid,
        name: nodeNameMap.get(item.uuid) ?? item.uuid.slice(0, 8),
        value: item.value,
        peak: item.peak,
        peakTime: item.peakTime,
      }))
      .filter((item) => Number.isFinite(item.value));
  }, [dashboardSummary, nodeNameMap]);

  const topMem = useMemo<TopRankItem[]>(() => {
    return (dashboardSummary?.top_mem ?? [])
      .map((item) => {
        const totalBytes = memTotalMap.get(item.uuid) ?? 0;
        const toPercent = (bytes: number) =>
          totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;
        return {
          uuid: item.uuid,
          name: nodeNameMap.get(item.uuid) ?? item.uuid.slice(0, 8),
          value: toPercent(item.value),
          peak: toPercent(item.peak),
          peakTime: item.peakTime,
        };
      })
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value);
  }, [dashboardSummary, nodeNameMap, memTotalMap]);

  const handleRenew = async (node: NodeBasicInfo) => {
    const expiry = computeRenewalDate(
      new Date(node.expired_at),
      node.billing_cycle,
    );
    if (!expiry) {
      toast.error(t("dashboard.renewNotSupported", "No billing cycle"));
      return;
    }
    setRenewingUuid(node.uuid);
    try {
      const res = await fetch(`/api/admin/client/${node.uuid}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: node.uuid,
          expired_at: expiry.toISOString(),
        }),
      });
      if (res.ok) {
        toast.success(
          t("dashboard.renewSuccess", "Renewed. New expiry: {{date}}", {
            date: expiry.toLocaleDateString(),
          }),
        );
        setRenewedUuids((prev) => new Set(prev).add(node.uuid));
      } else {
        toast.error(t("dashboard.renewFailed", "Renewal failed"));
      }
    } catch {
      toast.error(t("dashboard.renewFailed", "Renewal failed"));
    } finally {
      setRenewingUuid(null);
    }
  };

  const health = useMemo(() => {
    if (stats.total === 0) {
      return { level: "empty" as const, color: "gray" as const };
    }
    // Only "all online" when offline is exactly 0. A 95% threshold wrongly
    // showed healthy for 38/40 (exactly 95%) with 2 servers offline.
    if (stats.offline === 0) {
      return { level: "healthy" as const, color: "green" as const };
    }
    if (stats.onlineRate >= 75) {
      return { level: "warning" as const, color: "orange" as const };
    }
    return { level: "danger" as const, color: "red" as const };
  }, [stats.total, stats.offline, stats.onlineRate]);

  const healthDesc = {
    empty: t("dashboard.health.emptyDesc", "No servers have been added yet."),
    healthy: t(
      "dashboard.health.healthyDesc",
      "All servers are online and healthy.",
    ),
    warning: t(
      "dashboard.health.warningDesc",
      "Some servers are offline, please check.",
    ),
    danger: t(
      "dashboard.health.dangerDesc",
      "Most servers are offline, cluster is abnormal.",
    ),
  };

  const chartConfig = {
    upRate: {
      label: t("dashboard.uploadRate", "Upload rate"),
      color: "var(--green-9)",
    },
    downRate: {
      label: t("dashboard.downloadRate", "Download rate"),
      color: "var(--blue-9)",
    },
    upCum: {
      label: t("dashboard.uploadTotal", "Upload cumulative"),
      color: "var(--green-9)",
    },
    downCum: {
      label: t("dashboard.downloadTotal", "Download cumulative"),
      color: "var(--blue-9)",
    },
  } satisfies ChartConfig;

  const pingRankItems = useMemo(() => {
    const taskMap = new Map(
      pingTasks.map((task) => [String(task.id), task]),
    );
    return pingStats.map((stat) => {
      const taskName = pingTaskName(
        stat.task_id,
        taskMap,
        (id) => `${t("ping.task", "Ping task")} ${id}`,
      );
      const nodeName =
        nodeNameMap.get(stat.entity_id) ?? stat.entity_id.slice(0, 8);
      return {
        key: pingMetricStatKey(stat.entity_id, stat.task_id),
        entityId: stat.entity_id,
        taskId: stat.task_id,
        label: `${nodeName} · ${taskName}`,
        p95: typeof stat.p95 === "number" ? stat.p95 : null,
        volatility: stat.p99_p50_ratio ?? 0,
        loss: stat.loss ?? 0,
        valid: stat.valid,
      } satisfies PingRankItem;
    });
  }, [pingStats, pingTasks, nodeNameMap, t]);

  // 无有效延迟样本(如 100% 丢包)的节点波动无意义，不参与稳定性排名
  const stableLatencyItems = useMemo(
    () =>
      [...pingRankItems]
        .filter((item) => item.valid > 0)
        .sort((a, b) => a.volatility - b.volatility),
    [pingRankItems],
  );

  const unstableLatencyItems = useMemo(
    () =>
      [...pingRankItems]
        .filter((item) => item.valid > 0)
        .sort((a, b) => b.volatility - a.volatility),
    [pingRankItems],
  );

  const highestLossItems = useMemo(
    () => [...pingRankItems].sort((a, b) => b.loss - a.loss),
    [pingRankItems],
  );

  const renderLatencyColumn = (
    title: string,
    items: PingRankItem[],
    renderValue: (item: PingRankItem) => React.ReactNode,
    limit: number,
  ) => (
    <Flex direction="column" gap="2" className="flex-1 min-w-56">
      <Flex justify="between" align="center" gap="2">
        <Text size="2" weight="bold">
          {title}
        </Text>
        <RankListPopover
          title={title}
          ariaLabel={t("common.details", "Details")}
        >
          {items.length === 0 ? (
            <Text size="2" color="gray">
              {t("dashboard.noData", "No data")}
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {items.map((item, index) => (
                <Flex key={item.key} justify="between" align="center" gap="2">
                  <Text size="2" className="truncate" title={item.label}>
                    <Text size="2" color="gray">
                      {index + 1}.
                    </Text>{" "}
                    {item.label}
                  </Text>
                  <Flex align="center" gap="1" className="shrink-0">
                    {renderValue(item)}
                    <MiniChartButton
                      uuid={item.entityId}
                      metricKeys={PING_METRIC_KEYS}
                      tags={{ task_id: item.taskId }}
                      ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                    />
                  </Flex>
                </Flex>
              ))}
            </Flex>
          )}
        </RankListPopover>
      </Flex>
      {items.length === 0 ? (
        <Text size="2" color="gray">
          {t("dashboard.noData", "No data")}
        </Text>
      ) : (
        <Flex direction="column" gap="2">
          {items.slice(0, limit).map((item, index) => (
            <Flex key={item.key} justify="between" align="center" gap="2">
              <Text size="2" className="truncate" title={item.label}>
                <Text size="2" color="gray">
                  {index + 1}.
                </Text>{" "}
                {item.label}
              </Text>
              <Flex align="center" gap="1" className="shrink-0">
                {renderValue(item)}
                <MiniChartButton
                  uuid={item.entityId}
                  metricKeys={PING_METRIC_KEYS}
                  tags={{ task_id: item.taskId }}
                  ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                />
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );

  const renderLatencyValue = (item: PingRankItem) => (
    <Text size="2" className="whitespace-nowrap">
      <Text
        size="2"
        color={item.p95 != null ? latencyColor(item.p95) : "gray"}
      >
        {item.p95 != null ? `${Math.round(item.p95)} ms` : "-"}
      </Text>{" "}
      ·{" "}
      <Text size="2" color={volatilityColor(item.volatility)}>
        {t("chart.volatility", "Volatility")} {item.volatility.toFixed(2)}
      </Text>
    </Text>
  );

  if (isLoading) return <Loading text="" />;
  if (error) return <div>{error}</div>;

  return (
    <Flex direction="column" gap="4" p="4" className="km-page-admin-dashboard">
      <Flex justify="between" align="center" wrap="wrap" gap="2">
        <Flex direction="column" gap="1">
          <Text size="5" weight="bold">
            {t("dashboard.title", "Dashboard")}
          </Text>
          <Text size="2" color="gray">
            {t(
              "dashboard.greeting",
              "May every server run smoothly and everything is under control.",
            )}
          </Text>
        </Flex>
        <Button
          size="1"
          variant="soft"
          disabled={refreshing}
          onClick={() => void fetchAll()}
        >
          <RefreshCw size={14} />
          {t("common.refresh", "Refresh")}
        </Button>
      </Flex>

      <DashboardBoard>
        <DashboardWidget id="overview">
          <Flex gap="4" align="center">
            <ProgressRing
              percent={stats.onlineRate}
              color={health.color}
              ariaLabel={t(
                "dashboard.onlineRateAria",
                "{{percent}}% of servers online",
                {
                  percent: stats.onlineRate.toFixed(0),
                },
              )}
            />
            <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
              <Text size="4" weight="bold" className="truncate">
                {healthDesc[health.level]}
              </Text>
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">
                  {t("dashboard.overview", "Overview")}
                </Text>
                <Text size="2" weight="medium">
                  {t("dashboard.onlineNodes", "Online {{online}}/{{total}}", {
                    online: stats.online,
                    total: stats.total,
                  })}
                </Text>
                <Tips
                  side="right"
                  className="mr-auto"
                  ariaLabel={t("dashboard.offlineListAria", "Offline servers")}
                  trigger={
                    <Text
                      size="2"
                      weight="medium"
                      color={stats.offline > 0 ? "red" : "gray"}
                      className={
                        offlineNodes.length > 0
                          ? "cursor-pointer hover:underline"
                          : ""
                      }
                    >
                      {t("dashboard.offlineNodes", "Offline {{offline}}", {
                        offline: stats.offline,
                      })}
                    </Text>
                  }
                >
                  {offlineNodes.length > 0 ? (
                    <Flex direction="column" gap="1">
                      {offlineNodes.map((node) => (
                        <Text key={node.uuid} size="2">
                          {node.name}
                        </Text>
                      ))}
                    </Flex>
                  ) : (
                    <Text size="2">
                      {t("dashboard.noOfflineNodes", "All servers are online")}
                    </Text>
                  )}
                </Tips>
              </Flex>
            </Flex>
          </Flex>
        </DashboardWidget>

        <DashboardWidget id="database">
          <Flex direction="column" gap="3">
            <Flex gap="2" align="center" style={{ color: "var(--gray-10)" }}>
              <Database size={18} />
              <Text size="2" color="gray">
                {t("dashboard.dbUsage", "Database usage")}
              </Text>
            </Flex>
            <Flex direction="column" gap="2">
              <Flex justify="between" align="center" gap="2">
                <Text size="2" color="gray">
                  {t("dashboard.mainDb", "Main database")}
                </Text>
                <Text size="3" weight="bold">
                  {dbInfo ? formatBytes(dbInfo.main ?? 0) : "-"}
                </Text>
              </Flex>
              <Flex justify="between" align="center" gap="2">
                <Text size="2" color="gray">
                  {t("dashboard.monitoringDb", "Monitoring database")}
                </Text>
                <Text size="3" weight="bold">
                  {dbInfo ? formatBytes(dbInfo.monitoring ?? 0) : "-"}
                </Text>
              </Flex>
              <Separator size="4" />
              <Flex justify="between" align="center" gap="2">
                <Text size="2" weight="medium">
                  {t("settings.database.local_total", "Local Database Total")}
                </Text>
                <Text size="3" weight="bold">
                  {dbInfo
                    ? formatBytes((dbInfo.main ?? 0) + (dbInfo.monitoring ?? 0))
                    : "-"}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </DashboardWidget>

        <DashboardWidget id="expiry" supportsLimit>{(limit) =>
          <Flex direction="column" gap="3">
            <Flex gap="2" align="center" style={{ color: "var(--amber-11)" }}>
              <CalendarClock size={18} />
              <Text size="3" weight="bold">
                {t("dashboard.expiringSoon", "Expiring soon")}
              </Text>
            </Flex>
            {expiringNodes.length === 0 ? (
              <Text size="2" color="gray">
                {t("dashboard.noExpiring", "No servers expiring soon")}
              </Text>
            ) : (
              <Flex direction="column" gap="3">
                {expiringNodes.slice(0, limit).map((node) => {
                  const daysLeft = Math.ceil(
                    (new Date(node.expired_at).getTime() - Date.now()) / DAY_MS,
                  );
                  return (
                    <Flex
                      key={node.uuid}
                      justify="between"
                      align="center"
                      gap="2"
                    >
                      <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                        <Text
                          size="2"
                          weight="medium"
                          className="truncate"
                          title={node.name}
                        >
                          {node.name}
                        </Text>
                        <Flex gap="2" align="center">
                          <Text size="2" color="gray">
                            {new Date(node.expired_at).toLocaleDateString()}
                          </Text>
                          <Badge
                            color={daysLeft <= 3 ? "red" : "amber"}
                            variant="soft"
                          >
                            {t("dashboard.daysLeft", "{{days}} days left", {
                              days: daysLeft,
                            })}
                          </Badge>
                        </Flex>
                      </Flex>
                      <Button
                        size="1"
                        variant="soft"
                        aria-label={t("dashboard.renewed", "I've renewed")}
                        disabled={
                          renewingUuid === node.uuid ||
                          !node.billing_cycle ||
                          node.billing_cycle <= 0
                        }
                        onClick={() => handleRenew(node)}
                      >
                        {renewingUuid === node.uuid
                          ? t("dashboard.renewing", "Renewing...")
                          : t("dashboard.renewed", "I've renewed")}
                      </Button>
                    </Flex>
                  );
                })}
              </Flex>
            )}
          </Flex>
        }</DashboardWidget>

        <DashboardWidget id="traffic" supportsLimit>{(limit) =>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center" wrap="wrap" gap="2">
              <Text size="3" weight="bold">
                {t("dashboard.traffic24h", "Last 24h traffic")}
              </Text>
              <Flex gap="4" align="center" wrap="wrap">
                <Flex gap="1" align="center">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "var(--green-9)" }}
                  />
                  <Text size="2" color="gray">
                    {t("dashboard.uploadRate", "Upload rate")}
                  </Text>
                </Flex>
                <Flex gap="1" align="center">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "var(--blue-9)" }}
                  />
                  <Text size="2" color="gray">
                    {t("dashboard.downloadRate", "Download rate")}
                  </Text>
                </Flex>
                <Flex gap="1" align="center">
                  <span
                    className="w-4 border-t-2 border-dashed"
                    style={{ borderColor: "var(--green-9)" }}
                  />
                  <Text size="2" color="gray">
                    {t("dashboard.uploadTotal", "Upload cumulative")}
                  </Text>
                </Flex>
                <Flex gap="1" align="center">
                  <span
                    className="w-4 border-t-2 border-dashed"
                    style={{ borderColor: "var(--blue-9)" }}
                  />
                  <Text size="2" color="gray">
                    {t("dashboard.downloadTotal", "Download cumulative")}
                  </Text>
                </Flex>
                <Text size="2" color="gray">
                  ↑ {formatBytes(traffic?.totalUp ?? 0)} ↓{" "}
                  {formatBytes(traffic?.totalDown ?? 0)}
                </Text>
              </Flex>
            </Flex>
            {traffic === null ? (
              <Flex align="center" justify="center" style={{ height: 180 }}>
                <Loading text="" />
              </Flex>
            ) : traffic.points.length === 0 ? (
              <Flex align="center" justify="center" style={{ height: 180 }}>
                <Text size="2" color="gray">
                  {t("dashboard.noData", "No data")}
                </Text>
              </Flex>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="km-dashboard-chart h-[180px] w-full"
                style={{ aspectRatio: "auto" }}
                aria-label={t(
                  "dashboard.trafficChartAria",
                  "Last 24h traffic chart, showing upload and download rate and cumulative traffic",
                )}
              >
                <AreaChart
                  data={traffic.points}
                  margin={{ top: 16, right: 8, bottom: 4, left: 8 }}
                >
                  <defs>
                    <linearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--green-9)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--green-9)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--blue-9)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--blue-9)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: any) =>
                      new Date(v).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />
                  <YAxis
                    yAxisId="rate"
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    width={1}
                    mirror
                    tick={{ dx: 8 }}
                    tickFormatter={(v: any) =>
                      formatSpeed(Number(v)).replace(/ /g, "\u00a0")
                    }
                  />
                  <YAxis
                    yAxisId="cum"
                    orientation="right"
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    width={1}
                    mirror
                    tick={{ dx: -8 }}
                    tickFormatter={(v: any) =>
                      formatBytes(Number(v)).replace(/ /g, "\u00a0")
                    }
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_value: any, payload: any[]) => {
                          const point = payload?.[0]?.payload;
                          return point?.time
                            ? new Date(point.time).toLocaleString()
                            : "";
                        }}
                        formatter={(value: any, name: any) =>
                          name === "upRate" || name === "downRate"
                            ? formatSpeed(Number(value))
                            : formatBytes(Number(value))
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="upRate"
                    name="upRate"
                    yAxisId="rate"
                    stroke="var(--color-upRate)"
                    strokeWidth={2}
                    fill="url(#gradUp)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="downRate"
                    name="downRate"
                    yAxisId="rate"
                    stroke="var(--color-downRate)"
                    strokeWidth={2}
                    fill="url(#gradDown)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="upCum"
                    name="upCum"
                    yAxisId="cum"
                    stroke="var(--color-upCum)"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    fill="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="downCum"
                    name="downCum"
                    yAxisId="cum"
                    stroke="var(--color-downCum)"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    fill="none"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
            {traffic && traffic.nodeTotals.length > 0 && (
              <>
                <Separator size="4" />
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center" gap="2">
                    <Text size="3" weight="bold">
                      {t("dashboard.topTraffic", "Top traffic servers")}
                    </Text>
                    <RankListPopover
                      title={t("dashboard.topTraffic", "Top traffic servers")}
                      ariaLabel={t("common.details", "Details")}
                    >
                      <Flex direction="column" gap="2">
                        {traffic.nodeTotals.map((node, index) => (
                          <Flex
                            key={node.uuid}
                            justify="between"
                            align="center"
                            gap="2"
                          >
                            <Text size="2" className="truncate">
                              <Text size="2" color="gray">
                                {index + 1}.
                              </Text>{" "}
                              {nodeNameMap.get(node.uuid) ??
                                node.uuid.slice(0, 8)}
                            </Text>
                            <Flex align="center" gap="2" className="shrink-0">
                              <Text
                                size="2"
                                color="gray"
                                className="whitespace-nowrap"
                              >
                                ↑ {formatBytes(node.up)} ↓{" "}
                                {formatBytes(node.down)}
                              </Text>
                              <MiniChartButton
                                uuid={node.uuid}
                                metricKeys={NET_METRIC_KEYS}
                                ariaLabel={t(
                                  "dashboard.viewChart",
                                  "View 24h chart",
                                )}
                              />
                            </Flex>
                          </Flex>
                        ))}
                      </Flex>
                    </RankListPopover>
                  </Flex>
                  <Flex direction="column" gap="3">
                    {traffic.nodeTotals.slice(0, limit).map((node, index) => (
                      <Flex key={node.uuid} direction="column" gap="1">
                        <Flex justify="between" align="center" gap="2">
                          <Text size="2" className="truncate">
                            <Text size="2" color="gray">
                              {index + 1}.
                            </Text>{" "}
                            {nodeNameMap.get(node.uuid) ?? node.uuid.slice(0, 8)}
                          </Text>
                          <Flex align="center" gap="2" className="shrink-0">
                            <Text
                              size="2"
                              color="gray"
                              className="whitespace-nowrap"
                            >
                              ↑ {formatBytes(node.up)} ↓ {formatBytes(node.down)}
                            </Text>
                            <MiniChartButton
                              uuid={node.uuid}
                              metricKeys={NET_METRIC_KEYS}
                              ariaLabel={t(
                                "dashboard.viewChart",
                                "View 24h chart",
                              )}
                            />
                          </Flex>
                        </Flex>
                        {node.peakRate > 0 && (
                          <Text size="1" color="gray" className="truncate">
                            {t(
                              "dashboard.peakAt",
                              "Peak {{value}} at {{time}}",
                              {
                                value: formatSpeed(node.peakRate),
                                time: formatPeakTime(t, node.peakTime),
                              },
                            )}
                          </Text>
                        )}
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: "var(--gray-5)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${
                                (node.total / traffic.nodeTotals[0].total) *
                                100
                              }%`,
                              backgroundColor: "var(--accent-9)",
                              transition: "width 0.5s ease-out",
                            }}
                          />
                        </div>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              </>
            )}
          </Flex>
        }</DashboardWidget>

          <DashboardWidget id="cpu" supportsLimit>{(limit) =>
            <TopRankCard
              title={t("dashboard.topCpu", "Top CPU usage")}
              icon={<Cpu size={18} />}
              items={topCpu}
              limit={limit}
              metricKeys={CPU_METRIC_KEYS}
              t={t}
            />
          }</DashboardWidget>
          <DashboardWidget id="memory" supportsLimit>{(limit) =>
            <TopRankCard
              title={t("dashboard.topMem", "Top memory usage")}
              icon={<MemoryStick size={18} />}
              items={topMem}
              limit={limit}
              metricKeys={MEM_METRIC_KEYS}
              t={t}
            />
          }</DashboardWidget>

      <DashboardWidget id="ping" supportsLimit>{(limit) =>
        <Flex direction="column" gap="3">
          <Flex gap="2" align="center" style={{ color: "var(--gray-10)" }}>
            <Gauge size={18} />
            <Text size="3" weight="bold">
              {t("nodeCard.ping", "Ping")}
            </Text>
          </Flex>
          <Flex gap="6" wrap="wrap">
            {renderLatencyColumn(
              t("dashboard.stableLatency", "Most stable latency"),
              stableLatencyItems,
              renderLatencyValue,
              limit,
            )}
            {renderLatencyColumn(
              t("dashboard.unstableLatency", "Most unstable latency"),
              unstableLatencyItems,
              renderLatencyValue,
              limit,
            )}
            {renderLatencyColumn(
              t("dashboard.highestLoss", "Highest packet loss"),
              highestLossItems,
              (item) => (
                <Text size="2" className="whitespace-nowrap">
                  {item.loss.toFixed(1)}%
                </Text>
              ),
              limit,
            )}
          </Flex>
        </Flex>
      }</DashboardWidget>
      <DashboardWidget id="resources"><ExtraWidget kind="resources" nodes={nodeList ?? []} latest={latest} /></DashboardWidget>
      <DashboardWidget id="disk" supportsLimit>{(limit) => <ExtraWidget kind="disk" nodes={nodeList ?? []} latest={latest} limit={limit} />}</DashboardWidget>
      <DashboardWidget id="shortcuts"><ExtraWidget kind="shortcuts" nodes={nodeList ?? []} latest={latest} /></DashboardWidget>
      </DashboardBoard>
    </Flex>
  );
};

const ProgressRing = ({
  percent,
  color,
  ariaLabel,
}: {
  percent: number;
  color: "green" | "red" | "orange" | "gray";
  ariaLabel?: string;
}) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      style={{ flex: "none" }}
      role="img"
      aria-label={ariaLabel}
    >
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        stroke="var(--gray-5)"
        strokeWidth="10"
      />
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        stroke={`var(--${color}-9)`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        transform="rotate(-90 52 52)"
        style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
      />
      <text
        x="52"
        y="59"
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fill="currentColor"
      >
        {clamped.toFixed(0)}%
      </text>
    </svg>
  );
};

const TopRankCard = ({
  title,
  icon,
  items,
  metricKeys,
  limit = 4,
  t,
}: {
  title: string;
  icon: React.ReactNode;
  items: TopRankItem[];
  metricKeys: string[];
  limit?: number;
  t: TFunction;
}) => {
  return (
    <Flex direction="column" gap="3">
      <Flex
        gap="2"
        align="center"
        justify="between"
        style={{ color: "var(--gray-10)" }}
      >
        <Flex gap="2" align="center">
          {icon}
          <Text size="3" weight="bold">
            {title}
          </Text>
        </Flex>
        <RankListPopover
          title={title}
          ariaLabel={t("common.details", "Details")}
        >
          <Flex direction="column" gap="2">
            {items.map((item, index) => (
              <Flex key={item.uuid} justify="between" align="center" gap="2">
                <Text size="2" className="truncate" title={item.name}>
                  <Text size="2" color="gray">
                    {index + 1}.
                  </Text>{" "}
                  {item.name}
                </Text>
                <Flex align="center" gap="1" className="shrink-0">
                  <Text size="2" weight="bold" className="whitespace-nowrap">
                    {item.value.toFixed(1)}%
                  </Text>
                  <MiniChartButton
                    uuid={item.uuid}
                    metricKeys={metricKeys}
                    ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                  />
                </Flex>
              </Flex>
            ))}
          </Flex>
        </RankListPopover>
      </Flex>
      {items.length === 0 ? (
        <Text size="2" color="gray">
          {t("dashboard.noData", "No data")}
        </Text>
      ) : (
        <Flex direction="column" gap="3">
          {items.slice(0, limit).map((item, index) => {
            const percent = Math.min(Math.max(item.value, 0), 100);
            const barColor =
              percent >= 80 ? "red" : percent >= 60 ? "orange" : "green";
            return (
              <Flex key={item.uuid} direction="column" gap="1">
                <Flex justify="between" align="center" gap="2">
                  <Text size="2" className="truncate" title={item.name}>
                    <Text size="2" color="gray">
                      {index + 1}.
                    </Text>{" "}
                    {item.name}
                  </Text>
                  <Flex align="center" gap="1" className="shrink-0">
                    <Text size="2" weight="bold" className="whitespace-nowrap">
                      {item.value.toFixed(1)}%
                    </Text>
                    <MiniChartButton
                      uuid={item.uuid}
                      metricKeys={metricKeys}
                      ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                    />
                  </Flex>
                </Flex>
                <Text size="1" color="gray" className="truncate">
                  {t("dashboard.peakAt", "Peak {{value}} at {{time}}", {
                    value: `${item.peak.toFixed(1)}%`,
                    time: formatPeakTime(t, item.peakTime),
                  })}
                </Text>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--gray-5)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: `var(--${barColor}-9)`,
                      transition: "width 0.5s ease-out",
                    }}
                  />
                </div>
              </Flex>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
};

const formatMetricValue = (metricKey: string, value: number): string => {
  if (metricKey === "net.in.rate" || metricKey === "net.out.rate") {
    return formatSpeed(value);
  }
  if (metricKey === "memory.used") {
    return formatBytes(value);
  }
  if (metricKey === PING_LATENCY_METRIC) {
    return `${Math.round(value)} ms`;
  }
  return `${value.toFixed(1)}%`;
};

const MiniMetricChart = ({
  uuid,
  metricKeys,
  tags,
}: {
  uuid: string;
  metricKeys: string[];
  tags?: MetricTags;
}) => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const [seriesList, setSeriesList] = useState<MetricSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tagsKey = JSON.stringify(tags ?? null);
  const cacheKey = `${uuid}|${metricKeys.join(",")}|${tagsKey}`;

  useEffect(() => {
    let active = true;
    const cached = miniChartCache.get(cacheKey);
    if (cached) {
      setSeriesList(cached);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    call<any, QueryMetricsResponse>("public:queryMetrics", {
      metric_keys: metricKeys,
      entity_id: uuid,
      tags,
      start: start.toISOString(),
      end: now.toISOString(),
      aggregation: "avg",
      max_points: 240,
      fill_empty: true,
    })
      .then((res) => {
        if (!active) return;
        const next = normalizeMetricSeriesList(res?.series);
        miniChartCache.set(cacheKey, next);
        setSeriesList(next);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [call, uuid, metricKeys, tags, tagsKey, cacheKey]);

  const chartData = useMemo(() => {
    const rows = new Map<number, Record<string, string | number | null>>();
    const keys: string[] = [];
    for (const series of seriesList) {
      if (!keys.includes(series.metric_key)) keys.push(series.metric_key);
      for (const point of series.points ?? []) {
        if (point.value == null) continue;
        const ts = new Date(point.time).getTime();
        const row = rows.get(ts) ?? { time: ts };
        row[series.metric_key] = point.value;
        rows.set(ts, row);
      }
    }
    return {
      rows: Array.from(rows.values()).sort(
        (a, b) => Number(a.time) - Number(b.time),
      ),
      keys,
    };
  }, [seriesList]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const [index, key] of chartData.keys.entries()) {
      config[key] = {
        label:
          key === "net.in.rate"
            ? t("dashboard.uploadRate", "Upload rate")
            : key === "net.out.rate"
              ? t("dashboard.downloadRate", "Download rate")
              : key === "cpu.usage"
                ? t("dashboard.avgCpu", "Average CPU")
                : key === PING_LATENCY_METRIC
                  ? t("nodeCard.ping", "Ping")
                  : key,
        color: metricSeriesColor(index),
      };
    }
    return config;
  }, [chartData.keys, t]);

  return (
    <Flex direction="column" gap="2" style={{ width: 400 }}>
      <Text size="2" weight="bold">
        {t("chart.recentDay", "Last 1 day")}
      </Text>
      {loading ? (
        <Flex align="center" justify="center" style={{ height: 180 }}>
          <Loading text="" />
        </Flex>
      ) : error ? (
        <Flex align="center" justify="center" style={{ height: 180 }}>
          <Text size="2" color="red">
            {error}
          </Text>
        </Flex>
      ) : chartData.rows.length === 0 ? (
        <Flex align="center" justify="center" style={{ height: 180 }}>
          <Text size="2" color="gray">
            {t("dashboard.noData", "No data")}
          </Text>
        </Flex>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="km-dashboard-chart h-[180px] w-full"
          style={{ aspectRatio: "auto" }}
        >
          <LineChart
            data={chartData.rows}
            margin={{ top: 16, right: 8, bottom: 4, left: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: any) =>
                new Date(v).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={1}
              mirror
              tick={{ dx: 8 }}
              tickFormatter={(v: any) =>
                formatMetricValue(chartData.keys[0] ?? "", Number(v)).replace(
                  / /g,
                  "\u00a0",
                )
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_value: any, payload: any[]) => {
                    const point = payload?.[0]?.payload;
                    return point?.time
                      ? new Date(Number(point.time)).toLocaleString()
                      : "";
                  }}
                  formatter={(value: any, name: any) =>
                    formatMetricValue(String(name), Number(value))
                  }
                />
              }
            />
            {chartData.keys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={metricSeriesColor(index)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </Flex>
  );
};

const RankListPopover = ({
  title,
  ariaLabel,
  children,
}: {
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) => (
  <Popover.Root>
    <Popover.Trigger>
      <IconButton size="1" variant="ghost" color="gray" aria-label={ariaLabel}>
        <List size={14} />
      </IconButton>
    </Popover.Trigger>
    <Popover.Content style={{ width: 340 }}>
      <Flex direction="column" gap="2">
        <Text size="2" weight="bold">
          {title}
        </Text>
        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: 320 }}
        >
          {children}
        </div>
      </Flex>
    </Popover.Content>
  </Popover.Root>
);

const MiniChartButton = ({
  uuid,
  metricKeys,
  tags,
  ariaLabel,
}: {
  uuid: string;
  metricKeys: string[];
  tags?: MetricTags;
  ariaLabel?: string;
}) => (
  <Popover.Root>
    <Popover.Trigger>
      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        aria-label={ariaLabel}
      >
        <ChartNoAxesCombined size={14} />
      </IconButton>
    </Popover.Trigger>
    <Popover.Content style={{ width: 440 }}>
      <MiniMetricChart uuid={uuid} metricKeys={metricKeys} tags={tags} />
    </Popover.Content>
  </Popover.Root>
);

export default Dashboard;
