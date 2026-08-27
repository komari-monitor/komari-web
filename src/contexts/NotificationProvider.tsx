import React from "react";
import {
  NotificationContext,
  type OfflineNotification,
} from "./NotificationContext";

export const OfflineNotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [offlineNotification, setOfflineNotification] = React.useState<
    OfflineNotification[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const firstLoad = React.useRef(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    try {
      setError(null);
      const response = await fetch("/api/admin/notification/offline");
      if (!response.ok) {
        throw new Error("Failed to fetch offline notifications");
      }
      const data = await response.json();
      setOfflineNotification(data.data || []);
    } catch (error) {
      console.error("Error fetching offline notifications:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ offlineNotification, refresh, loading, error }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
