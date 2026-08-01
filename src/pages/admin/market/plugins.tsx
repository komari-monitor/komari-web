import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Blocks, Download, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Loading from "@/components/loading";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";

interface SourceStatus {
  id: string;
  name: string;
  url: string;
  count: number;
  error?: string;
}

interface MarketPlugin {
  name: I18nText;
  short: string;
  description?: I18nText;
  version: string;
  author: I18nText;
  url?: string;
  preview?: string;
  download: string;
  sha256: string;
  komari?: string;
  installable: boolean;
  source_id: string;
  source_name: string;
}

interface InstalledPlugin {
  short: string;
  version: string;
}

interface APIResponse<T> {
  status: string;
  message?: string;
  data: T;
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as APIResponse<T> | null;
  if (!response.ok || !payload || payload.status === "error") {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

const emptySource = () => ({
  name: "",
  url: "",
  enabled: true,
});

// 插件市场：对齐主题市场的 source/catalog/install 机制。
export default function PluginMarketPage() {
  const { call } = useRPC2Call();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "";
  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );

  const [plugins, setPlugins] = useState<MarketPlugin[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [installed, setInstalled] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySource());
  const [savingSource, setSavingSource] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<SourceStatus | null>(null);

  const loadCatalog = useCallback(async (force = false) => {
    const suffix = force ? "?refresh=true" : "";
    const [catalogPayload, installedResult] = await Promise.all([
      request<{ plugins: MarketPlugin[]; sources: SourceStatus[] }>(
        `/api/admin/plugin/market/catalog${suffix}`,
      ),
      call<any, InstalledPlugin[]>("admin:listPlugins").catch(() => []),
    ]);
    setPlugins(catalogPayload.data?.plugins || []);
    setSourceStatuses(catalogPayload.data?.sources || []);
    setInstalled(
      new Map(
        (Array.isArray(installedResult) ? installedResult : []).map((plugin) => [
          plugin.short,
          plugin.version,
        ]),
      ),
    );
  }, [call]);

  useEffect(() => {
    loadCatalog()
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setLoading(false));
  }, [loadCatalog]);

