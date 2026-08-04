import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Flex, Separator, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useLiveData, LiveDataProvider } from "@/contexts/LiveDataContext";
import { useNodeList, type NodeBasicInfo } from "@/contexts/NodeListContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { formatBytes } from "@/utils/unitHelper";
import Loading from "@/components/loading";
import UsageBar from "@/components/UsageBar";
import Tips from "@/components/ui/tips";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CalendarClock, Cpu, Database } from "lucide-react";
import { toast } from "sonner";
import type { QueryMetricsResponse } from "@/types/metrics";

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

const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

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

const DASHBOARD_REFRESH_MS = 60000;

const Dashboard = () => {
  return (
    <LiveDataProvider>
      <DashboardContent />
    </LiveDataProvider>
  );
};

const DashboardContent = () => {
  const { t } = useTranslation();
  const { live_data } = useLiveData();
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const { call } = useRPC2Call();

  const liveData = live_data?.data;
  const onlineSet = useMemo(() => new Set(liveData?.online ?? []), [liveData]);

  const [traffic, setTraffic] = useState<{
    points: {
      time: number;
      upRate: number;
      downRate: number;
      upCum: number;
      downCum: number;
    }[];
    nodeTotals: { uuid: string; up: number; down: number; total: number }[];
    totalUp: number;
    totalDown: number;
  } | null>(null);
  const [dbInfo, setDbInfo] = useState<{
    main: number | null;
    monitoring: number | null;
  } | null>(null);
  const [renewingUuid, setRenewingUuid] = useState<string | null>(null);

  const stats = useMemo(() => {
    const nodes = nodeList ?? [];
    let cpuSum = 0;
    let withLive = 0;
    for (const node of nodes) {
      if (!onlineSet.has(node.uuid)) continue;
      const record = liveData?.data[node.uuid];
      if (!record) continue;
      withLive += 1;
      cpuSum += record.cpu.usage || 0;
    }
    const online = onlineSet.size;
    const total = nodes.length;
    return {
      total,
      online,
      offline: total - online,
      onlineRate: total ? (online / total) * 100 : 0,
      avgCpu: withLive ? cpuSum / withLive : 0,
    };
  }, [liveData, nodeList, onlineSet]);

  const offlineNodes = useMemo(
    () => (nodeList ?? []).filter((node) => !onlineSet.has(node.uuid)),
    [nodeList, onlineSet],
  );

  const nodeNameMap = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node.name])),
    [nodeList],
  );

  const expiringNodes = useMemo(() => {
    const now = Date.now();
    const deadline = now + EXPIRING_SOON_DAYS * DAY_MS;
    return (nodeList ?? [])
      .filter((node) => {
        if (!node.expired_at) return false;
        const ts = new Date(node.expired_at).getTime();
        return ts >= now && ts <= deadline;
      })
      .sort(
        (a, b) =>
          new Date(a.expired_at).getTime() - new Date(b.expired_at).getTime(),
      );
  }, [nodeList]);

  const fetchTraffic = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    try {
      const res = await call<any, QueryMetricsResponse>("public:queryMetrics", {
        metric_keys: [
          "net.in.rate",
          "net.out.rate",
          "traffic.up",
          "traffic.down",
        ],
        start: start.toISOString(),
        end: now.toISOString(),
        aggregation: "max",
        aggregation_by_metric: {
          "traffic.up": "sum",
          "traffic.down": "sum",
        },
        fill_empty: true,
      });
      const byTime = new Map<
        number,
        {
          upRate: number;
          downRate: number;
          upDelta: number;
          downDelta: number;
        }
      >();
      const byEntity = new Map<string, { up: number; down: number }>();
      for (const series of res?.series ?? []) {
        const isRate =
          series.metric_key === "net.in.rate" ||
          series.metric_key === "net.out.rate";
        const isUp =
          series.metric_key === "net.out.rate" ||
          series.metric_key === "traffic.up";
        if (
          !isRate &&
          series.metric_key !== "traffic.up" &&
          series.metric_key !== "traffic.down"
        ) {
          continue;
        }
        const entity = series.entity_id;
        for (const point of series.points ?? []) {
          if (point.value == null) continue;
          const ts = new Date(point.time).getTime();
          const entry =
            byTime.get(ts) ??
            { upRate: 0, downRate: 0, upDelta: 0, downDelta: 0 };
          if (isRate) {
            if (isUp) entry.upRate += point.value;
            else entry.downRate += point.value;
          } else if (isUp) {
            entry.upDelta += point.value;
          } else {
            entry.downDelta += point.value;
          }
          byTime.set(ts, entry);
          if (!isRate) {
            const entityEntry = byEntity.get(entity) ?? { up: 0, down: 0 };
            if (isUp) entityEntry.up += point.value;
            else entityEntry.down += point.value;
            byEntity.set(entity, entityEntry);
          }
        }
      }
      const rate = Array.from(byTime.entries())
        .map(([time, value]) => ({ time, ...value }))
        .sort((a, b) => a.time - b.time);
      const points: {
        time: number;
        upRate: number;
        downRate: number;
        upCum: number;
        downCum: number;
      }[] = [];
      let totalUp = 0;
      let totalDown = 0;
      for (const point of rate) {
        totalUp += point.upDelta;
        totalDown += point.downDelta;
        points.push({
          time: point.time,
          upRate: point.upRate,
          downRate: point.downRate,
          upCum: totalUp,
          downCum: totalDown,
        });
      }
      const nodeTotals = Array.from(byEntity.entries())
        .map(([uuid, value]) => ({
          uuid,
          up: value.up,
          down: value.down,
          total: value.up + value.down,
        }))
        .sort((a, b) => b.total - a.total);
      setTraffic({ points, nodeTotals, totalUp, totalDown });
    } catch (e) {
      console.error("Failed to fetch traffic metrics:", e);
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

  useEffect(() => {
    let interval: number | undefined;
    const stopPolling = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const startPolling = () => {
      if (interval === undefined && !document.hidden) {
        interval = window.setInterval(refresh, 5000);
      }
    };
    const handleVisibilityChange = () => {
      stopPolling();
      if (!document.hidden) {
        refresh();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    fetchTraffic();
    fetchDbSize();
    const interval = window.setInterval(() => {
      fetchTraffic();
      fetchDbSize();
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchTraffic, fetchDbSize]);

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
        refresh();
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
    if (stats.onlineRate >= 95) {
      return { level: "healthy" as const, color: "green" as const };
    }
    if (stats.onlineRate >= 75) {
      return { level: "warning" as const, color: "orange" as const };
    }
    return { level: "danger" as const, color: "red" as const };
  }, [stats.total, stats.onlineRate]);

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

  if (isLoading) return <Loading text="" />;
  if (error) return <div>{error}</div>;

  return (
    <Flex direction="column" gap="4" p="4">
      <Flex gap="4" wrap="wrap">
        <Card className="flex-1 min-w-72">
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
        </Card>

        <Card className="flex-1 min-w-64">
          <StatCard
            title={t("dashboard.avgCpu", "Average CPU")}
            value={`${stats.avgCpu.toFixed(1)}%`}
            icon={<Cpu size={18} />}
          >
            <UsageBar label="" value={stats.avgCpu} compact />
          </StatCard>
        </Card>

        <Card className="flex-1 min-w-64">
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
            </Flex>
          </Flex>
        </Card>

        {expiringNodes.length > 0 && (
          <Card className="flex-1 min-w-72">
            <Flex direction="column" gap="3">
              <Flex gap="2" align="center" style={{ color: "var(--amber-11)" }}>
                <CalendarClock size={18} />
                <Text size="3" weight="bold">
                  {t("dashboard.expiringSoon", "Expiring soon")}
                </Text>
              </Flex>
              <Flex direction="column" gap="3">
                {expiringNodes.map((node) => {
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
            </Flex>
          </Card>
        )}
      </Flex>

      <Card>
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
            <Flex align="center" justify="center" style={{ height: 280 }}>
              <Loading text="" />
            </Flex>
          ) : traffic.points.length === 0 ? (
            <Flex align="center" justify="center" style={{ height: 280 }}>
              <Text size="2" color="gray">
                {t("dashboard.noData", "No data")}
              </Text>
            </Flex>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="h-[280px] w-full"
              aria-label={t(
                "dashboard.trafficChartAria",
                "Last 24h traffic chart, showing upload and download rate and cumulative traffic",
              )}
            >
              <AreaChart
                data={traffic.points}
                margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
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
                  tickFormatter={(v: any) => formatSpeed(Number(v))}
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
                  tickFormatter={(v: any) => formatBytes(Number(v))}
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
                <Text size="3" weight="bold">
                  {t("dashboard.topTraffic", "Top traffic servers")}
                </Text>
                <Flex direction="column" gap="3">
                  {traffic.nodeTotals.slice(0, 5).map((node, index) => (
                    <Flex key={node.uuid} direction="column" gap="1">
                      <Flex justify="between" align="center" gap="2">
                        <Text size="2" className="truncate">
                          <Text size="2" color="gray">
                            {index + 1}.
                          </Text>{" "}
                          {nodeNameMap.get(node.uuid) ?? node.uuid.slice(0, 8)}
                        </Text>
                        <Text
                          size="2"
                          color="gray"
                          className="whitespace-nowrap"
                        >
                          ↑ {formatBytes(node.up)} ↓ {formatBytes(node.down)}
                        </Text>
                      </Flex>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: "var(--gray-5)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${
                              (node.total / traffic.nodeTotals[0].total) * 100
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
      </Card>
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

const StatCard = React.memo(
  ({
    title,
    value,
    icon,
    children,
  }: {
    title: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    return (
      <Flex direction="column" gap="3">
        <Flex gap="2" align="center" style={{ color: "var(--gray-10)" }}>
          {icon}
          <Text size="2" color="gray">
            {title}
          </Text>
        </Flex>
        <Text size="6" weight="bold">
          {value}
        </Text>
        {children}
      </Flex>
    );
  },
);

export default Dashboard;
