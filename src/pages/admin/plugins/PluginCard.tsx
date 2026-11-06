import { AnimatePresence, motion } from "motion/react";
import { Badge, Button, Callout, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { FileText, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { StatusFeedback } from "@/components/motion";
import PluginIcon from "@/components/admin/PluginIcon";
import { hasPluginConfiguration } from "@/utils/pluginInfo";
import type { I18nText } from "@/utils/i18nText";
import type { PluginInfo } from "@/types/plugin";

/**
 * 把 Radix 的 Card 提升为 motion 组件：避免为了动画多包一层 div 改变原有 DOM 结构。
 * content 层专用（layout 弹簧 + 进场淡入）。
 */
const MotionCard = motion.create(Card);

interface PluginCardProps {
  plugin: PluginInfo;
  index: number;
  reduceMotion: boolean;
  displayText: (value: I18nText | undefined) => string;
  toggling: string | null;
  onConfigure: (plugin: PluginInfo) => void;
  onLogs: (plugin: PluginInfo) => void;
  onDelete: (plugin: PluginInfo) => void;
  onToggle: (plugin: PluginInfo, enabled: boolean) => void;
}

/** 已安装插件卡片：图标、名称、状态、配置/日志/删除、启停开关、启动失败错误 */
export default function PluginCard({
  plugin,
  index,
  reduceMotion,
  displayText,
  toggling,
  onConfigure,
  onLogs,
  onDelete,
  onToggle,
}: PluginCardProps) {
  const { t } = useTranslation();
  return (
    // content 层：卡片整行 layout 弹簧 + 进场错峰，DOM 上仍是一张 Card
    <MotionCard
      // 只补间位置：卡片高度会随日志/提示变化，尺寸补间会把文字拉伸
      layout="position"
      // .rt-Card 的全局 transition 含 transform：motion 每帧写 transform 时会被 CSS 再插值一次（拖尾）。
      // 内联只保留颜色/阴影过渡，位移完全交给 motion 的弹簧。
      style={{ transition: "box-shadow var(--km-dur-base) var(--km-ease-standard), background-color var(--km-dur-fast) var(--km-ease-standard)" }}
      size="2"
      className="km-plugin-card w-full"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        layout: MOTION_SPRING.layout,
        y: MOTION_SPRING.layout,
        opacity: MOTION_TRANSITION.fadeIn,
        delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.16),
      }}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="4">
          <Flex align="center" gap="2" className="min-w-0">
            <PluginIcon plugin={plugin} size={20} className="h-5 w-5 shrink-0" />
            <Flex direction="column" gap="1" className="min-w-0">
              <Flex align="center" gap="2" wrap="wrap">
                <Text weight="bold">
                  {displayText(plugin.name) || plugin.short}
                </Text>
                {/* feedback 层：启停状态真的翻转时翻一下 */}
                <StatusFeedback state={plugin.running}>
                  <Badge color={plugin.running ? "green" : "gray"}>
                    {plugin.running
                      ? t("plugin.running", "Running")
                      : t("plugin.stopped", "Stopped")}
                  </Badge>
                </StatusFeedback>
                <Text size="2" color="gray">
                  v{plugin.version}
                  {displayText(plugin.author)
                    ? ` · ${displayText(plugin.author)}`
                    : ""}
                </Text>
              </Flex>
              {displayText(plugin.description) && (
                <Text size="2" color="gray" className="truncate">
                  {displayText(plugin.description)}
                </Text>
              )}
            </Flex>
          </Flex>
          <Flex align="center" gap="2" className="shrink-0">
            {hasPluginConfiguration(plugin) && (
              <Button
                size="1"
                variant="soft"
                onClick={() => onConfigure(plugin)}
              >
                <Settings2 size={14} />
                {t("plugin.config", "Configuration")}
              </Button>
            )}
            <Button
              size="1"
              variant="soft"
              onClick={() => onLogs(plugin)}
            >
              <FileText size={14} />
              {t("logs.title", "Logs")}
            </Button>
            <Button
              size="1"
              variant="ghost"
              color="red"
              onClick={() => onDelete(plugin)}
              title={t("plugin.delete", "Delete plugin")}
              aria-label={t("plugin.delete", "Delete plugin")}
            >
              <Trash2 size={14} />
            </Button>
            <Switch
              checked={plugin.enabled}
              disabled={toggling === plugin.short}
              onCheckedChange={(checked) => onToggle(plugin, checked)}
              aria-label={
                plugin.enabled
                  ? t("plugin.disable", "Disable plugin")
                  : t("plugin.enable", "Enable plugin")
              }
              title={
                plugin.enabled
                  ? t("plugin.disable", "Disable plugin")
                  : t("plugin.enable", "Enable plugin")
              }
            />
          </Flex>
        </Flex>
        {/* feedback 层：启动失败的错误出现/清除时高度展开/收起，卡片不跳高（下方卡片由 layout 跟随） */}
        <AnimatePresence initial={false}>
          {plugin.last_error && (
            <motion.div
              key="last-error"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fade }}
              style={{ overflow: "hidden" }}
            >
              <Callout.Root color="red" size="1">
                <Callout.Text>
                  {t("plugin.last_error", "Last error")}:{" "}
                  {plugin.last_error}
                </Callout.Text>
              </Callout.Root>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>
    </MotionCard>
  );
}
