import React from "react";
import { useRouteQuery } from "@/lib/routeData";
import { offlineNotificationsQuery } from "@/routeQueries/ops";

export type OfflineNotification = {
  client: string;
  enable: boolean;
  cooldown: number;
  grace_period: number;
  last_notified: string;
};

interface OfflineNotificationContextType {
  offlineNotification: OfflineNotification[]
  loading?: boolean;
  error?: Error | null;
  refresh: () => Promise<void>;
}

const NotificationContext = React.createContext<OfflineNotificationContextType | undefined>(undefined);
const NO_NOTIFICATIONS: OfflineNotification[] = [];

export const OfflineNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 离线通知配置由 routePreload 在切换页面时提前请求（src/routeQueries/ops.ts）
  const result = useRouteQuery(offlineNotificationsQuery);
  React.useEffect(() => {
    if (result.error) console.error("Error fetching offline notifications:", result.error);
  }, [result.error]);
  // 与原实现一致：错误一直保留（之后的刷新成功也不清空）；loading 只表示首次加载
  const [lastError, setLastError] = React.useState<{ source: unknown; error: Error } | null>(null);
  if (result.error && result.error !== lastError?.source) {
    const source = result.error;
    setLastError({ source, error: source instanceof Error ? source : new Error(String(source)) });
  }
  const error = lastError?.error ?? null;
  const loading = result.data === undefined && !error;
  const offlineNotification = result.data ?? NO_NOTIFICATIONS;
  const refresh = result.reload;

  return (
    <NotificationContext.Provider value={{ offlineNotification, refresh, loading, error }}>
      {children}
    </NotificationContext.Provider>
  );
}
export const useOfflineNotification = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error("useOfflineNotification must be used within a OfflineNotificationProvider");
  }
  return context;
}
