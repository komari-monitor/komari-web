import { Flex, SegmentedControl, Text, TextField } from "@radix-ui/themes";
import { HardDrive, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { skeletonText } from "@/components/ui/skeleton";
import { SettingCard, SettingCardLabel } from "@/components/admin/SettingCard";
import { LEGACY_I18N, examples } from "./constants";
import type { Driver, Summary } from "./types";

type LegacySetupProps = {
  summary: Summary;
  /** 占位数据：数字渲染成等宽空白，骨架浮现前也不会露出假数字 */
  placeholder?: boolean;
  locale: string;
  driver: Driver;
  dsn: string;
  active: boolean;
  onDriverChange: (value: string) => void;
  onDSNChange: (value: string) => void;
};

export default function LegacySetup({
  summary,
  placeholder = false,
  locale,
  driver,
  dsn,
  active,
  onDriverChange,
  onDSNChange,
}: LegacySetupProps) {
  const { t } = useTranslation();
  const number = (value: number) => {
    const text = new Intl.NumberFormat(locale).format(value);
    return placeholder ? skeletonText(text.length) : text;
  };
  return (
    // 两组之间 section；组内：小标题 → 卡片 group（km-section-title 按父栈 block 折算），同类卡片之间 block
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="4">
        <SettingCardLabel>{t(`${LEGACY_I18N}.overview`)}</SettingCardLabel>
        {/* 说明文字紧跟它解释的统计卡：group */}
        <Flex direction="column" gap="2">
        <div className="km-database-migration-stats grid gap-km-block sm:grid-cols-2">
          <SettingCard
            className="km-database-migration-card"
            title={t(`${LEGACY_I18N}.load_rows`)}
          >
            <Flex direction="column" gap="1" className="mt-km-group w-full">
              <Text size="7" weight="bold" className="tabular-nums">
                {number(summary.load_rows)}{" "}
                <Text size="2" color="gray">
                  {t(`${LEGACY_I18N}.rows`)}
                </Text>
              </Text>
              <Text size="1" color="gray">
                {t(`${LEGACY_I18N}.gpu_rows`, { count: summary.gpu_rows })}
              </Text>
            </Flex>
          </SettingCard>
          <SettingCard
            className="km-database-migration-card"
            title={t(`${LEGACY_I18N}.latency_rows`)}
          >
            {/* 与左卡同结构：内容包一层占满剩余高度，否则被 SettingCard 的 justify-between/align-center 推到右下 */}
            <Flex direction="column" gap="1" className="mt-km-group w-full flex-1">
              <Text size="7" weight="bold" className="tabular-nums">
                {number(summary.latency_rows)}{" "}
                <Text size="2" color="gray">
                  {t(`${LEGACY_I18N}.rows`)}
                </Text>
              </Text>
            </Flex>
          </SettingCard>
        </div>
        <Text size="2" color="gray">
          {t(`${LEGACY_I18N}.overview_detail`, {
            points: number(summary.estimated_points),
            days: summary.retention_days,
            servers: summary.server_count,
          })}
        </Text>
        </Flex>
      </Flex>

      <Flex direction="column" gap="4">
        <SettingCardLabel>{t(`${LEGACY_I18N}.target`)}</SettingCardLabel>
        <SettingCard
          className="km-database-migration-card"
          title={t(`${LEGACY_I18N}.target`)}
          description={t(`${LEGACY_I18N}.target_description`)}
        >
          {/* 卡片标题 → 控件 group；驱动选择与 DSN 字段之间 block */}
          <Flex direction="column" gap="4" className="mt-km-group w-full">
            <SegmentedControl.Root
              value={driver}
              onValueChange={onDriverChange}
              className="w-full"
            >
              <SegmentedControl.Item value="sqlite">
                <HardDrive size={15} /> SQLite
              </SegmentedControl.Item>
              <SegmentedControl.Item value="mysql">
                <Server size={15} /> MySQL
              </SegmentedControl.Item>
              <SegmentedControl.Item value="postgresql">
                <Server size={15} /> PostgreSQL
              </SegmentedControl.Item>
            </SegmentedControl.Root>
            <label>
              <Text as="div" size="2" weight="bold" mb="2">
                {t(`${LEGACY_I18N}.dsn`)}
              </Text>
              <TextField.Root
                size="3"
                value={dsn}
                onChange={(event) => onDSNChange(event.target.value)}
                disabled={active}
                spellCheck={false}
              />
              <Text as="div" size="1" color="gray" mt="2" className="break-all">
                {t(`${LEGACY_I18N}.example`, { example: examples[driver] })}
              </Text>
            </label>
          </Flex>
        </SettingCard>
      </Flex>
    </Flex>
  );
}
