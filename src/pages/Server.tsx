import { LiveDataProvider, useLiveData } from "@/contexts/LiveNodeDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { NodeGrid } from "@/components/NodeCard";

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// 新建一个内部组件来消费 Context 和渲染 UI
const DashboardContent = () => {
  const [t] = useTranslation();
  const { live_data, node_data } = useLiveData();
  document.title = t("home_title");

  return (
    <>
      <Card className="mx-4">
        <CardContent className="p-4 md:text-base text-sm">
          <div className="flex md:flex-row flex-col md:gap-4 gap-1 justify-between md:items-center">
            <div className="flex w-full flex-row items-center justify-between md:basis-1/5">
              <p>{t("current_time")}</p>
              <p>{new Date().toLocaleString()}</p>
            </div>
            <div className="h-px w-full bg-border md:h-6 md:w-0.5 md:block hidden" />
            <div className="flex w-full flex-row items-center justify-between md:basis-1/5">
              <p>{t("current_online")}</p>
              <p>
                {live_data?.data?.online.length ?? 0} /{" "}
                {node_data?.data?.length ?? 0}
              </p>
            </div>
            <div className="h-px w-full bg-border md:h-6 md:w-0.5 md:block hidden" />
            <div className="flex w-full flex-row items-center justify-between md:basis-1/5">
              <p>{t("region_overview")}</p>
              <p>
                {node_data?.data
                  ? Object.entries(
                      node_data.data.reduce((acc, item) => {
                        acc[item.region] = (acc[item.region] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).length
                  : 0}
              </p>
            </div>
            <div className="h-px w-full bg-border md:h-6 md:w-0.5 md:block hidden" />
            <div className="flex w-full flex-row items-center justify-between md:basis-1/5">
              <p>{t("traffic_overview")}</p>
              <p>
                {"↑ " +
                  formatBytes(
                    live_data?.data?.data
                      ? Object.values(live_data.data.data).reduce(
                          (
                            acc,
                            node_item: { network: { totalUp?: number } }
                          ) => {
                            return acc + (node_item.network.totalUp || 0);
                          },
                          0
                        )
                      : 0
                  )}{" "}
                /{" "}
                {"↓ " +
                  formatBytes(
                    live_data?.data?.data
                      ? Object.values(live_data.data.data).reduce(
                          (
                            acc,
                            node_item: { network: { totalDown?: number } }
                          ) => {
                            return acc + (node_item.network.totalDown || 0);
                          },
                          0
                        )
                      : 0
                  )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <NodeGrid
        nodes={node_data?.data ?? []}
        liveData={live_data?.data ?? { online: [], data: {} }}
      />
    </>
  );
};

const Dashboard = () => {
  return (
    <LiveDataProvider>
      <DashboardContent />
    </LiveDataProvider>
  );
};

export default Dashboard;
