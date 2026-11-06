import NodeSelectorDialog from "@/components/NodeSelectorDialog";
import {
  NodeDetailsProvider,
  useNodeDetails,
} from "@/contexts/NodeDetailsContext";
import {
  PingTaskProvider,
  usePingTask,
  type PingTask,
} from "@/contexts/PingTaskContext";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Tabs,
  TextField,
} from "@radix-ui/themes";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AutoHeight, PresenceBox } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { TaskView } from "./pingTask_Task";
import { ServerView } from "./pingTask_Server";
import { KmTabsList } from "@/components/admin/KmTabsList";
import PageHeader from "@/components/PageHeader";
import { ApiError } from "@/lib/http";
import { postPingTask } from "./pingTask/api";

const PingTask = () => {
  return (
    <PingTaskProvider>
      <NodeDetailsProvider>
        <InnerLayout />
      </NodeDetailsProvider>
    </PingTaskProvider>
  );
};

const InnerLayout = () => {
  const { pingTasks, error } = usePingTask();
  const { isLoading: nodeDetailLoading, error: nodeDetailError } =
    useNodeDetails();
  const { t } = useTranslation();
  // 任务列表看 pingTasks 是否到达；节点的 isLoading 只表示首次加载（第一帧起为 true，刷新不再置 true）
  const pending = pingTasks === null || nodeDetailLoading;

  if (error || nodeDetailError) {
    return <div>{error || nodeDetailError}</div>;
  }
  return (
    <div className="km-page km-page-admin-pingtask">
      <PageHeader title={t("ping.title")} actions={<AddButton />} />
      <Tabs.Root defaultValue="task" className="km-pingtask-nav">
        {/* control 性格：选中下划线在标签间弹簧滑动（共享指示器，可被打断） */}
        <KmTabsList>
          <Tabs.Trigger value="task">{t("ping.task_view")}</Tabs.Trigger>
          <Tabs.Trigger value="server">{t("ping.server_view")}</Tabs.Trigger>
        </KmTabsList>
        {/*
          surface 层：任务视图 / 服务器视图切换时内容淡入（不接管 Radix Tabs 自身动画），
          两个视图行数不同，外层高度由 AutoHeight 弹簧过渡，不跳。
          加载中：用占位行渲染真实表格并骨架化；到达后同一位置揭开（key 换一棵子树，本地排序状态直接取真实数据）。
        */}
        <AutoHeight>
        <Box pt="4">
          <Skeletonize loading={pending} className="km-setting-card-skeleton">
          <Tabs.Content value="task" className="km-pingtask-view">
            <PresenceBox>
              <TaskView
                key={pending ? "placeholder" : "data"}
                pingTasks={pending ? PLACEHOLDER_TASKS : (pingTasks ?? [])}
              />
            </PresenceBox>
          </Tabs.Content>
          <Tabs.Content value="server" className="km-pingtask-view">
            <PresenceBox>
              <ServerView pingTasks={pending ? [] : (pingTasks ?? [])} loading={pending} />
            </PresenceBox>
          </Tabs.Content>
          </Skeletonize>
        </Box>
        </AutoHeight>
      </Tabs.Root>
    </div>
  );
};

/** 占位任务行：真实行组件 + 数字宽空白（负 id 不会与真实任务冲突；子树 inert，不会被提交） */
const PLACEHOLDER_TASKS: PingTask[] = Array.from({ length: 5 }, (_, i) => ({
  id: -1 - i,
  name: skeletonText(8 + (i % 3) * 2),
  type: skeletonText(4),
  target: skeletonText(12),
  interval: skeletonText(2) as unknown as number,
  clients: [],
  default_on: false,
}));

const AddButton: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [defaultOn, setDefaultOn] = React.useState(false);
  const { refresh } = usePingTask();
  const [selectedType, setSelectedType] = React.useState<
    "icmp" | "tcp" | "http"
  >("icmp");
  const [saving, setSaving] = React.useState(false);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!defaultOn && selected.length === 0) {
      toast.error(t("ping.default_on_description"));
      return;
    }
    const payload = {
      name: e.currentTarget.ping_name.value,
      type: selectedType,
      target: e.currentTarget.ping_target.value,
      default_on: defaultOn,
      clients: selected,
      interval: parseInt(e.currentTarget.interval.value, 10),
    };
    setSaving(true);
    postPingTask("/api/admin/ping/add", payload, t)
      .then(() => {
        setIsOpen(false);
        setSelected([]);
        setDefaultOn(false);
        setSelectedType("icmp");
        toast.success(t("common.success"));
      })
      .catch((error) => {
        // 与原实现一致：只有网络等非 HTTP 错误才打印
        if (!(error instanceof ApiError)) console.error("Error adding ping task:", error);
        toast.error(error.message);
      })
      .finally(() => {
        setSaving(false);
        refresh();
      });
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger>
        <Button>{t("common.add")}</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("common.add")}</Dialog.Title>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" justify="end" gap="2" className="font-bold">
            <label htmlFor="ping_name">{t("common.name")}</label>
            <TextField.Root id="ping_name" name="ping_name" />
            <label htmlFor="type">{t("common.type")}</label>
            <Select.Root
              value={selectedType}
              onValueChange={(value) =>
                setSelectedType(value as "icmp" | "tcp" | "http")
              }
            >
              <Select.Trigger id="type" name="type" />
              <Select.Content>
                <Select.Item value="icmp">ICMP</Select.Item>
                <Select.Item value="tcp">TCP</Select.Item>
                <Select.Item value="http">HTTP</Select.Item>
              </Select.Content>
            </Select.Root>
            <label htmlFor="ping_target">{t("ping.target")}</label>
            <TextField.Root
              id="ping_target"
              name="ping_target"
              placeholder="1.1.1.1 | 1.1.1.1:80 | https://1.1.1.1"
            />
            <label htmlFor="ping_server">{t("common.server")}</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-start gap-2">
                <NodeSelectorDialog value={selected} onChange={setSelected} />
                <label className="text-md font-normal">
                  {t("common.selected", { count: selected.length })}
                </label>
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={defaultOn}
                  onCheckedChange={(checked) => setDefaultOn(!!checked)}
                />
                <span>{t("ping.default_on")}</span>
              </label>
              <label className="text-sm font-normal text-gray-500">
                {t("ping.default_on_description")}
              </label>
            </div>
            <label htmlFor="interval">
              {t("ping.interval")} ({t("time.second")})
            </label>
            <TextField.Root
              id="interval"
              name="interval"
              defaultValue={60}
              type="number"
              placeholder="60"
            />
            <div className="flex justify-end gap-2 mt-km-block">
              <Dialog.Close>
                <Button variant="soft">{t("common.close")}</Button>
              </Dialog.Close>
              <Button disabled={saving} type="submit">
                {t("common.add")}
              </Button>
            </div>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default PingTask;
