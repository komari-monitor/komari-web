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

interface RawSystemDataPoint {
  cpu: {
    usage: number;
  };
  updated_at: string;
}

interface ChartFormattedDataPoint {
  time: string;
  cpuUsage: number;
}

const MAX_DATA_POINTS = 50;

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const transformRawDataPoint = (
  rawData: RawSystemDataPoint
): ChartFormattedDataPoint => {
  return {
    time: formatTime(rawData.updated_at),
    cpuUsage: parseFloat(rawData.cpu.usage.toFixed(2)),
  };
};

const chartConfig = {
  cpuUsage: {
    label: "CPU Usage",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export interface RealTimeCpuUsageChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeCpuUsageChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeCpuUsageChartProps) {
  const [chartData, setChartData] = useState<ChartFormattedDataPoint[]>(() => {
    if (initialRawData && initialRawData.length > 0) {
      const transformed = initialRawData.map(transformRawDataPoint);
      return transformed.slice(-MAX_DATA_POINTS);
    }
    return [];
  });

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0 && chartData.length === 0) {
      const transformed = initialRawData.map(transformRawDataPoint);
      setChartData(transformed.slice(-MAX_DATA_POINTS));
    }
  }, [initialRawData, chartData.length]);

  useEffect(() => {
    if (newRawDataPoint) {
      const formattedNewPoint = transformRawDataPoint(newRawDataPoint);
      setChartData((prevData) => {
        const updatedData = [...prevData, formattedNewPoint];
        if (updatedData.length > MAX_DATA_POINTS) {
          return updatedData.slice(updatedData.length - MAX_DATA_POINTS);
        }
        return updatedData;
      });
    }
  }, [newRawDataPoint]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU</CardTitle>
        <CardDescription>
          Updated_at:
          {newRawDataPoint?.updated_at
            ? formatTime(newRawDataPoint.updated_at)
            : "N/A"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 12,
              top: 5,
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
              dataKey="cpuUsage"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}%`}
              width={35}
            />
            <ChartTooltip
              cursor={true}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="cpuUsage"
              type="natural"
              fill={`var(--color-cpuUsage)`}
              fillOpacity={0.4}
              stroke={`var(--color-cpuUsage)`}
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
