import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, Switch } from "@radix-ui/themes";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
import Tips from "./ui/tips";
import { useRPC2Call } from "@/contexts/RPC2Context";

type PingTask = {
  id: number;
  name: string;
  interval?: number;
  clients?: string[];
  default_on?: boolean;
};

type MetricPoint = {
  time: string;
  value: number | null;
  tags?: Record<string, string>;
};

type MetricSeries = {
  metric_key: string;
  tags?: Record<string, string>;
  count: number;
  points: MetricPoint[];
};

type QueryMetricsResponse = {
  series: MetricSeries[];
};

type RenderSeries = {
  dataKey: string;
  taskId: string;
  name: string;
  color: string;
};

const colors = [
  "#F38181",
  "#347433",
  "#898AC4",
  "#03A6A1",
  "#7AD6F0",
  "#B388FF",
  "#FF8A65",
  "#FFD600",
];

interface MiniPingChartProps {
  uuid: string;
  width?: string | number;
  height?: string | number;
  hours?: number;
}

const applyEwma = (
  rows: Array<Record<string, string | number | null>>,
  series: RenderSeries[],
  enabled: boolean,
) => {
  if (!enabled) return rows;
  const alpha = 0.35;
  const out = rows.map((row) => ({ ...row }));
  for (const item of series) {
    let previous: number | null = null;
    for (const row of out) {
      const value = row[item.dataKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      previous = previous === null ? value : alpha * value + (1 - alpha) * previous;
      row[item.dataKey] = previous;
    }
  }
  return out;
};

const taskIdFromSeries = (series: MetricSeries, index: number) => {
  const raw = series.tags?.task_id;
  return raw && raw.trim() ? raw : String(index + 1);
};

const MiniPingChart = ({
  uuid,
  width = "100%",
  height = 300,
  hours = 12,
}: MiniPingChartProps) => {
  const [metricSeries, setMetricSeries] = useState<MetricSeries[]>([]);
  const [tasks, setTasks] = useState<PingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});
  const { t } = useTranslation();
  const [ewmaEnabled, setEwmaEnabled] = useState(false);
  const { call } = useRPC2Call();

  useEffect(() => {
    if (!uuid) return;

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      call<unknown, PingTask[]>("public:getPublicPingTasks"),
      call<any, QueryMetricsResponse>(
        "public:queryMetrics",
        {
          metric_keys: ["ping.latency_ms"],
          entity_id: uuid,
          hours,
          downsample: true,
          max_points: 240,
          aggregation: "avg",
          fill_empty: true,
        },
        { timeout: 30000 },
      ),
    ])
      .then(([taskList, result]) => {
        if (!active) return;
        setTasks(Array.isArray(taskList) ? taskList : []);
        setMetricSeries(result?.series ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Error");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [uuid, hours, call]);

  const taskMap = useMemo(
    () => new Map(tasks.map((task) => [String(task.id), task])),
    [tasks],
  );

  const built = useMemo(() => {
    const rows = new Map<string, Record<string, string | number | null>>();
    const renderSeries: RenderSeries[] = [];

    metricSeries.forEach((series, index) => {
      const taskId = taskIdFromSeries(series, index);
      const task = taskMap.get(taskId);
      const dataKey = `task_${taskId}_${index}`;
      renderSeries.push({
        dataKey,
        taskId,
        name: task?.name || `Task ${taskId}`,
        color: colors[index % colors.length],
      });

      for (const point of series.points ?? []) {
        const time = new Date(point.time).toISOString();
        const row = rows.get(time) ?? { time };
        row[dataKey] =
          typeof point.value === "number" && point.value >= 0 ? point.value : null;
        rows.set(time, row);
      }
    });

    return {
      rows: Array.from(rows.values()).sort(
        (a, b) => new Date(String(a.time)).getTime() - new Date(String(b.time)).getTime(),
      ),
      series: renderSeries,
    };
  }, [metricSeries, taskMap]);

  const chartData = useMemo(
    () => applyEwma(built.rows, built.series, ewmaEnabled),
    [built.rows, built.series, ewmaEnabled],
  );

  const timeFormatter = (value: any, index: number) => {
    if (!chartData.length) return "";
    if (index === 0 || index === chartData.length - 1) {
      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  };

  const labelFormatter = (value: any) => {
    const date = new Date(value);
    return date.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const chartConfig = useMemo(() => {
    const config: Record<string, any> = {};
    for (const item of built.series) {
      config[item.dataKey] = {
        label: item.name,
        color: item.color,
      };
    }
    return config;
  }, [built.series]);

  const handleLegendClick = useCallback((e: any) => {
    const key = e.dataKey;
    setHiddenLines((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <Card style={{ width, height }} className="flex flex-col">
      {loading && (
        <div
          style={{
            textAlign: "center",
            width: "100%",
            flexGrow: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loading />
        </div>
      )}
      {error && (
        <div
          style={{
            color: "red",
            textAlign: "center",
            width: "100%",
            flexGrow: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {error}
        </div>
      )}
      {!loading && !error && chartData.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          {t("common.none")}
        </div>
      ) : (
        !loading &&
        !error && (
          <ChartContainer config={chartConfig} className="w-full h-full">
            <LineChart
              data={chartData}
              accessibilityLayer
              margin={{ top: 10, right: 16, bottom: 10, left: 16 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickFormatter={timeFormatter}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                unit="ms"
                allowDecimals={false}
                orientation="left"
                type="number"
                tick={{ dx: -10 }}
                mirror={true}
              />
              <ChartTooltip
                cursor={false}
                formatter={(v: any) => (v === null ? null : `${Math.round(v)} ms`)}
                content={
                  <ChartTooltipContent
                    labelFormatter={labelFormatter}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend onClick={handleLegendClick} />
              {built.series.map((item) => (
                <Line
                  key={item.dataKey}
                  dataKey={item.dataKey}
                  name={item.dataKey}
                  stroke={item.color}
                  dot={false}
                  isAnimationActive={false}
                  strokeWidth={2}
                  connectNulls={true}
                  type="linear"
                  hide={!!hiddenLines[item.dataKey]}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )
      )}
      <div className="-mt-3 flex items-center" style={{ display: loading ? "none" : "flex" }}>
        <Switch size="1" checked={ewmaEnabled} onCheckedChange={setEwmaEnabled} />
        <label className="text-sm font-medium flex items-center gap-1 flex-row">
          EWMA
          <Tips mode="popup" side="top">
            <span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} />
          </Tips>
        </label>
      </div>
    </Card>
  );
};

export default MiniPingChart;
