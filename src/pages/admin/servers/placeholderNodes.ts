import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import { skeletonText } from "@/components/ui/skeleton";

/** 加载中的占位行：真实行组件 + 数字宽空白，Skeletonize 会画成与文字等宽的条 */
export const PLACEHOLDER_NODES: NodeDetail[] = Array.from({ length: 6 }, (_, i) => ({
  uuid: `__placeholder-${i}`,
  token: "",
  name: skeletonText(10 + (i % 3) * 3),
  cpu_name: "",
  virtualization: "",
  arch: "",
  cpu_cores: 0,
  os: "",
  gpu_name: "",
  ipv4: skeletonText(12),
  ipv6: "",
  region: "",
  mem_total: 0,
  swap_total: 0,
  disk_total: 0,
  version: skeletonText(6),
  weight: i,
  price: 0,
  remark: skeletonText(4 + (i % 2) * 3),
  public_remark: "",
  group: skeletonText(5),
  billing_cycle: 0,
  expired_at: "",
  created_at: "",
  updated_at: "",
  tags: "",
}));
