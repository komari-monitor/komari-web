import React from "react";

/**
 * 共享元素（Shared Element）登记处
 * ------------------------------------------------------------------
 * 浏览器要求同一个 view-transition-name 在文档中**唯一**。所以只在「即将跳转」
 * 的那一刻，给被点击的那张卡片的标题打上共享元素名，详情页标题使用同一个名字，
 * 浏览器据此把两者补间为「同一个东西从旧位置移动到新布局」。
 *
 * 跳转完成后立即清除，避免同名的元素互相干扰。
 */
const HERO_NAME = "km-node-hero";

let pendingHero: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const getSharedHero = () => pendingHero;

export const setSharedHero = (uuid: string | null) => {
  if (pendingHero === uuid) return;
  pendingHero = uuid;
  emit();
};

export const subscribeSharedHero = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** React 侧订阅：只有当前「待跳转」的卡片会拿到共享元素名 */
export const useSharedHero = (uuid: string) =>
  React.useSyncExternalStore(
    subscribeSharedHero,
    () => pendingHero === uuid,
    () => false,
  );

/** 生成共享元素样式；未登记时返回 undefined（不产生 view-transition-name） */
export const sharedHeroStyle = (active: boolean): React.CSSProperties | undefined =>
  active ? ({ viewTransitionName: HERO_NAME } as React.CSSProperties) : undefined;

export { HERO_NAME };
