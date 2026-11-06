import type React from "react";
import { Button, Dialog, Flex } from "@radix-ui/themes";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MarketConfirmDialogProps {
  open: boolean;
  /** 关闭（取消、Esc、点遮罩） */
  onClose: () => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText: React.ReactNode;
  onConfirm: () => void;
  disabled: boolean;
  /** 确认按钮前显示旋转图标 */
  spinning?: boolean;
}

/** 市场页的红色确认弹窗（卸载、删除源） */
export default function MarketConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmText,
  onConfirm,
  disabled,
  spinning,
}: MarketConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
        <Flex justify="end" gap="2" mt="5">
          <Dialog.Close><Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button></Dialog.Close>
          <Button color="red" disabled={disabled} onClick={onConfirm}>
            {spinning && <RefreshCw size={15} className="animate-spin" />}
            {confirmText}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
