import { Blocks } from "lucide-react";
import InlineSvgIcon from "@/components/InlineSvgIcon";
import { iconMap, resolvePluginIcon } from "@/utils/iconHelper";
import type { PluginInfo } from "@/types/plugin";

interface PluginIconProps {
  plugin: PluginInfo;
  size: number;
  className: string;
  /** 传入时以内联 style 设置透明度 */
  opacity?: number;
}

// 渲染插件 icon：lucide 名用组件，URL/相对路径用图片或内联 SVG，否则默认 Blocks。
export default function PluginIcon({ plugin, size, className, opacity }: PluginIconProps) {
  const style = opacity === undefined ? undefined : { opacity };
  const icon = resolvePluginIcon(plugin.short, plugin.icon);
  if (!icon) return <Blocks size={size} className={className} style={style} />;
  const Cmp = iconMap[icon];
  if (Cmp) {
    return <Cmp size={size} className={className} style={style} />;
  }
  return (
    <InlineSvgIcon
      src={icon}
      alt=""
      className={`${className} object-contain`}
      style={style}
    />
  );
}
