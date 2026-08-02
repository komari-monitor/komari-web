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
  IconButton,
  Separator,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  AlertTriangle,
  Blocks,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Loading from "@/components/loading";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";

interface MarketSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

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

const emptySource = (): Omit<MarketSource, "id"> => ({
  name: "",
  url: "",
  enabled: true,
});

async function request<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as APIResponse<T> | null;
  if (!response.ok || !payload || payload.status === "error") {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

// 插件市场：源管理与主题市场一致（增/改/删/启停 + 目录刷新）。
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
  const [sources, setSources] = useState<MarketSource[]>([]);
  const [installed, setInstalled] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState(emptySource());
  const [savingSource, setSavingSource] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<MarketSource | null>(null);

  const loadSources = useCallback(async () => {
    const payload = await request<MarketSource[]>("/api/admin/plugin/market/sources");
    setSources(payload.data || []);
  }, []);

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
    Promise.all([loadCatalog(), loadSources()])
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setLoading(false));
  }, [loadCatalog, loadSources]);

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

  const startCreateSource = () => {
    setEditingID(null);
    setSourceForm(emptySource());
  };

  const startEditSource = (source: MarketSource) => {
    setEditingID(source.id);
    setSourceForm({ name: source.name, url: source.url, enabled: source.enabled });
  };

  const saveSource = async () => {
    if (!sourceForm.name.trim() || !sourceForm.url.trim()) return;
    setSavingSource(true);
    try {
      await request(
        editingID
          ? `/api/admin/plugin/market/sources/${encodeURIComponent(editingID)}`
          : "/api/admin/plugin/market/sources",
        {
          method: editingID ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sourceForm),
        },
      );
      toast.success(
        editingID
          ? t("market.source_updated", "Source updated")
          : t("market.source_created", "Source created"),
      );
      startCreateSource();
      await Promise.all([loadSources(), loadCatalog(true)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSource(false);
    }
  };

  const updateSourceEnabled = async (source: MarketSource, enabled: boolean) => {
    try {
      await request(`/api/admin/plugin/market/sources/${encodeURIComponent(source.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...source, enabled }),
      });
      await Promise.all([loadSources(), loadCatalog(true)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteSource = async (source: MarketSource) => {
    try {
      await request(`/api/admin/plugin/market/sources/${encodeURIComponent(source.id)}`, {
        method: "DELETE",
      });
      if (editingID === source.id) startCreateSource();
      toast.success(t("market.source_deleted", "Source deleted"));
      await Promise.all([loadSources(), loadCatalog(true)]);
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
          <Button variant="soft" onClick={() => setSourcesOpen(true)}>
            <Settings2 size={14} />
            {t("market.manage_sources", "Manage sources")}
          </Button>
          <IconButton
            variant="soft"
            onClick={refresh}
            disabled={refreshing}
            title={t("common.refresh", "Refresh")}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </IconButton>
        </Flex>
      </Flex>

      <Separator size="4" />

      {sourceStatuses.filter((source) => source.error).map((source) => (
        <Callout.Root key={source.id} color="red" size="1">
          <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
          <Callout.Text>{source.name}: {source.error}</Callout.Text>
        </Callout.Root>
      ))}

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

      {/* 源管理弹窗：与主题市场一致 */}
      <Dialog.Root open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <Dialog.Content maxWidth="760px">
          <Dialog.Title>{t("market.manage_sources", "Manage sources")}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("market.manage_sources", "Manage sources")}
          </Dialog.Description>
          <Flex direction="column" gap="3" mt="4">
            {sources.length === 0 ? (
              <Text color="gray">{t("market.no_sources", "No sources configured")}</Text>
            ) : sources.map((source, index) => (
              <Box key={source.id}>
                {index > 0 && <Separator size="4" mb="3" />}
                <Flex justify="between" align="center" gap="3">
                  <Box className="min-w-0">
                    <Text as="div" weight="medium">{source.name}</Text>
                    <Text as="div" size="1" color="gray" className="truncate">{source.url}</Text>
                  </Box>
                  <Flex align="center" gap="2" className="shrink-0">
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={(checked) => updateSourceEnabled(source, checked)}
                    />
                    <IconButton
                      variant="ghost"
                      onClick={() => startEditSource(source)}
                      title={t("common.edit", "Edit")}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      color="red"
                      onClick={() => setSourceToDelete(source)}
                      title={t("common.delete", "Delete")}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Flex>
                </Flex>
              </Box>
            ))}
          </Flex>

          <Separator size="4" my="5" />
          <Flex justify="between" align="center" mb="3">
            <Text weight="bold">
              {editingID ? t("market.edit_source", "Edit source") : t("market.add_source", "Add source")}
            </Text>
            {editingID && (
              <Button size="1" variant="ghost" onClick={startCreateSource}>
                <Plus size={14} />
                {t("market.add_source", "Add source")}
              </Button>
            )}
          </Flex>
          <Flex direction="column" gap="3">
            <TextField.Root
              value={sourceForm.name}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("market.source_name", "Source name")}
            />
            <TextField.Root
              value={sourceForm.url}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="https://raw.githubusercontent.com/owner/repo/main/v1.json"
            />
            <Flex justify="between" align="center">
              <Flex align="center" gap="2">
                <Switch
                  checked={sourceForm.enabled}
                  onCheckedChange={(enabled) =>
                    setSourceForm((current) => ({ ...current, enabled }))
                  }
                />
                <Text size="2">{t("market.enabled", "Enabled")}</Text>
              </Flex>
              <Button
                onClick={saveSource}
                disabled={savingSource || !sourceForm.name.trim() || !sourceForm.url.trim()}
              >
                {savingSource && <RefreshCw size={15} className="animate-spin" />}
                {editingID ? t("common.save", "Save") : t("common.add", "Add")}
              </Button>
            </Flex>
          </Flex>
          <Flex justify="end" mt="5">
            <Dialog.Close>
              <Button variant="soft">{t("common.close", "Close")}</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 删除源确认 */}
      <Dialog.Root
        open={Boolean(sourceToDelete)}
        onOpenChange={(open) => {
          if (!open) setSourceToDelete(null);
        }}
      >
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>{t("common.delete", "Delete")}</Dialog.Title>
          <Dialog.Description>
            {t("market.delete_source_confirm", "Delete source {{name}}?", {
              name: sourceToDelete?.name,
            })}
          </Dialog.Description>
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button>
            </Dialog.Close>
            <Button
              color="red"
              disabled={!sourceToDelete}
              onClick={async () => {
                if (!sourceToDelete) return;
                await deleteSource(sourceToDelete);
                setSourceToDelete(null);
              }}
            >
              {t("common.delete", "Delete")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
