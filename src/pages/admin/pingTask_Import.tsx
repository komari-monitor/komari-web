import NodeSelectorDialog from "@/components/NodeSelectorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePingTask } from "@/contexts/PingTaskContext";
import { parse as parseJsonC, printParseErrorCode, type ParseError } from "jsonc-parser";
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  HoverCard,
  TextArea,
  Tooltip,
} from "@radix-ui/themes";
import { AlertCircle, CheckCircle2, FileUp, Info } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

type ImportStatus = "pending" | "success" | "failed";
type ImportNotice = {
  color: "red" | "green";
  message: string;
};

type ImportRow = {
  row: number;
  name: string;
  target: string;
  type: "icmp" | "tcp" | "http";
  interval: number;
  source?: "line" | "json" | "json-syntax";
  status: ImportStatus;
  message?: string;
  messageParams?: Record<string, string | number>;
  errorNear?: string;
};

const pingTypes = new Set(["icmp", "tcp", "http"]);
const lineDelimiters = [",", "-", "|"] as const;
const importFieldCount = 4;
const importFieldKeys = {
  name: ["name", "Name", "名称", "名稱", "名前", "nama"],
  target: ["target", "Target", "目标", "目標", "対象"],
  type: ["type", "Type", "类型", "類型", "種別", "jenis"],
  interval: ["interval", "Interval", "间隔", "間隔"],
};
const allowedJsonImportKeys = new Set(Object.values(importFieldKeys).flat());

const getImportField = (value: any, keys: string[]) =>
  keys.map((key) => value?.[key]).find((field) => field !== undefined);

const hasText = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const failedImportRow = (
  row: number,
  message: string,
  source: ImportRow["source"] = "line",
  messageParams?: ImportRow["messageParams"],
  errorNear?: string
): ImportRow => ({
  row,
  name: "",
  target: "",
  type: "icmp",
  interval: 60,
  source,
  status: "failed",
  message,
  messageParams,
  errorNear,
});

const normalizeImportRow = (
  value: any,
  row: number,
  source: ImportRow["source"] = "line",
  errorNear?: string
): ImportRow => {
  if (source === "json" && value && typeof value === "object" && !Array.isArray(value)) {
    const extraKeys = Object.keys(value).filter((key) => !allowedJsonImportKeys.has(key));
    if (extraKeys.length > 0) {
      return failedImportRow(
        row,
        "ping.import_error_extra_fields",
        source,
        { fields: extraKeys.join(", ") },
        errorNear
      );
    }
  }
  const name = getImportField(value, importFieldKeys.name);
  const target = getImportField(value, importFieldKeys.target);
  const typeValue = getImportField(value, importFieldKeys.type);
  const intervalValue = getImportField(value, importFieldKeys.interval);
  const type = String(typeValue ?? "").toLowerCase();
  const interval = Number(intervalValue);
  if (!hasText(name) || !hasText(target) || !hasText(typeValue) || !hasText(intervalValue)) {
    return failedImportRow(row, "ping.import_error_fields", source, undefined, errorNear);
  }
  if (!pingTypes.has(type)) {
    return failedImportRow(row, "ping.import_error_type", source, { value: type || "-" }, errorNear);
  }
  if (!Number.isInteger(interval) || interval <= 0) {
    return failedImportRow(
      row,
      "ping.import_error_interval",
      source,
      { value: String(intervalValue ?? "-") },
      errorNear
    );
  }
  return {
    row,
    name: String(name).trim(),
    target: String(target).trim(),
    type: type as ImportRow["type"],
    interval,
    source,
    status: "pending",
  };
};

const getOffsetContext = (text: string, offset: number, length = 1) => {
  const index = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      lineStart = i + 1;
    }
  }
  const nextLineBreak = text.indexOf("\n", lineStart);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const rawLine = text.slice(lineStart, lineEnd).replace(/\r$/, "");
  const column = Math.max(0, index - lineStart);
  const snippetStart = Math.max(0, column - 60);
  const snippetEnd = Math.min(rawLine.length, column + 80);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < rawLine.length ? "..." : "";
  const snippet = `${prefix}${rawLine.slice(snippetStart, snippetEnd)}${suffix}`;
  const markerColumn = prefix.length + Math.max(0, column - snippetStart);
  const markerLength = Math.max(1, Math.min(length, snippet.length - markerColumn));
  return {
    line,
    near: `${snippet}\n${" ".repeat(markerColumn)}${"^".repeat(markerLength)}`,
  };
};

const getLineContext = (line: string, offset: number) => {
  const index = Math.max(0, Math.min(offset, line.length));
  return `${line}\n${" ".repeat(index)}^`;
};

