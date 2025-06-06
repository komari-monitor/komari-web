import { z } from "zod";
import type { schema } from "@/types/node";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import { t } from "i18next";

function formatBytes(bytes?: number | string): string {
  if (!bytes || isNaN(Number(bytes))) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const b = Number(bytes);
  if (b === 0) return "0 Bytes";
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return parseFloat((b / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

export function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile();

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-foreground w-fit px-0 text-left">
          {item.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.name}</DrawerTitle>
          <DrawerDescription>
            {t("admin.nodeDetail.machineDetail", "机器详细信息")}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <form className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-ip">
                  {t("admin.nodeDetail.ipAddress", "IP 地址")}
                </Label>
                <div className="flex flex-col gap-1">
                  {item.ipv4 && (
                    <div className="flex items-center gap-1">
                      <span
                        id="detail-ipv4"
                        className="bg-muted px-3 py-2 rounded border flex-1 min-w-0 select-text"
                      >
                        {item.ipv4}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.ipv4!);
                        }}
                      >
                        <Copy size={16} />
                      </Button>
                    </div>
                  )}
                  {item.ipv6 && (
                    <div className="flex items-center gap-1">
                      <span
                        id="detail-ipv6"
                        className="bg-muted px-3 py-2 rounded border flex-1 min-w-0 select-text"
                      >
                        {item.ipv6}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.ipv6!);
                        }}
                      >
                        <Copy size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-version">
                  {t("admin.nodeDetail.clientVersion", "客户端版本")}
                </Label>
                <span
                  id="detail-version"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.version || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-os">
                  {t("admin.nodeDetail.os", "操作系统")}
                </Label>
                <span
                  id="detail-os"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.os || <span className="text-muted-foreground">-</span>}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-arch">
                  {t("admin.nodeDetail.arch", "架构")}
                </Label>
                <span
                  id="detail-arch"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.arch || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-cpu_name">
                  {t("admin.nodeDetail.cpu", "CPU")}
                </Label>
                <span
                  id="detail-cpu_name"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.cpu_name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-cpu_cores">
                  {t("admin.nodeDetail.cpuCores", "CPU 核心数")}
                </Label>
                <span
                  id="detail-cpu_cores"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.cpu_cores?.toString() || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-mem_total">
                  {t("admin.nodeDetail.memTotal", "总内存 (Bytes)")}
                </Label>
                <span
                  id="detail-mem_total"
                  className="bg-muted px-3 py-2 rounded border select-text"
                  title={
                    item.mem_total ? String(item.mem_total) + " Bytes" : "-"
                  }
                >
                  {formatBytes(item.mem_total)}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-disk_total">
                  {t("admin.nodeDetail.diskTotal", "总磁盘空间 (Bytes)")}
                </Label>
                <span
                  id="detail-disk_total"
                  className="bg-muted px-3 py-2 rounded border select-text"
                  title={
                    item.disk_total ? String(item.disk_total) + " Bytes" : "-"
                  }
                >
                  {formatBytes(item.disk_total)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="detail-gpu_name">
                {t("admin.nodeDetail.gpu", "GPU")}
              </Label>
              <span
                id="detail-gpu_name"
                className="bg-muted px-3 py-2 rounded border select-text"
              >
                {item.gpu_name || (
                  <span className="text-muted-foreground">-</span>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="detail-uuid">
                {t("admin.nodeDetail.uuid", "UUID")}
              </Label>
              <span
                id="detail-uuid"
                className="bg-muted px-3 py-2 rounded border select-text"
              >
                {item.uuid || <span className="text-muted-foreground">-</span>}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-createdAt">
                  {t("admin.nodeDetail.createdAt", "创建时间")}
                </Label>
                <span
                  id="detail-createdAt"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.created_at ? (
                    new Date(item.created_at).toLocaleString()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="detail-updatedAt">
                  {t("admin.nodeDetail.updatedAt", "更新时间")}
                </Label>
                <span
                  id="detail-updatedAt"
                  className="bg-muted px-3 py-2 rounded border select-text"
                >
                  {item.updated_at ? (
                    new Date(item.updated_at).toLocaleString()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </span>
              </div>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>{t("admin.nodeDetail.done", "完成")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
