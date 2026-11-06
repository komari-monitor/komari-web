import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import Loading from "@/components/loading";
import { NodeDetailsProvider, useNodeDetails } from "@/contexts/NodeDetailsContext";
import { useTranslation } from "react-i18next";
import {
    Button,
    Card,
    Flex,
    Text,
    TextField
} from "@radix-ui/themes";
import { Play } from "lucide-react";
import { toast } from "sonner";
import NodeSelector from "@/components/NodeSelector";
import { SettingCardCollapse } from "@/components/admin/SettingCard";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { AutoHeight, Collapse, PresenceBox } from "@/components/motion";
import PageHeader from "@/components/PageHeader";
import { useRouteQuery } from "@/lib/routeData";
import { execMeQuery } from "@/routeQueries/system";
import CommandEditor from "./exec/CommandEditor";
import TaskResultCard from "./exec/TaskResultCard";
import { COMMAND_EDITOR_ID } from "./exec/editorLayout";
import { execTask, fetchTaskResult } from "./exec/api";
import { TIMEOUT_RESULT_MARKER, type TaskResult } from "./exec/types";

const ExecPage = () => {
    return (
        <NodeDetailsProvider>
            <ExecContent />
        </NodeDetailsProvider>
    );
};

const ExecContent = () => {
    const { t } = useTranslation();
    // 节点列表的加载/错误由 NodeSelector 自己显示（只有列表区是骨架），页面其余部分直接渲染
    const { nodeDetail } = useNodeDetails();
    const [command, setCommand] = useState("");
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [executing, setExecuting] = useState(false);
    const [results, setResults] = useState<TaskResult[]>([]);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [polling, setPolling] = useState(false);
    const [twoFaCode, setTwoFaCode] = useState("");

    // 使用 useRef 来保存轮询相关的引用
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 清理轮询的函数
    const clearPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
        setPolling(false);
    };

    // 组件卸载时清理轮询
    useEffect(() => {
        return () => {
            clearPolling();
        };
    }, []);

    // 是否需要 2FA：切换页面时已由 routePreload 提前请求；请求失败按未开启处理
    const me = useRouteQuery(execMeQuery);
    const twoFaEnabled = !me.error && Boolean(me.data?.["2fa_enabled"]);

    // 轮询任务结果
    const pollTaskResult = async (taskId: string) => {
        try {
            const data = await fetchTaskResult(taskId);
            let taskResults: TaskResult[] | undefined;

            // 支持旧格式和新格式
            if (data.success && data.results) {
                taskResults = data.results;
            } else if (data.status === "success" && data.data) {
                taskResults = data.data;
            }

            if (taskResults) {
                setResults(taskResults);

                // 检查是否所有任务都已完成
                const allCompleted = taskResults.every(result => result.finished_at !== null);
                if (allCompleted) {
                    clearPolling();
                    toast.success(t("exec.allCompleted", "所有任务执行完成"));
                }
            }
        } catch (err) {
            console.error("轮询任务结果失败:", err);
            clearPolling();
        }
    };

    // 开始轮询
    const startPolling = (taskId: string) => {
        // 先清理之前的轮询
        clearPolling();

        setPolling(true);

        // 首次立即执行
        pollTaskResult(taskId);

        // 设置定时轮询
        pollingIntervalRef.current = setInterval(() => {
            pollTaskResult(taskId);
        }, 2000);

        // 60秒后停止轮询并设置为超时状态
        pollingTimeoutRef.current = setTimeout(() => {
            // 将未完成的任务状态设置为超时
            setResults(prevResults =>
                prevResults.map(result =>
                    result.finished_at === null
                        ? { ...result, finished_at: new Date().toISOString(), exit_code: -1, result: TIMEOUT_RESULT_MARKER }
                        : result
                )
            );
            clearPolling();
            toast.warning(t("exec.pollingTimeout", "任务执行超时"));
        }, 60000);
    };

    const executeCommand = async () => {
        if (!command.trim()) {
            toast.error(t("exec.errors.emptyCommand"));
            return;
        }

        if (selectedNodes.length === 0) {
            toast.error(t("exec.errors.noNodes"));
            return;
        }

        if (twoFaEnabled && !twoFaCode.trim()) {
            toast.error(t("account.otp_empty_error"));
            return;
        }

        // 清理之前的轮询
        clearPolling();

        setExecuting(true);
        setResults([]);
        setTaskId(null);

        try {
            const data = await execTask({
                // Remote exec treats whitespace as script content, so preserve the user's exact input.
                command,
                clients: selectedNodes,
                "2fa_code": twoFaCode,
            });

            if (data.success && data.task_id) {
                setTaskId(data.task_id);
                setTwoFaCode("");
                toast.success(t("exec.taskStarted"));
                startPolling(data.task_id);
            } else if (data.status === "success" && data.data?.task_id) {
                setTaskId(data.data.task_id);
                setTwoFaCode("");
                toast.success(t("exec.taskStarted"));
                startPolling(data.data.task_id);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t("common.unknownError");
            toast.error(errorMessage);
        } finally {
            setExecuting(false);
        }
    };

    const handleCommandKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
            return;
        }

        event.preventDefault();
        if (!executing) {
            executeCommand();
        }
    };

    const getSelectedNodeNames = () => {
        return selectedNodes.map(uuid => {
            const node = nodeDetail.find(n => n.uuid === uuid);
            return node ? node.name : uuid;
        }).join(", ");
    };

    return (
        <div className="km-page km-page-admin-exec km-exec-header">
            {/* 页面标题：与其它后台页一致，页头与内容之间由 km-page 的 section 档拉开，不再加分隔线 */}
            <PageHeader title={t("exec.title")} description={t("exec.description")} />

            {/* 命令输入区域 */}
            <Card className="km-exec-editor-card p-km-block">
                <Flex direction="column" gap="4">

                    <label htmlFor={COMMAND_EDITOR_ID} className="text-xl font-bold">
                        {t("exec.command")}
                    </label>
                    <CommandEditor
                        command={command}
                        onCommandChange={setCommand}
                        onKeyDown={handleCommandKeyDown}
                    />


                    <div>
                        <SettingCardCollapse title={t("exec.selectNodes")} defaultOpen>
                            <NodeSelector
                                value={selectedNodes}
                                onChange={setSelectedNodes}
                                className="min-h-[200px]"
                            />
                        </SettingCardCollapse>
                        {/* feedback 层：已选节点说明展开/收起用高度弹簧，下方按钮不跳 */}
                        <Collapse open={selectedNodes.length > 0} aria-hidden={selectedNodes.length === 0 || undefined}>
                            <Text as="p" size="2" color="gray" className="pt-2">
                                {selectedNodes.length > 0 && (
                                    <>{t("exec.selectedNodes", "已选择节点")}: {getSelectedNodeNames()}</>
                                )}
                            </Text>
                        </Collapse>
                    </div>

                    <Flex justify="end" gap="2">
                        {/* control 层：/api/me 返回后才知道要不要 2FA，输入框淡入，不突然插进来 */}
                        <AnimatePresence initial={false}>
                        {twoFaEnabled ? (
                            <motion.div
                                key="two-fa"
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ x: MOTION_SPRING.snappy, opacity: MOTION_TRANSITION.fade }}
                            >
                            <TextField.Root
                                className="w-32"
                                type="number"
                                placeholder="2FA"
                                value={twoFaCode}
                                onChange={(e) => setTwoFaCode((e.target as HTMLInputElement).value)}
                            />
                            </motion.div>
                        ) : null}
                        </AnimatePresence>
                        <Button
                            onClick={executeCommand}
                            disabled={executing || !command.trim() || selectedNodes.length === 0 || (twoFaEnabled && !twoFaCode.trim())}
                        >
                            {executing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                    {t("exec.executing")}
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    {t("exec.execute")}
                                </>
                            )}
                        </Button>
                    </Flex>
                </Flex>
            </Card>

            {/* 执行结果区域：content 层，结果出现时淡入上浮，整页不抖 */}
            <AnimatePresence initial={false}>
            {results.length > 0 && (
                <PresenceBox key="km-exec-output">
                <Card className="km-exec-output p-km-block">
                    <Flex direction="column" gap="4">
                        <Flex justify="between" align="center">
                            <Text size="4" weight="medium">
                                {t("exec.results", "执行结果")}
                            </Text>
                            {taskId && (
                                <Text size="2" color="gray">
                                    Task ID: {taskId}
                                </Text>
                            )}
                        </Flex>

                        {/*
                          content 层：结果列表随轮询增长（新节点结果、输出变长、轮询提示出现/消失），
                          外层高度由 AutoHeight 弹簧跟随；大段输出文字不做 layout 尺寸补间。
                        */}
                        <AutoHeight>
                        <div className="flex flex-col gap-km-block">
                        <div className="space-y-km-block">
                            {/* content 层：每个节点的结果卡片 layout 跟随 + 进出场 */}
                            <AnimatePresence initial={false}>
                            {results.map((result, index) => (
                                <TaskResultCard
                                    key={result.client}
                                    result={result}
                                    index={index}
                                    nodeName={nodeDetail.find(n => n.uuid === result.client)?.name || result.client}
                                />
                            ))}
                            </AnimatePresence>
                        </div>

                        {/* 轮询状态提示：content 层，出现/消失都过渡 */}
                        <AnimatePresence initial={false}>
                        {polling && (
                            <PresenceBox key="km-exec-polling">
                            <Flex align="center" justify="between" className="text-sm text-gray-500">
                                <Loading compact />
                                <Button
                                    variant="soft"
                                    size="1"
                                    onClick={clearPolling}
                                >
                                    {t("exec.stopPolling")}
                                </Button>
                            </Flex>
                            </PresenceBox>
                        )}
                        </AnimatePresence>
                        </div>
                        </AutoHeight>
                    </Flex>
                </Card>
                </PresenceBox>
            )}
            </AnimatePresence>
        </div>
    );
};

export default ExecPage;