  const filteredPlugins = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return plugins;
    return plugins.filter((plugin) =>
      [
        displayText(plugin.name),
        plugin.short,
        displayText(plugin.author),
        displayText(plugin.description),
        plugin.source_name,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [displayText, search, plugins]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCatalog(true);
      toast.success(t("plugin.market_refresh_success", "Plugin sources refreshed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  };

  const installPlugin = async (plugin: MarketPlugin) => {
    const key = `${plugin.source_id}:${plugin.short}`;
    setInstalling(key);
    try {
      const payload = await request("/api/admin/plugin/market/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: plugin.source_id, short: plugin.short }),
      });
      toast.success(payload.message || t("plugin.market_install_success", "Plugin installed"));
      await loadCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setInstalling(null);
    }
  };

  const saveSource = async () => {
    setSavingSource(true);
    try {
      const payload = await request("/api/admin/plugin/market/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      toast.success(payload.message || t("plugin.market_source_added", "Source added"));
      setSourcesOpen(false);
      setSourceForm(emptySource());
      await loadCatalog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSource(false);
    }
  };

  const deleteSource = async (source: SourceStatus) => {
    try {
      await request(`/api/admin/plugin/market/sources/${encodeURIComponent(source.id)}`, {
        method: "DELETE",
      });
      setSourceToDelete(null);
      await loadCatalog(true);
      toast.success(t("plugin.market_source_deleted", "Source deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (loading) return <Loading />;

  return (
    <Box className="p-4 space-y-4">
      <Flex align="center" justify="between">
        <Flex align="center" gap="2">
          <Blocks size={20} />
          <Heading size="4">{t("plugin.market", "Plugin Market")}</Heading>
        </Flex>
        <Flex gap="2">
          <Button variant="soft" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} />
            {t("plugin.market_refresh", "Refresh")}
          </Button>
          <Button onClick={() => setSourcesOpen(true)}>
            <Plus size={14} />
            {t("plugin.market_add_source", "Add Source")}
          </Button>
        </Flex>
      </Flex>

      <Separator size="4" />

      {/* 源状态：无源时提示全宽显示 */}
      {sourceStatuses.length === 0 ? (
        <Callout.Root>
          <Callout.Text>
            {t("plugin.market_no_sources", "No market sources configured")}
          </Callout.Text>
        </Callout.Root>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="2">
          {sourceStatuses.map((status) => (
            <Card key={status.id} size="1">
              <Flex align="center" justify="between">
                <Text size="2" weight="bold">
                  {status.name}
                </Text>
                <Flex align="center" gap="2">
                  <Badge color={status.error ? "red" : "green"}>
                    {status.error
                      ? t("plugin.market_source_error", "Error")
                      : `${status.count} ${t("plugin.market_plugins", "plugins")}`}
                  </Badge>
                  <Button
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={() => setSourceToDelete(status)}
                    title={t("plugin.market_delete_source", "Delete source")}
                    aria-label={t("plugin.market_delete_source", "Delete source")}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Flex>
              </Flex>
              <Text size="1" color="gray" className="break-all">
                {status.url}
              </Text>
              {status.error && (
                <Text size="1" color="red">
                  {status.error}
                </Text>
              )}
            </Card>
          ))}
        </Grid>
      )}

      <TextField.Root
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("plugin.market_search", "Search plugins...")}
      >
        <TextField.Slot>
          <Search size={14} />
        </TextField.Slot>
      </TextField.Root>

      {filteredPlugins.length === 0 ? (
        <Callout.Root>
          <Callout.Text>{t("plugin.market_no_plugins", "No plugins in the market")}</Callout.Text>
        </Callout.Root>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="3">
          {filteredPlugins.map((plugin) => {
            const installedVersion = installed.get(plugin.short);
            const isInstalled = installedVersion !== undefined;
            const key = `${plugin.source_id}:${plugin.short}`;
            return (
              <Card key={key}>
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between">
                    <Text weight="bold">{displayText(plugin.name) || plugin.short}</Text>
                    <Badge color={plugin.installable ? "green" : "gray"}>
                      {isInstalled
                        ? `${t("plugin.installed", "Installed")} v${installedVersion}`
                        : plugin.installable
                          ? `v${plugin.version}`
                          : t("plugin.market_not_installable", "Not installable")}
                    </Badge>
                  </Flex>
                  <Text size="2" color="gray">
                    {plugin.short} · {displayText(plugin.author)}
                    {plugin.komari ? ` · komari ${plugin.komari}` : ""}
                  </Text>
                  {displayText(plugin.description) && (
                    <Text size="2">{displayText(plugin.description)}</Text>
                  )}
                  <Flex align="center" justify="between">
                    <Text size="1" color="gray">
                      {plugin.source_name}
                    </Text>
                    <Button
                      size="1"
                      disabled={!plugin.installable || installing === key}
                      onClick={() => installPlugin(plugin)}
                    >
                      <Download size={14} />
                      {installing === key
                        ? t("plugin.market_installing", "Installing...")
                        : t("plugin.market_install", "Install")}
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Grid>
      )}

      {/* 添加源弹窗 */}
      <Dialog.Root open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <Dialog.Content>
          <Dialog.Title>{t("plugin.market_add_source", "Add Source")}</Dialog.Title>
          <Flex direction="column" gap="3" my="3">
            <TextField.Root
              value={sourceForm.name}
              onChange={(event) =>
                setSourceForm((form) => ({ ...form, name: event.target.value }))
              }
              placeholder={t("plugin.market_source_name", "Name")}
            />
            <TextField.Root
              value={sourceForm.url}
              onChange={(event) =>
                setSourceForm((form) => ({ ...form, url: event.target.value }))
              }
              placeholder={t("plugin.market_source_url", "Catalog URL")}
            />
          </Flex>
          <Flex gap="2" justify="end">
            <Button variant="soft" onClick={() => setSourcesOpen(false)}>
              {t("plugin.permission_cancel", "Cancel")}
            </Button>
            <Button onClick={saveSource} disabled={savingSource}>
              {savingSource
                ? t("plugin.market_saving", "Saving...")
                : t("plugin.market_save", "Save")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 删除源确认 */}
      <Dialog.Root
        open={sourceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSourceToDelete(null);
        }}
      >
        <Dialog.Content>
          <Dialog.Title>{t("plugin.market_delete_source", "Delete source")}</Dialog.Title>
          <Text as="p" size="2" my="3">
            {t("plugin.market_delete_source_confirm", "Delete this market source?")}{" "}
            {sourceToDelete?.name}
          </Text>
          <Flex gap="2" justify="end">
            <Button variant="soft" onClick={() => setSourceToDelete(null)}>
              {t("plugin.permission_cancel", "Cancel")}
            </Button>
            <Button
              color="red"
              onClick={() => sourceToDelete && deleteSource(sourceToDelete)}
            >
              {t("plugin.market_delete", "Delete")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
