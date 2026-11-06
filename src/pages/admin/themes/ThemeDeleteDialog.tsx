import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import type { I18nText } from "@/utils/i18nText";
import type { Theme } from "./types";

interface ThemeDeleteDialogProps {
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  themeToDelete: Theme | null;
  setThemeToDelete: (theme: Theme | null) => void;
  currentTheme: string | undefined;
  displayText: (value: I18nText | undefined) => string;
  deleteTheme: (themeShort: string) => Promise<void>;
}

/** 删除主题确认（删除当前主题时提示会先切回默认主题） */
export default function ThemeDeleteDialog({
  deleteDialogOpen,
  setDeleteDialogOpen,
  themeToDelete,
  setThemeToDelete,
  currentTheme,
  displayText,
  deleteTheme,
}: ThemeDeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>{t("theme.confirm_delete")}</Dialog.Title>
        <Dialog.Description>
          {t(
            themeToDelete?.short === currentTheme
              ? "theme.delete_active_warning"
              : "theme.delete_warning",
            { themeName: displayText(themeToDelete?.name) },
          )}
        </Dialog.Description>
        <Flex gap="2" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          <Button
            color="red"
            onClick={async () => {
              if (themeToDelete) {
                await deleteTheme(themeToDelete.short);
                setDeleteDialogOpen(false);
                setThemeToDelete(null);
              }
            }}
          >
            {t("common.delete")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
