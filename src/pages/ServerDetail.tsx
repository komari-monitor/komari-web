import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useParams } from "react-router";
import { useLiveData } from "@/contexts/LiveNodeDataContext";
import type { Record } from "@/types/NodeInfo";
import {
  RealTimeCpuUsageChart,
  RealTimeMemoryUsageChart,
  RealTimeNetworkSpeedChart,
  RealTimeConnectionsChart,
  RealTimeDiskUsageChart,
  RealTimeProcessCountChart,
} from "@/components/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { NodeInfoPanel } from "@/components/NodeInfoPanel";
import Flag from "@/components/Flag";

export const ServerDetail: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { live_data, node_data } = useLiveData();
  const [recentData, setRecentData] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!uuid) {
    window.location.href = "/";
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/recent/${uuid}`)
      .then((res) => {
        if (!res.ok) throw new Error("网络请求失败");
        return res.json();
      })
      .then((resJson) => {
        if (Array.isArray(resJson)) {
          setRecentData(resJson);
        } else {
          throw new Error("数据格式错误");
        }
      })
      .catch((err) => {
        setRecentData([]);
        setError(err.message || "加载失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [uuid]);

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="md:text-base text-sm">
            <h2 className="text-lg font-semibold mb-4">
              Server Detail for {uuid}
            </h2>
          </CardContent>
        </Card>
        <div className="p-8 text-center text-red-500">
          加载图表失败：{error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card className="gap-0">
        <CardHeader >
          <div className="flex justify-start items-center space-x-2">
            <Flag
              flag={
                node_data?.data.find((node) => node.uuid === uuid)?.region || ""
              }
            />
            <div className="flex flex-col">
              <p
                className={`font-bold text-base
                  truncate max-w-[180px] sm:max-w-[200px]`}
              >
                {node_data?.data.find((node) => node.uuid === uuid)?.name ||
                  uuid}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="md:text-base text-sm">
          <NodeInfoPanel
            nodeBasicInfo={node_data?.data.find((node) => node.uuid === uuid)!}
            record={live_data?.data.data[uuid!]}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </>
        ) : (
          <>
            <RealTimeCpuUsageChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
            <RealTimeMemoryUsageChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
            <RealTimeDiskUsageChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
            <RealTimeConnectionsChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
            <RealTimeNetworkSpeedChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
            <RealTimeProcessCountChart
              initialRawData={recentData}
              newRawDataPoint={live_data?.data.data[uuid!]}
            />
          </>
        )}
      </div>
    </div>
  );
};
