import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button, Dialog, Flex } from "@radix-ui/themes";
import { Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NumberPicker from "@/components/ui/number-picker";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_TRANSITION } from "@/lib/motion";
import PageHeader from "@/components/PageHeader";
import { useRouteQuery } from "@/lib/routeData";
import { LOGS_DEFAULT_LIMIT, logsQuery, type LogEntry } from "@/routeQueries/ops";

const NO_LOGS: LogEntry[] = [];
/** 骨架行：与真实行同样的 5 列（ID、IP、类型、消息、时间） */
const LogPlaceholderRow = ({ row }: { row: number }) => (
  <TableRow>
    <TableCell>{skeletonText(3)}</TableCell>
    <TableCell>{skeletonText(13)}</TableCell>
    <TableCell>{skeletonText(6)}</TableCell>
    <TableCell>{skeletonText(40 - (row % 3) * 8)}</TableCell>
    <TableCell>{skeletonText(18)}</TableCell>
  </TableRow>
);

const LogPage = () => {
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(LOGS_DEFAULT_LIMIT);
  // 与原实现一致：只有翻页才重新请求，请求时带上当时的 limit（单改 limit 不请求）
  const [request, setRequest] = React.useState({ page, limit });
  if (request.page !== page) setRequest({ page, limit });
  const [t] = useTranslation();
  const navigate = useNavigate();
  // 首屏由 routePreload 在切换页面时提前请求（src/routeQueries/ops.ts）；翻页时保留旧行、显示骨架
  const logsResult = useRouteQuery(logsQuery(request.limit, request.page));
  const loading = logsResult.loading;
  const logs = logsResult.data?.logs ?? NO_LOGS;
  const total = logsResult.data?.total ?? 1;
  // 与原实现一致：出错后一直显示错误
  const [error, setError] = React.useState<string | null>(null);
  if (logsResult.error && !error) {
    setError(logsResult.error instanceof Error ? logsResult.error.message : "Unknown error");
  }

  const totalPages = Math.ceil(total / limit);
  // 计算分页页码，显示当前页及前后1页，两端省略号
  const siblingsCount = 1;
  let pageNumbers: (number | string)[] = [];
  const leftSibling = Math.max(page - siblingsCount, 1);
  const rightSibling = Math.min(page + siblingsCount, totalPages);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;
  // 始终包含第一页
  pageNumbers.push(1);
  // 左侧省略或中间连续页
  if (showLeftDots) {
    pageNumbers.push("...");
  } else {
    for (let i = 2; i < leftSibling; i++) pageNumbers.push(i);
  }
  // 中间页，仅当不重复首尾页时加入
  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i > 1 && i < totalPages) pageNumbers.push(i);
  }
  // 右侧省略或中间连续页
  if (showRightDots) {
    pageNumbers.push("...");
  } else {
    for (let i = rightSibling + 1; i < totalPages; i++) pageNumbers.push(i);
  }
  // 始终包含最后一页（如果大于1）
  if (totalPages > 1) pageNumbers.push(totalPages);

  if (error) {
    return <div>Error: {error}</div>;
  }

  // 首次加载：表格是占位行画成的色块；翻页：保留旧行，表格淡成色块，新行到达后淡入
  const firstLoading = loading && logs.length === 0;

  return (
    // 页头直接渲染；只有表格（和依赖总数的分页）在加载中显示色块
    <div className="km-page km-page-admin-log">
      <PageHeader
        className="km-log-toolbar"
        title={t("logs.title")}
        actions={
          <>
            <Button variant="soft" onClick={() => navigate("/admin/pprof")}>
              <Activity size={16} />
              {t("pprof.title")}
            </Button>
            Limit
            <NumberPicker
              defaultValue={limit}
              onChange={setLimit}
              min={1}
              max={100}
            />
          </>
        }
      />
      {/* 表格 + 分页是一个区块：两者之间 block，页头与区块之间由 km-page 给 section */}
      <div className="flex flex-col gap-km-block">
      {/* 行数变化（最后一页更短）时表格高度弹簧过渡 */}
      <AutoHeight>
      <Skeletonize loading={loading} className="km-log-output km-setting-card-skeleton rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {firstLoading
              ? Array.from({ length: limit }, (_, row) => <LogPlaceholderRow key={row} row={row} />)
              : null}
            {/*
              content 层：翻页时新一批行淡入。旧行不做退场：退场期间新旧两批行同时在 tbody 里，
              表格会瞬间变成两倍高再缩回去。
            */}
            <AnimatePresence initial={false}>
            {logs.map((log, index) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  ...MOTION_TRANSITION.fadeIn,
                  delay: Math.min(index * 0.015, 0.12),
                }}
                className="km-ui-table-row transition-colors border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
              >
                <TableCell>
                  <Dialog.Root>
                    <Dialog.Trigger>
                      <label className="hover:underline font-bold">
                        {log.id}
                      </label>
                    </Dialog.Trigger>
                    <Dialog.Content>
                      <Dialog.Title>{t("log.title")}</Dialog.Title>
                      <Flex direction="column" gap="1">
                        <label className="font-bold">ID</label>
                        <label className="text-sm">{log.id}</label>
                        <label className="font-bold">IP</label>
                        <label className="text-sm">{log.ip}</label>
                        <label className="font-bold">UUID</label>
                        <label className="text-sm">{log.uuid}</label>
                        <label className="font-bold">Type</label>
                        <label className="text-sm">{log.msg_type}</label>
                        <label className="font-bold">Message</label>
                        <label className="text-sm">{log.message}</label>
                        <label className="font-bold">Time</label>
                        <label className="text-sm">
                          {new Date(log.time).toLocaleString()}
                        </label>
                      </Flex>
                      <Flex gap="2" justify="end" mt="5">
                        <Dialog.Close>
                          <Button variant="soft">{t("common.close")}</Button>
                        </Dialog.Close>
                      </Flex>
                    </Dialog.Content>
                  </Dialog.Root>
                </TableCell>
                <TableCell>{log.ip}</TableCell>
                <TableCell>{log.msg_type}</TableCell>
                <TableCell>
                  {log.message.length > 75
                    ? `${log.message.slice(0, 75)}...`
                    : log.message}
                </TableCell>
                <TableCell>{new Date(log.time).toLocaleString()}</TableCell>
              </motion.tr>
            ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </Skeletonize>
      </AutoHeight>
      {/* 分页数字按钮：首次加载时总页数未知，画成一小块色块 */}
      <Skeletonize loading={firstLoading} className="km-setting-card-skeleton self-center">
      <div className="flex justify-center items-center gap-2">
        <Button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          title={t("common.previous_page", "Previous page")}
          aria-label={t("common.previous_page", "Previous page")}
        >
          {"<"}
        </Button>
        {pageNumbers.map((p, i) =>
          typeof p === "number" ? (
            <Button
              key={i}
              variant={p === page ? "solid" : "soft"}
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ) : (
            <span key={i} className="px-2">
              ...
            </span>
          )
        )}
        <Button
          disabled={page === totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          title={t("common.next_page", "Next page")}
          aria-label={t("common.next_page", "Next page")}
        >
          {">"}
        </Button>
      </div>
      </Skeletonize>
      </div>
    </div>
  );
};
export default LogPage;
