"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatTime } from "@/utils/formatTime";
import { MAX_DATA_POINTS } from ".";

interface RawSystemDataPoint {
  network: {
    up: number;
    down: number;
  };
  updated_at: string;
}

interface ChartFormattedNetworkPoint {
  time: string;
  downloadSpeed: number;
  uploadSpeed: number;
}



const formatSpeed = (bytesPerSecond: number, decimals: number = 2): string => {
  if (
    bytesPerSecond === null ||
    bytesPerSecond === undefined ||
    isNaN(bytesPerSecond)
  )
    return "N/A";
  if (bytesPerSecond === 0) return "0 B/s";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];

  const absoluteBps = Math.abs(bytesPerSecond);
  if (absoluteBps < 1 && absoluteBps > 0) {
    return parseFloat(bytesPerSecond.toFixed(dm)) + " B/s";
  }
  if (absoluteBps < k && absoluteBps >= 1) {
    return parseFloat(bytesPerSecond.toFixed(dm)) + " B/s";
  }

  const i = Math.floor(Math.log(absoluteBps) / Math.log(k));
  const index = Math.max(0, Math.min(i, sizes.length - 1));

  return (
    parseFloat((bytesPerSecond / Math.pow(k, index)).toFixed(dm)) +
    " " +
    sizes[index]
  );
};

const transformNetworkDataPoint = (
  rawData: RawSystemDataPoint
): ChartFormattedNetworkPoint => {
  return {
    time: formatTime(rawData.updated_at),
    downloadSpeed: rawData.network.down,
    uploadSpeed: rawData.network.up,
  };
};

const networkChartConfig = {
  downloadSpeed: {
    label: "Download",
    color: "var(--chart-1)",
  },
  uploadSpeed: {
    label: "Upload",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export interface RealTimeNetworkSpeedChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeNetworkSpeedChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeNetworkSpeedChartProps) {
  const [chartData, setChartData] = useState<ChartFormattedNetworkPoint[]>(
    () => {
      if (initialRawData && initialRawData.length > 0) {
        const transformed = initialRawData.map(transformNetworkDataPoint);
        return transformed.slice(-MAX_DATA_POINTS);
      }
      return [];
    }
  );

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0 && chartData.length === 0) {
      const transformed = initialRawData.map(transformNetworkDataPoint);
      setChartData(transformed.slice(-MAX_DATA_POINTS));
    }
  }, [initialRawData, chartData.length]);

  useEffect(() => {
    if (newRawDataPoint) {
      const formattedNewPoint = transformNetworkDataPoint(newRawDataPoint);
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
        <CardTitle>Real-time Network Speed 📈</CardTitle>
        <CardDescription>
          Displaying real-time download and upload speeds for the last{" "}
          {MAX_DATA_POINTS} readings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={networkChartConfig}
          className="h-[350px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 20, right: 12, top: 5, bottom: 5 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(value) => formatSpeed(value as number, 1)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: ValueType, name: NameType) => {
                let label = name;
                if (name === "downloadSpeed") label = "下载速度: ";
                if (name === "uploadSpeed") label = "上传速度: ";
                if (typeof value === "number") {
                  return [label, formatSpeed(value, 2)];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="downloadSpeed"
              type="monotone"
              stroke={`var(--color-downloadSpeed)`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="uploadSpeed"
              type="monotone"
              stroke={`var(--color-uploadSpeed)`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
