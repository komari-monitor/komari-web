"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";

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
  connections: {
    tcp: number;
    udp: number;
  };
  updated_at: string;
}

interface ChartFormattedConnectionPoint {
  time: string;
  tcpConnections: number;
  udpConnections: number;
}

const transformConnectionDataPoint = (
  rawData: RawSystemDataPoint
): ChartFormattedConnectionPoint => {
  return {
    time: formatTime(rawData.updated_at),
    tcpConnections: rawData.connections.tcp,
    udpConnections: rawData.connections.udp,
  };
};

const connectionsChartConfig = {
  tcpConnections: {
    label: "TCP",
    color: "var(--chart-1)",
  },
  udpConnections: {
    label: "UDP",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export interface RealTimeConnectionsChartProps {
  initialRawData?: RawSystemDataPoint[];
  newRawDataPoint?: RawSystemDataPoint;
}

export function RealTimeConnectionsChart({
  initialRawData,
  newRawDataPoint,
}: RealTimeConnectionsChartProps) {
  const [chartData, setChartData] = useState<ChartFormattedConnectionPoint[]>(
    () => {
      if (initialRawData && initialRawData.length > 0) {
        const transformed = initialRawData.map(transformConnectionDataPoint);
        return transformed.slice(-MAX_DATA_POINTS);
      }
      return [];
    }
  );

  useEffect(() => {
    if (initialRawData && initialRawData.length > 0 && chartData.length === 0) {
      const transformed = initialRawData.map(transformConnectionDataPoint);
      setChartData(transformed.slice(-MAX_DATA_POINTS));
    }
  }, [initialRawData, chartData.length]);

  useEffect(() => {
    if (newRawDataPoint) {
      const formattedNewPoint = transformConnectionDataPoint(newRawDataPoint);
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
        <CardTitle>Connection Counts</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={connectionsChartConfig}
          className="h-[300px] w-full"
        >
          <LineChart
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
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
              width={40}
            />
            <ChartTooltip
              cursor={true}
              formatter={(value: ValueType, name: NameType) => {
                let label = name;
                if (name === "tcpConnections") label = "TCP: ";
                if (name === "udpConnections") label = "UDP: ";
                if (typeof value === "number") {
                  return [label, String(Math.round(value))];
                }
                return [label, String(value)];
              }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent/>} />
            <Line
              dataKey="tcpConnections"
              type="linear"
              stroke={`var(--color-tcpConnections)`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="udpConnections"
              type="linear"
              stroke={`var(--color-udpConnections)`}
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
