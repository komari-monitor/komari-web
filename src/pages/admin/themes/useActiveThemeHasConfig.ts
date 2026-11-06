import { useEffect, useState } from "react";
import {
  fetchThemeManifest,
  getThemeConfigurationType,
  THEME_CONFIGURATION_MANAGED,
} from "@/utils/themeConfiguration";

/** 当前主题的 komari-theme.json 是否声明了托管配置项（决定页头「主题设置」按钮） */
export function useActiveThemeHasConfig(
  currentTheme: string | undefined,
  publicTheme: string | undefined,
) {
  const [activeThemeHasConfig, setActiveThemeHasConfig] = useState(false);

  // 当 currentTheme 或 publicTheme 变化时重新检测当前主题是否有配置文件
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const themeShort = currentTheme || publicTheme;
      if (!themeShort) {
        setActiveThemeHasConfig(false);
        return;
      }
      try {
        // 强制不缓存
        const resp = await fetchThemeManifest(themeShort);
        if (!resp.ok) {
          setActiveThemeHasConfig(false);
          return;
        }
        const data = await resp.json().catch(() => null);
        if (
          !cancelled &&
          data &&
          data.configuration &&
          getThemeConfigurationType(data.configuration) ===
            THEME_CONFIGURATION_MANAGED &&
          Array.isArray(data.configuration.data) &&
          data.configuration.data.length > 0
        ) {
          setActiveThemeHasConfig(true);
        } else if (!cancelled) {
          setActiveThemeHasConfig(false);
        }
      } catch {
        if (!cancelled) setActiveThemeHasConfig(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [currentTheme, publicTheme]);

  return activeThemeHasConfig;
}
