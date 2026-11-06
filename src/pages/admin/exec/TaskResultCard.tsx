import { Button, Card, Flex, Text, Badge } from "@radix-ui/themes";
import { AlertCircle, CheckCircle2, Copy, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { Collapse, StatusFeedback } from "@/components/motion";
import { TIMEOUT_RESULT_MARKER, type TaskResult } from "./types";

/** 单个节点的执行结果卡片（状态徽标、退出码、输出） */
const TaskResultCard = ({
    result,
    index,
    nodeName,
}: {
    result: TaskResult;
    index: number;
    nodeName: string;
}) => {
    const { t } = useTranslation();

    const copyOutput = (output: string) => {
        navigator.clipboard.writeText(output);
        toast.success(t("common.success"));
    };

    // 超时标记结果展示为本地化文案
    const displayResultText = (result: TaskResult) =>
        result.result === TIMEOUT_RESULT_MARKER ? t("exec.status.timeout") : result.result;

    const getTaskStatus = (result: TaskResult) => {
        if (result.finished_at === null) {
            return { status: "running", color: "blue" as const, text: t("exec.status.running") };
        }
        if (result.result === TIMEOUT_RESULT_MARKER) {
            return { status: "timeout", color: "orange" as const, text: t("exec.status.timeout", "超时") };
        }
        if (result.exit_code === 0) {
            return { status: "success", color: "green" as const, text: t("common.success") };
        }
        return { status: "failed", color: "red" as const, text: t("common.error") };
    };

    const status = getTaskStatus(result);
    return (
        <motion.div
            // 只补间位置（行内有文字，尺寸补间会拉伸文字；高度变化直接生效）
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{
                layout: MOTION_SPRING.layout,
                y: MOTION_SPRING.layout,
                opacity: { ...MOTION_TRANSITION.fadeIn, delay: Math.min(index * 0.03, 0.18) },
            }}
        >
        <Card className="p-km-block">
            <Flex direction="column" gap="2">
                {/* 节点信息和状态 */}
                <label className="text-xl font-medium">
                    {nodeName}
                </label>
                <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                        <Text weight="medium">{result.client_info.name}</Text>
                        {/* feedback 层：运行 -> 成功/失败的状态翻转才播一下 */}
                        <StatusFeedback state={status.status}>
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
                        </StatusFeedback>
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
                            onClick={() => copyOutput(displayResultText(result))}
                            title={t("common.copy", "Copy")}
                            aria-label={t("common.copy", "Copy")}
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
                {/* 输出第一次出现：高度弹簧展开（负 margin 抵消所在栈的 gap 2，收起时不留空隙） */}
                <Collapse open={Boolean(result.result)} style={{ marginTop: "calc(-1 * var(--space-2))" }}>
                    <div style={{ paddingTop: "var(--space-2)" }}>
                    <div className="bg-[var(--gray-2)] rounded-md p-3 font-mono text-sm overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{result.result ? displayResultText(result) : null}</pre>
                    </div>
                    </div>
                </Collapse>
            </Flex>
        </Card>
        </motion.div>
    );
};

export default TaskResultCard;
