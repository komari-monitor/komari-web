import { useState } from "react";
import { NodeDetailsProvider } from "@/contexts/NodeDetailsContext";
import { Swap } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import { PLACEHOLDER_NODES } from "./servers/placeholderNodes";
import useServerList from "./servers/useServerList";
import EmptyNodesGuide from "./servers/EmptyNodesGuide";
import Header from "./servers/Header";
import NodeTable from "./servers/NodeTable";

const NodeDetailsPage = () => {
  return (
    <NodeDetailsProvider>
      <Layout />
    </NodeDetailsProvider>
  );
};

const Layout = () => {
  const { nodeDetail, error, settings, settingsLoading, pending, isEmpty } =
    useServerList();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const filteredNodes = Array.isArray(nodeDetail)
    ? nodeDetail
        .filter((node) =>
          node.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => a.weight - b.weight)
    : [];

  if (error) return <div>{error}</div>;

  return (
    <div className="km-page km-page-admin-index">
      <Header
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedNodes={selectedNodes}
        settings={settings}
        settingsLoading={settingsLoading}
      />

      {/*
        surface 层：空状态 <-> 列表交叉淡化，外层高度弹簧（Swap = AutoHeight + popLayout），
        搜索过滤导致的行增删也由同一个 AutoHeight 跟随，表格下方不会跳。
        加载中：用占位行渲染真实表格并骨架化（形状就是表格本身），到达后同一位置淡成内容。
      */}
      <Swap swapKey={isEmpty ? "empty" : "table"}>
        {isEmpty ? (
          <EmptyNodesGuide />
        ) : (
          <Skeletonize loading={pending} className="km-setting-card-skeleton">
            <NodeTable
              // 占位行与真实行 uuid 不同：换一棵子树，让 localNodes 直接从真实数据初始化
              key={pending ? "placeholder" : "data"}
              nodes={pending ? PLACEHOLDER_NODES : filteredNodes}
              selectedNodes={pending ? [] : selectedNodes}
              setSelectedNodes={setSelectedNodes}
              settings={settings}
            />
          </Skeletonize>
        )}
      </Swap>
    </div>
  );
};

export default NodeDetailsPage;
