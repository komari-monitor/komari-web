import { Button, Dialog, Flex } from "@radix-ui/themes";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Confirmation from "./Confirmation";
import { STRUCTURE_I18N } from "./constants";

/** 结构迁移前删除历史监控数据的二次确认（需勾选确认框） */
export default function DiscardDialog({
  open,
  onOpenChange,
  busy,
  confirmDiscard,
  onConfirmDiscardChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  confirmDiscard: boolean;
  onConfirmDiscardChange: (value: boolean) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{t(`${STRUCTURE_I18N}.discard_title`)}</Dialog.Title>
        <Dialog.Description>
          {t(`${STRUCTURE_I18N}.discard_description`)}
        </Dialog.Description>
        <Flex direction="column" gap="4" mt="4">
          <Confirmation
            checked={confirmDiscard}
            onCheckedChange={onConfirmDiscardChange}
            color="red"
            description={t(`${STRUCTURE_I18N}.discard_warning`)}
            label={t(`${STRUCTURE_I18N}.discard_confirm`)}
          />
        </Flex>
        <Flex gap="2" justify="end" mt="5">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={busy}>
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          <Button
            color="red"
            disabled={busy || !confirmDiscard}
            onClick={onDiscard}
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            <Trash2 size={16} />
            {t(`${STRUCTURE_I18N}.discard_action`)}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
