import type React from "react";
import { Flex, Heading, Text } from "@radix-ui/themes";

/**
 * 后台页面统一页头：标题（可带图标）+ 可选说明 + 右侧操作区。
 *
 * 间距按 src/global.css「间距系统」：
 * - 标题与说明属于同一元素内部 → inline（gap 1）；图标与 size 6 标题之间用 group（gap 2），大字号配稍宽的间隙
 * - 操作按钮之间是一组控件 → group（gap 2）
 * - 页头与下方内容的距离由外层 .km-page 的 section 档负责，页头自身不带外边距
 *
 * 窄屏时操作区折到标题下方，左对齐，不挤压标题。
 */
export default function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Flex
      className={"km-page-header" + (className ? " " + className : "")}
      justify="between"
      align={description ? "end" : "center"}
      wrap="wrap"
      gap="4"
    >
      <Flex direction="column" gap="1" className="min-w-0">
        <Flex align="center" gap="2" className="min-w-0">
          {icon ? (
            <span className="km-page-header-icon inline-flex shrink-0 items-center text-[var(--accent-11)]">
              {icon}
            </span>
          ) : null}
          <Heading as="h1" size="6" weight="bold" className="min-w-0 truncate">
            {title}
          </Heading>
        </Flex>
        {description ? (
          <Text as="p" size="2" color="gray">
            {description}
          </Text>
        ) : null}
      </Flex>
      {actions ? (
        <Flex align="center" gap="2" wrap="wrap" className="km-page-header-actions">
          {actions}
        </Flex>
      ) : null}
    </Flex>
  );
}
