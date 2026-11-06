import { Flex, Separator, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Database } from "lucide-react";
import { AnimatedNumber } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils/unitHelper";
import type { DbSizeInfo } from "./types";

/** 一行「名称 …… 大小」：有数据时数值滚动，请求结束但没数据时显示 "-"，首次加载中显示占位 */
const DbSizeRow = ({
  label,
  labelEmphasis = false,
  value,
  loaded,
}: {
  label: string;
  /** 合计行：标签用正文色 + medium 字重 */
  labelEmphasis?: boolean;
  value: number | null;
  loaded: boolean;
}) => (
  <Flex justify="between" align="center" gap="2">
    {labelEmphasis ? (
      <Text size="2" weight="medium">
        {label}
      </Text>
    ) : (
      <Text size="2" color="gray">
        {label}
      </Text>
    )}
    {/* feedback 层：数值滚动，只在值真的变化时动 */}
    <Text size="3" weight="bold">
      {value !== null ? (
        <AnimatedNumber value={value} format={formatBytes} />
      ) : loaded ? (
        "-"
      ) : (
        skeletonText(7)
      )}
    </Text>
  </Flex>
);

/** 数据库占用：主库 / 监控库 / 合计 */
export const DatabaseWidget = ({
  dbInfo,
  loaded,
}: {
  dbInfo: DbSizeInfo | null;
  loaded: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <Skeletonize loading={!loaded}>
    <Flex direction="column" gap="4">
      <Flex gap="2" align="center" style={{ color: "var(--gray-10)" }}>
        <Database size={18} />
        <Text size="2" color="gray">
          {t("dashboard.dbUsage", "Database usage")}
        </Text>
      </Flex>
      <Flex direction="column" gap="2">
        <DbSizeRow
          label={t("dashboard.mainDb", "Main database")}
          value={dbInfo ? dbInfo.main ?? 0 : null}
          loaded={loaded}
        />
        <DbSizeRow
          label={t("dashboard.monitoringDb", "Monitoring database")}
          value={dbInfo ? dbInfo.monitoring ?? 0 : null}
          loaded={loaded}
        />
        <Separator size="4" />
        <DbSizeRow
          label={t("settings.database.local_total", "Local Database Total")}
          labelEmphasis
          value={dbInfo ? (dbInfo.main ?? 0) + (dbInfo.monitoring ?? 0) : null}
          loaded={loaded}
        />
      </Flex>
    </Flex>
    </Skeletonize>
  );
};
