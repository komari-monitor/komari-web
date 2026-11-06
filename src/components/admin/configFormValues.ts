import { skeletonText } from "@/components/ui/skeleton";
import type { ConfigFormItem } from "./ConfigFormTabs";

/** 配置还在读取时用的占位字段：与真实表单同结构，文字由 Skeletonize 变成占位条 */
export const CONFIG_FORM_PLACEHOLDER_ITEMS: ConfigFormItem[] = [
  { type: "title", name: skeletonText(8) },
  { key: "__km_placeholder_a", type: "string", name: skeletonText(10), help: skeletonText(26) },
  { key: "__km_placeholder_b", type: "switch", name: skeletonText(12), help: skeletonText(32) },
  { key: "__km_placeholder_c", type: "number", name: skeletonText(9), help: skeletonText(22) },
  { key: "__km_placeholder_d", type: "string", name: skeletonText(11), help: skeletonText(28) },
];

interface ConfigValueItem {
  key?: string;
  type?: string;
  default?: any;
}

/**
 * 配置表单的初始值：已保存的值优先，其次 default。
 * title / textbox 与无 key 的项不产生值；nodes / pingtasks 选择项序列化为 JSON 字符串（缺省 "[]"）。
 * 主题配置、插件配置页与插件配置弹窗共用。
 */
export function buildConfigInitialValues(
  items: Iterable<ConfigValueItem>,
  saved: Record<string, any> | undefined | null,
): Record<string, any> {
  const init: Record<string, any> = {};
  for (const item of items) {
    if (item.type === "title" || item.type === "textbox" || !item.key) continue;
    const value = saved?.[item.key];
    const selection = item.type === "nodes" || item.type === "pingtasks";
    init[item.key] =
      value !== undefined
        ? selection
          ? JSON.stringify(value)
          : value
        : item.default ?? (selection ? "[]" : undefined);
  }
  return init;
}
