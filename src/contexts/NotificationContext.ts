import React from "react";

export type OfflineNotification = {
  client: string;
  enable: boolean;
  cooldown: number;
  grace_period: number;
  last_notified: string;
};

export interface OfflineNotificationContextType {
  offlineNotification: OfflineNotification[];
  loading?: boolean;
  error?: Error | null;
  refresh: () => Promise<void>;
}

export const NotificationContext = React.createContext<
  OfflineNotificationContextType | undefined
>(undefined);

export const useOfflineNotification = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useOfflineNotification must be used within a OfflineNotificationProvider",
    );
  }
  return context;
};
