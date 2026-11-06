import { Box, Button, Dialog, Flex, IconButton, Separator, Switch, Text, TextField } from "@radix-ui/themes";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import MarketConfirmDialog from "./MarketConfirmDialog";
import type { MarketSourcesState } from "./useMarketSources";

/** 源管理弹窗：源列表（启停/编辑/删除）+ 新增/编辑表单 */
export default function MarketSourcesDialog({ state }: { state: MarketSourcesState }) {
  const { t } = useTranslation();
  const {
    sources,
    sourcesOpen,
    setSourcesOpen,
    editingID,
    sourceForm,
    setSourceForm,
    savingSource,
    startCreateSource,
    startEditSource,
    saveSource,
    updateSourceEnabled,
    setSourceToDelete,
  } = state;
  return (
    <Dialog.Root open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <Dialog.Content maxWidth="760px">
        <Dialog.Title>{t("market.manage_sources", "Manage sources")}</Dialog.Title>
        <Dialog.Description className="sr-only">{t("market.manage_sources", "Manage sources")}</Dialog.Description>
        <Flex direction="column" gap="4">
          {sources.length === 0 ? (
            <Text color="gray">{t("market.no_sources", "No sources configured")}</Text>
          ) : (
            <AnimatePresence initial={false}>
            {sources.map((source, index) => (
            <motion.div
              key={source.id}
              // 只补间位置（行内有文字，尺寸补间会拉伸文字；高度变化直接生效）
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ layout: MOTION_SPRING.layout, opacity: MOTION_TRANSITION.fadeIn }}
            >
              {index > 0 && <Separator size="4" mb="4" />}
              <Flex justify="between" align="center" gap="4">
                <Box className="min-w-0">
                  <Text as="div" weight="medium">{source.name}</Text>
                  <Text as="div" size="1" color="gray" className="truncate">{source.url}</Text>
                </Box>
                <Flex align="center" gap="2" className="shrink-0">
                  <Switch checked={source.enabled} onCheckedChange={(checked) => updateSourceEnabled(source, checked)} />
                  <IconButton variant="ghost" onClick={() => startEditSource(source)} title={t("common.edit", "Edit")}><Pencil size={16} /></IconButton>
                  <IconButton variant="ghost" color="red" onClick={() => setSourceToDelete(source)} title={t("common.delete", "Delete")}><Trash2 size={16} /></IconButton>
                </Flex>
              </Flex>
            </motion.div>
            ))}
            </AnimatePresence>
          )}
        </Flex>

        <Separator size="4" my="5" />
        <Flex justify="between" align="center" mb="4">
          <Text weight="bold">{editingID ? t("market.edit_source", "Edit source") : t("market.add_source", "Add source")}</Text>
          {editingID && <Button size="1" variant="ghost" onClick={startCreateSource}><Plus size={14} />{t("market.add_source", "Add source")}</Button>}
        </Flex>
        <Flex direction="column" gap="4">
          <TextField.Root value={sourceForm.name} onChange={(event) => setSourceForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("market.source_name", "Source name")} />
          <TextField.Root value={sourceForm.url} onChange={(event) => setSourceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://raw.githubusercontent.com/owner/repo/main/v1.json" />
          <Flex justify="between" align="center">
            <Flex align="center" gap="2"><Switch checked={sourceForm.enabled} onCheckedChange={(enabled) => setSourceForm((current) => ({ ...current, enabled }))} /><Text size="2">{t("market.enabled", "Enabled")}</Text></Flex>
            <Button onClick={saveSource} disabled={savingSource || !sourceForm.name.trim() || !sourceForm.url.trim()}>
              {savingSource && <RefreshCw size={15} className="animate-spin" />}
              {editingID ? t("common.save", "Save") : t("common.add", "Add")}
            </Button>
          </Flex>
        </Flex>
        <Flex justify="end" gap="2" mt="5"><Dialog.Close><Button variant="soft">{t("common.close", "Close")}</Button></Dialog.Close></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** 删除源确认弹窗 */
export function MarketSourceDeleteDialog({ state }: { state: MarketSourcesState }) {
  const { t } = useTranslation();
  const { sourceToDelete, setSourceToDelete, deleteSource } = state;
  return (
    <MarketConfirmDialog
      open={Boolean(sourceToDelete)}
      onClose={() => setSourceToDelete(null)}
      title={t("common.delete", "Delete")}
      description={t("market.delete_source_confirm", "Delete source {{name}}?", { name: sourceToDelete?.name })}
      confirmText={t("common.delete", "Delete")}
      disabled={!sourceToDelete}
      onConfirm={async () => {
        if (!sourceToDelete) return;
        await deleteSource(sourceToDelete);
        setSourceToDelete(null);
      }}
    />
  );
}
