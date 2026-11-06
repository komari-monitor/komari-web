import React from 'react';
import { errorMessage } from "@/lib/http";
import { useRouteQuery } from "@/lib/routeData";
import { nodeDetailsQuery } from "@/routeQueries/ops";

export type NodeDetail = {
  uuid: string;
  token: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  gpu_name: string;
  ipv4: string;
  ipv6: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version: string;
  weight: number;
  price: number;
  remark: string | undefined;
  public_remark: string;
  group: string | undefined;
  billing_cycle: number;
  expired_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: any; 
};

interface NodeDetailsContextType {
  nodeDetail: NodeDetail[] | [];
  /** 首次加载还没结束（从第一帧起就是 true，数据或错误到达后变 false；之后的 refresh 不再置 true） */
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}
const NodeDetailsContext = React.createContext<NodeDetailsContextType | undefined>(undefined);
const NO_NODES: NodeDetail[] = [];
export const NodeDetailsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 节点列表由 routePreload 在切换页面时提前请求（src/routeQueries/ops.ts 为所有用到本 Provider 的路由登记）
  const result = useRouteQuery(nodeDetailsQuery);
  // 错误文字保留到下一次出错（与原实现一致：之后的刷新成功也不清空）
  const [lastError, setLastError] = React.useState<{ source: unknown; message: string } | null>(null);
  if (result.error && result.error !== lastError?.source) {
    setLastError({ source: result.error, message: errorMessage(result.error) });
  }
  const error = lastError?.message ?? null;
  const isLoading = result.data === undefined && error === null;
  const { reload } = result;
  const refresh = React.useCallback(() => {
    void reload();
  }, [reload]);
  const nodeDetail = result.data ?? NO_NODES;
  return (
    <NodeDetailsContext.Provider value={{ nodeDetail, isLoading, error, refresh }}>
      {children}
    </NodeDetailsContext.Provider>
  );
};

export const useNodeDetails = () => {
    const context = React.useContext(NodeDetailsContext);
    if (context === undefined) {
        throw new Error("useNodeDetails must be used within a NodeDetailsProvider");
    }
    return context;
};