const getDelimiterOffset = (line: string, delimiter: string, fieldIndex: number) => {
  if (fieldIndex === 0) return 0;
  let offset = -1;
  for (let i = 0; i < fieldIndex; i += 1) {
    offset = line.indexOf(delimiter, offset + 1);
    if (offset === -1) return line.length;
  }
  return offset + delimiter.length;
};

const getPreviousNonWhitespace = (text: string, offset: number) => {
  const index = getPreviousNonWhitespaceIndex(text, offset);
  return index === -1 ? "" : text[index];
};

const getPreviousNonWhitespaceIndex = (text: string, offset: number) => {
  for (let i = Math.min(offset - 1, text.length - 1); i >= 0; i -= 1) {
    if (!/\s/.test(text[i])) return i;
  }
  return -1;
};

const getNextNonWhitespace = (text: string, offset: number) => {
  for (let i = Math.max(0, offset); i < text.length; i += 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return "";
};

const getJsonErrorMessage = (text: string, error: ParseError) => {
  const code = printParseErrorCode(error.error);
  if (
    code === "CommaExpected" &&
    getPreviousNonWhitespace(text, error.offset) === "}" &&
    getNextNonWhitespace(text, error.offset) === "{"
  ) {
    return "ping.import_error_json_comma_items";
  }
  if (
    (code === "PropertyNameExpected" || code === "ValueExpected") &&
    getPreviousNonWhitespace(text, error.offset) === "," &&
    getNextNonWhitespace(text, error.offset) === "{"
  ) {
    return "ping.import_error_json_object_end";
  }
  const messages: Record<string, string> = {
    ColonExpected: "ping.import_error_json_colon",
    CommaExpected: "ping.import_error_json_comma",
    CloseBraceExpected: "ping.import_error_json_bracket",
    CloseBracketExpected: "ping.import_error_json_bracket",
    EndOfFileExpected: "ping.import_error_json_extra",
    InvalidCharacter: "ping.import_error_json_symbol",
    InvalidCommentToken: "ping.import_error_json_comment",
    InvalidEscapeCharacter: "ping.import_error_json_string",
    InvalidNumberFormat: "ping.import_error_json_number",
    InvalidSymbol: "ping.import_error_json_symbol",
    PropertyNameExpected: "ping.import_error_json_key",
    UnexpectedEndOfComment: "ping.import_error_json_comment",
    UnexpectedEndOfNumber: "ping.import_error_json_number",
    UnexpectedEndOfString: "ping.import_error_json_string",
    ValueExpected: "ping.import_error_json_value",
  };
  return messages[code] ?? "ping.import_error_json";
};

const jsonImportExample = `[
  {
    "name": "Google DNS",
    "target": "8.8.8.8",
    "type": "icmp",
    "interval": 60
  },
  {
    "name": "Apple",
    "target": "apple.com",
    "type": "tcp",
    "interval": 60
  }
]`;

const parseDelimitedImportLine = (line: string, row: number): ImportRow => {
  const candidates = lineDelimiters
    .map((delimiter) => ({
      delimiter,
      parts: line.split(delimiter).map((part) => part.trim()),
    }))
    .filter((candidate) => candidate.parts.length > 1);
  if (candidates.length === 0) {
    return failedImportRow(row, "ping.import_error_txt_separator", "line", undefined, line);
  }
  const candidate =
    candidates.find((item) => item.parts.length >= importFieldCount) ??
    candidates.sort((a, b) => b.parts.length - a.parts.length)[0];
  const { delimiter, parts } = candidate;
  const emptyIndex = parts.findIndex((part) => part === "");
  if (emptyIndex !== -1) {
    return failedImportRow(
      row,
      "ping.import_error_txt_empty_field",
      "line",
      undefined,
      getLineContext(line, getDelimiterOffset(line, delimiter, emptyIndex))
    );
  }
  if (parts.length < importFieldCount) {
    return failedImportRow(
      row,
      "ping.import_error_fields",
      "line",
      undefined,
      getLineContext(line, line.length)
    );
  }
  if (parts.length > importFieldCount && delimiter !== "-") {
    return failedImportRow(
      row,
      "ping.import_error_extra_fields",
      "line",
      { fields: parts.slice(importFieldCount).join(delimiter) },
      getLineContext(line, getDelimiterOffset(line, delimiter, importFieldCount))
    );
  }
  const interval = parts.pop() ?? "";
  const type = parts.pop() ?? "";
  const name = parts.shift() ?? "";
  const target = parts.join(delimiter).trim();

  return normalizeImportRow({ name, target, type, interval }, row, "line", line);
};

const parseImportText = (text: string): ImportRow[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const errors: ParseError[] = [];
    const parsed = parseJsonC(trimmed, errors, {
      allowTrailingComma: false,
      disallowComments: true,
    });
    if (errors.length > 0) {
      const error = errors[0];
      const message = getJsonErrorMessage(trimmed, error);
      const previousIndex = getPreviousNonWhitespaceIndex(trimmed, error.offset);
      const offset =
        message === "ping.import_error_json_comma_items" && previousIndex !== -1
          ? previousIndex + 1
          : message === "ping.import_error_json_object_end" && previousIndex !== -1
            ? previousIndex
            : error.offset;
      const context = getOffsetContext(trimmed, offset, error.length);
      return [
        failedImportRow(
          context.line,
          message,
          "json-syntax",
          undefined,
          context.near
        ),
      ];
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row, index) => normalizeImportRow(row, index + 1, "json"));
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseDelimitedImportLine(line, index + 1));
};

