export const THEME_CONFIGURATION_MANAGED = "managed";
export const THEME_CONFIGURATION_RAW = "raw";
export const THEME_CONFIGURATION_REDIRECT = "redirect";

export interface ThemeConfiguration {
  type?: string;
  icon?: string;
  name?: unknown;
  data?: unknown;
}

export const getThemeConfigurationType = (
  configuration?: ThemeConfiguration,
) => (configuration?.type || THEME_CONFIGURATION_MANAGED).trim().toLowerCase();

/** 主题包里的 komari-theme.json（静态文件，强制不缓存） */
export const THEME_MANIFEST_URL = (theme: string) => `/themes/${theme}/komari-theme.json`;

/** 请求主题清单，返回原始 Response（调用方自行处理 !ok） */
export const fetchThemeManifest = (theme: string) =>
  fetch(THEME_MANIFEST_URL(theme), { cache: "no-cache" });

/** 读取主题清单：HTTP 失败抛出 "HTTP <status>"，JSON 解析失败照常抛出 */
export async function loadThemeManifest<T = { configuration?: ThemeConfiguration }>(
  theme: string,
): Promise<T> {
  const resp = await fetchThemeManifest(theme);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

export const getRawThemeHtml = (configuration?: ThemeConfiguration) =>
  getThemeConfigurationType(configuration) === THEME_CONFIGURATION_RAW &&
  typeof configuration?.data === "string"
    ? configuration.data
    : "";

const normalizeSiteRoot = (siteRoot: string) => {
  const fallback = "/";
  const root = siteRoot.trim() || fallback;

  try {
    const parsed = new URL(root, window.location.origin);
    if (parsed.origin !== window.location.origin) return fallback;

    const pathname = parsed.pathname || fallback;
    if (pathname === "/") return fallback;
    return `/${pathname.replace(/^\/+|\/+$/g, "")}/`;
  } catch {
    return fallback;
  }
};

export const normalizeThemeRedirectTarget = (
  data: unknown,
  siteRoot = import.meta.env.BASE_URL || "/",
) => {
  if (typeof data !== "string") return null;

  const target = data.trim();
  if (
    !target ||
    target.startsWith("//") ||
    target.includes("\\") ||
    /^[a-z][a-z\d+\-.]*:/i.test(target)
  ) {
    return null;
  }

  let url: URL;
  try {
    const root = normalizeSiteRoot(siteRoot);
    const base = `${window.location.origin}${root}`;
    const rootRelativeTarget = target.startsWith("/")
      ? target.replace(/^\/+/, "")
      : target.replace(/^(\.\.\/)+/, "");
    const rootRelativePath = rootRelativeTarget.split(/[?#]/, 1)[0];

    if (rootRelativePath.split("/").includes("..")) return null;

    url = new URL(rootRelativeTarget, base);

    if (
      root !== "/" &&
      url.pathname !== root.slice(0, -1) &&
      !url.pathname.startsWith(root)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.pathname.split("/").includes("..")) return null;

  return `${url.pathname}${url.search}${url.hash}`;
};
