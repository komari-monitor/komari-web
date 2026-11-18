import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import throttle from "lodash/throttle";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type { RecoverableSessionGroup } from "./RecoverableSessionsDialog";
import type { TerminalSessionApi } from "./TerminalSession";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_PADDING,
} from "./terminalDefaults";
import {
  createTab,
  createTabId,
  type CloseMode,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";
import {
  appendTabToLeaf,
  collectLeaves,
  createLeafPane,
  findLeaf,
  findLeafByTabId,
  insertTabAfterInLeaf,
  moveTabAcrossPanes,
  removeTabsFromTree,
  reorderTabInLeaf,
  splitLeafWithTab,
  updateLeaf,
  updateSplitRatio,
  type DropZone,
  type SplitZone,
  type TerminalPaneNode,
} from "./splitTree";

interface RecoverableTerminalSession {
  request_id: string;
  uuid: string;
  agent_connected: boolean;
}

const getTabShortcutIndex = (event: KeyboardEvent) => {
  const code = event.code;
  const codeDigit =
    code.startsWith("Digit") || code.startsWith("Numpad")
      ? code.slice(-1)
      : null;
  if (codeDigit !== null) {
    return codeDigit === "0" ? 9 : Number(codeDigit) - 1;
  }

  const key = event.key;
  if (key >= "1" && key <= "9") {
    return Number(key) - 1;
  }
  return key === "0" ? 9 : -1;
};

export const useTerminalPage = () => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const [clients, setClients] = useState<TerminalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [recoverableSessions, setRecoverableSessions] = useState<
    RecoverableTerminalSession[]
  >([]);
  const [recoverableDialogOpen, setRecoverableDialogOpen] = useState(false);
  const [recoverableSubmitting, setRecoverableSubmitting] = useState(false);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [paneTree, setPaneTree] = useState<TerminalPaneNode>(() =>
    createLeafPane(),
  );
  const [activePaneId, setActivePaneId] = useState<string>(
    () => (paneTree.type === "leaf" ? paneTree.id : ""),
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [serverMenuPaneId, setServerMenuPaneId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(window.innerWidth * 0.7);
  const [httpsCalloutOpen, setHttpsCalloutOpen] = useState(
    window.location.protocol !== "https:",
  );
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaResolved, setTwoFaResolved] = useState(false);
  const [onboardingAuthenticated, setOnboardingAuthenticated] = useState(false);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchUseRegex, setSearchUseRegex] = useState(false);
  const [resourceMonitorServers, setResourceMonitorServers] = useState<
    string[]
  >([]);
  const [tabLatencies, setTabLatencies] = useState<Record<string, number>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const initialUuidRef = useRef(
    new URLSearchParams(window.location.search).get("uuid"),
  );
  const tabsRef = useRef<TerminalTab[]>([]);
  const paneTreeRef = useRef<TerminalPaneNode>(paneTree);
  const activePaneIdRef = useRef<string>(activePaneId);
  const activeTabIdRef = useRef<string | null>(null);
  const sessionApisRef = useRef(new Map<string, TerminalSessionApi>());
  const [activeApi, setActiveApi] = useState<TerminalSessionApi | null>(null);

  const leaves = useMemo(() => collectLeaves(paneTree), [paneTree]);
  const resolvedActivePane = useMemo(
    () => leaves.find((leaf) => leaf.id === activePaneId) ?? leaves[0] ?? null,
    [activePaneId, leaves],
  );
  const activeTabId = resolvedActivePane?.activeTabId ?? null;

  tabsRef.current = tabs;
  paneTreeRef.current = paneTree;
  activePaneIdRef.current = resolvedActivePane?.id ?? activePaneId;
  activeTabIdRef.current = activeTabId;

  const appearance = {
    "--xterm-padding": `${DEFAULT_TERMINAL_PADDING}px`,
    "--xterm-font-family": DEFAULT_TERMINAL_FONT_FAMILY,
  } as CSSProperties;
  const updateTabs = useCallback((next: TerminalTab[]) => {
    tabsRef.current = next;
    setTabs(next);
  }, []);

  const updatePaneTree = useCallback((next: TerminalPaneNode) => {
    paneTreeRef.current = next;
    setPaneTree(next);
  }, []);

  const fitAllSessions = useCallback(() => {
    requestAnimationFrame(() => {
      for (const api of sessionApisRef.current.values()) {
        api.fit();
      }
    });
  }, []);

  const focusPane = useCallback((paneId: string) => {
    const leaf = findLeaf(paneTreeRef.current, paneId);
    if (!leaf) return;
    activePaneIdRef.current = paneId;
    setActivePaneId(paneId);
    if (leaf.activeTabId) {
      const api = sessionApisRef.current.get(leaf.activeTabId);
      requestAnimationFrame(() => {
        api?.terminal.focus();
      });
    }
  }, []);

  const activateTabInPane = useCallback((paneId: string, tabId: string) => {
    const nextTree = updateLeaf(paneTreeRef.current, paneId, (leaf) =>
      leaf.tabIds.includes(tabId) ? { ...leaf, activeTabId: tabId } : leaf,
    );
    updatePaneTree(nextTree);
    activePaneIdRef.current = paneId;
    setActivePaneId(paneId);
    requestAnimationFrame(() => {
      const api = sessionApisRef.current.get(tabId);
      api?.fit();
      api?.terminal.focus();
    });
  }, [updatePaneTree]);

  const setActiveTabId = useCallback(
    (tabId: string | null) => {
      if (!tabId) return;
      const owner = findLeafByTabId(paneTreeRef.current, tabId);
      if (owner) {
        activateTabInPane(owner.id, tabId);
      }
    },
    [activateTabInPane],
  );

  useEffect(() => {
    if (!resolvedActivePane) return;
    if (resolvedActivePane.id !== activePaneId) {
      setActivePaneId(resolvedActivePane.id);
    }
  }, [activePaneId, resolvedActivePane]);

  const orderedClients = useMemo(
    () =>
      [...clients].sort(
        (left, right) => (left.weight ?? 0) - (right.weight ?? 0),
      ),
    [clients],
  );

  useEffect(() => {
    let mounted = true;
    setClientsLoading(true);
    fetch("/api/admin/client/list")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load clients (${response.status})`);
        }
        return response.json();
      })
      .then((data: unknown) => {
        if (!mounted) {
          return;
        }
        const list = Array.isArray(data) ? (data as TerminalClient[]) : [];
        setClients(list);
        setClientsLoading(false);
        const initialUuid = initialUuidRef.current;
        if (!initialUuid) {
          return;
        }
        const client = list.find((item) => item.uuid === initialUuid);
        if (!client) {
          if (list.length === 0) {
            toast.error(t("terminal.no_active_connection"));
          }
          return;
        }
        if (tabsRef.current.length === 0) {
          const tab = createTab(client, undefined, t("terminal.server"));
          updateTabs([tab]);
          const rootLeaves = collectLeaves(paneTreeRef.current);
          const firstPaneId = rootLeaves[0]?.id ?? "";
          const nextTree = appendTabToLeaf(
            paneTreeRef.current,
            firstPaneId,
            tab.id,
            true,
          );
          updatePaneTree(nextTree);
          const updatedFirst = collectLeaves(nextTree)[0];
          if (updatedFirst) {
            setActivePaneId(updatedFirst.id);
          }
        }
      })
      .catch((error) => {
        if (mounted) {
          console.error("Failed to load clients:", error);
          toast.error(t("terminal.clients_load_failed", "Failed to load servers"));
        }
      })
      .finally(() => {
        if (mounted) setClientsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [t, updatePaneTree, updateTabs]);

  useEffect(() => {
    let cancelled = false;
    void call<undefined, RecoverableTerminalSession[]>(
      "admin:listRecoverableTerminalSessions",
    )
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          return;
        }
        setRecoverableSessions(data);
        setRecoverableDialogOpen(true);
      })
      .catch(() => {
        // Ignore when unauthenticated or RPC is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [call]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/me")
      .then((response) => response.json())
      .then((data: { "2fa_enabled"?: boolean; logged_in?: boolean }) => {
        if (!mounted) {
          return;
        }
        const enabled = Boolean(data?.["2fa_enabled"]);
        setTwoFaEnabled(enabled);
        setTwoFaResolved(true);
        setOnboardingAuthenticated(data.logged_in === true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setTwoFaResolved(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "terminal-search-decoration-style";
    style.textContent = [
      ".xterm-rows span[style*='background-color:#ffff00'],",
      ".xterm-rows span[style*='background-color: rgb(255, 255, 0)'],",
      ".xterm-rows span[style*='background-color:#ff9632'],",
      ".xterm-rows span[style*='background-color: rgb(255, 150, 50)'],",
      ".xterm-rows span[style*='background-color:rgb(255,150,50)'] { color: #000000 !important; }",
    ].join("\n");
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const handleApiChange = useCallback(
    (id: string, api: TerminalSessionApi | null) => {
      if (api) {
        sessionApisRef.current.set(id, api);
      } else {
        sessionApisRef.current.delete(id);
      }
      if (activeTabIdRef.current === id) {
        setActiveApi(api);
      }
    },
    [],
  );

  const handleLatencyChange = useCallback(
    (id: string, latencyMs: number | null) => {
      setTabLatencies((current) => {
        if (latencyMs === null) {
          if (!(id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[id];
          return next;
        }
        if (current[id] === latencyMs) {
          return current;
        }
        return { ...current, [id]: latencyMs };
      });
    },
    [],
  );

  useEffect(() => {
    const api = activeTabId
      ? sessionApisRef.current.get(activeTabId) ?? null
      : null;
    setActiveApi(api);
  }, [activeTabId]);

  const activeApiRef = useRef<TerminalSessionApi | null>(null);
  activeApiRef.current = activeApi;
  const searchSelectionRef = useRef(false);
  const searchSelectionResetTimerRef =
    useRef<number | null>(null);

  const setTerminalSelectionTheme = useCallback(
    (terminal: TerminalSessionApi["terminal"], searchActive: boolean) => {
      terminal.options.theme = {
        ...terminal.options.theme,
        selectionBackground: searchActive ? "#ff9632" : "#ffffff",
        selectionForeground: "#000000",
        selectionInactiveBackground: searchActive ? "#ff9632" : "#ffffff",
      };
    },
    [],
  );

  const resetSearchSelectionTimer = useCallback(() => {
    if (searchSelectionResetTimerRef.current !== null) {
      window.clearTimeout(searchSelectionResetTimerRef.current);
      searchSelectionResetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const resize = window.setTimeout(() => fitAllSessions(), 100);
    return () => window.clearTimeout(resize);
  }, [activeApi, fitAllSessions, isSidebarOpen, leaves.length]);

  useEffect(() => {
    const terminal = activeApi?.terminal;
    if (!terminal) {
      return;
    }
    const disposable = terminal.onSelectionChange(() => {
      if (!searchSelectionRef.current) {
        setTerminalSelectionTheme(terminal, false);
      }
    });
    return () => disposable.dispose();
  }, [activeApi, setTerminalSelectionTheme]);

  // Document title updates
  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      document.title = t("terminal.title");
      return;
    }
    const activeTitle = activeTab.title || t("terminal.title");
    if (tabs.length > 1) {
      document.title = t("terminal.title_with_sessions", {
        name: activeTitle,
        count: tabs.length,
      });
    } else {
      document.title = `${t("terminal.title")} - ${activeTitle}`;
    }
  }, [activeTabId, tabs, t]);

  const startDragging = useCallback(
    (event: ReactMouseEvent | ReactTouchEvent) => {
      event.preventDefault();
      draggingRef.current = true;
      document.body.style.userSelect = "none";
    },
    [],
  );

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    document.body.style.userSelect = "";
    fitAllSessions();
  }, [fitAllSessions]);

  const handleDrag = useCallback((clientX: number) => {
    if (!draggingRef.current || !containerRef.current) {
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const minSidebar = bounds.width <= 640 ? 220 : 300;
    const available = Math.max(0, bounds.width - minSidebar);
    const minLeft = Math.min(
      Math.max(bounds.width * 0.3, bounds.width <= 640 ? 160 : 300),
      available,
    );
    const maxLeft = Math.max(minLeft, available);
    const newWidth = Math.min(
      Math.max(clientX - bounds.left, minLeft),
      maxLeft,
    );
    setLeftWidth(newWidth);
  }, []);

  useEffect(() => {
    const throttledDrag = throttle(handleDrag, 16);
    const onMouseMove = (event: MouseEvent) => {
      if (draggingRef.current) {
        throttledDrag(event.clientX);
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (draggingRef.current && event.touches[0]) {
        throttledDrag(event.touches[0].clientX);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDragging);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", stopDragging);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopDragging);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", stopDragging);
      throttledDrag.cancel();
    };
  }, [handleDrag, stopDragging]);

  const openClient = useCallback(
    (client: TerminalClient, targetPaneId?: string) => {
      const tab = createTab(client, undefined, t("terminal.server"));
      updateTabs([...tabsRef.current, tab]);
      const paneId =
        targetPaneId ??
        activePaneIdRef.current ??
        collectLeaves(paneTreeRef.current)[0]?.id ??
        "";
      const nextTree = appendTabToLeaf(
        paneTreeRef.current,
        paneId,
        tab.id,
        true,
      );
      updatePaneTree(nextTree);
      const owner = findLeafByTabId(nextTree, tab.id);
      if (owner) {
        activePaneIdRef.current = owner.id;
        setActivePaneId(owner.id);
      }
      setServerMenuPaneId(null);
    },
    [t, updatePaneTree, updateTabs],
  );

  const duplicateTab = useCallback(
    (id: string) => {
      const source = tabsRef.current.find((item) => item.id === id);
      if (!source) {
        setServerMenuPaneId(activePaneIdRef.current || null);
        return;
      }
      const duplicate: TerminalTab = {
        ...source,
        id: createTabId(),
        color: null,
        requestId: undefined,
      };
      updateTabs([...tabsRef.current, duplicate]);
      const nextTree = insertTabAfterInLeaf(
        paneTreeRef.current,
        id,
        duplicate.id,
        true,
      );
      updatePaneTree(nextTree);
      const owner = findLeafByTabId(nextTree, duplicate.id);
      if (owner) {
        activePaneIdRef.current = owner.id;
        setActivePaneId(owner.id);
      }
    },
    [updatePaneTree, updateTabs],
  );

  const splitPane = useCallback(
    (paneId: string, zone: SplitZone, sourceTabId?: string) => {
      const leaf =
        findLeaf(paneTreeRef.current, paneId) ??
        findLeaf(paneTreeRef.current, activePaneIdRef.current);
      if (!leaf) return;
      const baseTabId = sourceTabId ?? leaf.activeTabId ?? leaf.tabIds[0];
      const source = baseTabId
        ? tabsRef.current.find((item) => item.id === baseTabId)
        : undefined;
      if (!source) {
        setServerMenuPaneId(leaf.id);
        return;
      }
      const newTab: TerminalTab = {
        ...source,
        id: createTabId(),
        color: null,
        requestId: undefined,
      };
      updateTabs([...tabsRef.current, newTab]);
      const { tree: nextTree, newPaneId } = splitLeafWithTab(
        paneTreeRef.current,
        leaf.id,
        zone,
        newTab.id,
      );
      updatePaneTree(nextTree);
      activePaneIdRef.current = newPaneId;
      setActivePaneId(newPaneId);
      fitAllSessions();
    },
    [fitAllSessions, updatePaneTree, updateTabs],
  );

  const moveTab = useCallback(
    (
      tabId: string,
      targetPaneId: string,
      zone: DropZone,
      insertBeforeTabId?: string | null,
    ) => {
      const { tree: nextTree, activePaneId: nextActivePaneId } =
        moveTabAcrossPanes(
          paneTreeRef.current,
          tabId,
          targetPaneId,
          zone,
          insertBeforeTabId,
        );
      updatePaneTree(nextTree);
      const validTarget =
        findLeaf(nextTree, nextActivePaneId) ?? collectLeaves(nextTree)[0];
      if (validTarget) {
        activePaneIdRef.current = validTarget.id;
        setActivePaneId(validTarget.id);
      }
      fitAllSessions();
      requestAnimationFrame(() => {
        sessionApisRef.current.get(tabId)?.terminal.focus();
      });
    },
    [fitAllSessions, updatePaneTree],
  );

  const resizeSplit = useCallback(
    (splitId: string, ratio: number) => {
      updatePaneTree(updateSplitRatio(paneTreeRef.current, splitId, ratio));
      fitAllSessions();
    },
    [fitAllSessions, updatePaneTree],
  );

  const addTab = useCallback(() => {
    if (activeTabIdRef.current) {
      duplicateTab(activeTabIdRef.current);
    } else {
      const fallbackPane =
        activePaneIdRef.current || collectLeaves(paneTreeRef.current)[0]?.id;
      setServerMenuPaneId(fallbackPane ?? null);
    }
  }, [duplicateTab]);

  const startRename = useCallback((id: string) => {
    const tab = tabsRef.current.find((item) => item.id === id);
    if (!tab) {
      return;
    }
    setActiveTabId(id);
    setEditingTabId(id);
    setRenameDraft(tab.title);
  }, [setActiveTabId]);

  const commitRename = useCallback(() => {
    const id = editingTabId;
    const value = renameDraft.trim();
    setEditingTabId(null);
    if (!id || !value) {
      return;
    }
    updateTabs(
      tabsRef.current.map((tab) =>
        tab.id === id ? { ...tab, title: value } : tab,
      ),
    );
  }, [editingTabId, renameDraft, updateTabs]);

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
  }, []);

  const colorTab = useCallback(
    (id: string, color: string | null) => {
      updateTabs(
        tabsRef.current.map((tab) => (tab.id === id ? { ...tab, color } : tab)),
      );
    },
    [updateTabs],
  );

  const toggleResourceMonitor = useCallback((uuid: string) => {
    setResourceMonitorServers((current) =>
      current.includes(uuid)
        ? current.filter((item) => item !== uuid)
        : [...current, uuid],
    );
  }, []);

  const closeTabs = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const remove = new Set(ids);
      const previous = tabsRef.current;
      const next = previous.filter((tab) => !remove.has(tab.id));
      updateTabs(next);
      const nextTree = removeTabsFromTree(paneTreeRef.current, remove);
      updatePaneTree(nextTree);
      const remainingLeaves = collectLeaves(nextTree);
      if (!remainingLeaves.some((leaf) => leaf.id === activePaneIdRef.current)) {
        const fallbackLeaf = remainingLeaves[0];
        if (fallbackLeaf) {
          activePaneIdRef.current = fallbackLeaf.id;
          setActivePaneId(fallbackLeaf.id);
        }
      }
      const stillUsedUuids = new Set(next.map((tab) => tab.uuid));
      const removedUuids = new Set(
        previous
          .filter((tab) => remove.has(tab.id) && !stillUsedUuids.has(tab.uuid))
          .map((tab) => tab.uuid),
      );
      setResourceMonitorServers((current) =>
        current.filter((uuid) => !removedUuids.has(uuid)),
      );
      setTabLatencies((current) => {
        let changed = false;
        const nextLatencies = { ...current };
        for (const id of remove) {
          if (id in nextLatencies) {
            delete nextLatencies[id];
            changed = true;
          }
        }
        return changed ? nextLatencies : current;
      });
      setEditingTabId((id) => (id && remove.has(id) ? null : id));
      fitAllSessions();
    },
    [fitAllSessions, updatePaneTree, updateTabs],
  );

  const closeTab = useCallback(
    (id: string, mode: CloseMode, paneId?: string) => {
      const leaf = paneId
        ? findLeaf(paneTreeRef.current, paneId)
        : findLeafByTabId(paneTreeRef.current, id);
      const scopedIds = leaf ? leaf.tabIds : tabsRef.current.map((t) => t.id);
      const index = scopedIds.indexOf(id);
      if (index < 0) {
        return;
      }
      if (mode === "current") {
        closeTabs([id]);
      } else if (mode === "left") {
        closeTabs(scopedIds.slice(0, index));
      } else if (mode === "right") {
        closeTabs(scopedIds.slice(index + 1));
      } else {
        closeTabs(scopedIds.filter((tabId) => tabId !== id));
      }
    },
    [closeTabs],
  );

  const exportText = useCallback((id: string) => {
    const api = sessionApisRef.current.get(id);
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!api || !tab) {
      return;
    }
    const text = api.exportText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tab.title || "terminal"}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const openFileManager = useCallback((id?: string) => {
    if (id) {
      setActiveTabId(id);
    }
    setIsSidebarOpen(true);
  }, [setActiveTabId]);
  const openSearch = useCallback((id?: string) => {
    if (id) {
      setActiveTabId(id);
    }
    setSearchOpen(true);
  }, [setActiveTabId]);

  const closeSearch = useCallback(() => {
    searchSelectionRef.current = false;
    resetSearchSelectionTimer();
    if (activeApi) {
      setTerminalSelectionTheme(activeApi.terminal, false);
    }
    setSearchOpen(false);
    activeApi?.searchAddon?.clearDecorations();
    activeApi?.terminal?.focus();
  }, [activeApi, resetSearchSelectionTimer, setTerminalSelectionTheme]);

  const performSearch = useCallback(
    (
      term: string,
      caseSens: boolean,
      regex: boolean,
      direction: "next" | "prev" = "next",
      fresh = false,
    ) => {
      if (!activeApi?.searchAddon) {
        return;
      }
      if (!term) {
        activeApi.searchAddon.clearDecorations();
        setSearchResultIndex(0);
        setSearchResultCount(0);
        return;
      }
      const searchOptions = {
        caseSensitive: caseSens,
        regex,
        incremental: true,
        decorations: {
          matchBackground: "#ffff00",
          matchBorder: "#ffff00",
          matchOverviewRuler: "#ffff00",
          activeMatchBackground: "#ff9632",
          activeMatchBorder: "#ff9632",
          activeMatchColorOverviewRuler: "#ff9632",
        },
      };

      searchSelectionRef.current = true;
      setTerminalSelectionTheme(activeApi.terminal, true);
      resetSearchSelectionTimer();
      if (fresh) {
        activeApi.searchAddon.clearDecorations();
        activeApi.terminal.clearSelection();
        setSearchResultIndex(0);
        setSearchResultCount(0);
      }

      try {
        if (direction === "next") {
          activeApi.searchAddon.findNext(term, searchOptions);
        } else {
          activeApi.searchAddon.findPrevious(term, searchOptions);
        }
      } catch {
        activeApi.searchAddon.clearDecorations();
        setSearchResultIndex(0);
        setSearchResultCount(0);
      } finally {
        searchSelectionResetTimerRef.current = window.setTimeout(() => {
          searchSelectionRef.current = false;
          searchSelectionResetTimerRef.current = null;
        }, 0);
      }
    },
    [activeApi, resetSearchSelectionTimer, setTerminalSelectionTheme],
  );

  const handleSearchTermChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
    },
    [],
  );

  const handleFindNext = useCallback(() => {
    performSearch(searchTerm, searchCaseSensitive, searchUseRegex, "next");
  }, [performSearch, searchCaseSensitive, searchTerm, searchUseRegex]);

  const handleFindPrevious = useCallback(() => {
    performSearch(searchTerm, searchCaseSensitive, searchUseRegex, "prev");
  }, [performSearch, searchCaseSensitive, searchTerm, searchUseRegex]);

  const handleToggleCaseSensitive = useCallback(() => {
    setSearchCaseSensitive((value) => !value);
  }, []);

  const handleToggleUseRegex = useCallback(() => {
    setSearchUseRegex((value) => !value);
  }, []);

  // Re-run an existing query once the target terminal becomes available.
  useEffect(() => {
    if (!searchOpen || !searchTerm || !activeApi?.searchAddon) {
      return;
    }
    performSearch(searchTerm, searchCaseSensitive, searchUseRegex, "next", true);
  }, [
    activeApi,
    performSearch,
    searchCaseSensitive,
    searchOpen,
    searchTerm,
    searchUseRegex,
  ]);

  // Subscribe to search result count changes
  useEffect(() => {
    if (!activeApi?.searchAddon) {
      return;
    }
    const disposable = activeApi.searchAddon.onDidChangeResults((event) => {
      setSearchResultIndex(event.resultIndex);
      setSearchResultCount(event.resultCount);
    });
    return () => {
      disposable.dispose();
    };
  }, [activeApi]);

  // Reorder tabs
  const reorderTab = useCallback(
    (paneId: string, sourceId: string, targetId: string) => {
      updatePaneTree(
        reorderTabInLeaf(paneTreeRef.current, paneId, sourceId, targetId),
      );
    },
    [updatePaneTree],
  );

  const switchTab = useCallback((direction: 1 | -1) => {
    const leaf = findLeaf(paneTreeRef.current, activePaneIdRef.current);
    if (!leaf || leaf.tabIds.length < 2) {
      return;
    }
    const activeIndex = leaf.activeTabId
      ? leaf.tabIds.indexOf(leaf.activeTabId)
      : 0;
    const currentIndex = activeIndex < 0 ? 0 : activeIndex;
    const nextIndex =
      (currentIndex + direction + leaf.tabIds.length) % leaf.tabIds.length;
    activateTabInPane(leaf.id, leaf.tabIds[nextIndex]);
  }, [activateTabInPane]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const clearActiveTerminal = useCallback(() => {
    const terminal = activeApiRef.current?.terminal;
    if (!terminal) {
      return;
    }
    terminal.clear();
    terminal.focus();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        document.querySelector(
          ".km-file-editor, .km-guide-content, .km-recoverable-sessions-dialog",
        )
      ) {
        return;
      }
      const ctrlShift =
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey;
      const ctrlAlt =
        event.ctrlKey &&
        event.altKey &&
        !event.shiftKey &&
        !event.metaKey;

      // Ctrl+Alt+T: new tab
      if (ctrlAlt && event.code === "KeyT") {
        event.preventDefault();
        addTab();
        return;
      }

      // Ctrl+Alt+W: close current tab
      if (ctrlAlt && event.code === "KeyW") {
        event.preventDefault();
        if (activeTabIdRef.current) {
          closeTab(activeTabIdRef.current, "current");
        }
        return;
      }

      // Ctrl+Alt+Right / Ctrl+Alt+Left: next / previous tab
      if (
        ctrlAlt &&
        (event.code === "ArrowRight" || event.code === "ArrowLeft")
      ) {
        event.preventDefault();
        switchTab(event.code === "ArrowRight" ? 1 : -1);
        return;
      }

      // Alt+Enter: toggle fullscreen
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.code === "Enter"
      ) {
        event.preventDefault();
        toggleFullscreen();
        return;
      }

      // Ctrl+Alt+K: clear terminal buffer
      if (ctrlAlt && event.code === "KeyK") {
        event.preventDefault();
        clearActiveTerminal();
        return;
      }

      const isFindShortcut =
        ctrlShift &&
        (event.code === "KeyF" ||
          event.key.toLowerCase() === "f" ||
          event.code === "KeyX" ||
          event.key.toLowerCase() === "x");

      // Ctrl+Shift+F opens Find; Ctrl+Shift+X remains as a compatibility alias.
      if (isFindShortcut) {
        event.preventDefault();
        openSearch();
        return;
      }

      // Ctrl+Alt+1..0 (Switch tab)
      if (ctrlAlt) {
        const index = getTabShortcutIndex(event);
        const leaf = findLeaf(paneTreeRef.current, activePaneIdRef.current);
        if (leaf && index >= 0 && index < leaf.tabIds.length) {
          event.preventDefault();
          activateTabInPane(leaf.id, leaf.tabIds[index]);
          return;
        }
      }

      // Ctrl+Shift+1..0 (Create server tab)
      if (ctrlShift) {
        const index = getTabShortcutIndex(event);
        if (index >= 0 && index < orderedClients.length) {
          event.preventDefault();
          openClient(orderedClients[index]);
          return;
        }
      }

      // Alt+Shift+Arrow: quick split active pane
      if (
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        (event.code === "ArrowRight" ||
          event.code === "ArrowLeft" ||
          event.code === "ArrowDown" ||
          event.code === "ArrowUp")
      ) {
        event.preventDefault();
        const zone: SplitZone =
          event.code === "ArrowRight"
            ? "right"
            : event.code === "ArrowLeft"
            ? "left"
            : event.code === "ArrowDown"
            ? "bottom"
            : "top";
        splitPane(activePaneIdRef.current, zone);
        return;
      }

    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activateTabInPane,
    addTab,
    clearActiveTerminal,
    closeTab,
    openClient,
    openSearch,
    openFileManager,
    orderedClients,
    splitPane,
    switchTab,
    toggleFullscreen,
  ]);

  const recoverableSessionGroups = useMemo<RecoverableSessionGroup[]>(() => {
    if (recoverableSessions.length === 0) {
      return [];
    }
    const clientsMap = new Map(clients.map((item) => [item.uuid, item]));
    const groups = new Map<string, RecoverableSessionGroup>();
    for (const session of recoverableSessions) {
      const existing = groups.get(session.uuid);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const client = clientsMap.get(session.uuid);
      groups.set(session.uuid, {
        uuid: session.uuid,
        name: client?.name || session.uuid || t("terminal.server"),
        count: 1,
      });
    }
    return Array.from(groups.values());
  }, [clients, recoverableSessions, t]);

  const showRecoverableDialog =
    recoverableDialogOpen && !clientsLoading && recoverableSessions.length > 0;

  const handleTerminateRecoverableSessions = useCallback(async () => {
    if (recoverableSubmitting) {
      return;
    }
    setRecoverableSubmitting(true);
    try {
      const requestIds = recoverableSessions.map((session) => session.request_id);
      if (requestIds.length > 0) {
        await call("admin:terminateTerminalSessions", {
          request_ids: requestIds,
        });
      }
      setRecoverableSessions([]);
      setRecoverableDialogOpen(false);
    } catch (error) {
      console.error("Failed to terminate recoverable terminal sessions:", error);
      toast.error(
        t("terminal.recoverable.terminate_failed", "结束会话失败，请重试"),
      );
    } finally {
      setRecoverableSubmitting(false);
    }
  }, [call, recoverableSessions, recoverableSubmitting, t]);

  const handleRecoverSessions = useCallback(async () => {
    if (recoverableSubmitting) {
      return;
    }
    setRecoverableSubmitting(true);
    try {
      let targetSessions = recoverableSessions;
      try {
        const latest = await call<undefined, RecoverableTerminalSession[]>(
          "admin:listRecoverableTerminalSessions",
        );
        if (Array.isArray(latest)) {
          const expectedIds = new Set(
            recoverableSessions.map((session) => session.request_id),
          );
          targetSessions = latest.filter((session) =>
            expectedIds.has(session.request_id),
          );
        }
      } catch {
        // Fall back to cached list; server attach enforces single-browser uniqueness.
      }

      if (targetSessions.length === 0) {
        setRecoverableSessions([]);
        setRecoverableDialogOpen(false);
        toast.info(
          t(
            "terminal.recoverable.none_left",
            "可恢复的会话已在其他标签页处理或已过期",
          ),
        );
        return;
      }

      const clientsMap = new Map(clients.map((item) => [item.uuid, item]));
      const newTabs = targetSessions.map((session) => {
        const client: TerminalClient = clientsMap.get(session.uuid) ?? {
          uuid: session.uuid,
          name: session.uuid,
          os: "",
        };
        return createTab(
          client,
          undefined,
          t("terminal.server"),
          session.request_id,
        );
      });

      updateTabs([...tabsRef.current, ...newTabs]);
      let nextTree = paneTreeRef.current;
      const targetPaneId =
        activePaneIdRef.current || collectLeaves(nextTree)[0]?.id || "";
      for (const [index, tab] of newTabs.entries()) {
        nextTree = appendTabToLeaf(nextTree, targetPaneId, tab.id, index === 0);
      }
      updatePaneTree(nextTree);
      const firstTab = newTabs[0];
      if (firstTab) {
        const owner = findLeafByTabId(nextTree, firstTab.id);
        if (owner) {
          activePaneIdRef.current = owner.id;
          setActivePaneId(owner.id);
        }
      }
      setRecoverableSessions([]);
      setRecoverableDialogOpen(false);
    } finally {
      setRecoverableSubmitting(false);
    }
  }, [
    call,
    clients,
    recoverableSessions,
    recoverableSubmitting,
    t,
    updatePaneTree,
    updateTabs,
  ]);

  const sessionsReady = twoFaResolved;

  return {
    onboardingAuthenticated,
    t,
    appearance,
    clients,
    clientsLoading,
    showRecoverableDialog,
    recoverableSessionsCount: recoverableSessions.length,
    recoverableSessionGroups,
    recoverableSubmitting,
    tabs,
    paneTree,
    leaves,
    activePaneId: resolvedActivePane?.id ?? activePaneId,
    activeTabId,
    editingTabId,
    renameDraft,
    serverMenuPaneId,
    isSidebarOpen,
    leftWidth,
    httpsCalloutOpen,
    twoFaEnabled,
    searchOpen,
    searchTerm,
    searchResultIndex,
    searchResultCount,
    searchCaseSensitive,
    searchUseRegex,
    resourceMonitorServers,
    tabLatencies,
    containerRef,
    sessionsReady,
    setActiveTabId,
    focusPane,
    activateTabInPane,
    setServerMenuPaneId,
    setRenameDraft,
    setIsSidebarOpen,
    setHttpsCalloutOpen,
    handleSearchTermChange,
    handleFindNext,
    handleFindPrevious,
    handleToggleCaseSensitive,
    handleToggleUseRegex,
    toggleResourceMonitor,
    openSearch,
    openFileManager,
    closeSearch,
    handleApiChange,
    handleLatencyChange,
    startDragging,
    addTab,
    openClient,
    startRename,
    commitRename,
    cancelRename,
    duplicateTab,
    exportText,
    colorTab,
    closeTab,
    reorderTab,
    splitPane,
    moveTab,
    resizeSplit,
    fitAllSessions,
    handleRecoverSessions,
    handleTerminateRecoverableSessions,
  };
};
