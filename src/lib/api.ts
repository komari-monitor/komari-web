import React from "react";
import { invalidateRouteQueries } from "@/lib/routeData";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/http";

/**
 * API utility functions for settings management
 */

export interface SettingsResponse {
  sitename: string;
  description: string;
  cors_origin_check_enabled: boolean;
  geo_ip_enabled: boolean;
  geo_ip_provider: string;
  o_auth_provider: string;
  o_auth_enabled: boolean;
  ssrf_protection_enabled: boolean;
  custom_head: string;
  metric_rollup_minute_retention_minutes?: number;
  metric_rollup_five_minute_retention_minutes?: number;
  metric_rollup_hour_retention_hours?: number;
  CreatedAt: string;
  UpdatedAt: string;
  [key: string]: any;
}

type SettingsRestart = {
  guidePath: string;
};

const migrationGuideStatusPath = "/api/admin/database-migration/auth";
const migrationGuidePollInterval = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settingsRestartFrom(responseData: unknown): SettingsRestart | undefined {
  if (!isRecord(responseData) || !isRecord(responseData.data)) {
    return undefined;
  }

  const { restart_required: restartRequired, guide_path: guidePath } =
    responseData.data;
  if (
    restartRequired !== true ||
    typeof guidePath !== "string" ||
    !guidePath.startsWith("/") ||
    guidePath.startsWith("//")
  ) {
    return undefined;
  }
  return { guidePath };
}

function waitForMigrationGuide(guidePath: string) {
  const check = async () => {
    try {
      const payload = await api.get<unknown>(migrationGuideStatusPath, {
        cache: "no-store",
        expectSuccess: false,
      });
      if (isRecord(payload) && payload.status === "success") {
        window.location.replace(guidePath);
        return;
      }
    } catch {
      // The previous process may still be stopping or the replacement may not be ready.
    }
    window.setTimeout(check, migrationGuidePollInterval);
  };

  window.setTimeout(check, migrationGuidePollInterval);
}

/**
 * Fetch settings from the API
 * @returns Promise containing the settings data
 */
async function getSettings(): Promise<SettingsResponse> {
  try {
    let data: unknown;
    try {
      data = await api.get<unknown>("/api/admin/settings", { expectSuccess: false });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`HTTP error! status: ${error.status}`);
      }
      throw error;
    }
    const settingsPayload = isRecord(data) ? data["data"] : undefined;

    if (
      typeof settingsPayload !== "object" ||
      settingsPayload === null ||
      Array.isArray(settingsPayload)
    ) {
      throw new Error("Invalid settings response payload");
    }

    // Remove database metadata fields that are not needed for UI
    const settings = Object.fromEntries(
      Object.entries(settingsPayload).filter(
        ([key]) => !["CreatedAt", "UpdatedAt", "id"].includes(key),
      ),
    );

    return settings as SettingsResponse;
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    throw error;
  }
}

/**
 * Update settings via the API
 * @param settings - The settings object to update
 * @returns Promise containing the response
 */
async function updateSettings(
  settings: Partial<SettingsResponse>
): Promise<SettingsRestart | undefined> {
  let responseData: unknown;
  try {
    responseData = await api.post<unknown>("/api/admin/settings", settings, {
      expectSuccess: false,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const errorData = error.body;
    const message =
      isRecord(errorData) && errorData.message
        ? String(errorData.message)
        : `HTTP error! status: ${error.status}`;
    console.error("Failed to update settings:", message);
    throw new Error(message);
  }
  // 设置已写入：作废还没被页面取走的设置预取（任何页面保存都一样），之后进入设置页一定读到新值
  invalidateRouteQueries("ops/settings");
  invalidateRouteQueries("admin/settings");

  const restart = settingsRestartFrom(responseData);
  if (restart) {
    waitForMigrationGuide(restart.guidePath);
  }
  return restart;
}
export async function updateSettingsWithToast(
  settings: Partial<SettingsResponse>,
  t: (key: string) => string
): Promise<void> {
  try {
    const restart = await updateSettings(settings);
    if (!restart) {
      toast.success(t("settings.settings_saved"));
    }
  } catch (error) {
    toast.error(t("settings.settings_save_failed") + ": " + error);
    throw error;
  }
}

/**
 * Update a single setting field
 * @param key - The setting key to update
 * @param value - The new value for the setting
 * @param currentSettings - The current settings object (to merge with)
 * @returns Promise containing the response
 */
async function updateSingleSetting<K extends keyof SettingsResponse>(
  key: K,
  value: SettingsResponse[K],
  currentSettings: SettingsResponse
): Promise<SettingsRestart | undefined> {
  const updatedSettings = { ...currentSettings, [key]: value };
  return updateSettings(updatedSettings);
}

/**
 * Hook for managing settings state and API calls
 */
export function useSettings() {
  const [settings, setSettings] = React.useState<SettingsResponse>({
    sitename: "",
    description: "",
    cors_origin_check_enabled: true,
    geo_ip_enabled: false,
    geo_ip_provider: "",
    o_auth_provider: "",
    o_auth_enabled: false,
    ssrf_protection_enabled: false,
    custom_head: "",
    CreatedAt: "",
    UpdatedAt: "",
  });

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch settings on mount
  React.useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch settings"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update a single setting
  const updateSetting = async <K extends keyof SettingsResponse>(
    key: K,
    value: SettingsResponse[K]
  ) => {
    try {
      const restart = await updateSingleSetting(key, value, settings);
      if (!restart) {
        setSettings((prev) => ({ ...prev, [key]: value }));
      }
      return restart;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to update ${String(key)}`
      );
      throw err;
    }
  };

  // Update multiple settings
  const updateMultipleSettings = async (
    newSettings: Partial<SettingsResponse>
  ) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      const restart = await updateSettings(updatedSettings);
      if (!restart) {
        setSettings(updatedSettings);
      }
      return restart;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update settings"
      );
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    setSettings,
    updateSetting,
    updateMultipleSettings,
    refetch: async () => {
      const data = await getSettings();
      setSettings(data);
    },
  };
}
