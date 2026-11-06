import { Button, Dialog, Flex } from "@radix-ui/themes";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import Confirmation from "./Confirmation";
import { LEGACY_I18N, STRUCTURE_I18N } from "./constants";
import type { Summary } from "./types";

/** 开始迁移确认；旧版监控数据迁移时附带 SQLite / 大数据量风险确认 */
export default function StartDialog({
  open,
  onOpenChange,
  legacy,
  busy,
  summary,
  sqliteRisk,
  largeRisk,
  confirmSQLite,
  onConfirmSQLiteChange,
  confirmLarge,
  onConfirmLargeChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legacy: boolean;
  busy: boolean;
  summary?: Summary;
  sqliteRisk: boolean;
  largeRisk: boolean;
  confirmSQLite: boolean;
  onConfirmSQLiteChange: (value: boolean) => void;
  confirmLarge: boolean;
  onConfirmLargeChange: (value: boolean) => void;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>
          {t(
            legacy
              ? `${LEGACY_I18N}.start_title`
              : `${STRUCTURE_I18N}.confirm_title`,
          )}
        </Dialog.Title>
        <Dialog.Description>
          {t(
            legacy
              ? `${LEGACY_I18N}.start_description`
              : `${STRUCTURE_I18N}.confirm_description`,
          )}
        </Dialog.Description>
        {legacy && (
          <Flex direction="column" gap="4" mt="4">
            {sqliteRisk && (
              <Confirmation
                checked={confirmSQLite}
                onCheckedChange={onConfirmSQLiteChange}
                color="amber"
                description={t(`${LEGACY_I18N}.sqlite_risk`, {
                  servers: summary?.server_count ?? 0,
                  days: summary?.retention_days ?? 0,
                })}
                label={t(`${LEGACY_I18N}.sqlite_confirm`)}
              />
            )}
            {largeRisk && (
              <Confirmation
                checked={confirmLarge}
                onCheckedChange={onConfirmLargeChange}
                color="red"
                description={t(`${LEGACY_I18N}.large_risk`)}
                label={t(`${LEGACY_I18N}.large_confirm`)}
              />
            )}
          </Flex>
        )}
        <Flex gap="2" justify="end" mt="5" wrap="wrap">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={busy}>
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          <Button
            disabled={
              busy ||
              (sqliteRisk && !confirmSQLite) ||
              (largeRisk && !confirmLarge)
            }
            onClick={onStart}
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {t(
              legacy
                ? `${LEGACY_I18N}.confirm_start`
                : `${STRUCTURE_I18N}.start`,
            )}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
