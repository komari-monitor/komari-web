import React from "react";
import { useTranslation } from "react-i18next";
import {
  TrafficReportContext,
  type TrafficReportNotification,
} from "./TrafficReportContext";

export const TrafficReportNotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { t } = useTranslation();
  const [trafficReportNotification, setTrafficReportNotification] =
    React.useState<TrafficReportNotification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const firstLoad = React.useRef(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    try {
      setError(null);
      const response = await fetch("/api/admin/notification/traffic-report/");
      if (!response.ok) {
        throw new Error(t("notification.traffic_report.errors.fetch_failed"));
      }
      const data = await response.json();
      setTrafficReportNotification(data.data || []);
    } catch (err) {
      console.error("Error fetching traffic report notifications:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, [t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <TrafficReportContext.Provider
      value={{ trafficReportNotification, refresh, loading, error }}
    >
      {children}
    </TrafficReportContext.Provider>
  );
};
