import React from "react";
import { Badge, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Loading from "@/components/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/utils/unitHelper";

type BillingArchive = {
  id: number;
  client_uuid: string;
  client_name: string;
  cycle_key: string;
  period_start: string;
  period_end: string;
  timezone: string;
  reset_day: number;
  upload_bytes: number;
  download_bytes: number;
  traffic_limit: number;
  limit_type: string;
  billable_bytes: number;
  exceeded: boolean;
  archived_at: string;
};

type BillingHistoryResponse = {
  status: string;
  data: {
    archives: BillingArchive[];
    total: number;
    page: number;
    limit: number;
  };
  message?: string;
};

const PAGE_SIZE = 20;

export default function BillingHistory() {
  const { t } = useTranslation();
  const [clientUUID, setClientUUID] = React.useState("");
  const [cycleKey, setCycleKey] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<BillingHistoryResponse["data"] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (clientUUID.trim()) {
      params.set("client_uuid", clientUUID.trim());
    }
    if (cycleKey.trim()) {
      params.set("cycle_key", cycleKey.trim());
    }

    try {
      const response = await fetch(`/api/admin/billing/history?${params}`);
      const payload = (await response.json()) as BillingHistoryResponse;
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || `HTTP ${response.status}`);
      }
      setData(payload.data);
    } catch (error) {
      console.error("Failed to load billing history:", error);
      toast.error(t("billing_history.load_failed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientUUID, cycleKey, page, t]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="km-page-admin-billing-history p-0 md:p-4">
      <h1 className="mb-2 text-2xl font-semibold">{t("billing_history.title")}</h1>
      <Text as="p" color="gray" className="mb-4">
        {t("billing_history.description")}
      </Text>

      <Flex gap="3" wrap="wrap" align="end" className="mb-4">
        <label className="min-w-64 flex-1">
          <Text as="div" size="2" weight="medium" className="mb-1">
            {t("billing_history.client_uuid")}
          </Text>
          <TextField.Root
            value={clientUUID}
            onChange={(event) => setClientUUID(event.target.value)}
            placeholder={t("billing_history.client_uuid_placeholder")}
          />
        </label>
        <label className="min-w-64 flex-1">
          <Text as="div" size="2" weight="medium" className="mb-1">
            {t("billing_history.cycle_key")}
          </Text>
          <TextField.Root
            value={cycleKey}
            onChange={(event) => setCycleKey(event.target.value)}
            placeholder={t("billing_history.cycle_key_placeholder")}
          />
        </label>
        <Button
          onClick={() => {
            if (page === 1) {
              void loadHistory();
            } else {
              setPage(1);
            }
          }}
        >
          {t("common.search")}
        </Button>
      </Flex>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--gray-a5)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("billing_history.client")}</TableHead>
                  <TableHead>{t("billing_history.period")}</TableHead>
                  <TableHead>{t("billing_history.upload")}</TableHead>
                  <TableHead>{t("billing_history.download")}</TableHead>
                  <TableHead>{t("billing_history.billable")}</TableHead>
                  <TableHead>{t("billing_history.limit")}</TableHead>
                  <TableHead>{t("billing_history.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.archives ?? []).map((archive) => (
                  <TableRow key={archive.id}>
                    <TableCell>
                      <div className="font-medium">{archive.client_name || archive.client_uuid}</div>
                      <div className="text-xs text-[var(--gray-a11)]">{archive.client_uuid}</div>
                    </TableCell>
                    <TableCell>
                      <div>{formatDate(archive.period_start)}</div>
                      <div className="text-xs text-[var(--gray-a11)]">
                        {formatDate(archive.period_end)} · {archive.timezone}
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(archive.upload_bytes)}</TableCell>
                    <TableCell>{formatBytes(archive.download_bytes)}</TableCell>
                    <TableCell>
                      {formatBytes(archive.billable_bytes)}
                      <div className="text-xs uppercase text-[var(--gray-a11)]">{archive.limit_type}</div>
                    </TableCell>
                    <TableCell>
                      {archive.traffic_limit > 0 ? formatBytes(archive.traffic_limit) : t("common.none")}
                    </TableCell>
                    <TableCell>
                      <Badge color={archive.exceeded ? "red" : "green"}>
                        {archive.exceeded
                          ? t("billing_history.exceeded")
                          : t("billing_history.within_limit")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.archives.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-[var(--gray-a11)]">
                      {t("billing_history.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Flex justify="between" align="center" className="mt-4">
            <Text color="gray">
              {t("billing_history.total", { count: data?.total ?? 0 })}
            </Text>
            <Flex gap="2" align="center">
              <Button variant="soft" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                {t("billing_history.previous")}
              </Button>
              <Text>{page} / {totalPages}</Text>
              <Button
                variant="soft"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("billing_history.next")}
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
