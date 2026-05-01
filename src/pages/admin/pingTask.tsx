import Loading from "@/components/loading";
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
import { useSettings } from "@/lib/api";
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
import { TaskView } from "./pingTask_Task";
import { ServerView } from "./pingTask_Server";

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
  const { pingTasks, isLoading, error } = usePingTask();
  const { isLoading: nodeDetailLoading, error: nodeDetailError } =
    useNodeDetails();
  const { t } = useTranslation();

  if (isLoading || nodeDetailLoading) {
    return <Loading />;
  }
  if (error || nodeDetailError) {
    return <div>{error || nodeDetailError}</div>;
  }
  return (
    <Flex direction="column" gap="4" className="p-4">
      <div className="flex justify-between items-center">
        <label className="text-2xl font-bold">{t("ping.title")}</label>
        <AddButton />
      </div>
      <Tabs.Root defaultValue="task">
        <Tabs.List>
          <Tabs.Trigger value="task">{t("ping.task_view")}</Tabs.Trigger>
          <Tabs.Trigger value="server">{t("ping.server_view")}</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="task">
            <TaskView pingTasks={pingTasks ?? []} />
          </Tabs.Content>
          <Tabs.Content value="server">
            <ServerView pingTasks={pingTasks ?? []} />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
      <DiskUsageEstimate />
    </Flex>
  );
};



const DiskUsageEstimate = () => {
  const { pingTasks } = usePingTask();
  const { t } = useTranslation();

  // 计算预估磁盘消耗
  const calculateDiskUsage = () => {
    if (!pingTasks || pingTasks.length === 0) return 0;

    // 一条记录的大小估算：
    // - uuid: 36字节 (UUID字符串)
    // - int: 8字节 (64位整数)
    // - int: 8字节 (64位整数)
    // - time: 33字节 (RFC3339格式字符串，如 "2006-01-02T15:04:05.000Z07:00")
    // - 其他开销: 20字节
    const recordSize = (36 + 8 + 8 + 33 + 20) * 2; // 回收余量2倍

    const totalRecordsPerDay = pingTasks.reduce((total, task) => {
      const clientCount = task.clients?.length || 0;
      const interval = task.interval || 60; // 默认60秒
      const recordsPerDay = (clientCount * (24 * 60 * 60)) / interval;
      return total + recordsPerDay;
    }, 0);

    return totalRecordsPerDay * recordSize;
  };

  // 格式化文件大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  const { settings } = useSettings();

  const dailyUsage = calculateDiskUsage();
  //const monthlyUsage = dailyUsage * 31;
  //const yearlyUsage = dailyUsage * 365;

  return (
    <div className="text-sm text-muted-foreground">
      <label>
        {t("ping.disk_usage_estimate")}: {formatBytes(dailyUsage)}/
        {t("common.day")},{" "}
        {t("ping.disk_usage_with_settings", {
          hour: settings.ping_record_preserve_time,
          space: formatBytes(
            (dailyUsage * settings.ping_record_preserve_time) / 24
          ),
        })}
      </label>
    </div>
  );
};

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
    fetch("/api/admin/ping/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (response.ok) {
          setIsOpen(false);
          setSelected([]);
          setDefaultOn(false);
          setSelectedType("icmp");
          toast.success(t("common.success"));
        } else {
          response
            .json()
            .then((data) => {
              toast.error(data?.message || t("common.error"));
            })
            .catch((error) => {
              toast.error(error.message);
            });
        }
      })
      .catch((error) => {
        console.error("Error adding ping task:", error);
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
            <label htmlFor="type">{t("ping.type")}</label>
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
            <div className="flex justify-end gap-2">
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
