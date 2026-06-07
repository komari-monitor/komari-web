import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from "react";
import Loading from "@/components/loading";
import { NodeDetailsProvider, useNodeDetails } from "@/contexts/NodeDetailsContext";
import { useTranslation } from "react-i18next";
import {
    Button,
    Card,
    Flex,
    Text,
    Separator,
    Badge
} from "@radix-ui/themes";
import { Play, AlertCircle, CheckCircle2, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import NodeSelector from "@/components/NodeSelector";
import { SettingCardCollapse } from "@/components/admin/SettingCard";

interface TaskResult {
    task_id: string;
    client: string;
    client_info: {
        uuid: string;
        name: string;
        [key: string]: any;
    };
    result: string;
    exit_code: number | null;
    finished_at: string | null;
    created_at: string;
}

interface ExecResponse {
    success?: boolean;
    task_id?: string;
    clients?: string[];
    message?: string;
    // 新的响应格式
    status?: string;
    data?: {
        task_id: string;
    };
}

interface TaskResultResponse {
    success?: boolean;
    results?: TaskResult[];
    message?: string;
    // 新的响应格式
    status?: string;
    data?: TaskResult[];
}

const COMMAND_EDITOR_COLLAPSED_LINES = 3;
const COMMAND_EDITOR_LINE_HEIGHT = 24;
const COMMAND_EDITOR_VERTICAL_PADDING = 24;
const COMMAND_EDITOR_COLLAPSED_HEIGHT = COMMAND_EDITOR_COLLAPSED_LINES * COMMAND_EDITOR_LINE_HEIGHT + COMMAND_EDITOR_VERTICAL_PADDING;

const ExecPage = () => {
    return (
        <NodeDetailsProvider>
            <ExecContent />
        </NodeDetailsProvider>
    );
};

const ExecContent = () => {
    const { t } = useTranslation();
    const { nodeDetail, isLoading, error } = useNodeDetails();
    const [command, setCommand] = useState("");
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [executing, setExecuting] = useState(false);
    const [results, setResults] = useState<TaskResult[]>([]);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [polling, setPolling] = useState(false);
    const [commandFocused, setCommandFocused] = useState(false);
    const [commandEditorHeight, setCommandEditorHeight] = useState(COMMAND_EDITOR_COLLAPSED_HEIGHT);

    // 使用 useRef 来保存轮询相关的引用
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const commandTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const commandLineCount = useMemo(() => {
        return command === "" ? 1 : command.split("\n").length;
    }, [command]);

    const commandLineLabels = useMemo(() => {
        if (commandFocused || commandLineCount <= COMMAND_EDITOR_COLLAPSED_LINES) {
            return Array.from({ length: commandLineCount }, (_, index) => String(index + 1));
        }

        const visibleNumberedLines = COMMAND_EDITOR_COLLAPSED_LINES - 1;
        const remainingLines = commandLineCount - visibleNumberedLines;
        return [
            ...Array.from({ length: visibleNumberedLines }, (_, index) => String(index + 1)),
            `+${remainingLines}`,
        ];
    }, [commandFocused, commandLineCount]);

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

    useEffect(() => {
        const textarea = commandTextareaRef.current;
        if (!textarea) {
            return;
        }

        if (!commandFocused) {
            textarea.scrollTop = 0;
            setCommandEditorHeight(COMMAND_EDITOR_COLLAPSED_HEIGHT);
            return;
        }

        textarea.style.height = "auto";
        setCommandEditorHeight(Math.max(COMMAND_EDITOR_COLLAPSED_HEIGHT, textarea.scrollHeight));
        textarea.style.height = "100%";
    }, [command, commandFocused]);

    if (isLoading) {
        return <Loading />;
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    // 轮询任务结果
    const pollTaskResult = async (taskId: string) => {
        try {
            const response = await fetch(`/api/admin/task/${taskId}/result`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: TaskResultResponse = await response.json();
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
                        ? { ...result, finished_at: new Date().toISOString(), exit_code: -1, result: "执行超时" }
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

        // 清理之前的轮询
        clearPolling();

        setExecuting(true);
        setResults([]);
        setTaskId(null);

        try {
            const response = await fetch("/api/admin/task/exec", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    command,
                    clients: selectedNodes,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data: ExecResponse = await response.json();

            if (data.success && data.task_id) {
                setTaskId(data.task_id);
                toast.success(t("exec.taskStarted"));
                startPolling(data.task_id);
            } else if (data.status === "success" && data.data?.task_id) {
                setTaskId(data.data.task_id);
                toast.success(t("exec.taskStarted"));
                startPolling(data.data.task_id);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "未知错误";
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

    const copyOutput = (output: string) => {
        navigator.clipboard.writeText(output);
        toast.success(t("common.success"));
    };

    const getSelectedNodeNames = () => {
        return selectedNodes.map(uuid => {
            const node = nodeDetail.find(n => n.uuid === uuid);
            return node ? node.name : uuid;
        }).join(", ");
    };

    const getTaskStatus = (result: TaskResult) => {
        if (result.finished_at === null) {
            return { status: "running", color: "blue" as const, text: t("exec.status.running") };
        }
        if (result.result === "执行超时") {
            return { status: "timeout", color: "orange" as const, text: t("exec.status.timeout", "超时") };
        }
        if (result.exit_code === 0) {
            return { status: "success", color: "green" as const, text: t("common.success") };
        }
        return { status: "failed", color: "red" as const, text: t("common.error") };
    };

    return (
        <div className="p-4 flex flex-col gap-3">
            {/* 页面标题 */}
            <div>
                <h1 className="text-2xl font-bold">{t("exec.title")}</h1>
                <Text size="2" color="gray" className="mt-1">
                    {t("exec.description")}
                </Text>
            </div>

            <Separator size="4" />

            {/* 命令输入区域 */}
            <Card className="p-6">
                <Flex direction="column" gap="4">

                    <label className="text-xl font-bold">
                        {t("exec.command")}
                    </label>
                    <div
                        className="grid grid-cols-[3.75rem_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--gray-a7)] bg-[var(--color-surface)] transition-[height,border-color,box-shadow] duration-200 focus-within:border-[var(--accent-8)] focus-within:shadow-[0_0_0_1px_var(--accent-8)]"
                        style={{ height: commandEditorHeight }}
                    >
                        <div
                            aria-hidden="true"
                            className="select-none overflow-hidden border-r border-[var(--gray-a5)] bg-[var(--gray-2)] px-2 py-3 text-right font-mono text-xs leading-6 text-[var(--gray-11)]"
                        >
                            {commandLineLabels.map((label, index) => (
                                <div
                                    key={`${label}-${index}`}
                                    className={label.startsWith("+") ? "font-medium text-[var(--accent-11)]" : undefined}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                        <textarea
                            ref={commandTextareaRef}
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onFocus={() => setCommandFocused(true)}
                            onBlur={() => setCommandFocused(false)}
                            onKeyDown={handleCommandKeyDown}
                            placeholder={t("exec.commandPlaceholder")}
                            rows={COMMAND_EDITOR_COLLAPSED_LINES}
                            wrap="soft"
                            spellCheck={false}
                            className="h-full w-full resize-none border-0 bg-transparent px-3 py-3 font-mono text-sm leading-6 text-[var(--gray-12)] outline-none placeholder:text-[var(--gray-9)]"
                            style={{
                                overflowY: "hidden",
                                overflowWrap: "break-word",
                                whiteSpace: "pre-wrap",
                            }}
                        />
                    </div>


                    <div>
                        <SettingCardCollapse title={t("exec.selectNodes")} defaultOpen>
                            <NodeSelector
                                value={selectedNodes}
                                onChange={setSelectedNodes}
                                className="min-h-[200px]"
                            />
                        </SettingCardCollapse>
                        {selectedNodes.length > 0 && (
                            <Text size="2" color="gray" className="mt-2">
                                {t("exec.selectedNodes", "已选择节点")}: {getSelectedNodeNames()}
                            </Text>
                        )}
                    </div>

                    <Flex justify="end" gap="2">
                        <Button
                            onClick={executeCommand}
                            disabled={executing || !command.trim() || selectedNodes.length === 0}
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

            {/* 执行结果区域 */}
            {results.length > 0 && (
                <Card className="p-6">
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

                        <div className="space-y-4">
                            {results.map((result) => {
                                const status = getTaskStatus(result);
                                return (
                                    <Card key={result.client} className="p-4">
                                        <Flex direction="column" gap="3">
                                            {/* 节点信息和状态 */}
                                            <label className="text-xl font-medium">
                                                {nodeDetail.find(n => n.uuid === result.client)?.name || result.client}
                                            </label>
                                            <Flex justify="between" align="center">
                                                <Flex align="center" gap="2">
                                                    <Text weight="medium">{result.client_info.name}</Text>
                                                    <Badge
                                                        color={status.color}
                                                        variant="soft"
                                                    >
                                                        {status.status === "running" ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                                                                {status.text}
                                                            </>
                                                        ) : status.status === "success" ? (
                                                            <>
                                                                <CheckCircle2 size={12} />
                                                                {status.text}
                                                            </>
                                                        ) : status.status === "timeout" ? (
                                                            <>
                                                                <Clock size={12} />
                                                                {status.text}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertCircle size={12} />
                                                                {status.text}
                                                            </>
                                                        )}
                                                    </Badge>
                                                    {result.exit_code !== null && (
                                                        <Text size="1" color="gray">
                                                            Exit Code: {result.exit_code}
                                                        </Text>
                                                    )}
                                                </Flex>

                                                {result.result && (
                                                    <Button
                                                        variant="ghost"
                                                        size="1"
                                                        onClick={() => copyOutput(result.result)}
                                                    >
                                                        <Copy size={14} />
                                                    </Button>
                                                )}
                                            </Flex>

                                            {/* 时间信息 */}
                                            {/* <Flex gap="4" className="text-sm text-gray-500">
                                                <Text size="1" color="gray">
                                                    创建时间: {new Date(result.created_at).toLocaleString()}
                                                </Text>
                                                {result.finished_at && (
                                                    <Text size="1" color="gray">
                                                        完成时间: {new Date(result.finished_at).toLocaleString()}
                                                    </Text>
                                                )}
                                            </Flex> */}

                                            {/* 输出内容 */}
                                            {result.result && (
                                                <div className="bg-[var(--gray-2)] rounded-md p-3 font-mono text-sm overflow-x-auto">
                                                    <pre className="whitespace-pre-wrap">{result.result}</pre>
                                                </div>
                                            )}
                                        </Flex>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* 轮询状态提示 */}
                        {polling && (
                            <Flex align="center" justify="between" className="text-sm text-gray-500">
                                <Flex align="center" gap="2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                    <Text size="2" color="gray">
                                        正在获取最新执行状态...
                                    </Text>
                                </Flex>
                                <Button
                                    variant="soft"
                                    size="1"
                                    onClick={clearPolling}
                                >
                                    停止轮询
                                </Button>
                            </Flex>
                        )}
                    </Flex>
                </Card>
            )}
        </div>
    );
};

export default ExecPage;