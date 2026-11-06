import type { TFunction } from "i18next";
import type { PluginInfo } from "@/types/plugin";

/** 插件是否声明了可编辑配置项（忽略 title 分组项） */
export const hasPluginConfiguration = (plugin: PluginInfo | undefined | null) =>
  Array.isArray(plugin?.configuration?.data) &&
  plugin!.configuration!.data!.some((item) => item.type !== "title");

/**
 * 需要批准的权限列表（按能力拆分；超时/大小限制等运行时设置不在此列）。
 * server.registerRPC、server.getConfig、插件目录内文件读写默认授予，不弹确认。
 */
export function pluginPermissionLabels(plugin: PluginInfo, t: TFunction): string[] {
  const labels: string[] = [];
  const p = plugin.permissions;
  if (!p) return labels;
  if (p.allowSystemRPC)
    labels.push(t("plugin.permission.allowSystemRPC", "Call system RPC"));
  if (p.allowRoutes)
    labels.push(t("plugin.permission.allowRoutes", "Register HTTP routes"));
  if (p.allowHooks)
    labels.push(
      t("plugin.permission.allowHooks", "Modify HTTP requests/responses"),
    );
  if (p.allowHTMLInject)
    labels.push(
      t(
        "plugin.permission.allowHTMLInject",
        "Embed CSS/JS into every HTML page",
      ),
    );
  if (p.allowExec)
    labels.push(t("plugin.permission.allowExec", "Execute child processes"));
  if (p.allowListen)
    labels.push(t("plugin.permission.allowListen", "Listen on local ports"));
  if (p.allowAllFileAccess)
    labels.push(
      t(
        "plugin.permission.allowAllFileAccess",
        "Access files outside the plugin directory",
      ),
    );
  return labels;
}
