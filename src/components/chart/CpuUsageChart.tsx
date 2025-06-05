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
  cpu: {
    usage: number;
  };
  updated_at: string;
}

interface ChartFormattedDataPoint {
  time: string;
  cpuUsage: number;
}



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
        <CardTitle>Real-time CPU Usage 📊</CardTitle>
        <CardDescription>
          Displaying the last {MAX_DATA_POINTS} CPU usage readings.
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
              width={30}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: ValueType, name: NameType) => {
                let label = name;
                if (name === "cpuUsage") label = "CPU 使用率: ";
                if (typeof value === "number") {
                  return [label, `${value.toFixed(2)}%`];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="cpuUsage"
              type="step"
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
