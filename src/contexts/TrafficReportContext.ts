import React from "react";

export type TrafficReportNotification = {
  client: string;
  enable: boolean;
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
};

export interface TrafficReportNotificationContextType {
  trafficReportNotification: TrafficReportNotification[];
  loading?: boolean;
  error?: Error | null;
  refresh: () => Promise<void>;
}

export const TrafficReportContext = React.createContext<
  TrafficReportNotificationContextType | undefined
>(undefined);

export const useTrafficReportNotification = () => {
  const context = React.useContext(TrafficReportContext);
  if (!context) {
    throw new Error(
      "useTrafficReportNotification must be used within a TrafficReportNotificationProvider",
    );
  }
  return context;
};
