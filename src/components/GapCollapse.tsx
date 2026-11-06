import type React from "react";
import { motion } from "motion/react";
import { MOTION_TRANSITION, SKELETON_MOTION } from "@/lib/motion";

/**
 * 条件出现的区块（错误提示、2FA 字段、进度卡）放在 flex gap / space-y 的纵向栈里时，
 * 高度从 0 弹簧展开，同时把「它带来的那一份间距」用负 marginTop 一起补间：
 * 收起时净占位正好是 0，展开时正好是 gap，前后元素不会因为间距瞬间多/少一截而跳。
 *
 * 必须作为 AnimatePresence 的直接子元素并带 key 使用。
 * 展开结束后 overflow 恢复 visible，不裁切焦点环和阴影；只在动画期间裁切。
 */
export const GapCollapse = ({
  gap,
  children,
  className,
}: {
  /** 所在栈的间距（像素）：flex gap 或 space-y 的值 */
  gap: number;
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial={{ height: 0, opacity: 0, marginTop: -gap, overflow: "hidden" }}
    animate={{
      height: "auto",
      opacity: 1,
      marginTop: 0,
      transitionEnd: { overflow: "visible" },
    }}
    exit={{ height: 0, opacity: 0, marginTop: -gap, overflow: "hidden" }}
    transition={{
      height: SKELETON_MOTION.height,
      marginTop: SKELETON_MOTION.height,
      opacity: MOTION_TRANSITION.fade,
    }}
  >
    {children}
  </motion.div>
);

export default GapCollapse;
