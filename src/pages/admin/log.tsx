import React from "react";
import {
  Badge,
  Button,
  Callout,
  DataList,
  Dialog,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { GapCollapse } from "@/components/admin/SettingCard";
import { AutoHeight } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MOTION_TRANSITION } from "@/lib/motion";
import { useRouteQuery } from "@/lib/routeData";
import { LOGS_DEFAULT_LIMIT, logsQuery, type LogEntry } from "@/routeQueries/ops";

const NO_LOGS: LogEntry[] = [];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const PLACEHOLDER_ROWS = 6;

const LOG_TYPE_META = {
  info: { color: "blue" },
  warn: { color: "amber" },
  error: { color: "red" },
  login: { color: "green" },
  logout: { color: "gray" },
  terminal: { color: "violet" },
  renewal: { color: "teal" },
} as const;

const TYPE_FILTERS = ["", ...Object.keys(LOG_TYPE_META)] as const;

const typeColor = (type: string) =>
  LOG_TYPE_META[type as keyof typeof LOG_TYPE_META]?.color ?? "gray";

const typeLabel = (type: string, t: (key: string) => string) => {
  if (!type) return t("logs.type.unknown");
  const key = `logs.type.${type}`;
  const translated = t(key);
  return translated === key ? type : translated;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "-" : date.toLocaleString();
};

const shortUUID = (uuid: string) =>
  uuid ? `${uuid.slice(0, 8)}...${uuid.slice(-4)}` : "-";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const copyText = async (text: string, success: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch (error) {
    console.error("Failed to copy log data:", error);
  }
};

const logAsText = (log: LogEntry, t: (key: string) => string) =>
  [
    `ID: ${log.id}`,
    `${t("logs.field_type")}: ${typeLabel(log.msg_type, t)}`,
    `${t("logs.field_time")}: ${formatDateTime(log.time)}`,
    `${t("logs.field_ip")}: ${log.ip || "-"}`,
    `${t("logs.field_uuid")}: ${log.uuid || "-"}`,
    "",
    log.message,
  ].join("\n");

function LogTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  return (
    <Badge color={typeColor(type)} variant="soft">
      {typeLabel(type, t)}
    </Badge>
  );
}

const LogPlaceholderRow = ({ row }: { row: number }) => (
  <TableRow>
    <TableCell>
      <Badge color="gray" variant="soft">
        {skeletonText(4)}
      </Badge>
    </TableCell>
    <TableCell>{skeletonText(46 - (row % 3) * 8)}</TableCell>
    <TableCell className="hidden md:table-cell">{skeletonText(12)}</TableCell>
    <TableCell className="hidden xl:table-cell">{skeletonText(16)}</TableCell>
    <TableCell>{skeletonText(17)}</TableCell>
    <TableCell>{skeletonText(4)}</TableCell>
  </TableRow>
);

