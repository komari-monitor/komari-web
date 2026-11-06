import { Box, Button, Callout, Card, Dialog, Flex, Separator, Text, TextField } from "@radix-ui/themes";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AutoHeight } from "@/components/motion";
import type { I18nText } from "@/utils/i18nText";
import type { ThemeImportPreview } from "./types";

interface ThemeImportDialogProps {
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  importUrl: string;
  setImportUrl: (url: string) => void;
  importPreview: ThemeImportPreview | null;
  setImportPreview: (preview: ThemeImportPreview | null) => void;
  importError: string | null;
  setImportError: (error: string | null) => void;
  importChecking: boolean;
  importInstalling: boolean;
  previewImportTheme: () => void;
  confirmImportTheme: () => void;
  displayText: (value: I18nText | undefined) => string;
}

/** 从 GitHub 仓库地址导入主题：先检测、再确认导入 */
export default function ThemeImportDialog({
  importDialogOpen,
  setImportDialogOpen,
  importUrl,
  setImportUrl,
  importPreview,
  setImportPreview,
  importError,
  setImportError,
  importChecking,
  importInstalling,
  previewImportTheme,
  confirmImportTheme,
  displayText,
}: ThemeImportDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root
      open={importDialogOpen}
      onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportUrl("");
          setImportPreview(null);
          setImportError(null);
        }
      }}
    >
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{t("theme.import_title")}</Dialog.Title>
        <Dialog.Description>
          {t("theme.import_description")}
        </Dialog.Description>

        {/* 检查结果 / 错误出现或替换时，对话框高度用弹簧跟随，不跳 */}
        <AutoHeight className="mt-km-block">
        <Flex direction="column" gap="4">
          <Flex gap="2">
            <Box className="flex-1">
              <TextField.Root
                placeholder="https://github.com/owner/repo"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !importChecking) {
                    previewImportTheme();
                  }
                }}
                disabled={importChecking || importInstalling}
              />
            </Box>
            <Button
              onClick={previewImportTheme}
              disabled={
                !importUrl.trim() || importChecking || importInstalling
              }
              className="gap-2"
            >
              {importChecking ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              {t("theme.import_check")}
            </Button>
          </Flex>

          {importError && (
            <Callout.Root color="red" size="1">
              <Callout.Icon>
                <AlertTriangle size={16} />
              </Callout.Icon>
              <Callout.Text>{importError}</Callout.Text>
            </Callout.Root>
          )}

          {importPreview && (
            <Flex direction="column" gap="4">
              <Separator size="4" />
              <Card size="2">
                <Flex direction="column" gap="2">
                  <Flex gap="2" align="center">
                    <Text size="2" weight="bold" color="gray" wrap="nowrap">
                      {t("theme.name")}
                    </Text>
                    <Text size="3" weight="bold">
                      {displayText(importPreview.theme.name)}
                    </Text>
                  </Flex>
                  <Flex gap="2" align="center">
                    <Text size="2" weight="bold" color="gray" wrap="nowrap">
                      {t("theme.version")}
                    </Text>
                    <Text size="3">{importPreview.theme.version}</Text>
                  </Flex>
                  <Flex gap="2" align="center">
                    <Text size="2" weight="bold" color="gray" wrap="nowrap">
                      {t("theme.author")}
                    </Text>
                    <Text size="3">
                      {displayText(importPreview.theme.author)}
                    </Text>
                  </Flex>
                  {importPreview.theme.description && (
                    <Flex gap="2" align="center">
                      <Text
                        size="2"
                        weight="bold"
                        color="gray"
                        wrap="nowrap"
                      >
                        {t("common.description")}
                      </Text>
                      <Text size="3">
                        {displayText(importPreview.theme.description)}
                      </Text>
                    </Flex>
                  )}
                </Flex>

                {importPreview.exists && (
                  <Callout.Root color="orange" size="1" mt="4">
                    <Callout.Icon>
                      <AlertTriangle size={16} />
                    </Callout.Icon>
                    <Callout.Text>
                      {t("theme.import_exists_warning")}
                    </Callout.Text>
                  </Callout.Root>
                )}
              </Card>
            </Flex>
          )}
        </Flex>
        </AutoHeight>

        <Flex gap="2" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          {importPreview && (
            <Button
              onClick={confirmImportTheme}
              disabled={importInstalling}
              className="gap-2"
            >
              {importInstalling && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {t("theme.import_confirm")}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
