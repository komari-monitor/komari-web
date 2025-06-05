import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "react-router";
import { useLiveData } from "@/contexts/LiveNodeDataContext";
import type { Record } from "@/types/NodeInfo";
import { RealTimeCpuUsageChart } from "@/components/CpuUsageChart";
export const ServerDetail: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { live_data } = useLiveData();
  const [recentData, setRecentData] = useState<Record[]>([]);
  if (!uuid) {
    window.location.href = "/";
  }

  useEffect(() => {
    fetch(`/api/recent/${uuid}`)
      .then((res) => res.json())
      .then((resJson) => {
        if (Array.isArray(resJson)) {
          setRecentData(resJson);
          console.log("Recent data fetched:", resJson);
        }
      })
      .catch(() => setRecentData([]));
  }, [uuid]);
  return (
    <>
      {" "}
      <Card className="mx-4">
        <CardContent className="p-4 md:text-base text-sm">
          <h2 className="text-lg font-semibold mb-4">
            Server Detail for {uuid}
          </h2>
          <p>Details for server with ID: {uuid}</p>
        </CardContent>
      </Card>
      <Card className="">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-4">CPU Usage Chart</h3>
          <RealTimeCpuUsageChart
            initialRawData={recentData}
            newRawDataPoint={live_data?.data.data[uuid!]}
          />
        </CardContent>
      </Card>
    </>
  );
};
