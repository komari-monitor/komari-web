import {
  Activity,
  ArrowUpDown,
  Boxes,
  CalendarClock,
  ChartNoAxesCombined,
  Cpu,
  Database,
  Gauge,
  Globe,
  HardDrive,
  History,
  MemoryStick,
  Server,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { WidgetId } from "./layout";

/** 与各仪表盘卡片保持一致的图标映射，用于卡片选择弹窗、空位添加器与拖拽落位提示。 */
export const WIDGET_ICONS: Record<WidgetId, LucideIcon> = {
  overview: Server,
  globe: Globe,
  trafficQuota: ArrowUpDown,
  billing: Wallet,
  expiry: CalendarClock,
  liveBandwidth: Activity,
  traffic: ChartNoAxesCombined,
  cpu: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
  uptime: History,
  ping: Gauge,
  resources: Boxes,
  database: Database,
  shortcuts: Zap,
};
