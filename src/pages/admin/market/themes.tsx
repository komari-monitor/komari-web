import Loading from "@/components/loading";
import { useSettings } from "@/lib/api";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Grid,
  IconButton,
  Separator,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface MarketSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface MarketSourceStatus {
  id: string;
  name: string;
  url: string;
  count: number;
  error?: string;
}

interface MarketTheme {
  name: I18nText;
  short: string;
  description: I18nText;
  version: string;
  author: I18nText;
  url: string;
  preview: string;
  download: string;
  sha256: string;
  installable: boolean;
  source_id: string;
  source_name: string;
}

interface InstalledTheme {
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

function isVersionNewer(candidate: string, installed: string) {
  const parse = (value: string) => {
    const match = value.trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return match ? [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)] : null;
  };
  const next = parse(candidate);
  const current = parse(installed);
  if (!next || !current) return candidate !== installed;
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as APIResponse<T> | null;
  if (!response.ok || !payload || payload.status === "error") {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

export default function ThemeMarketPage() {
  const { t, i18n } = useTranslation();
  const [themes, setThemes] = useState<MarketTheme[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<MarketSourceStatus[]>([]);
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
  const [selectedTheme, setSelectedTheme] = useState<MarketTheme | null>(null);
  const [themeToUninstall, setThemeToUninstall] = useState<MarketTheme | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<MarketSource | null>(null);
  const [settingTheme, setSettingTheme] = useState<string | null>(null);
  const [deletingTheme, setDeletingTheme] = useState<string | null>(null);
  const { settings, refetch: refetchSettings } = useSettings();
  const currentTheme = settings?.theme;
  const language = i18n.resolvedLanguage || i18n.language;
  const displayText = useCallback(
    (value: I18nText) => resolveI18nText(value, language) || "",
    [language],
  );

  const loadSources = useCallback(async () => {
    const payload = await request<MarketSource[]>("/api/admin/theme/market/sources");
    setSources(payload.data || []);
  }, []);

  const loadCatalog = useCallback(async (force = false) => {
    const suffix = force ? "?refresh=true" : "";
    const [catalogPayload, installedPayload] = await Promise.all([
      request<{ themes: MarketTheme[]; sources: MarketSourceStatus[] }>(
        `/api/admin/theme/market/catalog${suffix}`,
      ),
      request<InstalledTheme[]>("/api/admin/theme/list"),
    ]);
    setThemes(catalogPayload.data?.themes || []);
    setSourceStatuses(catalogPayload.data?.sources || []);
    setInstalled(
      new Map((installedPayload.data || []).map((theme) => [theme.short, theme.version])),
    );
  }, []);

  useEffect(() => {
    Promise.all([loadCatalog(), loadSources()])
      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [loadCatalog, loadSources]);

  const filteredThemes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return themes;
    return themes.filter((theme) =>
      [displayText(theme.name), theme.short, displayText(theme.author), displayText(theme.description), theme.source_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [displayText, search, themes]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCatalog(true);
      toast.success(t("market.refresh_success", "Theme sources refreshed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  };

  const installTheme = async (theme: MarketTheme) => {
    const key = `${theme.source_id}:${theme.short}`;
    setInstalling(key);
    try {
      const payload = await request("/api/admin/theme/market/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: theme.source_id, short: theme.short }),
      });
      toast.success(payload.message || t("market.install_success", "Theme installed"));
      await loadCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setInstalling(null);
    }
  };

  const setActiveTheme = async (theme: MarketTheme) => {
    setSettingTheme(theme.short);
    try {
      await request(`/api/admin/theme/set?theme=${encodeURIComponent(theme.short)}`);
      await refetchSettings();
      toast.success(t("theme.set_success", "Theme activated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSettingTheme(null);
    }
  };

  const uninstallTheme = async (theme: MarketTheme) => {
    setDeletingTheme(theme.short);
    try {
      if (currentTheme === theme.short) {
        await request("/api/admin/theme/set?theme=default");
      }
      await request("/api/admin/theme/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ short: theme.short }),
      });
      await Promise.all([loadCatalog(), refetchSettings()]);
      setSelectedTheme(null);
      toast.success(t("market.uninstall_success", "Theme uninstalled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingTheme(null);
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
          ? `/api/admin/theme/market/sources/${encodeURIComponent(editingID)}`
          : "/api/admin/theme/market/sources",
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
      await request(`/api/admin/theme/market/sources/${encodeURIComponent(source.id)}`, {
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
      await request(`/api/admin/theme/market/sources/${encodeURIComponent(source.id)}`, {
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
    <Box className="p-4 md:p-6 space-y-5">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Box>
          <Text as="div" size="6" weight="bold">
            {t("market.themes", "Theme Market")}
          </Text>
          <Text as="div" size="2" color="gray" mt="1">
            {t("market.description", "Find and install themes from the internet.")}
          </Text>
        </Box>
        <Flex gap="2">
          <Button variant="soft" onClick={() => setSourcesOpen(true)}>
            <Settings2 size={16} />
            {t("market.manage_sources", "Manage sources")}
          </Button>
          <IconButton variant="soft" onClick={refresh} disabled={refreshing} title={t("market.refresh", "Refresh")}>
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </IconButton>
        </Flex>
      </Flex>

      {sourceStatuses.filter((source) => source.error).map((source) => (
        <Callout.Root key={source.id} color="red" size="1">
          <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
          <Callout.Text>{source.name}: {source.error}</Callout.Text>
        </Callout.Root>
      ))}

      <TextField.Root
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("market.search_placeholder", "Search themes, authors or sources")}
        size="3"
      >
        <TextField.Slot><Search size={17} /></TextField.Slot>
      </TextField.Root>

      {filteredThemes.length === 0 ? (
        <Flex direction="column" align="center" justify="center" className="py-16" gap="2">
          <ImageIcon size={42} className="text-gray-400" />
          <Text color="gray">{t("market.no_themes", "No themes found")}</Text>
        </Flex>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", lg: "3", xl: "4" }} gap="4">
          {filteredThemes.map((theme) => {
            const key = `${theme.source_id}:${theme.short}`;
            const installedVersion = installed.get(theme.short);
            const isInstalled = Boolean(installedVersion);
            const hasUpdate = Boolean(installedVersion && isVersionNewer(theme.version, installedVersion));
            const isActive = currentTheme === theme.short;
            const isInstallable = theme.installable;
            return (
              <Card
                key={key}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedTheme(theme)}
              >
                <Box className="aspect-video bg-gray-3 overflow-hidden relative">
                  {theme.preview ? (
                    <img
                      src={theme.preview}
                      alt={displayText(theme.name)}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <Flex align="center" justify="center" className="h-full"><ImageIcon size={40} /></Flex>
                  )}
                  {isActive && <Badge className="absolute top-2 right-2" color="green" variant="solid">{t("theme.active", "Active")}</Badge>}
                </Box>
                <Flex direction="column" gap="3" p="4">
                  <Box>
                    <Flex justify="between" align="start" gap="2">
                      <Text weight="bold" size="3">{displayText(theme.name)}</Text>
                      <IconButton asChild size="1" variant="ghost" title={t("market.project_page", "Project page")} onClick={(event) => event.stopPropagation()}>
                        <a href={theme.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>
                      </IconButton>
                    </Flex>
                    <Text as="div" size="1" color="gray" mt="1">
                      {displayText(theme.author)} · v{theme.version}
                    </Text>
                  </Box>
                  <Text as="p" size="2" color="gray" className="min-h-10 line-clamp-2">
                    {displayText(theme.description)}
                  </Text>
                  <Flex justify="between" align="center" gap="2" wrap="wrap">
                    <Box>
                      {isInstalled && (
                        <Badge color={hasUpdate ? "orange" : "green"} variant="soft">
                          {hasUpdate
                            ? t("market.update_available", "Update available")
                            : t("market.installed", "Installed")}
                        </Badge>
                      )}
                      {!isInstalled && !isInstallable && (
                        <Badge color="gray" variant="soft">{t("market.install_unavailable", "Package unavailable")}</Badge>
                      )}
                    </Box>
                    <Flex gap="1" wrap="wrap" justify="end" onClick={(event) => event.stopPropagation()}>
                      {!isInstalled && isInstallable && (
                        <Button size="1" onClick={() => installTheme(theme)} disabled={installing === key}>
                          {installing === key ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                          {t("market.install", "Install")}
                        </Button>
                      )}
                      {hasUpdate && isInstallable && (
                        <Button size="1" onClick={() => installTheme(theme)} disabled={installing === key}>
                          {installing === key ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {t("market.update", "Update")}
                        </Button>
                      )}
                      {isInstalled && !isActive && (
                        <Button size="1" variant="soft" onClick={() => setActiveTheme(theme)} disabled={settingTheme === theme.short}>
                          <Settings2 size={14} />{t("theme.set_active", "Set theme")}
                        </Button>
                      )}
                      {isInstalled && (
                        <Button size="1" variant="soft" color="red" onClick={() => setThemeToUninstall(theme)} disabled={deletingTheme === theme.short}>
                          <Trash2 size={14} />{t("market.uninstall", "Uninstall")}
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Grid>
      )}

      <Dialog.Root open={Boolean(selectedTheme)} onOpenChange={(open) => { if (!open) setSelectedTheme(null); }}>
        <Dialog.Content maxWidth="820px">
          <Dialog.Title>{selectedTheme ? displayText(selectedTheme.name) : ""}</Dialog.Title>
          <Dialog.Description className="sr-only">{selectedTheme ? displayText(selectedTheme.description) : ""}</Dialog.Description>
          {selectedTheme && (() => {
            const key = `${selectedTheme.source_id}:${selectedTheme.short}`;
            const installedVersion = installed.get(selectedTheme.short);
            const isInstalled = Boolean(installedVersion);
            const hasUpdate = Boolean(installedVersion && isVersionNewer(selectedTheme.version, installedVersion));
            const isActive = currentTheme === selectedTheme.short;
            const isInstallable = selectedTheme.installable;
            return (
              <>
                <Box className="aspect-video bg-gray-3 overflow-hidden mt-4">
                  {selectedTheme.preview ? (
                    <img src={selectedTheme.preview} alt={displayText(selectedTheme.name)} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  ) : (
                    <Flex align="center" justify="center" className="h-full"><ImageIcon size={56} /></Flex>
                  )}
                </Box>
                <Flex direction="column" gap="2" mt="4">
                  <Text size="2" color="gray">{displayText(selectedTheme.description)}</Text>
                  <Flex gap="2" wrap="wrap">
                    <Badge variant="soft">{displayText(selectedTheme.author)}</Badge>
                    <Badge variant="soft">v{selectedTheme.version}</Badge>
                    {installedVersion && <Badge color="green" variant="soft">{t("market.installed_version", "Installed v{{version}}", { version: installedVersion })}</Badge>}
                    {!isInstalled && !isInstallable && <Badge color="gray" variant="soft">{t("market.install_unavailable", "Package unavailable")}</Badge>}
                  </Flex>
                  <Text size="2"><Text weight="bold">{t("market.source", "Source")}:</Text> {selectedTheme.source_name}</Text>
                  <a href={selectedTheme.url} target="_blank" rel="noreferrer" className="text-sm text-blue-9 inline-flex items-center gap-1 w-fit">
                    {t("market.project_page", "Project page")}<ExternalLink size={14} />
                  </a>
                </Flex>
                <Flex justify="end" gap="2" mt="5" wrap="wrap">
                  <Dialog.Close><Button variant="soft" color="gray">{t("common.close", "Close")}</Button></Dialog.Close>
                  {!isInstalled && isInstallable && (
                    <Button onClick={() => installTheme(selectedTheme)} disabled={installing === key}>
                      <Download size={15} />{t("market.install", "Install")}
                    </Button>
                  )}
                  {hasUpdate && isInstallable && (
                    <Button onClick={() => installTheme(selectedTheme)} disabled={installing === key}>
                      <RefreshCw size={15} />{t("market.update", "Update")}
                    </Button>
                  )}
                  {isInstalled && !isActive && (
                    <Button variant="soft" onClick={() => setActiveTheme(selectedTheme)} disabled={settingTheme === selectedTheme.short}>
                      <Settings2 size={15} />{t("theme.set_active", "Set theme")}
                    </Button>
                  )}
                  {isInstalled && (
                    <Button color="red" variant="soft" onClick={() => setThemeToUninstall(selectedTheme)} disabled={deletingTheme === selectedTheme.short}>
                      <Trash2 size={15} />{t("market.uninstall", "Uninstall")}
                    </Button>
                  )}
                </Flex>
              </>
            );
          })()}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <Dialog.Content maxWidth="760px">
          <Dialog.Title>{t("market.manage_sources", "Manage sources")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("market.manage_sources", "Manage sources")}</Dialog.Description>
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
                    <Switch checked={source.enabled} onCheckedChange={(checked) => updateSourceEnabled(source, checked)} />
                    <IconButton variant="ghost" onClick={() => startEditSource(source)} title={t("common.edit", "Edit")}><Pencil size={16} /></IconButton>
                    <IconButton variant="ghost" color="red" onClick={() => setSourceToDelete(source)} title={t("common.delete", "Delete")}><Trash2 size={16} /></IconButton>
                  </Flex>
                </Flex>
              </Box>
            ))}
          </Flex>

          <Separator size="4" my="5" />
          <Flex justify="between" align="center" mb="3">
            <Text weight="bold">{editingID ? t("market.edit_source", "Edit source") : t("market.add_source", "Add source")}</Text>
            {editingID && <Button size="1" variant="ghost" onClick={startCreateSource}><Plus size={14} />{t("market.add_source", "Add source")}</Button>}
          </Flex>
          <Flex direction="column" gap="3">
            <TextField.Root value={sourceForm.name} onChange={(event) => setSourceForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("market.source_name", "Source name")} />
            <TextField.Root value={sourceForm.url} onChange={(event) => setSourceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://raw.githubusercontent.com/owner/repo/main/v1.json" />
            <Flex justify="between" align="center">
              <Flex align="center" gap="2"><Switch checked={sourceForm.enabled} onCheckedChange={(enabled) => setSourceForm((current) => ({ ...current, enabled }))} /><Text size="2">{t("market.enabled", "Enabled")}</Text></Flex>
              <Button onClick={saveSource} disabled={savingSource || !sourceForm.name.trim() || !sourceForm.url.trim()}>
                {savingSource && <RefreshCw size={15} className="animate-spin" />}
                {editingID ? t("common.save", "Save") : t("common.add", "Add")}
              </Button>
            </Flex>
          </Flex>
          <Flex justify="end" mt="5"><Dialog.Close><Button variant="soft">{t("common.close", "Close")}</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={Boolean(themeToUninstall)} onOpenChange={(open) => { if (!open) setThemeToUninstall(null); }}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>{t("market.uninstall", "Uninstall")}</Dialog.Title>
          <Dialog.Description>
            {t("market.uninstall_confirm", "Uninstall {{name}}?", { name: themeToUninstall ? displayText(themeToUninstall.name) : "" })}
          </Dialog.Description>
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close><Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button></Dialog.Close>
            <Button
              color="red"
              disabled={!themeToUninstall || deletingTheme === themeToUninstall.short}
              onClick={async () => {
                if (!themeToUninstall) return;
                await uninstallTheme(themeToUninstall);
                setThemeToUninstall(null);
              }}
            >
              {deletingTheme && <RefreshCw size={15} className="animate-spin" />}
              {t("market.uninstall", "Uninstall")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={Boolean(sourceToDelete)} onOpenChange={(open) => { if (!open) setSourceToDelete(null); }}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>{t("common.delete", "Delete")}</Dialog.Title>
          <Dialog.Description>
            {t("market.delete_source_confirm", "Delete source {{name}}?", { name: sourceToDelete?.name })}
          </Dialog.Description>
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close><Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button></Dialog.Close>
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
