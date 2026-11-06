import React from "react";
import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

/**
 * 多选对话框外壳：触发器 + 标题 + 内容 + 「取消 / 完成」。
 * 打开时把临时选择重置为 value，只有点击「完成」才通过 onChange 提交。
 * SelectorDialog 与 NodeSelectorDialog 共用。
 */
export interface SelectorDialogShellProps {
  /** 受控开关；不传时由内部状态管理 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value: string[];
  onChange: (ids: string[]) => void;
  title: React.ReactNode;
  trigger: React.ReactNode;
  className?: string;
  /** 对话框主体，拿到临时选择及其 setter */
  children: (temp: string[], setTemp: (ids: string[]) => void) => React.ReactNode;
}

export default function SelectorDialogShell({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  value,
  onChange,
  title,
  trigger,
  className,
  children,
}: SelectorDialogShellProps) {
  const { t } = useTranslation();
  // 自动/受控弹窗开关
  const [autoOpen, setAutoOpen] = React.useState(false);
  const open = openProp !== undefined ? openProp : autoOpen;
  const onOpenChange = onOpenChangeProp || setAutoOpen;
  // 临时选中，只有点击确定才提交
  const [temp, setTemp] = React.useState<string[]>(value);
  React.useEffect(() => {
    if (open) setTemp(value);
  }, [open, value]);

  const handleOk = () => {
    onChange(temp);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 400 }} className={className}>
        <Dialog.Title>{title}</Dialog.Title>
        {children(temp, setTemp)}
        <Flex gap="2" justify="end" mt="5">
          <Dialog.Close>
            <Button variant="soft">{t("common.cancel")}</Button>
          </Dialog.Close>
          <Button onClick={handleOk}>{t("common.done")}</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
