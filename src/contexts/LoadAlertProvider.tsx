import React from "react";
import {
  LoadAlertContext,
  type LoadAlert,
  type LoadAlertResponse,
} from "./LoadAlertContext";

export const LoadAlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loadAlerts, setLoadAlerts] = React.useState<LoadAlert[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    fetch("/api/admin/notification/load")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch notification tasks");
        }
        return response.json();
      })
      .then((resp: LoadAlertResponse) => {
        setLoadAlerts(resp && Array.isArray(resp.data) ? resp.data : []);
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching load alerts");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    refresh();
    setIsLoading(false);
  }, [refresh]);

  return (
    <LoadAlertContext.Provider value={{ loadAlerts, isLoading, error, refresh }}>
      {children}
    </LoadAlertContext.Provider>
  );
};
