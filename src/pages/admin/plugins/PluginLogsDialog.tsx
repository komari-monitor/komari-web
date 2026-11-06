import { Dialog } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { AutoHeight } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import type { PluginInfo } from "@/types/plugin";

/** 日志骨架：几行长短不一的文字（与 pre 里真实日志同字号、同行高） */
const LOG_PLACEHOLDER = [42, 56, 31, 48, 26, 52]
  .map((chars) => skeletonText(chars))
  .join("\n");

interface PluginLogsDialogProps {
  logPlugin: PluginInfo | null;
  setLogPlugin: (plugin: PluginInfo | null) => void;
  logsLoading: boolean;
  logContent: string;
}

/** 运行日志弹窗 */
export default function PluginLogsDialog({
  logPlugin,
  setLogPlugin,
  logsLoading,
  logContent,
}: PluginLogsDialogProps) {
  const { t } = useTranslation();
  return (
        <Dialog.Root
          open={logPlugin !== null}
          onOpenChange={(open) => {
            if (!open) setLogPlugin(null);
          }}
        >
          <Dialog.Content>
            <Dialog.Title>
              {t("logs.title", "Logs")} · {logPlugin?.short}
            </Dialog.Title>
            {/*
              overlay 层：日志加载中是同一个 pre 里的几行骨架，日志到达后原地淡入；
              行数不同由 AutoHeight 弹簧过渡（不再「转圈 -> 整块换成日志」地跳高）。
            */}
            <AutoHeight>
              <Skeletonize loading={logsLoading}>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-gray-1 p-3 text-xs">
                  {logsLoading
                    ? LOG_PLACEHOLDER
                    : logContent || t("plugin.no_logs", "No logs")}
                </pre>
              </Skeletonize>
            </AutoHeight>
          </Dialog.Content>
        </Dialog.Root>
  );
}
