import { ApiError, requestJson, type RequestOptions } from "@/lib/http";

type ThemeSettings = Record<string, unknown>;

// 这两个接口原本只检查 HTTP 状态，错误文字为 "HTTP <status>"。
async function request<T>(url: string, options: RequestOptions) {
  try {
    return await requestJson<T>(url, { ...options, expectSuccess: false });
  } catch (error) {
    if (error instanceof ApiError) throw new Error(`HTTP ${error.status}`);
    throw error;
  }
}

let pending: Promise<unknown> = Promise.resolve();

export async function readCurrentThemeSettings() {
  const payload = await request<{ data?: any } | null>("/api/public", { cache: "no-store" });
  const data = payload?.data;
  if (!data || typeof data.theme !== "string" ||
    !data.theme_settings || typeof data.theme_settings !== "object" ||
    Array.isArray(data.theme_settings)) {
    throw new Error("Invalid theme settings response");
  }
  return { theme: data.theme as string, settings: data.theme_settings as ThemeSettings };
}

// This endpoint replaces the entire configuration, including undeclared keys.
// Merge a fresh read and serialize writes, also across tabs where supported.
export function saveThemeSettings(
  theme: string,
  patch: ThemeSettings | ((current: ThemeSettings) => ThemeSettings),
) {
  const save = async () => {
    const current = await readCurrentThemeSettings();
    if (current.theme !== theme) throw new Error("The active theme has changed");
    const values = typeof patch === "function" ? patch(current.settings) : patch;
    await request(`/api/admin/theme/settings?theme=${encodeURIComponent(theme)}`, {
      json: { ...current.settings, ...values },
      keepalive: true,
    });
  };
  const task = pending.catch(() => {}).then(() =>
    navigator.locks
      ? navigator.locks.request("komari-theme-settings", save)
      : save(),
  );
  pending = task;
  return task;
}
