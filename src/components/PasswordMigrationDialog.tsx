import React from "react";
import { Dialog, Button, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "password_migration_dismissed_date";

interface PasswordMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PasswordMigrationDialog: React.FC<PasswordMigrationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();

  const handleLater = () => {
    // 记录当天不再提示
    const today = new Date().toDateString();
    localStorage.setItem(STORAGE_KEY, today);
    onOpenChange(false);
  };

  const handleChangePassword = () => {
    onOpenChange(false);
    window.location.href = "/admin/account";
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{t("password_migration.title")}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          <Text>{t("password_migration.description")}</Text>
        </Dialog.Description>
        <Flex gap="3" justify="end">
          <Button variant="soft" onClick={handleLater}>
            {t("password_migration.later")}
          </Button>
          <Button onClick={handleChangePassword}>
            {t("password_migration.change_now")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

// 检查是否应该显示密码迁移提示
export function shouldShowPasswordMigrationDialog(
  passwordMigrationRequired: boolean | undefined
): boolean {
  if (!passwordMigrationRequired) {
    return false;
  }

  const dismissedDate = localStorage.getItem(STORAGE_KEY);
  if (!dismissedDate) {
    return true;
  }

  // 检查是否是同一天，同一天不再提示
  const today = new Date().toDateString();
  return dismissedDate !== today;
}

export default PasswordMigrationDialog;
