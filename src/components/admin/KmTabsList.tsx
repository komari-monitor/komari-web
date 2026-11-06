import React from "react";
import { Tabs } from "@radix-ui/themes";
import { motion, useAnimationControls } from "motion/react";
import { CONTROL_MOTION } from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";

type KmTabsListProps = React.ComponentPropsWithoutRef<typeof Tabs.List>;

/**
 * 带「滑动下划线」的 Tabs.List（control 性格 + 共享元素）。
 *
 * Radix Tabs 的选中下划线是每个 trigger 自己的 ::before，切换时旧的消失、新的出现。
 * 这里把它换成列表里唯一的一条指示器：从旧标签的位置/宽度弹簧滑到新标签，
 * 连续点击时弹簧改目标会保留当前速度顺势转向（可被打断）。
 *
 * 为什么不用 layoutId：Radix 的 trigger 会把 children 渲染两遍（可见层 + 隐藏的占位层），
 * 把 layoutId 元素放进 trigger 会出现两个同 id 节点；指示器作为 Tabs.List 的直接子元素，
 * 不改动 trigger 内部结构，也不影响 roving focus。
 *
 * 位置由 DOM 实测（offsetLeft/offsetWidth，相对 List 本身），所以受控/非受控、
 * 异步加载的标签、横向滚动的列表都适用。
 */
export const KmTabsList = React.forwardRef<HTMLDivElement, KmTabsListProps>(
  ({ children, className, ...props }, forwardedRef) => {
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const controls = useAnimationControls();
    const reduced = useKmReducedMotion();
    const placed = React.useRef(false);
    const [visible, setVisible] = React.useState(false);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        listRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    React.useLayoutEffect(() => {
      const list = listRef.current;
      if (!list) return;
      let frame = 0;
      const measure = () => {
        const active = list.querySelector<HTMLElement>(
          ':scope > [role="tab"][data-state="active"]',
        );
        if (!active) {
          setVisible(false);
          return;
        }
        setVisible(true);
        const target = { x: active.offsetLeft, width: active.offsetWidth };
        if (!placed.current || reduced) {
          // 首次出现直接落位，不从 0 扫过来
          placed.current = true;
          controls.set(target);
        } else {
          void controls.start({ ...target, transition: CONTROL_MOTION.indicator });
        }
      };
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      };
      measure();
      const mutation = new MutationObserver(schedule);
      mutation.observe(list, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-state"],
      });
      const resize = new ResizeObserver(schedule);
      resize.observe(list);
      return () => {
        cancelAnimationFrame(frame);
        mutation.disconnect();
        resize.disconnect();
      };
    }, [controls, reduced]);

    return (
      <Tabs.List
        ref={setRefs}
        // 隐藏 Radix 自带的逐项下划线（::before），改由下面唯一的指示器表达选中
        className={`relative [&>[role=tab]]:before:hidden ${className ?? ""}`}
        {...props}
      >
        {children}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[2px]"
          style={{
            backgroundColor: "var(--accent-indicator)",
            opacity: visible ? 1 : 0,
          }}
          initial={false}
          animate={controls}
        />
      </Tabs.List>
    );
  },
);
KmTabsList.displayName = "KmTabsList";

export default KmTabsList;
