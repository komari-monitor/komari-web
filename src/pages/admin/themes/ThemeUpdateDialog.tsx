import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Theme } from "./types";

interface ThemeUpdateDialogProps {
  updateDialogOpen: boolean;
  setUpdateDialogOpen: (open: boolean) => void;
  themeToUpdate: Theme | null;
  setThemeToUpdate: (theme: Theme | null) => void;
  updating: boolean;
  updateTheme: (themeShort: string) => Promise<void>;
}

/** 从主题原地址更新 */
export default function ThemeUpdateDialog({
  updateDialogOpen,
  setUpdateDialogOpen,
  themeToUpdate,
  setThemeToUpdate,
  updating,
  updateTheme,
}: ThemeUpdateDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>{t("theme.update")}</Dialog.Title>
        <Dialog.Description>
          {t("theme.update_description")}
        </Dialog.Description>

        {/* Auto Mode Explanation */}
        <Text as="p" size="2" color="gray" mt="4">
          {t("theme.update_mode_auto_description")}
        </Text>

        <Flex gap="2" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          <Button
            color="blue"
            disabled={updating}
            onClick={async () => {
              if (themeToUpdate) {
                await updateTheme(themeToUpdate.short);
                setUpdateDialogOpen(false);
                setThemeToUpdate(null);
              }
            }}
          >
            {updating ? (
              <Box className="animate-spin mr-2">
                <RefreshCw size={16} />
              </Box>
            ) : null}
            {t("theme.update")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
