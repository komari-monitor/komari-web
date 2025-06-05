"use client";

import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
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
  ram: {
    total: number;
    used: number;
  };
  swap: {
    total: number;
    used: number;
  };
  updated_at: string;
}

interface ChartFormattedMemoryPoint {
  time: string;
  ramUsed: number;
  swapUsed: number;
}



const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return "N/A";
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const absoluteBytes = Math.abs(bytes);
  if (absoluteBytes < 1) {
    return parseFloat(bytes.toFixed(dm)) + " Bytes";
  }

  const i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
  const index = Math.max(0, Math.min(i, sizes.length - 1));

  return (
    parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + " " + sizes[index]
  );
};

const transformMemoryDataPoint = (
  rawData: RawSystemDataPoint
): ChartFormattedMemoryPoint => {
  return {
    time: formatTime(rawData.updated_at),
    ramUsed: rawData.ram.used,
    swapUsed: rawData.swap.used,
  };
};

const memoryChartConfig = {
  ramUsed: {
    label: "RAM Used",
    color: "var(--chart-1)",
  },
  swapUsed: {
    label: "Swap Used",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export interface RealTimeMemoryUsageChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeMemoryUsageChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeMemoryUsageChartProps) {
  const [chartData, setChartData] = useState<ChartFormattedMemoryPoint[]>(
    () => {
      if (initialRawData && initialRawData.length > 0) {
        const transformed = initialRawData.map(transformMemoryDataPoint);
        return transformed.slice(-MAX_DATA_POINTS);
      }
      return [];
    }
  );

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0 && chartData.length === 0) {
      const transformed = initialRawData.map(transformMemoryDataPoint);
      setChartData(transformed.slice(-MAX_DATA_POINTS));
    }
  }, [initialRawData, chartData.length]);

  useEffect(() => {
    if (newRawDataPoint) {
      const formattedNewPoint = transformMemoryDataPoint(newRawDataPoint);
      setChartData((prevData) => {
        const updatedData = [...prevData, formattedNewPoint];
        if (updatedData.length > MAX_DATA_POINTS) {
          return updatedData.slice(updatedData.length - MAX_DATA_POINTS);
        }
        return updatedData;
      });
    }
  }, [newRawDataPoint]);

  const latestRamTotal =
    newRawDataPoint?.ram.total ??
    (chartData.length > 0
      ? initialRawData?.find(
          (d) =>
            formatTime(d.updated_at) === chartData[chartData.length - 1].time
        )?.ram.total
      : undefined) ??
    0;
  const latestSwapTotal =
    newRawDataPoint?.swap.total ??
    (chartData.length > 0
      ? initialRawData?.find(
          (d) =>
            formatTime(d.updated_at) === chartData[chartData.length - 1].time
        )?.swap.total
      : undefined) ??
    0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Real-time Memory Usage 💾</CardTitle>
        <CardDescription>
          RAM Total: {formatBytes(latestRamTotal, 1)}, Swap Total:{" "}
          {formatBytes(latestSwapTotal, 1)}. Displaying last {MAX_DATA_POINTS}{" "}
          readings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={memoryChartConfig} className="h-[350px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 20,
              right: 12,
              top: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
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
                if (name === "ramUsed") label = "RAM: ";
                if (name === "swapUsed") label = "Swap: ";
                if (typeof value === "number") {
                  return [label, formatBytes(value, 2)];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="ramUsed"
              type="natural"
              fill={`var(--color-ramUsed)`}
              fillOpacity={0.4}
              stroke={`var(--color-ramUsed)`}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
            <Area
              dataKey="swapUsed"
              type="natural"
              fill={`var(--color-swapUsed)`}
              fillOpacity={0.4}
              stroke={`var(--color-swapUsed)`}
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
