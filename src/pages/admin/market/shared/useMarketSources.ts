import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { RouteQueryResult } from "@/lib/routeData";
import {
  deleteMarketSource,
  fetchMarketSources,
  saveMarketSource,
  toastError,
} from "./api";
import { emptySource, type MarketKind, type MarketSource } from "./types";

/**
 * 市场源管理（主题市场与插件市场一致）：列表、增/改/删/启停。
 * 源变化后同时刷新源列表与目录（reloadCatalog(true)）。
 * 首屏的源列表由页面用 useRouteQuery(marketSourcesQuery(kind)) 读取后传进来，这里只负责之后的刷新。
 */
export function useMarketSources(
  kind: MarketKind,
  sourcesResult: RouteQueryResult<MarketSource[]>,
  reloadCatalog: (force?: boolean) => Promise<unknown>,
) {
  const { t } = useTranslation();
  const sources = sourcesResult.data ?? [];
  const setSources = sourcesResult.setData;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState(emptySource());
  const [savingSource, setSavingSource] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<MarketSource | null>(null);

  const loadSources = useCallback(async () => {
    const payload = await fetchMarketSources<MarketSource[]>(kind);
    setSources(payload.data || []);
  }, [kind, setSources]);

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
      await saveMarketSource(kind, editingID, sourceForm);
      toast.success(
        editingID
          ? t("market.source_updated", "Source updated")
          : t("market.source_created", "Source created"),
      );
      startCreateSource();
      await Promise.all([loadSources(), reloadCatalog(true)]);
    } catch (error) {
      toastError(error);
    } finally {
      setSavingSource(false);
    }
  };

  const updateSourceEnabled = async (source: MarketSource, enabled: boolean) => {
    try {
      await saveMarketSource(kind, source.id, { ...source, enabled });
      await Promise.all([loadSources(), reloadCatalog(true)]);
    } catch (error) {
      toastError(error);
    }
  };

  const deleteSource = async (source: MarketSource) => {
    try {
      await deleteMarketSource(kind, source.id);
      if (editingID === source.id) startCreateSource();
      toast.success(t("market.source_deleted", "Source deleted"));
      await Promise.all([loadSources(), reloadCatalog(true)]);
    } catch (error) {
      toastError(error);
    }
  };

  return {
    sources,
    sourcesOpen,
    setSourcesOpen,
    editingID,
    sourceForm,
    setSourceForm,
    savingSource,
    sourceToDelete,
    setSourceToDelete,
    loadSources,
    startCreateSource,
    startEditSource,
    saveSource,
    updateSourceEnabled,
    deleteSource,
  };
}

export type MarketSourcesState = ReturnType<typeof useMarketSources>;
