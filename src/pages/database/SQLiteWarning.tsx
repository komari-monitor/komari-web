import { Callout } from "@radix-ui/themes";
import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { GapCollapse } from "@/components/GapCollapse";
import { SPACE } from "@/lib/spacing";
import { isSQLiteDSN } from "@/utils/metric";

/** DSN 指向 SQLite 时的提醒；放在 block 档（gap="4"）的字段栈里 */
export default function SQLiteWarning({
  dsn,
  motionKey,
}: {
  dsn: string;
  motionKey: string;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence initial={false}>
      {isSQLiteDSN(dsn) && (
        <GapCollapse key={motionKey} gap={SPACE.block}>
          <Callout.Root color="amber" variant="surface">
            <Callout.Text>{t("install.sqlite_warning")}</Callout.Text>
          </Callout.Root>
        </GapCollapse>
      )}
    </AnimatePresence>
  );
}
