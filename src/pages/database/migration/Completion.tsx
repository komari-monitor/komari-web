import { Callout, Flex, Text } from "@radix-ui/themes";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  COMMON_I18N,
  LEGACY_I18N,
  STRUCTURE_I18N,
  formatBytes,
} from "./constants";
import type { MigrationStatus } from "./types";

export default function Completion({
  status,
  locale,
  legacy,
}: {
  status: MigrationStatus;
  locale: string;
  legacy: boolean;
}) {
  const { t } = useTranslation();
  const prefix = legacy ? LEGACY_I18N : STRUCTURE_I18N;
  return (
    <Flex direction="column" gap="4">
      <Callout.Root color="green" variant="surface" size="3">
        <Callout.Icon>
          <CheckCircle2 size={22} />
        </Callout.Icon>
        <Callout.Text>
          <Text as="div" weight="bold">
            {t(`${prefix}.completed_title`)}
          </Text>
          <Text as="div" mt="1">
            {t(`${prefix}.completed_description`)}
          </Text>
        </Callout.Text>
      </Callout.Root>
      <div className="km-database-migration-stats grid gap-km-block sm:grid-cols-3">
        {[
          ["before", status.before_bytes ?? 0],
          ["after", status.after_bytes ?? 0],
          ["saved", status.saved_bytes ?? 0],
        ].map(([key, value]) => (
          <Flex
            key={key}
            direction="column"
            gap="1"
            className="border p-km-block"
            style={{ borderColor: "var(--gray-a5)" }}
          >
            <Text size="1" color="gray">
              {t(`${COMMON_I18N}.${key}`)}
            </Text>
            <Text size="5" weight="bold" className="tabular-nums">
              {formatBytes(Number(value), locale)}
            </Text>
            {key === "saved" && (
              <Text size="2" color="green" className="tabular-nums">
                {new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 1,
                }).format(status.saved_percent ?? 0)}
                %
              </Text>
            )}
          </Flex>
        ))}
      </div>
    </Flex>
  );
}
