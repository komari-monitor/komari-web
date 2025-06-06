"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatTime } from "@/utils/formatTime";
import { MAX_DATA_POINTS } from ".";

interface RawSystemDataPoint {
  disk: {
    total: number;
    used: number;
  };
  updated_at: string;
}

interface ChartFormattedDiskPoint {
  time: string;
  diskUsed: number;
}




const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return "N/A";
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const absoluteBytes = Math.abs(bytes);
  if (absoluteBytes < 1 && absoluteBytes > 0) {
    return parseFloat(bytes.toFixed(dm)) + " Bytes";
  }
  if (absoluteBytes < k && absoluteBytes >= 1) {
    return parseFloat(bytes.toFixed(dm)) + " Bytes";
  }

  const i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
  const index = Math.max(0, Math.min(i, sizes.length - 1));

  return (
    parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + " " + sizes[index]
  );
};

const transformDiskDataPoint = (
  rawData: RawSystemDataPoint
): { point: ChartFormattedDiskPoint; total: number } => {
  return {
    point: {
      time: formatTime(rawData.updated_at),
      diskUsed: rawData.disk.used,
    },
    total: rawData.disk.total,
  };
};

const diskChartConfig = {
  diskUsed: {
    label: "Disk Used",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const getInitialDiskTotal = (data?: RawSystemDataPoint[]): number => {
  if (data && data.length > 0 && data[data.length - 1].disk.total > 0) {
    return data[data.length - 1].disk.total;
  }
  return 1 * 1024 * 1024 * 1024;
};

export interface RealTimeDiskUsageChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeDiskUsageChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeDiskUsageChartProps) {
  const [currentDiskTotal, setCurrentDiskTotal] = useState<number>(() =>
    getInitialDiskTotal(initialRawData)
  );

  const [chartData, setChartData] = useState<ChartFormattedDiskPoint[]>(() => {
    if (initialRawData && initialRawData.length > 0) {
      return initialRawData
        .map((raw) => transformDiskDataPoint(raw).point)
        .slice(-MAX_DATA_POINTS);
    }
    return [];
  });

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0) {
      if (chartData.length === 0) {
        setChartData(
          initialRawData
            .map((raw) => transformDiskDataPoint(raw).point)
            .slice(-MAX_DATA_POINTS)
        );
      }
      const latestInitialTotal =
        initialRawData[initialRawData.length - 1].disk.total;
      if (latestInitialTotal > 0) {
        setCurrentDiskTotal(latestInitialTotal);
      } else if (currentDiskTotal <= 1) {
        setCurrentDiskTotal(getInitialDiskTotal(undefined));
      }
    }
  }, [chartData.length, currentDiskTotal, initialRawData]);

  useEffect(() => {
    if (newRawDataPoint) {
      const { point: formattedNewPoint, total: newTotal } =
        transformDiskDataPoint(newRawDataPoint);
      setChartData((prevData) => {
        const updatedData = [...prevData, formattedNewPoint];
        return updatedData.length > MAX_DATA_POINTS
          ? updatedData.slice(updatedData.length - MAX_DATA_POINTS)
          : updatedData;
      });
      if (newTotal > 0) {
        setCurrentDiskTotal(newTotal);
      }
    }
  }, [newRawDataPoint]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disk</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pr-5">
        <ChartContainer config={diskChartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, currentDiskTotal > 0 ? currentDiskTotal : 1]}
              allowDataOverflow={true}
              tickFormatter={(value) => formatBytes(value as number, 1)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: ValueType, name: NameType) => {
                let label = name;
                if (name === "diskUsed") label = "已用空间";
                if (typeof value === "number") {
                  return [label, formatBytes(value, 2)];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="diskUsed"
              type="stepAfter"
              fill={`var(--color-diskUsed)`}
              fillOpacity={0.4}
              stroke={`var(--color-diskUsed)`}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
