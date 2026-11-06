import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import { Flex, Checkbox, Text, IconButton } from "@radix-ui/themes";
import { Copy, MenuIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { TableCell } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import PriceTags from "@/components/PriceTags";
import { motion } from "motion/react";
import { MOTION_TRANSITION, MOTION_EASE_CSS, MOTION_MS } from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import ActionButtons from "./ActionButtons";
import DetailView from "./DetailView";

const SortableRow = ({
  node,
  selectedNodes,
  handleSelectNode,
  settings,
  isSnapshotBackend,
}: {
  node: NodeDetail;
  selectedNodes: string[];
  handleSelectNode: (uuid: string, checked: boolean) => void;
  settings: any;
  isSnapshotBackend: boolean;
}) => {
  const reduced = useKmReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: node.uuid,
      // content 层：重排时长与曲线来自统一 token（dnd-kit 只吃 CSS 字符串，这里由常量拼出）
      transition: {
        duration: reduced ? 0 : MOTION_MS.base,
        easing: MOTION_EASE_CSS.emphasized,
      },
    });
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("copy_success"));
  }
  return (
    // content 层：行增删只做淡入淡出——transform 交给 dnd-kit，避免两边抢同一个属性
    <motion.tr
      ref={setNodeRef}
      style={style}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MOTION_TRANSITION.fadeIn}
      className="km-ui-table-row transition-colors border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
    >
      <TableCell>
        <div
          {...attributes}
          {...listeners}
          className={`cursor-move p-2 rounded hover:bg-accent-a3 transition-colors ${
            isMobile ? "touch-manipulation select-none" : ""
          }`}
          style={{
            touchAction: "none", // 禁用移动端的默认手势
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          title={
            isMobile
              ? t("admin.nodeTable.dragToReorder", "长按拖拽重新排序")
              : undefined
          }
        >
          <MenuIcon size={isMobile ? 18 : 16} color={"var(--gray-8)"} />
        </div>
      </TableCell>
      <TableCell>
        <Checkbox
          checked={selectedNodes.includes(node.uuid)}
          onCheckedChange={(checked) => handleSelectNode(node.uuid, !!checked)}
        />
      </TableCell>
      <TableCell>
        <DetailView node={node} />
      </TableCell>
      <TableCell>
        <Flex direction="column">
          {node.ipv4 && (
            <Text size="2" className="flex items-center gap-1">
              {node.ipv4}
              <IconButton variant="ghost" onClick={() => copy(node.ipv4)}>
                <Copy size="16" />
              </IconButton>
            </Text>
          )}
          {node.ipv6 && (
            <Text
              size="2"
              className="flex items-center gap-1"
              title={node.ipv6}
            >
              {node.ipv6.length > 20
                ? (() => {
                    const segments = node.ipv6.split(":");
                    return segments.length > 3
                      ? `${segments.slice(0, 2).join(":")}:...${
                          segments[segments.length - 1]
                        }`
                      : node.ipv6;
                  })()
                : node.ipv6}
              <IconButton variant="ghost" onClick={() => copy(node.ipv6)}>
                <Copy size="16" />
              </IconButton>
            </Text>
          )}
        </Flex>
      </TableCell>
      <TableCell>{node.version}</TableCell>
      <TableCell>
        <Text
          size="2"
          title={node.group}
          style={{
            maxWidth: "150px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.group && node.group.length > 10
            ? `${node.group.slice(0, 10)}...`
            : node.group}
        </Text>
      </TableCell>
      <TableCell>
        <Text
          size="2"
          title={node.remark}
          style={{
            maxWidth: "150px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.remark && node.remark.length > 10
            ? `${node.remark.slice(0, 10)}...`
            : node.remark}
        </Text>
      </TableCell>
      <TableCell>
        <PriceTags
          price={node.price}
          billing_cycle={node.billing_cycle}
          expired_at={node.expired_at}
          currency={node.currency}
          tags={node.tags || ""}
        />
      </TableCell>
      <TableCell>
        <ActionButtons
          node={node}
          settings={settings}
          isSnapshotBackend={isSnapshotBackend}
        />
      </TableCell>
    </motion.tr>
  );
};

export default SortableRow;
