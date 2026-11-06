import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RouteQueryResult } from "@/lib/routeData";

/** 只读取首屏状态，不关心数据类型 */
type QueryState = Pick<RouteQueryResult<unknown>, "data" | "error">;
import { toastError } from "./api";

/**
 * 市场页的首屏加载与手动刷新：
 * - 首屏的目录与源由 useRouteQuery 读取（切换页面时已提前请求）；任一失败 toast 一次，之后 loading=false；
 * - refresh() 强制刷新目录，成功 toast refreshSuccessText。
 */
export function useMarketPage(
  catalog: QueryState,
  sources: QueryState,
  loadCatalog: (force?: boolean) => Promise<unknown>,
  refreshSuccessText: string,
) {
  const [refreshing, setRefreshing] = useState(false);
  const firstError = catalog.error ?? sources.error;
  const failed = Boolean(firstError);
  // 与原来的 Promise.all 一致：两个都到了，或任一失败，首屏就结束
  const loading = !failed && (catalog.data === undefined || sources.data === undefined);

  const reported = useRef(false);
  useEffect(() => {
    if (!firstError || reported.current) return;
    reported.current = true;
    toastError(firstError);
  }, [firstError]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCatalog(true);
      toast.success(refreshSuccessText);
    } catch (error) {
      toastError(error);
    } finally {
      setRefreshing(false);
    }
  };

  return { loading, refreshing, refresh };
}
