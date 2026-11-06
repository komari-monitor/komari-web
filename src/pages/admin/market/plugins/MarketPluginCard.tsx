import { Badge, Button, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { Download, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CONTENT_MOTION, MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { StatusFeedback } from "@/components/motion";
import { hasPluginConfiguration } from "@/utils/pluginInfo";
import type { I18nText } from "@/utils/i18nText";
import type { PluginInfo } from "@/types/plugin";
import { isKomariCompatible, isVersionNewer } from "../shared/version";
import type { MarketPlugin } from "./types";

/** Radix Card 提升为 motion 组件：动画不额外增加 DOM 层级（content 层专用）。 */
const MotionMarketCard = motion.create(Card);

interface MarketPluginCardProps {
  plugin: MarketPlugin;
  index: number;
  installed: Map<string, string>;
  installedInfo: Map<string, PluginInfo>;
  currentVersion: string;
  toggling: Set<string>;
  deletingPlugin: string | null;
  installing: string | null;
  reduceMotion: boolean;
  displayText: (value: I18nText | undefined) => string;
  togglePlugin: (plugin: PluginInfo) => void | Promise<void>;
  installPlugin: (plugin: MarketPlugin) => void | Promise<void>;
  setConfigPlugin: (plugin: PluginInfo | null) => void;
  setPluginToUninstall: (plugin: MarketPlugin) => void;
}

/** 插件市场卡片：安装 / 更新 / 启停 / 配置 / 卸载 */
export default function MarketPluginCard({
  plugin,
  index,
  installed,
  installedInfo,
  currentVersion,
  toggling,
  deletingPlugin,
  installing,
  reduceMotion,
  displayText,
  togglePlugin,
  installPlugin,
  setConfigPlugin,
  setPluginToUninstall,
}: MarketPluginCardProps) {
  const { t } = useTranslation();
  const installedVersion = installed.get(plugin.short);
  const isInstalled = installedVersion !== undefined;
  const hasUpdate = Boolean(
    installedVersion &&
    isVersionNewer(plugin.version, installedVersion),
  );
  const komariCompatible = isKomariCompatible(
    plugin.komari,
    currentVersion,
  );
  const canConfigure =
    isInstalled && hasPluginConfiguration(installedInfo.get(plugin.short));
  const key = `${plugin.source_id}:${plugin.short}`;
  const busy = toggling.has(plugin.short) || deletingPlugin === plugin.short || installing === key;
  return (
    // content 层：卡片 layout 跟随搜索/分类过滤，hover 先行抬升
    <MotionMarketCard
      key={key}
      // 只补间位置：网格同行卡片会被拉齐高度，尺寸补间会把文字拉伸
      layout="position"
      // .rt-Card 的全局 transition 含 transform：motion 每帧写 transform 时会被 CSS 再插值一次（拖尾）。
    // 内联只保留颜色/阴影过渡，位移完全交给 motion 的弹簧。
    style={{ transition: "box-shadow var(--km-dur-base) var(--km-ease-standard), background-color var(--km-dur-fast) var(--km-ease-standard)" }}
      size="2"
      className="km-market-plugin-card h-full"
      initial={reduceMotion ? false : { ...CONTENT_MOTION.item.initial, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        layout: MOTION_SPRING.layout,
        opacity: MOTION_TRANSITION.fadeIn,
        scale: MOTION_SPRING.layout,
        y: MOTION_SPRING.layout,
        delay: reduceMotion ? 0 : CONTENT_MOTION.stagger(index),
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { ...CONTENT_MOTION.hover, transition: MOTION_SPRING.snappy }
      }
    >
      <Flex direction="column" gap="2" className="h-full">
        <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Text weight="bold">
            {displayText(plugin.name) || plugin.short}
          </Text>
          <Flex align="center" justify="end" gap="1" wrap="wrap">
            {hasUpdate && (
              <Badge color="orange" variant="soft">
                {t("common.update_available", "New version available")}
              </Badge>
            )}
            {isInstalled && (
              // feedback 层：运行状态真的变化时才翻一下
              <StatusFeedback state={Boolean(installedInfo.get(plugin.short)?.running)}>
                <Badge color={installedInfo.get(plugin.short)?.running ? "green" : "blue"} variant="soft">
                  {installedInfo.get(plugin.short)?.running
                    ? t("exec.status.running", "Running")
                    : t("market.installed", "Installed")} v{installedVersion?.replace(/^v/i, "")}
                </Badge>
              </StatusFeedback>
            )}
            {!isInstalled && (!plugin.installable || !komariCompatible) && (
              <Badge color="gray" variant="soft">
                {komariCompatible
                  ? t(
                      "market.install_unavailable",
                      "Package unavailable",
                    )
                  : t(
                      "plugin.market_update_required",
                      "Komari update required",
                    )}
              </Badge>
            )}
          </Flex>
        </Flex>
        <Text size="2" color="gray">
          {displayText(plugin.author)}
          {plugin.komari ? ` · ${plugin.komari}` : ""}
        </Text>
        {displayText(plugin.description) && (
          <Text size="2">{displayText(plugin.description)}</Text>
        )}
        <Flex align="center" justify="between" gap="2" wrap="wrap" className="mt-auto">
          <Text size="1" color="gray">
            {plugin.source_name}
          </Text>
          <Flex align="center" gap="2" wrap="wrap" justify="end">
            {isInstalled && installedInfo.has(plugin.short) && (
              <Switch
                size="1"
                checked={installedInfo.get(plugin.short)?.enabled ?? false}
                disabled={busy}
                onCheckedChange={() => { const info = installedInfo.get(plugin.short); if (info) void togglePlugin(info); }}
                aria-label={`${displayText(plugin.name) || plugin.short}: ${installedInfo.get(plugin.short)?.enabled
                  ? t("plugin.disable", "Disable plugin")
                  : t("plugin.enable", "Enable plugin")}`}
              />
            )}
            {!isInstalled && plugin.installable && komariCompatible && (
              <Button
                size="1"
                disabled={busy}
                onClick={() => installPlugin(plugin)}
              >
                <Download size={14} />
                {installing === key
                  ? t("plugin.market_installing", "Installing...")
                  : t("plugin.market_install", "Install")}
              </Button>
            )}
            {isInstalled && hasUpdate && plugin.installable && komariCompatible && (
              <Button
                size="1"
                color="yellow"
                variant="soft"
                disabled={busy}
                onClick={() => installPlugin(plugin)}
              >
                {installing === key ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {t("common.update", "Update")}
              </Button>
            )}
            {canConfigure && (
              <Button
                size="1"
                variant="soft"
                disabled={busy}
                onClick={() => setConfigPlugin(installedInfo.get(plugin.short) || null)}
              >
                <Settings2 size={14} />
                {t("plugin.config", "Configuration")}
              </Button>
            )}
            {isInstalled && (
              <Button
                size="1"
                variant="soft"
                color="red"
                disabled={busy}
                onClick={() => setPluginToUninstall(plugin)}
              >
                <Trash2 size={14} />
                {t("market.uninstall", "Uninstall")}
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>
    </MotionMarketCard>
  );
}
