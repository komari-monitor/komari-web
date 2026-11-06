import React from "react";
import { toast } from "sonner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { Dialog, Flex, Button } from "@radix-ui/themes";
import { UserAgentHelper } from "@/utils/UserAgentHelper";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import { AnimatePresence, motion } from "motion/react";
import { CONTENT_MOTION } from "@/lib/motion";
import PageHeader from "@/components/PageHeader";
import { ApiError, api } from "@/lib/http";
import { useRouteQuery } from "@/lib/routeData";
import { sessionsQuery } from "@/routeQueries/admin";
/** 骨架占位行数：常见的会话数量 */
const SESSION_PLACEHOLDER_ROWS = 5;

/** 骨架行：与真实行同样的 7 列，文字长度贴近真实内容（会话 ID 前缀、UA、IP、时间） */
const SessionPlaceholderRow = ({ row }: { row: number }) => (
  <TableRow>
    <TableCell>{skeletonText(11)}</TableCell>
    <TableCell>{skeletonText(18 - (row % 3) * 3)}</TableCell>
    <TableCell>{skeletonText(13)}</TableCell>
    <TableCell>{skeletonText(13)}</TableCell>
    <TableCell>{skeletonText(18)}</TableCell>
    <TableCell>{skeletonText(26)}</TableCell>
    <TableCell>{skeletonText(4)}</TableCell>
  </TableRow>
);

