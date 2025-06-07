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
const SettingsContext = React.createContext<SettingsData | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        setSettings(result.data);
      })
      .catch((e) => {
        console.error("Failed to fetch settings:", e);
      });
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const settings = React.useContext(SettingsContext);
  if (settings === null) {
    toast.error(t("settings.not_found"));
    return null;
  }
  return settings;
}
