import { Button, IconButton } from "@radix-ui/themes";
import { motion } from "motion/react";

/**
 * Radix 按钮的 motion 版本（control 性格）。
 * 用 motion.create 直接让按钮本身成为动画元素，而不是在外面再包一层 motion.div：
 * - DropdownMenu.Trigger / Popover.Trigger 是 asChild，包一层 div 会让 aria-expanded、
 *   data-state、className、焦点归还都落到不可聚焦的 div 上；
 * - 也不会改变 DOM 层级，主题里 `.km-navbar-controls > button` 之类的选择器保持有效。
 */
export const MotionIconButton = motion.create(IconButton);
export const MotionButton = motion.create(Button);
