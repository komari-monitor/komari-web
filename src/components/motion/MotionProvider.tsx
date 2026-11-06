import React from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";

/**
 * 全站动效配置入口
 * - MotionConfig 统一默认 transition：任何 motion 组件即使没写 transition 也不会跑偏；
 * - reducedMotion="user"：自动尊重系统「减少动态效果」，JS 动画与 CSS 媒体查询保持一致；
 * - 不在全局包 LayoutGroup：layoutId 本身就是全局匹配的；全局 LayoutGroup 会让任何一个 layout 节点
 *   更新时把全站 layout 节点都标脏重测，layoutDependency 门控失效，还会让无关区域跟着补间。
 *   确实需要「兄弟组件互相感知布局」时，在局部包 LayoutGroup。
 */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <MotionConfig reducedMotion="user" transition={MOTION_SPRING.layout}>
      {children}
    </MotionConfig>
  );
};

/**
 * 读取系统「减少动态效果」偏好。
 * 返回 true 时调用方应跳过位移/缩放，只保留必要的淡入淡出或直接切换。
 */
export const useKmReducedMotion = () => useReducedMotion() === true;

/** 便捷工具：按 reducedMotion 自动降级过渡（时长归零，只切换状态） */
export const useKmTransition = () => {
  const reduced = useKmReducedMotion();
  return React.useMemo(
    () =>
      reduced
        ? {
            reduced,
            layout: { duration: 0 },
            shared: { duration: 0 },
            snappy: { duration: 0 },
            soft: { duration: 0 },
            pop: { duration: 0 },
            fade: { duration: 0 },
            enter: { duration: 0 },
            exit: { duration: 0 },
          }
        : {
            reduced,
            layout: MOTION_SPRING.layout,
            shared: MOTION_SPRING.shared,
            snappy: MOTION_SPRING.snappy,
            soft: MOTION_SPRING.soft,
            pop: MOTION_SPRING.pop,
            fade: MOTION_TRANSITION.fade,
            enter: MOTION_TRANSITION.enter,
            exit: MOTION_TRANSITION.exit,
          },
    [reduced],
  );
};

export default MotionProvider;
