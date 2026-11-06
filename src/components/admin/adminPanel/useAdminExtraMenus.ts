import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText } from "@/utils/i18nText";
import { resolvePluginIcon } from "@/utils/iconHelper";
import type { PluginInfo } from "@/types/plugin";
import {
  getThemeConfigurationType,
  loadThemeManifest,
  normalizeThemeRedirectTarget,
  THEME_CONFIGURATION_MANAGED,
  THEME_CONFIGURATION_RAW,
  THEME_CONFIGURATION_REDIRECT,
} from "@/utils/themeConfiguration";
import type { ExtendedMenuItem } from "./types";

/**
 * 后台侧栏的动态菜单：
 * - 当前主题声明了配置页时，在「外观与插件」下注入主题配置入口；
 * - 已启用插件的后台页面，组成「插件功能」二级菜单。
 * refreshVersion 变化（安装/切换主题、启停插件后）时重新读取。
 */
export function useAdminExtraMenus(
  currentTheme: string | undefined,
  currentLanguage: string,
  refreshVersion: number,
) {
  const { call } = useRPC2Call();
  const { t } = useTranslation();
  // 动态扩展菜单（主题 + 插件注入页面）
  const [extraMenuItems, setExtraMenuItems] = useState<ExtendedMenuItem[]>([]);
  const [pluginMenuItems, setPluginMenuItems] = useState<ExtendedMenuItem[]>([]);

  useEffect(() => {
    let ignore = false;
    async function loadThemeMenu() {
      // 仅当 theme 存在且不等于 default 时扩展
      if (!currentTheme) {
        setExtraMenuItems([]);
        return;
      }
      try {
        const data = await loadThemeManifest<any>(currentTheme);
        if (ignore) return;
        const cfg = data?.configuration;
        if (!cfg) {
          setExtraMenuItems([]);
          return;
        }

        const cfgType = getThemeConfigurationType(cfg);
        let itemPath: string | null = null;
        if (
          cfgType === THEME_CONFIGURATION_MANAGED &&
          Array.isArray(cfg.data) &&
          cfg.data.length > 0
        ) {
          itemPath = "/admin/theme_managed";
        } else if (cfgType === THEME_CONFIGURATION_RAW) {
          itemPath = "/admin/theme_raw";
        } else if (cfgType === THEME_CONFIGURATION_REDIRECT) {
          itemPath = normalizeThemeRedirectTarget(cfg.data);
        }

        if (!itemPath) {
          setExtraMenuItems([]);
          return;
        }
        const rawLabel: string =
          resolveI18nText(cfg.name, currentLanguage) ??
          t("theme.manage_with_name", {
            name: currentTheme === "default" ? "" : currentTheme,
          });
        const icon: string = cfg.icon || "Settings2"; // fallback icon
        const item: ExtendedMenuItem = {
          labelKey: rawLabel,
          rawLabel,
          path: itemPath,
          icon,
          reloadDocument: cfgType === THEME_CONFIGURATION_REDIRECT,
        };
        setExtraMenuItems([item]);
      } catch (e) {
        console.warn("加载主题配置失败，将不扩展主题菜单:", e);
        if (!ignore) setExtraMenuItems([]);
      }
    }
    loadThemeMenu();
    return () => {
      ignore = true;
    };
  }, [currentTheme, refreshVersion]);
  // 插件注入的管理页面：manifest pages（visibility=admin）-> 插件菜单的二级菜单。
  // iframe 页面进入 plugin-page 路由；redirect 页面复用主题的站内跳转校验。
  useEffect(() => {
    let ignore = false;
    async function loadPluginMenu() {
      try {
        const result = await call<any, PluginInfo[]>("admin:listPlugins");
        if (ignore || !Array.isArray(result)) return;
        const pluginIconUrl = (plugin: PluginInfo, icon?: string) =>
          resolvePluginIcon(plugin.short, icon) || "Blocks";
        const items: ExtendedMenuItem[] = [];
        for (const plugin of result) {
          if (!plugin.enabled) continue; // 未启用的插件不注入导航菜单
          for (const page of plugin.pages || []) {
            if (page.visibility === "public") continue; // 公开页面走公开路由，不进后台导航
            const label =
              resolveI18nText(page.title, currentLanguage) ||
              resolveI18nText(plugin.name, currentLanguage) ||
              plugin.short;
            const pageType = page.type || "iframe";
            if (pageType === "redirect") {
              const target = normalizeThemeRedirectTarget(page.url);
              if (!target) continue;
              items.push({
                labelKey: label,
                rawLabel: label,
                path: target,
                icon: pluginIconUrl(plugin, page.icon),
                reloadDocument: true, // 与主题 redirect 一致：整页跳转到站内路径
              });
              continue;
            }
            items.push({
              labelKey: label,
              rawLabel: label,
              path: `/admin/plugin-page?short=${encodeURIComponent(plugin.short)}&file=${encodeURIComponent(page.file || "")}`,
              icon: pluginIconUrl(plugin, page.icon),
            });
          }
        }
        if (!ignore) setPluginMenuItems(items);
      } catch (e) {
        console.warn("加载插件菜单失败:", e);
        if (!ignore) setPluginMenuItems([]);
      }
    }
    loadPluginMenu();
    return () => {
      ignore = true;
    };
  }, [call, currentLanguage, refreshVersion]);

  return { extraMenuItems, pluginMenuItems };
}
