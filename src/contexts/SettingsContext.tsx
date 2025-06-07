import * as React from "react";
import { t } from "i18next";
import { toast } from "sonner";

export type SettingsData = {
  id: number;
  sitename: string;
  description: string;
  allow_cors: boolean;
  geo_ip_enabled: boolean;
  geo_ip_provider: string;
  o_auth_client_id: string;
  o_auth_client_secret: string;
  o_auth_enabled: boolean;
  disable_password_login: boolean;
  custom_head: string;
  custom_body: string;
  telegram_enabled: boolean;
  telegram_endpoint: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  CreatedAt: string;
  UpdatedAt: string;
};

type SettingsContextType = {
  settings: SettingsData | null;
  isUpdating: boolean;
  isFetching: boolean;
  updateSettings: (data: Partial<SettingsData>) => Promise<void>;
  refetchSettings: () => Promise<void>;
};

const SettingsContext = React.createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [isUpdating, setIsUpdating] = React.useState<boolean>(false);
  const [isFetching, setIsFetching] = React.useState<boolean>(true);

  const fetchSettingsData = async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      setSettings(result.data);
    } catch (e) {
      console.error("Failed to fetch settings:", e);
      toast.error(t("settings.fetch_failed") || "获取设置失败");
    } finally {
      setIsFetching(false);
    }
  };

  React.useEffect(() => {
    fetchSettingsData();
  }, []);

  const refetchSettings = async () => {
    await fetchSettingsData();
    toast.success(t("settings.refresh_success") || "设置已刷新");
  };

  const updateSettings = async (data: Partial<SettingsData>) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "An unknown error occurred");
      }

      await fetchSettingsData();
      toast.success(
        result.message || t("settings.save_success") || "设置已保存"
      );
    } catch (e: any) {
      console.error("Failed to update settings:", e);
      toast.error(e.message || t("settings.save_failed") || "保存设置失败");
    } finally {
      setIsUpdating(false);
    }
  };

  const contextValue = {
    settings,
    isUpdating,
    isFetching,
    updateSettings,
    refetchSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
