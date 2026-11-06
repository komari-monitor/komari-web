import { Badge, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { MOTION_TRANSITION } from "@/lib/motion";
import { pluginPermissionLabels } from "@/utils/pluginInfo";
import type { PluginInfo } from "@/types/plugin";

interface PluginPermissionDialogProps {
  /** 待批准的插件；null 时关闭 */
  plugin: PluginInfo | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onApprove: () => void;
  /** 启停请求进行中：禁用两个按钮 */
  busy?: boolean;
  /** 权限徽标逐个错峰淡入（插件管理页） */
  animated?: boolean;
}

// 插件启用前的权限确认弹窗：插件管理页与插件市场共用。
export default function PluginPermissionDialog({
  plugin,
  onOpenChange,
  onCancel,
  onApprove,
  busy,
  animated,
}: PluginPermissionDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={plugin !== null} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Title>
          {t("plugin.permission_title", "Permission required")}
        </Dialog.Title>
        {/* 说明 → 权限列表 → 默认授予附注：同一块内容，block；附注紧跟列表 */}
        <Text as="p" size="2">
          {t(
            "plugin.permission_description",
            "This plugin requests the following permissions:",
          )}
        </Text>
        <Flex direction="column" gap="2" mt="4">
          {plugin &&
            pluginPermissionLabels(plugin, t).length === 0 && (
              <Text size="2" color="gray">
                {t(
                  "plugin.permission_none",
                  "This plugin requests no special permissions",
                )}
              </Text>
            )}
          {plugin &&
            pluginPermissionLabels(plugin, t).map((label, index) =>
              animated ? (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    ...MOTION_TRANSITION.fadeIn,
                    delay: Math.min(index * 0.03, 0.18),
                  }}
                >
                  <Badge color="orange" size="2" className="justify-start">
                    {label}
                  </Badge>
                </motion.div>
              ) : (
                <Badge
                  key={label}
                  color="orange"
                  size="2"
                  className="justify-start"
                >
                  {label}
                </Badge>
              ),
            )}
        </Flex>
        <Text as="p" size="1" color="gray" mt="4">
          {t(
            "plugin.permission_default_note",
            "Default granted: read plugin configuration, register plugin RPC, read/write files inside the plugin directory",
          )}
        </Text>
        <Flex gap="2" justify="end" mt="5">
          <Button variant="soft" disabled={busy} onClick={onCancel}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button disabled={busy} onClick={onApprove}>
            {t("plugin.permission_approve", "Approve & Enable")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
