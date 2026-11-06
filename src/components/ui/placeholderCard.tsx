import type React from "react";
import { cn } from "@/lib/utils";
import { Skeletonize } from "./skeleton";

/**
 * 列表里的一张占位卡片：加载中时把真实卡片组件（喂占位数据）包成一块同尺寸的色块；
 * 加载完成后原样返回卡片，不多一层 DOM（列表的 AnimatePresence / layout 直接作用在卡片上）。
 */
export const placeholderCard = (loading: boolean, key: React.Key, card: React.ReactNode, className = "h-full") =>
  loading ? (
    <Skeletonize key={key} loading className={cn("km-setting-card-skeleton", className)}>
      {card}
    </Skeletonize>
  ) : (
    card
  );
