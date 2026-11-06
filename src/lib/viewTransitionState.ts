import React from "react";

/**
 * 原生 View Transition 的全局状态
 * ------------------------------------------------------------------
 * 命中共享元素跳转时，浏览器已经在做「同一个东西从旧位置移动到新布局」的补间。
 * 此时 React 侧的路由过渡必须让位，否则两套动画同时跑会互相打架。
 */
let active = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const setViewTransitionActive = (next: boolean) => {
  if (active === next) return;
  active = next;
  emit();
};

export const subscribeViewTransition = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 当前是否有原生 View Transition 正在播放 */
export const useViewTransitionActive = () =>
  React.useSyncExternalStore(
    subscribeViewTransition,
    () => active,
    () => false,
  );
