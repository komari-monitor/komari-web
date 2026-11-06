import type React from "react";
import { Button } from "@radix-ui/themes";
import { motion } from "motion/react";
import { CONTROL_MOTION } from "@/lib/motion";

/** 表单提交按钮。control 性格：提交类按钮，按压回弹 + 保存中压暗（不改文案，避免布局跳动） */
export default function SavingButton({
  saving,
  children,
}: {
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <motion.div
        className="inline-flex"
        whileTap={saving ? undefined : CONTROL_MOTION.tap}
        animate={saving ? { scale: 0.98, opacity: 0.7 } : { scale: 1, opacity: 1 }}
        transition={CONTROL_MOTION.transition}
      >
        <Button disabled={saving} type="submit">
          {children}
        </Button>
      </motion.div>
    </div>
  );
}
