"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { UAParser } from "ua-parser-js";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import type { Session } from "@/contexts/SessionContext";

// 设备信息解析函数
const parseUserAgent = (uaString: string) => {
  if (!uaString) return { browser: "未知", os: "未知" };
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  const browser = result.browser.name
    ? `${result.browser.name} ${result.browser.version || ""}`.trim()
    : "未知浏览器";
  const os = result.os.name
    ? `${result.os.name} ${result.os.version || ""}`.trim()
    : "未知操作系统";
  return { browser, os };
};

// 详情组件
const SessionDetails = ({ session }: { session: Session }) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 py-4 text-sm">
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="uuid" className="text-right">
          {t("admin.session.table.uuid")}
        </Label>
        <span id="uuid" className="col-span-2 break-all">
          {session.uuid}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="session" className="text-right">
          {t("admin.session.table.session_id")}
        </Label>
        <span id="session" className="col-span-2 break-all">
          {session.session}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="ip" className="text-right">
          {t("admin.session.table.first_ip")}
        </Label>
        <span id="ip" className="col-span-2">
          {session.ip}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="login_method" className="text-right">
          {t("admin.session.table.login_method")}
        </Label>
        <span id="login_method" className="col-span-2">
          {session.login_method}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="created_at" className="text-right">
          {t("admin.session.table.created_at")}
        </Label>
        <span id="created_at" className="col-span-2">
          {new Date(session.created_at).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="expires" className="text-right">
          {t("admin.session.table.expires")}
        </Label>
        <span id="expires" className="col-span-2">
          {new Date(session.expires).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="latest_online" className="text-right">
          {t("admin.session.table.latest_online")}
        </Label>
        <span id="latest_online" className="col-span-2">
          {new Date(session.latest_online).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <Label htmlFor="user_agent" className="text-right">
          {t("admin.session.table.user_agent")}
        </Label>
        <span id="user_agent" className="col-span-2 break-all">
          {session.user_agent}
        </span>
      </div>
    </div>
  );
};

export const getColumns = (
  t: (key: string) => string,
  currentSessionId: string | null,
  onDelete: (sessionId: string) => void
): ColumnDef<Session>[] => {
  return [
    {
      accessorKey: "session",
      header: t("admin.session.table.session_id"),
      cell: ({ row }) => {
        const session = row.original;
        const isCurrent = session.session === currentSessionId;
        const isDesktop =
          typeof window !== "undefined" && window.innerWidth >= 768;

        const content = (
          <div className="flex items-center gap-2">
            <span className="max-w-[120px] truncate font-medium">
              {session.session}
            </span>
            {isCurrent && <Badge variant="outline">{t("admin.session.table.current")}</Badge>}
          </div>
        );

        if (isDesktop) {
          return (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="link"
                  className="p-0 h-auto font-medium text-primary"
                >
                  {content}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                  <DialogTitle>{t("admin.session.table.session_detail")}</DialogTitle>
                </DialogHeader>
                <SessionDetails session={session} />
              </DialogContent>
            </Dialog>
          );
        }

        return (
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="link"
                className="p-0 h-auto font-medium text-primary"
              >
                {content}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{t("admin.session.table.session_detail")}</DrawerTitle>
              </DrawerHeader>
              <div className="px-4">
                <SessionDetails session={session} />
              </div>
            </DrawerContent>
          </Drawer>
        );
      },
    },
    {
      accessorKey: "ip",
      header: t("admin.session.table.first_ip"),
    },
    {
      accessorKey: "user_agent",
      header: t("admin.session.table.device"),
      cell: ({ row }) => {
        const { os, browser } = parseUserAgent(row.getValue("user_agent"));
        return (
          <div>
            <div>{os}</div>
            <div className="text-xs text-muted-foreground">{browser}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "login_method",
      header: t("admin.session.table.login_method"),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="!p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("admin.session.table.created_at")}
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at"));
        return <div className="text-left">{date.toLocaleDateString()}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const session = row.original;
        const isCurrent = session.session === currentSessionId;

        if (isCurrent) return null;

        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 />
                <span className="sr-only">{t("admin.session.table.delete")}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("admin.session.table.delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.session.table.delete_confirm_desc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("admin.session.table.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(session.session)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {t("admin.session.table.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];
};
