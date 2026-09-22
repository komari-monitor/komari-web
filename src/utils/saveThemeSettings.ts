type ThemeSettings = Record<string, unknown>;

let pending: Promise<unknown> = Promise.resolve();

export async function readCurrentThemeSettings() {
  const response = await fetch("/api/public", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { data } = await response.json();
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
    const response = await fetch(`/api/admin/theme/settings?theme=${encodeURIComponent(theme)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...current.settings, ...values }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  };
  const task = pending.catch(() => {}).then(() =>
    navigator.locks
      ? navigator.locks.request("komari-theme-settings", save)
      : save(),
  );
  pending = task;
  return task;
}
