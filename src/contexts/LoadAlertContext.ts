import React from "react";

export interface LoadAlert {
  id?: number;
  name?: string;
  clients?: string[];
  metric?: "cpu" | "ram" | "disk" | "net_in" | "net_out";
  threshold?: number;
  ratio?: number;
  interval?: number;
  last_notified?: string;
  [property: string]: any;
}

export interface LoadAlertResponse {
  data: LoadAlert[];
  message: string;
  status: string;
  [property: string]: any;
}

export interface LoadAlertContextType {
  loadAlerts: LoadAlert[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export const LoadAlertContext = React.createContext<
  LoadAlertContextType | undefined
>(undefined);

export const useLoadAlert = () => {
  const context = React.useContext(LoadAlertContext);
  if (!context) {
    throw new Error("useLoadAlert must be used within a LoadAlertProvider");
  }
  return context;
};