export default function Sessions() {
  const [t] = useTranslation();
  // 页面切换时数据已经由 routePreload 提前请求；等待预算内到达直接显示，否则显示骨架
  const sessionsResult = useRouteQuery(sessionsQuery);
  const sessions = sessionsResult.data ?? null;
  const setSessions = sessionsResult.setData;
  const sessionsFailed = Boolean(sessionsResult.error);
  React.useEffect(() => {
    const error = sessionsResult.error;
    if (!error) return;
    const message = error instanceof ApiError
      ? `Error: ${error.status} ${error.statusText}`
      : error instanceof Error ? error.message : String(error);
    console.error("Error fetching sessions:", error);
    toast.error(message);
  }, [sessionsResult.error]);

  function deleteSession(sessionId: string) {
    const isCurrent = sessionId === sessions?.current;
    // 原逻辑不看 HTTP 状态，只按响应体的 status 判断成功
    api
      .post<{ status?: string }>(
        "/api/admin/session/remove",
        { session: sessionId },
        { expectSuccess: false },
      )
      .catch((error) => {
        if (error instanceof ApiError) return error.body as { status?: string };
        throw error;
      })
      .then((data) => {
        if (data?.status === "success") {
          toast.success(t("sessions.deleted_successfully"));
          if (isCurrent) {
            window.location.href = "/"; // 登出
            return;
          }
          setSessions((prev) => ({
            ...prev!,
            data: prev?.data.filter((s) => s.session !== sessionId) || [],
          }));
        } else {
          console.error("Failed to delete session:", data);
          toast.error(t("sessions.delete_failed"));
        }
      })
      .catch((error) => {
        console.error("Error deleting session:", error);
        toast.error(error.message);
      });
  }
  function deleteAllSessions() {
    api
      .post("/api/admin/session/remove/all", undefined, {
        headers: { "Content-Type": "application/json" },
        expectSuccess: false,
      })
      .then(() => {
        window.location.href = "/"; // 登出
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          toast.error("Error:" + error.status);
          return;
        }
        toast.error(error.message);
      });
  }

  // 会话未到时表格用占位行渲染，Skeletonize 把表格画成色块
  const loading = !sessions && !sessionsFailed;

  return (
    // 页头直接渲染；只有会话表格在加载中显示色块
    <div className="km-page km-page-admin-sessions">
      <PageHeader
        title={t("sessions.title")}
        actions={
        <Dialog.Root>
          <Dialog.Trigger>
            <Button color="red">{t("sessions.delete_all")}</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t("sessions.delete_all")}</Dialog.Title>
            <Dialog.Description>
              {t("sessions.delete_all_desc")}
            </Dialog.Description>
            <Flex gap="2" justify="end" mt="5">
              <Dialog.Trigger>
                <Button variant="soft">{t("common.cancel")}</Button>
              </Dialog.Trigger>
              <Dialog.Trigger>
                <Button color="red" onClick={deleteAllSessions}>
                  {t("common.delete")}
                </Button>
              </Dialog.Trigger>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
        }
      />
      {/* 占位行数 -> 真实会话数、删除会话：表格高度弹簧过渡 */}
      <AutoHeight className="km-sessions-table overflow-hidden rounded-lg">
        <Skeletonize loading={loading} className="km-setting-card-skeleton">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sessions.session_id")}</TableHead>
              <TableHead>UA</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Latest IP</TableHead>
              <TableHead>{t("sessions.expires_at")}</TableHead>
              <TableHead>{t("sessions.last_login")}</TableHead>
              <TableHead>{t("sessions.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 占位行没有退场：数据到达的那一帧直接换成真实行（真实行入场） */}
            {loading
              ? Array.from({ length: SESSION_PLACEHOLDER_ROWS }, (_, row) => (
                  <SessionPlaceholderRow key={row} row={row} />
                ))
              : null}
            {/*
              content 性格：会话行是表格数据，删除/新增时用 layout 弹簧重排，
              退出行走默认 mode（tbody 不是 flex/grid，用 popLayout 会让 tr 脱离文档流），
              所以是「先让位、再消失」，而不是整张表瞬间跳一下。
            */}
            <AnimatePresence initial={false}>
            {(sessions?.data ?? []).map((s) => {
              const isCurrent = s.session === sessions?.current;
              return (
                <motion.tr
                  key={s.uuid}
                  // 只补间位置（行内有文字，尺寸补间会拉伸文字；高度变化直接生效）
                  layout="position"
                  initial={CONTENT_MOTION.item.initial}
                  animate={CONTENT_MOTION.item.animate}
                  exit={{
                    ...CONTENT_MOTION.item.exit,
                    transition: CONTENT_MOTION.exitTransition,
                  }}
                  transition={CONTENT_MOTION.transition}
                  data-slot="table-row"
                  className="km-session-item km-ui-table-row transition-colors border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
                >
                  <TableCell>
                    <Dialog.Root>
                      <Dialog.Trigger>
                        <label className="hover:underline cursor-pointer">
                          {s.session.slice(0, 8)}...
                          {isCurrent && (
                            <span className="ml-2 text-sm text-blue-600">
                              {t("sessions.current")}
                            </span>
                          )}
                        </label>
                      </Dialog.Trigger>
                      <Dialog.Content>
                        <Dialog.Title>
                          {t("sessions.active_sessions")}
                        </Dialog.Title>
                        <Flex direction="column" gap="1">
                          <label className="text-base font-bold">
                            {t("sessions.session_id")}
                          </label>
                          <label className="text-sm">{s.session}</label>
                          <label className="text-base font-bold">
                            IP / {t("sessions.latest_ip")}
                          </label>
                          <label className="text-sm">
                            {s.ip} / {s.latest_ip}
                          </label>
                          <label className="text-base font-bold">
                            User Agent
                          </label>
                          <label className="text-sm">{s.user_agent}</label>
                          <label className="text-sm text-muted-foreground font-bold">
                            {UserAgentHelper.format(s.user_agent, t)}
                          </label>
                          <label className="text-base font-bold">
                            {t("sessions.last_user_agent")}
                          </label>
                          <label className="text-sm">
                            {s.latest_user_agent}
                          </label>
                          <label className="text-sm text-muted-foreground font-bold">
                            {UserAgentHelper.format(s.latest_user_agent, t)}
                          </label>

                          <label className="text-base font-bold">
                            {t("sessions.login_method")}
                          </label>
                          <label className="text-sm">{s.login_method}</label>
                          <label className="text-base font-bold">
                            {t("sessions.latest_online")}
                          </label>
                          <label className="text-sm">
                            {new Date(s.latest_online).toLocaleString()}
                            {" "}({formatDuration((Date.now() - new Date(s.latest_online).getTime()),t)})
                          </label>
                          <label className="text-base font-bold">
                            {t("sessions.created_at")}
                          </label>
                          <label className="text-sm">
                            {new Date(s.created_at).toLocaleString()}
                          </label>
                          <label className="text-base font-bold">
                            {t("sessions.expires_at")}
                          </label>
                          <label className="text-sm">
                            {new Date(s.expires).toLocaleString()}
                          </label>
                          <Flex gap="2" justify="end" mt="5">
                            <Dialog.Trigger>
                              <Button variant="soft">{t("common.close")}</Button>
                            </Dialog.Trigger>
                          </Flex>
                        </Flex>
                      </Dialog.Content>
                    </Dialog.Root>
                  </TableCell>
                  <TableCell>{UserAgentHelper.format(s.user_agent, t)}</TableCell>
                  <TableCell>{s.ip}</TableCell>
                  <TableCell>{s.latest_ip}</TableCell>
                  <TableCell>{new Date(s.expires).toLocaleString()}</TableCell>
                  <TableCell>
                    {new Date(s.latest_online).toLocaleString()}{" "}({formatDuration((Date.now() - new Date(s.latest_online).getTime()),t)})
                  </TableCell>
                  <TableCell>
                    <Dialog.Root>
                      {!isCurrent && (
                        <Dialog.Trigger>
                          <Button color="red" variant="ghost">
                            {t("common.delete")}
                          </Button>
                        </Dialog.Trigger>
                      )}
                      <Dialog.Content>
                        <Dialog.Title>
                          {t("common.confirm_delete")}
                        </Dialog.Title>
                        <Dialog.Description>
                          {t("sessions.delete_one_desc")}
                        </Dialog.Description>
                        <Flex gap="2" justify="end" mt="5">
                          <Dialog.Trigger>
                            <Button variant="soft">
                              {t("common.cancel")}
                            </Button>
                          </Dialog.Trigger>
                          <Dialog.Trigger>
                            <Button
                              color="red"
                              onClick={() => deleteSession(s.session)}
                            >
                              {t("common.delete")}
                            </Button>
                          </Dialog.Trigger>
                        </Flex>
                      </Dialog.Content>
                    </Dialog.Root>
                  </TableCell>
                </motion.tr>
              );
            })}
            </AnimatePresence>
          </TableBody>
        </Table>
        </Skeletonize>
      </AutoHeight>
    </div>
  );
}

function formatDuration(number: number,t:any ): string {
  const ms = Math.abs(number);
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return t("just_now");
  }

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}${t("nodeCard.time_day")}${remainingHours}${t("nodeCard.time_hour")}${t("time.ago")}`;
    }
    return `${days}${t("nodeCard.time_day")} ${t("time.ago")}`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}${t("nodeCard.time_hour")}${remainingMinutes}${t("nodeCard.time_minute")}${t("time.ago")}`;
    }
    return `${hours}${t("nodeCard.time_hour")}${t("time.ago")}`;
  }

  const remainingSeconds = seconds % 60;
  return `${minutes}${t("nodeCard.time_minute")}${remainingSeconds}${t("nodeCard.time_second")}${t("time.ago")}`;
}