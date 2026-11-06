import { Badge, Button, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock } from "lucide-react";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { DAY_MS, rankRowMotion } from "./utils";

/** 即将到期的服务器列表，每行带「我已续费」按钮 */
export const ExpiryWidget = ({
  limit,
  loading,
  nodes,
  renewingUuid,
  onRenew,
}: {
  limit: number;
  loading: boolean;
  nodes: NodeBasicInfo[];
  renewingUuid: string | null;
  onRenew: (node: NodeBasicInfo) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Flex direction="column" gap="4">
      <Flex gap="2" align="center" style={{ color: "var(--amber-11)" }}>
        <CalendarClock size={18} />
        <Text size="3" weight="bold">
          {t("dashboard.expiringSoon", "Expiring soon")}
        </Text>
      </Flex>
      {/* 常驻的 Skeletonize：占位行换成真实行时仍在「揭开」过程里，新文字跟着淡入，而不是突然出现 */}
      <Skeletonize loading={loading}>
      {loading ? (
        // 占位行：与真实行同结构（名称 / 日期 + 徽标 / 按钮），静态元素，到达后直接换成真实列表
          <Flex direction="column" gap="3">
            {Array.from({ length: Math.min(limit, 2) }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                  <Text size="2" weight="medium">{skeletonText(10)}</Text>
                  <Flex gap="2" align="center">
                    <Text size="2">{skeletonText(9)}</Text>
                    <Badge variant="soft" color="gray">{skeletonText(6)}</Badge>
                  </Flex>
                </Flex>
                <Button size="1" variant="soft" color="gray" tabIndex={-1}>
                  {skeletonText(7)}
                </Button>
              </div>
            ))}
          </Flex>
      ) : nodes.length === 0 ? (
        <Text size="2" color="gray">
          {t("dashboard.noExpiring", "No servers expiring soon")}
        </Text>
      ) : (
        <Flex direction="column" gap="3" className="relative">
          {/*
content 层：排行条目只在「顺序/成员真的变化」时用弹簧补位。
- layout="position"：只补间位置，不补间尺寸（行内有文字，尺寸补间会把文字拉伸）。
- layoutDependency=顺序 key：这些列表位于可拖拽的仪表盘卡片里，卡片被 dnd-kit 拖动落位、
编辑态网格重排时整张卡片在动，若每次重渲染都测量，行会相对卡片「再滑一遍」（双重位移）。
- popLayout：退场行立即脱离文档流，邻居同时补位，列表高度不会先多一行再塌回去。
*/}
          <AnimatePresence initial={false} mode="popLayout">
          {nodes.slice(0, limit).map((node) => {
            const daysLeft = Math.ceil(
              (new Date(node.expired_at).getTime() - Date.now()) / DAY_MS,
            );
            return (
              <motion.div
                key={node.uuid}
                {...rankRowMotion(nodes.slice(0, limit).map((entry) => entry.uuid).join("|"))}
                className="flex items-center justify-between gap-2"
              >
                <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                  <Text
                    size="2"
                    weight="medium"
                    className="truncate"
                    title={node.name}
                  >
                    {node.name}
                  </Text>
                  <Flex gap="2" align="center">
                    <Text size="2" color="gray">
                      {new Date(node.expired_at).toLocaleDateString()}
                    </Text>
                    <Badge
                      color={daysLeft <= 3 ? "red" : "amber"}
                      variant="soft"
                    >
                      {t("dashboard.daysLeft", "{{days}} days left", {
                        days: daysLeft,
                      })}
                    </Badge>
                  </Flex>
                </Flex>
                <Button
                  size="1"
                  variant="soft"
                  aria-label={t("dashboard.renewed", "I've renewed")}
                  disabled={
                    renewingUuid === node.uuid ||
                    !node.billing_cycle ||
                    node.billing_cycle <= 0
                  }
                  onClick={() => onRenew(node)}
                >
                  {renewingUuid === node.uuid
                    ? t("dashboard.renewing", "Renewing...")
                    : t("dashboard.renewed", "I've renewed")}
                </Button>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </Flex>
      )}
      </Skeletonize>
    </Flex>
  );
};
