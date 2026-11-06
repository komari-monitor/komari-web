import React from "react";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { skeletonText } from "@/components/ui/skeleton";
import { Swap } from "@/components/motion";
import { useTranslation } from "react-i18next";
import Selector from "./Selector";

/** 节点列表未到时的占位行：用真实的 Selector 渲染，列表区的 Skeletonize 把名字画成条 */
const PLACEHOLDER_NODES = Array.from({ length: 5 }, (_, index) => ({
  uuid: `km-placeholder-${index}`,
  name: skeletonText(8 + ((index * 3) % 6)),
  weight: index,
})) as NodeDetail[];
const noop = () => {};

interface NodeSelectorProps {
  className?: string;
  hiddenDescription?: boolean;
  value: string[]; // uuid 列表
  onChange: (uuids: string[]) => void;
  hiddenUuidOnlyClient?: boolean;
}

const NodeSelector: React.FC<NodeSelectorProps> = ({
  className = "",
  hiddenDescription = false,
  value,
  onChange,
  hiddenUuidOnlyClient = false,
}) => {
  const { nodeDetail, isLoading, error } = useNodeDetails();
  const { t } = useTranslation();
  let nodesFiltered = value;
  // 节点没到时没法判断哪些是「仅客户端」：先按传入的选择计数，不先显示 0
  if (hiddenUuidOnlyClient && !isLoading) {
    nodesFiltered = nodesFiltered.filter((node) =>
      nodeDetail.find((n) => n.uuid === node && !n.is_only_client)
    );
  }
  // 加载中：只有列表区是骨架（同一个 Selector 用占位行渲染，不接收选择），搜索框、已选计数直接渲染；到达后原地淡入
  // 错误：与列表交叉淡化，外层高度弹簧
  return (
    <Swap swapKey={error ? "error" : "list"}>
      {error ? (
        <div className="km-node-selector-error text-sm text-red-500">{error}</div>
      ) : (
        <Selector
          className={`km-node-selector ${className}`}
          hiddenDescription={hiddenDescription}
          loading={isLoading}
          value={nodesFiltered}
          onChange={isLoading ? noop : onChange}
          items={isLoading ? PLACEHOLDER_NODES : [...nodeDetail]}
          sortItems={(a, b) => (a.weight ?? 0) - (b.weight ?? 0)}
          getId={(n) => n.uuid}
          getLabel={(n) => n.name}
          searchPlaceholder={t("common.search")}
          headerLabel={t("common.server")}
        />
      )}
    </Swap>
  );
};

export default NodeSelector;