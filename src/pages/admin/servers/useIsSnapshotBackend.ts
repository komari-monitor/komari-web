import { useEffect } from "react";
import { useRouteQuery } from "@/lib/routeData";
import { backendVersionQuery } from "@/routeQueries/ops";

/** 后端是否为 snapshot 版本（决定安装指令是否默认指定 snapshot 版本） */
export default function useIsSnapshotBackend() {
  // 版本号由 routePreload 在进入服务器列表时提前请求（src/routeQueries/ops.ts）
  const { data, error } = useRouteQuery(backendVersionQuery);

  useEffect(() => {
    if (error) console.error("Failed to fetch backend version:", error);
  }, [error]);

  const version = data?.version?.trim().toLowerCase() || "";
  return version.startsWith("snapshot");
}
