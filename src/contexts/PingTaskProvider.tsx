import React from "react";
import {
  PingTaskContext,
  type PingTask,
  type PingTaskResponse,
} from "./PingTaskContext";

export const PingTaskProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pingTasks, setPingTasks] = React.useState<PingTask[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    fetch("/api/admin/ping")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch ping tasks");
        return response.json();
      })
      .then((resp: PingTaskResponse) => {
        setPingTasks(resp && Array.isArray(resp.data) ? resp.data : []);
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching ping tasks");
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
    <PingTaskContext.Provider value={{ pingTasks, isLoading, error, refresh }}>
      {children}
    </PingTaskContext.Provider>
  );
};
