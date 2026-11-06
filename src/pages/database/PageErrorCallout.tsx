import { Callout } from "@radix-ui/themes";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { GapCollapse } from "@/components/GapCollapse";
import { STACK_GAP } from "./layout";

/** 页面级错误提示：连同 section 间距一起展开/收起，下面的区块顺势移动 */
export default function PageErrorCallout({
  error,
  motionKey,
}: {
  error: string;
  motionKey: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <GapCollapse key={motionKey} gap={STACK_GAP}>
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={18} />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        </GapCollapse>
      )}
    </AnimatePresence>
  );
}
