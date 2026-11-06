import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import type { PluginInfo } from "@/types/plugin";

interface PluginDeleteDialogProps {
  pluginToDelete: PluginInfo | null;
  setPluginToDelete: (plugin: PluginInfo | null) => void;
  deleting: boolean;
  deletePlugin: (plugin: PluginInfo) => void;
}

/** 删除插件确认 */
export default function PluginDeleteDialog({
  pluginToDelete,
  setPluginToDelete,
  deleting,
  deletePlugin,
}: PluginDeleteDialogProps) {
  const { t } = useTranslation();
  return (
        <Dialog.Root
          open={pluginToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPluginToDelete(null);
          }}
        >
          <Dialog.Content>
            <Dialog.Title>{t("plugin.delete", "Delete plugin")}</Dialog.Title>
            <Text as="p" size="2">
              {t("plugin.delete_confirm", "Delete this plugin?")}{" "}
              {pluginToDelete?.short}
              <br />
              {t(
                "plugin.delete_confirm_desc",
                "The plugin directory and its configuration will be removed.",
              )}
            </Text>
            <Flex gap="2" justify="end" mt="5">
              <Button variant="soft" onClick={() => setPluginToDelete(null)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                color="red"
                disabled={deleting}
                onClick={() => pluginToDelete && deletePlugin(pluginToDelete)}
              >
                {deleting
                  ? t("plugin.deleting", "Deleting...")
                  : t("plugin.delete", "Delete")}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
  );
}
