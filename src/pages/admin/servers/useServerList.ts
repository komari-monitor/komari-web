import { useEffect } from "react";
import { useNodeDetails } from "@/contexts/NodeDetailsContext";
import { useRouteQuery } from "@/lib/routeData";
import { DEFAULT_SETTINGS, settingsQuery } from "@/routeQueries/ops";

/** 服务器列表数据：节点列表（每 5 秒刷新）+ 设置，以及「首次加载是否结束」 */
export default function useServerList() {
  const { nodeDetail, isLoading, error, refresh } = useNodeDetails();
  // 设置与节点列表一起由 routePreload 提前请求（src/routeQueries/ops.ts）
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const settingsLoading = settingsResult.data === undefined && !settingsResult.error;

  useEffect(() => {
    const interval = setInterval(() => { refresh() }, 5000);
    return () => clearInterval(interval);
  }, [nodeDetail]);

  // NodeDetailsProvider 的 isLoading 只表示首次加载（从第一帧起为 true），之后的 5 秒刷新不会再置 true
  const pending = isLoading;

  const isEmpty = !pending && Array.isArray(nodeDetail) && nodeDetail.length === 0;

  return { nodeDetail, error, settings, settingsLoading, pending, isEmpty };
}
