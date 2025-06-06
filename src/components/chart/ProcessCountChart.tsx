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
  process: number;
  updated_at: string;
  cpu?: { usage: number };
  ram?: { total: number; used: number };
  swap?: { total: number; used: number };
  network?: { up: number; down: number };
}

interface ChartFormattedProcessPoint {
  time: string;
  processCount: number;
}



const transformProcessDataPoint = (
  rawData: RawSystemDataPoint
): ChartFormattedProcessPoint => {
  return {
    time: formatTime(rawData.updated_at),
    processCount: Math.floor(rawData.process),
  };
};

const processChartConfig = {
  processCount: {
    label: "Processes",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export interface RealTimeProcessCountChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeProcessCountChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeProcessCountChartProps) {
  const [chartData, setChartData] = useState<ChartFormattedProcessPoint[]>(
    () => {
      if (initialRawData && initialRawData.length > 0) {
        const transformed = initialRawData.map(transformProcessDataPoint);
        return transformed.slice(-MAX_DATA_POINTS);
      }
      return [];
    }
  );

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0 && chartData.length === 0) {
      const transformed = initialRawData.map(transformProcessDataPoint);
      setChartData(transformed.slice(-MAX_DATA_POINTS));
    }
  }, [initialRawData, chartData.length]);

  useEffect(() => {
    if (newRawDataPoint) {
      const formattedNewPoint = transformProcessDataPoint(newRawDataPoint);
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
        <CardTitle>Process Count</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={processChartConfig}
          className="h-[300px] w-full"
        >
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
              dataKey="processCount"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={30}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: ValueType, name: NameType) => {
                let label = name;
                if (name === "processCount") label = "进程数: ";
                if (typeof value === "number") {
                  return [label, Math.floor(value).toString()];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="processCount"
              type="stepAfter"
              fill={`var(--color-processCount)`}
              fillOpacity={0.4}
              stroke={`var(--color-processCount)`}
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
