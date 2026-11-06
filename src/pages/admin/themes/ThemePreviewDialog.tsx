import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { Image as ImageIcon, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { I18nText } from "@/utils/i18nText";
import type { Theme } from "./types";

interface ThemePreviewDialogProps {
  previewDialogOpen: boolean;
  setPreviewDialogOpen: (open: boolean) => void;
  selectedTheme: Theme | null;
  displayText: (value: I18nText | undefined) => string;
  setActiveTheme: (themeShort: string) => void;
  setThemeToUpdate: (theme: Theme) => void;
  setUpdateDialogOpen: (open: boolean) => void;
  setThemeToDelete: (theme: Theme) => void;
  setDeleteDialogOpen: (open: boolean) => void;
}

/** 主题详情：大预览图、作者/版本/说明/地址，启用、更新、删除入口 */
export default function ThemePreviewDialog({
  previewDialogOpen,
  setPreviewDialogOpen,
  selectedTheme,
  displayText,
  setActiveTheme,
  setThemeToUpdate,
  setUpdateDialogOpen,
  setThemeToDelete,
  setDeleteDialogOpen,
}: ThemePreviewDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
      <Dialog.Content maxWidth="800px">
        <Dialog.Title>{displayText(selectedTheme?.name)}</Dialog.Title>

        {/* 紧跟标题（标题自带 mb 3），不再额外加上边距 */}
        <Flex direction="column" gap="4">
          <Box className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
            {selectedTheme?.preview ? (
              <img
                src={`/themes/${selectedTheme.short}/${selectedTheme.preview}`}
                alt={displayText(selectedTheme.name)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Flex align="center" justify="center" className="w-full h-full">
                <ImageIcon size={64} className="text-gray-400" />
              </Flex>
            )}
          </Box>

          <Flex direction="column" gap="2">
            <Flex gap="2" justify="start" align="center">
              <Text size="2" weight="bold" color="gray" wrap="nowrap">
                {t("theme.author")}
              </Text>
              <Text size="3">{displayText(selectedTheme?.author)}</Text>
            </Flex>
            <Flex gap="2" justify="start" align="center">
              <Text size="2" weight="bold" color="gray" wrap="nowrap">
                {t("theme.version")}
              </Text>
              <Text size="3">{selectedTheme?.version}</Text>
            </Flex>
            <Flex gap="2" justify="start" align="center">
              <Text size="2" weight="bold" color="gray" wrap="nowrap">
                {t("common.description")}
              </Text>
              <Text size="3">{displayText(selectedTheme?.description)}</Text>
            </Flex>
            {selectedTheme?.url && (
              <Flex gap="2" justify="start" align="center">
                <Text size="2" weight="bold" color="gray" wrap="nowrap">
                  URL
                </Text>
                <Text size="1" className="overflow-hidden text-ellipsis">
                  {selectedTheme?.url}
                </Text>
                <a
                  href={selectedTheme.url}
                  target="_blank"
                  rel="noreferrer"
                  title={t("theme.theme_url", "Theme URL")}
                  aria-label={t("theme.theme_url", "Theme URL")}
                >
                  <SquareArrowOutUpRight size={12} />
                </a>
              </Flex>
            )}
          </Flex>
        </Flex>

        <Flex gap="2" mt="5" justify="end" wrap="wrap">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.close")}
            </Button>
          </Dialog.Close>
          {selectedTheme && !selectedTheme.active && (
            <Button
              onClick={() => {
                setActiveTheme(selectedTheme.short);
                setPreviewDialogOpen(false);
              }}
            >
              {t("theme.set_active")}
            </Button>
          )}
          {selectedTheme && selectedTheme.short !== "default" && (
            <Button
              variant="soft"
              color="blue"
              onClick={() => {
                setThemeToUpdate(selectedTheme);
                setUpdateDialogOpen(true);
              }}
              className="gap-2"
            >
              <RefreshCw size={16} />
              {t("theme.update")}
            </Button>
          )}
          {selectedTheme && selectedTheme.short !== "default" && (
            <Button
              size="2"
              variant="solid"
              color="red"
              onClick={() => {
                setThemeToDelete(selectedTheme);
                setDeleteDialogOpen(true);
              }}
            >
              {t("common.delete")}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
