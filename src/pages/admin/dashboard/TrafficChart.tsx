import { Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { SkeletonChartShape, Skeletonize } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatBytes } from "@/utils/unitHelper";
import type { TrafficSummary } from "./types";
import { formatSpeed } from "@/utils/unitHelper";

/** 24h 流量图：上传 / 下载速率（面积）+ 累计流量（虚线），双 Y 轴 */
export const TrafficChart = ({
  traffic,
  loading,
}: {
  traffic: TrafficSummary | null;
  loading: boolean;
}) => {
  const { t } = useTranslation();

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

  // content 层：图表区高度恒定 180px（骨架 / 空态 / 图表一致，卡片不变高变矮）。
  // 骨架期间显示折线轮廓（SkeletonChartShape 常驻挂载），数据到达后与真实图表交叉淡化。
  return (
    <Skeletonize
      loading={loading}
      label
      className="relative"
      style={{ height: 180 }}
    >
      <SkeletonChartShape />
      {traffic === null || traffic.points.length === 0 ? (
        <Flex align="center" justify="center" style={{ height: 180 }}>
          {!loading && (
            <Text size="2" color="gray">
              {t("dashboard.noData", "No data")}
            </Text>
          )}
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
    </Skeletonize>
  );
};