export const ImportPingTasksDialog = () => {
  const { t } = useTranslation();
  const { refresh } = usePingTask();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [debouncedText, setDebouncedText] = React.useState("");
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [filter, setFilter] = React.useState<"all" | "success" | "failed">("all");
  const [selectedClients, setSelectedClients] = React.useState<string[]>([]);
  const [serverSelectorOpen, setServerSelectorOpen] = React.useState(false);
  const [defaultOn, setDefaultOn] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [needsRefresh, setNeedsRefresh] = React.useState(false);
  const [notice, setNotice] = React.useState<ImportNotice | null>(null);

  const counts = React.useMemo(
    () => ({
      success: rows.filter((row) => row.status === "success").length,
      failed: rows.filter((row) => row.status === "failed").length,
    }),
    [rows]
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedText(text), 1500);
    return () => window.clearTimeout(timer);
  }, [text]);

  const parsedRows = React.useMemo(
    () => parseImportText(debouncedText),
    [debouncedText]
  );
  const parseErrors = React.useMemo(
    () => parsedRows.filter((row) => row.status === "failed"),
    [parsedRows]
  );
  const isTyping = text !== debouncedText;
  const canShowLiveValidation = React.useMemo(() => {
    const value = debouncedText.trim();
    if (!value) return false;
    if (value.startsWith("[") || value.startsWith("{")) {
      return (
        (value.startsWith("[") && value.endsWith("]")) ||
        (value.startsWith("{") && value.endsWith("}"))
      );
    }
    const lines = value.split(/\r?\n/).filter((line) => line.trim());
    const delimiterCount = (value.match(/[,\-|]/g) ?? []).length;
    return lines.length > 1 || delimiterCount > 0;
  }, [debouncedText]);
  const visibleRows =
    filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const showRemarkColumn = visibleRows.some((row) => row.message);
  const statusText = (status: ImportStatus) =>
    status === "success"
      ? t("common.success")
      : t("common.error");
  const importMessage = (row: ImportRow) =>
    row.message?.startsWith("ping.")
      ? t(row.message, row.messageParams)
      : row.message;
  const importErrorLabel = (row: ImportRow) => {
    const key = row.source === "json" ? "ping.import_error_item" : "ping.import_error_line";
    return t(key, { row: row.row });
  };
  const renderImportError = (row: ImportRow, index: number) => {
    const label = importErrorLabel(row);
    return (
      <span className="block text-xs" key={`${row.source}-${row.row}-${index}`}>
        <span className="block">
          {label}: {importMessage(row)}
        </span>
        {row.errorNear && (
          <>
            <span className="mt-1 block text-[11px] text-amber-11">
              {t("ping.import_error_near")}
            </span>
            <code className="block whitespace-pre-wrap break-all rounded bg-amber-2 px-2 py-1 font-mono text-[11px] text-amber-12">
              {row.errorNear}
            </code>
          </>
        )}
      </span>
    );
  };
  const importFormats = [
    {
      label: "TXT",
      content: (
        <div className="whitespace-pre text-sm leading-5">
          {t("ping.import_txt_help")}
        </div>
      ),
    },
    {
      label: "JSON",
      content: (
        <div className="space-y-2 text-sm leading-5">
          <div>{t("ping.import_json_help")}</div>
          <pre className="rounded-md bg-gray-2 p-3 font-mono text-xs leading-5 text-blue-11">
            <code>{jsonImportExample}</code>
          </pre>
        </div>
      ),
    },
    {
      label: "CSV",
      content: (
        <div className="space-y-2 text-sm leading-5">
          <div className="whitespace-pre">{t("ping.import_csv_help")}</div>
          <table className="border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border border-gray-7 px-2 py-1">Google DNS</td>
                <td className="border border-gray-7 px-2 py-1">8.8.8.8</td>
                <td className="border border-gray-7 px-2 py-1">icmp</td>
                <td className="border border-gray-7 px-2 py-1">60</td>
              </tr>
              <tr>
                <td className="border border-gray-7 px-2 py-1">Apple</td>
                <td className="border border-gray-7 px-2 py-1">apple.com</td>
                <td className="border border-gray-7 px-2 py-1">tcp</td>
                <td className="border border-gray-7 px-2 py-1">60</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
  ];

  const importDisabledReason = React.useMemo(() => {
    if (importing) return t("common.importing");
    if (!text.trim()) return t("ping.import_empty");
    if (isTyping) return t("ping.import_checking");
    if (parsedRows.length === 0) return t("ping.import_empty");
    if (
      !defaultOn &&
      selectedClients.length === 0 &&
      parsedRows.some((row) => row.status === "pending")
    ) {
      return t("ping.import_select_server");
    }
    return "";
  }, [defaultOn, importing, isTyping, parsedRows, selectedClients.length, t, text]);

  const updateText = (value: string) => {
    setText(value);
    setRows([]);
    setFilter("all");
    setNotice(null);
  };

  const appendResultRow = (row: ImportRow, update: Partial<ImportRow>) => {
    setRows((current) => [...current, { ...row, ...update }]);
  };

  const clearImportData = () => {
    setText("");
    setDebouncedText("");
    setRows([]);
    setFilter("all");
  };

  const resetDialog = () => {
    clearImportData();
    setSelectedClients([]);
    setServerSelectorOpen(false);
    setDefaultOn(false);
    setImporting(false);
    setNeedsRefresh(false);
    setNotice(null);
  };

  const importRows = async () => {
    const nextRows = parseImportText(text);
    const nextPendingRows = nextRows.filter((row) => row.status === "pending");
    const nextFailedRows = nextRows.filter((row) => row.status === "failed");
    if (nextRows.length === 0) {
      setNotice({
        color: "red",
        message: t("ping.import_empty"),
      });
      return;
    }
    if (nextPendingRows.length === 0) {
      setRows(nextFailedRows);
      setFilter("failed");
      setNotice({
        color: "red",
        message: t("ping.import_invalid_rows", {
          count: nextFailedRows.length,
        }),
      });
      return;
    }
    if (!defaultOn && selectedClients.length === 0) {
      const needsClients = nextRows.some((row) => row.status === "pending");
      if (needsClients) {
        setNotice({
          color: "red",
          message: t("ping.import_select_server"),
        });
        setServerSelectorOpen(true);
        return;
      }
    }

    setRows(nextFailedRows);
    setFilter("all");
    setNotice(null);
    setImporting(true);
    let successCount = 0;
    let failedCount = nextFailedRows.length;
    for (const row of nextRows) {
      if (row.status !== "pending") continue;
      try {
        const response = await fetch("/api/admin/ping/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            target: row.target,
            type: row.type,
            interval: row.interval,
            default_on: defaultOn,
            clients: selectedClients,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || t("common.error"));
        }
        appendResultRow(row, { status: "success" });
        successCount += 1;
      } catch (error: any) {
        appendResultRow(row, {
          status: "failed",
          message: error?.message || t("common.error"),
        });
        failedCount += 1;
      }
    }
    setImporting(false);
    if (successCount > 0) setNeedsRefresh(true);
    setNotice({
      color: failedCount === 0 ? "green" : "red",
      message:
        failedCount === 0
          ? t("ping.import_success_count", { count: successCount })
          : t("ping.import_finished_count", {
              success: successCount,
              failed: failedCount,
            }),
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          if (needsRefresh) refresh();
          resetDialog();
        }
      }}
    >
      <Dialog.Trigger>
        <Button variant="soft">
          <FileUp size="16" />
          {t("common.import")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content className="max-w-4xl">
        <Dialog.Title>{t("common.import")}</Dialog.Title>
        <Flex direction="column" gap="3">
          {notice && (
            <Callout.Root color={notice.color} size="1" variant="surface">
              <Callout.Icon>
                {notice.color === "green" ? (
                  <CheckCircle2 size="16" />
                ) : (
                  <AlertCircle size="16" />
                )}
              </Callout.Icon>
              <Callout.Text>{notice.message}</Callout.Text>
            </Callout.Root>
          )}
          <div>
            <label
              htmlFor="ping-task-import-file"
              className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue-7 bg-blue-2 text-sm text-blue-11 hover:bg-blue-3"
            >
              <FileUp size="24" />
              <span className="font-medium">
                {t("ping.import_choose_file_prefix")}
                {importFormats.map((format, index) => (
                  <React.Fragment key={format.label}>
                    {index > 0 && <span className="mx-1">/</span>}
                    <HoverCard.Root>
                      <HoverCard.Trigger>
                        <button
                          type="button"
                          className="relative inline-flex cursor-help items-center pr-1.5 font-semibold outline-none"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        >
                          {format.label}
                          <Info
                            size="9"
                            className="absolute -right-0.5 -top-1 text-blue-10"
                          />
                        </button>
                      </HoverCard.Trigger>
                      <HoverCard.Content
                        align="center"
                        side="top"
                        size="1"
                        maxWidth="760px"
                        className="border border-gray-6"
                      >
                        {format.content}
                      </HoverCard.Content>
                    </HoverCard.Root>
                  </React.Fragment>
                ))}
                {t("ping.import_choose_file_suffix")}
              </span>
            </label>
          </div>
          <input
            id="ping-task-import-file"
            className="hidden"
            type="file"
            accept=".json,.txt,.csv,application/json,text/plain,text/csv"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = event.target.files?.[0];
              if (!file) return;
              file.text().then(updateText).catch((error) => {
                setNotice({ color: "red", message: error.message });
              }).finally(() => {
                input.value = "";
              });
            }}
          />
          <TextArea
            value={text}
            onChange={(event) => updateText(event.target.value)}
            className="font-mono text-sm"
            rows={9}
          />
          {text.trim() && !isTyping && canShowLiveValidation && parseErrors.length > 0 && (
            <Callout.Root color="amber" size="1" variant="surface">
              <Callout.Icon>
                <AlertCircle size="16" />
              </Callout.Icon>
              <Callout.Text>
                <span className="block">
                  {t("ping.import_invalid_rows", { count: parseErrors.length })}
                </span>
                {parseErrors.slice(0, 5).map(renderImportError)}
                {parseErrors.length > 5 && (
                  <span className="block text-xs">
                    {t("ping.import_error_more", {
                      count: parseErrors.length - 5,
                    })}
                  </span>
                )}
              </Callout.Text>
            </Callout.Root>
          )}
          <Flex direction="column" gap="2">
            <label className="text-sm font-normal">
              {t("common.server")}
            </label>
            <Flex align="center" gap="2" wrap="wrap">
              <NodeSelectorDialog
                open={serverSelectorOpen}
                onOpenChange={setServerSelectorOpen}
                value={selectedClients}
                onChange={setSelectedClients}
              />
              <span className="text-sm text-muted-foreground">
                {t("common.selected", { count: selectedClients.length })}
              </span>
            </Flex>
            <label className="flex min-h-10 items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={defaultOn}
                onCheckedChange={(checked) => setDefaultOn(!!checked)}
              />
              <span>{t("ping.default_on")}</span>
            </label>
          </Flex>
          {rows.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("ping.target")}</TableHead>
                    <TableHead>{t("ping.type")}</TableHead>
                    <TableHead>{t("ping.interval")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    {showRemarkColumn && (
                      <TableHead>{t("common.remark")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>{row.name || "-"}</TableCell>
                      <TableCell>{row.target || "-"}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.interval}</TableCell>
                      <TableCell>{statusText(row.status)}</TableCell>
                      {showRemarkColumn && (
                        <TableCell>{importMessage(row) || ""}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Flex align="center" gap="2" justify="between" wrap="wrap">
            <Flex gap="2" wrap="wrap">
              {rows.length > 0 &&
                (["all", "success", "failed"] as const).map(
                  (value) => (
                    <Button
                      key={value}
                      variant={filter === value ? "solid" : "soft"}
                      color={
                        value === "failed"
                          ? "red"
                          : value === "success"
                            ? "green"
                            : undefined
                      }
                      onClick={() => setFilter(value)}
                    >
                      {value === "all" ? t("common.all") : statusText(value)}
                      {value !== "all" && ` ${counts[value]}`}
                    </Button>
                  )
                )}
            </Flex>
            {importDisabledReason ? (
              <Tooltip
                content={importDisabledReason}
                maxWidth="280px"
                delayDuration={120}
              >
                <span className="inline-flex">
                  <Button onClick={importRows} disabled>
                    <FileUp size="16" />
                    {importing ? t("common.importing") : t("common.import")}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button onClick={importRows}>
                <FileUp size="16" />
                {t("common.import")}
              </Button>
            )}
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
