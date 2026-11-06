import React from "react";
import { Button, Flex } from "@radix-ui/themes";
import NodeSelector from "./NodeSelector";
import SelectorDialogShell from "./SelectorDialogShell";
import { useNodeDetails } from "@/contexts/NodeDetailsContext";
import { useTranslation } from "react-i18next";
import { Skeletonize } from "@/components/ui/skeleton";

interface NodeSelectorDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value: string[];
  onChange: (uuids: string[]) => void;
  title?: React.ReactNode;
  className?: string;
  hiddenDescription?: boolean;
  hiddenUuidOnlyClient?: boolean;
  children?: React.ReactNode; // 新增 children 属性
}

const NO_SELECTION: string[] = [];

const NodeSelectorDialog: React.FC<NodeSelectorDialogProps> = ({
  open,
  onOpenChange,
  value,
  onChange,
  title,
  className,
  hiddenDescription,
  hiddenUuidOnlyClient,
  children, // 解构 children
}) => {
  const { t } = useTranslation();
  const { nodeDetail, isLoading } = useNodeDetails();

  const allUuids = React.useMemo(() => {
    const uuids = nodeDetail.map((n) => n.uuid);
    if (hiddenUuidOnlyClient) {
      return uuids.filter(
        (u) => !nodeDetail.find((n) => n.uuid === u)?.is_only_client
      );
    }
    return uuids;
  }, [nodeDetail, hiddenUuidOnlyClient]);
  const totalCount = allUuids.length;

  return (
    <SelectorDialogShell
      open={open}
      onOpenChange={onOpenChange}
      value={value ?? NO_SELECTION}
      onChange={onChange}
      title={title || t("common.select")}
      trigger={children ? children : <Button>{title || t("common.select")}</Button>}
      className="km-node-selector-dialog"
    >
      {(temp, setTemp) => {
        const isAllSelected =
          totalCount > 0 && allUuids.every((u) => temp.includes(u));

        const handleToggleAll = () => {
          if (isAllSelected) {
            setTemp(temp.filter((u) => !allUuids.includes(u)));
          } else {
            setTemp(Array.from(new Set([...temp, ...allUuids])));
          }
        };

        return (
          <Flex direction="column" gap="4">
            <Flex justify="between" align="center" gap="2">
              {/* 总数未到时不先显示「0」：画成等宽小骨架，到达后原地淡入 */}
              <Skeletonize as="span" loading={isLoading}>
                <label className="text-sm text-gray-600">
                  {t("common.selected_total", {
                    count: temp.length,
                    total: totalCount,
                  })}
                </label>
              </Skeletonize>
              <Button
                type="button"
                variant="soft"
                size="1"
                onClick={handleToggleAll}
                disabled={isLoading || totalCount === 0}
              >
                {isAllSelected
                  ? t("common.deselect_all")
                  : t("common.select_all")}
              </Button>
            </Flex>
            <NodeSelector
              value={temp}
              onChange={setTemp}
              className={`km-node-selector-list ${className ?? ""}`}
              hiddenUuidOnlyClient={hiddenUuidOnlyClient}
              hiddenDescription={hiddenDescription}
            />
          </Flex>
        );
      }}
    </SelectorDialogShell>
  );
};

export default NodeSelectorDialog;
