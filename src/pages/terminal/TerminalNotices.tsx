import { Callout, Flex, IconButton } from "@radix-ui/themes";
import { Cross1Icon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { OVERLAY_MOTION } from "@/lib/motion";
import { TablerAlertTriangleFilled } from "@/components/Icones/Tabler";
import { TERMINAL_CALLOUT_CLASS_NAME } from "./terminalTypes";

interface TerminalNoticesProps {
  httpsCalloutOpen: boolean;
  onDismissHttpsCallout: () => void;
}

const TerminalNotices = ({
  httpsCalloutOpen,
  onDismissHttpsCallout,
}: TerminalNoticesProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-12 z-30 flex items-center justify-center">
        <AnimatePresence initial={false}>
          {httpsCalloutOpen && (
            <motion.div
              key="https-callout"
              // overlay 层：从顶部边缘滑入 + 轻微预缩放（Anticipation）
              initial={OVERLAY_MOTION.enter.initial}
              animate={OVERLAY_MOTION.enter.animate}
              exit={OVERLAY_MOTION.enter.exit}
              transition={OVERLAY_MOTION.enter.transition}
              className="pointer-events-auto"
            >
              <Callout.Root
                color="red"
                size="2"
                className={TERMINAL_CALLOUT_CLASS_NAME}
              >
                <Callout.Icon>
                  <TablerAlertTriangleFilled className="text-red-400" />
                </Callout.Icon>
                <Callout.Text className="font-medium">
                  <Flex align="center" justify="between" gap="3">
                    <span>{t("warn_https")}</span>
                    <IconButton
                      variant="soft"
                      color="red"
                      size="1"
                      className="transition-colors hover:bg-red-500/20"
                      onClick={onDismissHttpsCallout}
                    >
                      <Cross1Icon />
                    </IconButton>
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default TerminalNotices;