export default function LogPage() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<number>(LOGS_DEFAULT_LIMIT);
  const [msgType, setMsgType] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [appliedSearch, setAppliedSearch] = React.useState("");
  const [selectedLog, setSelectedLog] = React.useState<LogEntry | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(id);
  }, [search]);

  const logsResult = useRouteQuery(
    logsQuery(limit, page, msgType, appliedSearch),
  );
  const logs = logsResult.data?.logs ?? NO_LOGS;
  const total = logsResult.data?.total ?? 0;
  const loading = logsResult.loading;
  const firstLoading = loading && logs.length === 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const hasFilters = Boolean(msgType || appliedSearch);
  const showTable = loading || !logsResult.error || logs.length > 0;

  React.useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
  }, [loading, page, totalPages]);

  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setMsgType("");
    setPage(1);
  };

  return (
    <div className="km-page km-page-admin-log">
      <PageHeader
        title={t("logs.title")}
        actions={
          <Tooltip content={t("common.refresh")}>
            <IconButton
              variant="soft"
              disabled={loading}
              aria-label={t("common.refresh")}
              onClick={() => void logsResult.reload()}
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : undefined}
              />
            </IconButton>
          </Tooltip>
        }
      />

      <div className="flex flex-col gap-km-block">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TextField.Root
            type="text"
            value={search}
            placeholder={t("logs.search_placeholder")}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:max-w-72"
          >
            <TextField.Slot>
              <Search size={15} />
            </TextField.Slot>
            {search ? (
              <TextField.Slot side="right">
                <IconButton
                  size="1"
                  variant="ghost"
                  aria-label={t("common.clear_search")}
                  title={t("common.clear_search")}
                  onClick={() => setSearch("")}
                >
                  <X size={12} />
                </IconButton>
              </TextField.Slot>
            ) : null}
          </TextField.Root>
          <Select.Root
            value={msgType || "all"}
            onValueChange={(value) => {
              setMsgType(value === "all" ? "" : value);
              setPage(1);
            }}
          >
            <Select.Trigger
              className="w-full sm:w-40"
              aria-label={t("logs.filter_type")}
              title={t("logs.filter_type")}
            />
            <Select.Content>
              {TYPE_FILTERS.map((type) => (
                <Select.Item key={type || "all"} value={type || "all"}>
                  {type ? typeLabel(type, t) : t("logs.filter_all_types")}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {hasFilters ? (
            <Button variant="ghost" color="gray" onClick={clearFilters}>
              {t("logs.clear_filters")}
            </Button>
          ) : null}
        </div>

        <GapCollapse show={Boolean(logsResult.error)}>
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text className="min-w-0 break-words">
              {t("logs.load_failed")}
              {logsResult.error ? `: ${errorMessage(logsResult.error)}` : null}
            </Callout.Text>
            <Button
              size="1"
              variant="soft"
              color="red"
              className="ml-auto shrink-0"
              onClick={() => void logsResult.reload()}
            >
              {t("common.retry")}
            </Button>
          </Callout.Root>
        </GapCollapse>

        {showTable ? (
          <AutoHeight className="overflow-hidden rounded-lg">
            <Skeletonize loading={loading} className="km-setting-card-skeleton">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t("common.type")}</TableHead>
                    <TableHead>{t("logs.field_message")}</TableHead>
                    <TableHead className="hidden w-36 md:table-cell">
                      {t("logs.field_ip")}
                    </TableHead>
                    <TableHead className="hidden w-40 xl:table-cell">
                      {t("logs.field_uuid")}
                    </TableHead>
                    <TableHead className="w-44">{t("logs.field_time")}</TableHead>
                    <TableHead className="w-16 text-right">
                      {t("common.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firstLoading
                    ? Array.from(
                        { length: Math.min(limit, PLACEHOLDER_ROWS) },
                        (_, row) => <LogPlaceholderRow key={row} row={row} />,
                      )
                    : null}
                  {!firstLoading && logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <Flex direction="column" align="center" gap="2">
                          <Text size="2" color="gray">
                            {hasFilters ? t("logs.no_matches") : t("logs.empty")}
                          </Text>
                          {hasFilters ? (
                            <Button
                              variant="soft"
                              size="1"
                              onClick={clearFilters}
                            >
                              {t("logs.clear_filters")}
                            </Button>
                          ) : null}
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {/* 翻页只做横向内容替换的淡入，不做纵向位移 */}
                  {!firstLoading
                    ? logs.map((log, index) => (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{
                            ...MOTION_TRANSITION.fadeIn,
                            delay: Math.min(index * 0.018, 0.12),
                          }}
                          data-slot="table-row"
                          className="km-ui-table-row border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
                        >
                          <TableCell>
                            <LogTypeBadge type={log.msg_type} />
                          </TableCell>
                          <TableCell className="min-w-64 max-w-[42rem] whitespace-normal">
                            <Text
                              as="p"
                              size="2"
                              className="m-0 line-clamp-2 break-words"
                              title={log.message}
                            >
                              {log.message || "-"}
                            </Text>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Text size="2">{log.ip || "-"}</Text>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <Text size="2" color="gray" title={log.uuid}>
                              {shortUUID(log.uuid)}
                            </Text>
                          </TableCell>
                          <TableCell>
                            <Text
                              as="p"
                              size="2"
                              className="m-0 whitespace-nowrap"
                            >
                              {formatDateTime(log.time)}
                            </Text>
                            <Text as="p" size="1" color="gray" className="m-0">
                              #{log.id}
                            </Text>
                          </TableCell>
                          <TableCell className="text-right">
                            <Tooltip content={t("common.details")}>
                              <IconButton
                                variant="ghost"
                                aria-label={t("common.details")}
                                onClick={() => setSelectedLog(log)}
                              >
                                <Eye size={16} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </motion.tr>
                      ))
                    : null}
                </TableBody>
              </Table>
            </Skeletonize>
          </AutoHeight>
        ) : null}

        <Skeletonize loading={firstLoading}>
          <Flex justify="between" align="center" gap="3" wrap="wrap" px="1">
            <Text size="2" color="gray" aria-live="polite">
              {total > 0
                ? t("logs.showing", {
                    from: rangeStart,
                    to: rangeEnd,
                    total,
                  })
                : t("logs.no_entries")}
            </Text>
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="2" color="gray" className="whitespace-nowrap">
                {t("logs.per_page")}
              </Text>
              <Select.Root
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <Select.Trigger
                  aria-label={t("logs.per_page")}
                  title={t("logs.per_page")}
                />
                <Select.Content>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <Select.Item key={size} value={String(size)}>
                      {size}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <IconButton
                variant="soft"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label={t("common.previous_page")}
                title={t("common.previous_page")}
              >
                <ChevronLeft size={16} />
              </IconButton>
              <Text
                size="2"
                color="gray"
                className="km-tabular-nums whitespace-nowrap"
              >
                {page} / {totalPages}
              </Text>
              <IconButton
                variant="soft"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                aria-label={t("common.next_page")}
                title={t("common.next_page")}
              >
                <ChevronRight size={16} />
              </IconButton>
            </Flex>
          </Flex>
        </Skeletonize>
      </div>

      <LogDetailDialog
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onCopy={(log) => void copyText(logAsText(log, t), t("copy_success"))}
      />
    </div>
  );
}

function LogDetailDialog({
  log,
  onClose,
  onCopy,
}: {
  log: LogEntry | null;
  onClose: () => void;
  onCopy: (log: LogEntry) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={Boolean(log)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="42rem">
        <Dialog.Title>{t("logs.detail_title")}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {log ? `#${log.id} · ${formatDateTime(log.time)}` : null}
        </Dialog.Description>

        {log ? (
          <Flex direction="column" gap="4" mt="4">
            <DataList.Root size="2">
              <DataList.Item>
                <DataList.Label>{t("logs.field_type")}</DataList.Label>
                <DataList.Value>
                  <LogTypeBadge type={log.msg_type} />
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>{t("logs.field_ip")}</DataList.Label>
                <DataList.Value>{log.ip || "-"}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>{t("logs.field_uuid")}</DataList.Label>
                <DataList.Value className="break-all">
                  {log.uuid || "-"}
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                {t("logs.field_message")}
              </Text>
              <Text
                as="p"
                size="2"
                className="m-0 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words"
              >
                {log.message || "-"}
              </Text>
            </Flex>
          </Flex>
        ) : null}

        <Flex gap="2" justify="end" mt="5">
          {log ? (
            <Button variant="soft" onClick={() => onCopy(log)}>
              <Copy size={15} />
              {t("common.copy")}
            </Button>
          ) : null}
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t("common.close")}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
