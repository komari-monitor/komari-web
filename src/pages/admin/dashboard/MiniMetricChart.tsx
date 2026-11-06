import { useEffect, useMemo, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { SkeletonChartShape, Skeletonize } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MetricSeries, MetricTags, QueryMetricsResponse } from "@/types/metrics";
import {
  PING_LATENCY_METRIC,
  metricSeriesColor,
  normalizeMetricSeriesList,
} from "@/utils/metricSeries";
import { formatMetricValue, miniChartCache } from "./utils";

/** 排行行旁「24h 图表」弹层里的单节点折线图 */
export const MiniMetricChart = ({
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
            ? t("dashboard.downloadRate", "Download rate")
            : key === "net.out.rate"
              ? t("dashboard.uploadRate", "Upload rate")
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
      {/*
        overlay 层：弹层里的结果区固定 180px。加载中是折线轮廓骨架（与图表交叉淡化），
        错误 / 空态与图表同高，弹层不会变高变矮。
      */}
      <Skeletonize loading={loading} label className="relative" style={{ height: 180 }}>
      <SkeletonChartShape />
      {loading ? null : error ? (
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
      </Skeletonize>
    </Flex>
  );
};
