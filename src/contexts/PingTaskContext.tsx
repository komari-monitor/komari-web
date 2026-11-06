import React from "react";
import { useRouteQuery } from "@/lib/routeData";
import { pingTasksQuery } from "@/routeQueries/ops";

export interface PingTask {
  clients?: string[];
  default_on?: boolean;
  id?: number;
  interval?: number;
  target?: string;
  type?: string;
  [property: string]: any;
}

interface PingTaskContextType {
  pingTasks: PingTask[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const PingTaskContext = React.createContext<PingTaskContextType | undefined>(
  undefined
);

export const PingTaskProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // 任务列表由 routePreload 在切换页面时提前请求（src/routeQueries/ops.ts）
  const result = useRouteQuery(pingTasksQuery);
  const pingTasks = result.data ?? null;
  // 与原实现一致：刷新开始时清掉错误，失败时显示错误文字
  const error =
    result.loading || !result.error
      ? null
      : (result.error instanceof Error && result.error.message) ||
        "An error occurred while fetching ping tasks";
  const { reload } = result;
  const refresh = React.useCallback(() => {
    void reload();
  }, [reload]);

  return (
    <PingTaskContext.Provider
      value={{ pingTasks, isLoading: result.loading, error, refresh }}
    >
      {children}
    </PingTaskContext.Provider>
  );
};

export const usePingTask = () => {
  const context = React.useContext(PingTaskContext);
  if (!context) {
    throw new Error("usePingTask must be used within a PingTaskProvider");
  }
  return context;
};
