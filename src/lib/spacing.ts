/**
 * 间距系统的 JS 侧镜像（规则见 src/global.css「间距系统」）。
 *
 * 只在 JS 必须拿到像素值时使用，例如 GapCollapse 用负 marginTop 收回所在栈的那份 gap、
 * 或者需要按 gap 计算行高的网格。样式里请直接用 Radix 数字 / km-* 语义类。
 *
 * 必须与 src/main.tsx 里 <Theme scaling="110%"> 保持一致：Radix 的 --space-N 会乘以 scaling。
 */
export const SPACING_SCALE = 1.1;

const px = (base: number) => base * SPACING_SCALE;

export const SPACE = {
  /** 4：同一元素内部（图标与文字、标题与说明） */
  inline: px(4),
  /** 8：同一组控件之间 */
  group: px(8),
  /** 12：控件内部的紧凑排列，不用于区块之间 */
  compact: px(12),
  /** 16：块内（卡片内边距、字段之间、同类卡片之间） */
  block: px(16),
  /** 24：块外（标题与内容、功能区块之间） */
  section: px(24),
  /** 32：页面级留白 */
  page: px(32),
  /** 48：低密度页（登录、安装、空状态） */
  hero: px(48),
} as const;

export type SpaceToken = keyof typeof SPACE;
