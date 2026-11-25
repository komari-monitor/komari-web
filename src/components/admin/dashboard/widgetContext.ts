import { createContext, useContext } from "react";
import type { WidgetHeight, WidgetWidth } from "./layout";

export type DashboardWidgetRenderContextValue = {
  editing: boolean;
  dragging: boolean;
  isDragPreview: boolean;
  width: WidgetWidth;
  height: WidgetHeight;
};

export const DashboardWidgetRenderContext = createContext<DashboardWidgetRenderContextValue>({
  editing: false,
  dragging: false,
  isDragPreview: false,
  width: "compact",
  height: "short",
});

/** 供卡片内部感知当前是否处于编辑/拖拽预览态及自身尺寸档位（如 3D 地球自适应与手势隔离） */
export function useDashboardWidgetContext() {
  return useContext(DashboardWidgetRenderContext);
}
