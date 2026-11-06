import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Flex, Text } from "@radix-ui/themes";
import { motion } from "motion/react";
import { CONTROL_MOTION, MOTION_SPRING } from "@/lib/motion";

// 侧边栏项目组件
export default function SidebarItem({
  to,
  onClick,
  icon,
  children,
  newTab,
  reloadDocument,
}: {
  to: string;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  newTab?: boolean;
  reloadDocument?: boolean;
}) {
  const location = useLocation();
  const isExternalLink = to.startsWith("http://") || to.startsWith("https://");
  // 带 query 的菜单项（如 /admin/plugin-page?short=x）做全匹配；不带 query
  // 的菜单项只比 pathname（如 /admin/plugins/config?short=x 点亮“插件配置”），
  // 同时避免前缀兄弟路由（/admin/plugins 与 /admin/plugins/config）同时点亮。
  const isActive =
    !isExternalLink &&
    to !== "/" &&
    (to.includes("?")
      ? location.pathname + location.search === to
      : location.pathname === to.split("?")[0]);
  const openInNewTab = newTab === true || (isExternalLink && newTab !== false);

  if (openInNewTab || reloadDocument) {
    return (
      <a
        data-guide-nav={to}
        href={to}
        onClick={onClick}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        className="group block w-full rounded-md"
      >
        <Flex
          className="p-2 gap-2 h-full transition-colors duration-200 group-hover:bg-accent-3 group-focus-visible:bg-accent-3"
          align="center"
          style={{
            borderLeft: "4px solid transparent",
            borderRadius: "6px",
            color: "inherit",
            transition: "background-color 0.2s, border-color 0.2s",
          }}
        >
          <span
            style={{
              color: "inherit",
              opacity: 0.7,
            }}
            className="flex w-4 h-5 items-center justify-center"
          >
            {icon}
          </span>
          <Text className="text-base" weight="medium" style={{ flex: 1 }}>
            {children}
          </Text>
        </Flex>
      </a>
    );
  }

  return (
    <Link
      data-guide-nav={to}
      to={to}
      onClick={onClick}
      className="group block w-full rounded-md"
    >
      {/*
        hover 高亮交给 CSS（.km-sidebar-item:hover），不要用 whileHover 写内联背景色：
        motion 会把 hover 的 background-color 留在 style 里，页面切换后鼠标已离开，
        内联值却还在，于是「hover 标记没被清除」。CSS 伪类随指针状态自动复位。
      */}
      <motion.div
        className="km-sidebar-item relative p-2 gap-2 flex items-center"
        data-active={isActive ? "true" : "false"}
        style={{ borderRadius: "6px" }}
        whileTap={{ scale: 0.99 }}
        transition={CONTROL_MOTION.transition}
      >
        {isActive && (
          <motion.span
            layoutId="km-sidebar-active-bg"
            aria-hidden
            className="absolute inset-0 rounded-md"
            style={{ backgroundColor: "var(--accent-4)" }}
            transition={MOTION_SPRING.snappy}
          />
        )}
        <motion.span
          aria-hidden
          className="km-sidebar-active-bar"
          initial={false}
          animate={{
            scaleY: isActive ? 1 : 0.001,
            opacity: isActive ? 1 : 0,
          }}
          transition={MOTION_SPRING.snappy}
          style={{ backgroundColor: "var(--accent-8)" }}
        />
        <span
          style={{
            color: isActive ? "var(--accent-10)" : "inherit",
            opacity: isActive ? 1 : 0.7,
          }}
          className="relative flex w-4 h-5 items-center justify-center"
        >
          {icon}
        </span>
        <Text
          className="relative text-base"
          weight={isActive ? "bold" : "medium"}
          style={{
            flex: 1,
            color: isActive ? "var(--accent-11)" : undefined,
          }}
        >
          {children}
        </Text>
      </motion.div>
    </Link>
  );
}
