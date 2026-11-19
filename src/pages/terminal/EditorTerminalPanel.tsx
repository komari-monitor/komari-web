import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNodeList } from "@/contexts/NodeListContext";
import { MOTION_SPRING } from "@/lib/motion";
import type { TerminalSessionApi } from "./TerminalSession";
import { TerminalPaneStage } from "./TerminalWorkspace";
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
import {
  fetchTerminalSettingsFromTheme,
  getCachedTerminalSettings,
  MIN_TERMINAL_FONT_SIZE,
  type TerminalSettings,
} from "./terminalDefaults";
import {
  createTab,
  createTabId,
  type CloseMode,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";

interface EditorTerminalPanelProps {
  uuid: string;
  visible: boolean;
  serverName?: string;
  serverOs?: string;
  terminalSettings?: TerminalSettings;
  hasBackground?: boolean;
  onClose: () => void;
}

const MIN_TERMINAL_HEIGHT = 120;
const MAX_TERMINAL_HEIGHT = 600;
const DEFAULT_TERMINAL_HEIGHT = 220;
const EDITOR_TERMINAL_FONT_SIZE_DELTA = 3;
const EDITOR_TERMINAL_PADDING = 8;

const isNonTerminalInputFocused = () => {
  const activeEl = document.activeElement;
  return (
    activeEl instanceof HTMLElement &&
    activeEl.matches("input, textarea, [contenteditable='true']") &&
    !activeEl.classList.contains("xterm-helper-textarea")
  );
};

const EditorTerminalPanel = ({
  uuid,
  visible,
  serverName,
  serverOs,
  terminalSettings: terminalSettingsProp,
  hasBackground = false,
  onClose,
}: EditorTerminalPanelProps) => {
  const { t } = useTranslation();
  const { nodeList } = useNodeList(false) ?? { nodeList: [] };

  const node = useMemo(
    () => (nodeList ?? []).find((item) => item.uuid === uuid),
    [nodeList, uuid],
  );
  const resolvedServerName = serverName?.trim() || node?.name?.trim() || "";
  const resolvedServerOs = serverOs?.trim() || node?.os?.trim() || "";
  const fallbackTitle = t("terminal.title", "Terminal");

  const currentClient = useMemo<TerminalClient>(
    () => ({
      uuid,
      name: resolvedServerName || fallbackTitle,
      os: resolvedServerOs,
    }),
    [fallbackTitle, resolvedServerName, resolvedServerOs, uuid],
  );
  const clients = useMemo(() => [currentClient], [currentClient]);
  const currentClientRef = useRef<TerminalClient>(currentClient);
  currentClientRef.current = currentClient;

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaResolved, setTwoFaResolved] = useState(false);
  const [loadedSettings, setLoadedSettings] = useState(
    () => terminalSettingsProp ?? getCachedTerminalSettings(),
  );
  const terminalSettings = terminalSettingsProp ?? loadedSettings;
  const editorFontSize = Math.max(
    MIN_TERMINAL_FONT_SIZE,
    terminalSettings.fontSize - EDITOR_TERMINAL_FONT_SIZE_DELTA,
  );

  const [height, setHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  // 拖动分隔条时高度必须 1:1 跟手；弹簧只用于展开/收起
  const [resizing, setResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  const [initialState] = useState(() => {
    const initialTab = createTab(
      {
        uuid,
        name: resolvedServerName || fallbackTitle,
        os: resolvedServerOs,
      },
      undefined,
      fallbackTitle,
    );
    const initialLeaf = createLeafPane([initialTab.id], initialTab.id);
    return {
      tabs: [initialTab],
      paneTree: initialLeaf as TerminalPaneNode,
      activePaneId: initialLeaf.id,
      autoTitledIds: resolvedServerName ? new Set<string>() : new Set([initialTab.id]),
    };
  });

  const [tabs, setTabs] = useState<TerminalTab[]>(initialState.tabs);
  const [paneTree, setPaneTree] = useState<TerminalPaneNode>(
    initialState.paneTree,
  );
  const [activePaneId, setActivePaneId] = useState<string>(
    initialState.activePaneId,
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [tabLatencies, setTabLatencies] = useState<Record<string, number>>({});

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchUseRegex, setSearchUseRegex] = useState(false);

  const autoTitledIdsRef = useRef<Set<string>>(initialState.autoTitledIds);
  const tabsRef = useRef<TerminalTab[]>(tabs);
  const paneTreeRef = useRef<TerminalPaneNode>(paneTree);
  const activePaneIdRef = useRef<string>(activePaneId);
  const activeTabIdRef = useRef<string | null>(null);
  const editingTabIdRef = useRef<string | null>(editingTabId);
  const sessionApisRef = useRef(new Map<string, TerminalSessionApi>());
  const [activeApi, setActiveApi] = useState<TerminalSessionApi | null>(null);
  const activeApiRef = useRef<TerminalSessionApi | null>(null);
  activeApiRef.current = activeApi;
  const searchSelectionRef = useRef(false);
  const searchSelectionResetTimerRef = useRef<number | null>(null);
  const wasVisibleRef = useRef(visible);

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
  editingTabIdRef.current = editingTabId;

  const updateTabs = useCallback((next: TerminalTab[]) => {
    tabsRef.current = next;
    setTabs(next);
  }, []);

  const updatePaneTree = useCallback((next: TerminalPaneNode) => {
    paneTreeRef.current = next;
    setPaneTree(next);
  }, []);

  // Once server metadata resolves asynchronously, backfill any initial fallback tab title.
  useEffect(() => {
    if (!resolvedServerName || autoTitledIdsRef.current.size === 0) return;
    const pending = autoTitledIdsRef.current;
    const hasMatch = tabsRef.current.some((tab) => pending.has(tab.id));
    if (!hasMatch) {
      pending.clear();
      return;
    }
    updateTabs(
      tabsRef.current.map((tab) =>
        pending.has(tab.id) ? { ...tab, title: resolvedServerName } : tab,
      ),
    );
    pending.clear();
  }, [resolvedServerName, updateTabs]);

  useEffect(() => {
    if (!resolvedActivePane) return;
    if (resolvedActivePane.id !== activePaneId) {
      setActivePaneId(resolvedActivePane.id);
    }
  }, [activePaneId, resolvedActivePane]);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/me")
      .then((response) => response.json())
      .then((data: { "2fa_enabled"?: boolean }) => {
        if (!mounted) return;
        setTwoFaEnabled(Boolean(data?.["2fa_enabled"]));
        setTwoFaResolved(true);
      })
      .catch(() => {
        if (mounted) setTwoFaResolved(true);
      });
    if (!terminalSettingsProp) {
      void fetchTerminalSettingsFromTheme()
        .then((loaded) => {
          if (mounted) setLoadedSettings(loaded);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [terminalSettingsProp]);

  useEffect(() => {
    if (document.getElementById("terminal-search-decoration-style")) {
      return;
    }
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

  const fitAllSessions = useCallback(() => {
    requestAnimationFrame(() => {
      for (const api of sessionApisRef.current.values()) {
        api.fit();
        if (api.terminal.rows > 0) {
          api.terminal.refresh(0, api.terminal.rows - 1);
        }
      }
    });
  }, []);

  const focusPane = useCallback((paneId: string) => {
    const leaf = findLeaf(paneTreeRef.current, paneId);
    if (!leaf) return;
    if (activePaneIdRef.current !== paneId) {
      activePaneIdRef.current = paneId;
      setActivePaneId(paneId);
    }
    if (leaf.activeTabId && !editingTabIdRef.current) {
      const api = sessionApisRef.current.get(leaf.activeTabId);
      requestAnimationFrame(() => {
        if (editingTabIdRef.current || isNonTerminalInputFocused()) return;
        api?.terminal.focus();
      });
    }
  }, []);

  const activateTabInPane = useCallback(
    (paneId: string, tabId: string) => {
      const nextTree = updateLeaf(paneTreeRef.current, paneId, (leaf) =>
        leaf.tabIds.includes(tabId) ? { ...leaf, activeTabId: tabId } : leaf,
      );
      updatePaneTree(nextTree);
      activePaneIdRef.current = paneId;
      setActivePaneId(paneId);
      requestAnimationFrame(() => {
        const api = sessionApisRef.current.get(tabId);
        api?.fit();
        if (!editingTabIdRef.current && !isNonTerminalInputFocused()) {
          api?.terminal.focus();
        }
      });
    },
    [updatePaneTree],
  );

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

  const createNewTab = useCallback(
    (targetPaneId?: string) => {
      const client = currentClientRef.current;
      const tab = createTab(client, undefined, fallbackTitle);
      if (!resolvedServerName) {
        autoTitledIdsRef.current.add(tab.id);
      }
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
    },
    [fallbackTitle, resolvedServerName, updatePaneTree, updateTabs],
  );

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
          if (!(id in current)) return current;
          const next = { ...current };
          delete next[id];
          return next;
        }
        if (current[id] === latencyMs) return current;
        return { ...current, [id]: latencyMs };
      });
    },
    [],
  );

  const handleTitleChange = useCallback(
    (id: string, terminalTitle: string) => {
      const normalized = terminalTitle.trim();
      const current = tabsRef.current.find((tab) => tab.id === id);
      if (!current || (current.terminalTitle ?? "") === normalized) {
        return;
      }
      updateTabs(
        tabsRef.current.map((tab) =>
          tab.id === id ? { ...tab, terminalTitle: normalized } : tab,
        ),
      );
    },
    [updateTabs],
  );

  useEffect(() => {
    const api = activeTabId
      ? (sessionApisRef.current.get(activeTabId) ?? null)
      : null;
    setActiveApi(api);
  }, [activeTabId]);

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
    return () => {
      resetSearchSelectionTimer();
    };
  }, [resetSearchSelectionTimer]);

  useEffect(() => {
    const terminal = activeApi?.terminal;
    if (!terminal) return;
    const disposable = terminal.onSelectionChange(() => {
      if (!searchSelectionRef.current) {
        setTerminalSelectionTheme(terminal, false);
      }
    });
    return () => disposable.dispose();
  }, [activeApi, setTerminalSelectionTheme]);

  useEffect(() => {
    const resize = window.setTimeout(() => fitAllSessions(), 100);
    return () => window.clearTimeout(resize);
  }, [activeApi, fitAllSessions, leaves.length]);

  // Keep sessions alive in the background while hidden; sync inert/focus/fit across visibility toggles.
  useEffect(() => {
    const el = panelRef.current;
    if (el) {
      el.inert = !visible;
    }

    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (!visible) {
      if (editingTabIdRef.current) {
        editingTabIdRef.current = null;
        setEditingTabId(null);
      }
      activeApiRef.current?.terminal.blur();
      if (
        el &&
        document.activeElement instanceof HTMLElement &&
        el.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
      return;
    }

    if (!wasVisible) {
      if (tabsRef.current.length === 0) {
        createNewTab();
      }
      const frame = requestAnimationFrame(() => {
        fitAllSessions();
        const currentTabId = activeTabIdRef.current;
        if (currentTabId && !editingTabIdRef.current) {
          sessionApisRef.current.get(currentTabId)?.terminal.focus();
        }
      });
      const timer = window.setTimeout(() => {
        fitAllSessions();
      }, 180);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }
  }, [createNewTab, fitAllSessions, visible]);

  const startRename = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((item) => item.id === id);
      if (!tab) return;
      editingTabIdRef.current = id;
      setActiveTabId(id);
      setEditingTabId(id);
      setRenameDraft(tab.title);
    },
    [setActiveTabId],
  );

  const commitRename = useCallback(() => {
    const id = editingTabIdRef.current;
    const value = renameDraft.trim();
    editingTabIdRef.current = null;
    setEditingTabId(null);
    if (!id) return;
    if (value) {
      autoTitledIdsRef.current.delete(id);
      updateTabs(
        tabsRef.current.map((tab) =>
          tab.id === id ? { ...tab, title: value } : tab,
        ),
      );
    }
    const api = sessionApisRef.current.get(id);
    requestAnimationFrame(() => {
      if (!editingTabIdRef.current) {
        api?.terminal.focus();
      }
    });
  }, [renameDraft, updateTabs]);

  const cancelRename = useCallback(() => {
    const id = editingTabIdRef.current;
    editingTabIdRef.current = null;
    setEditingTabId(null);
    if (id) {
      const api = sessionApisRef.current.get(id);
      requestAnimationFrame(() => {
        if (!editingTabIdRef.current) {
          api?.terminal.focus();
        }
      });
    }
  }, []);

  const duplicateTab = useCallback(
    (id: string) => {
      const source = tabsRef.current.find((item) => item.id === id);
      if (!source) {
        createNewTab();
        return;
      }
      const duplicate: TerminalTab = {
        ...source,
        id: createTabId(),
        terminalTitle: undefined,
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
    [createNewTab, updatePaneTree, updateTabs],
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
      const newTab: TerminalTab = source
        ? {
            ...source,
            id: createTabId(),
            terminalTitle: undefined,
            color: null,
            requestId: undefined,
          }
        : createTab(currentClientRef.current, undefined, fallbackTitle);
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
    [fallbackTitle, fitAllSessions, updatePaneTree, updateTabs],
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

  const reorderTab = useCallback(
    (paneId: string, sourceId: string, targetId: string) => {
      updatePaneTree(
        reorderTabInLeaf(paneTreeRef.current, paneId, sourceId, targetId),
      );
    },
    [updatePaneTree],
  );

  const colorTab = useCallback(
    (id: string, color: string | null) => {
      updateTabs(
        tabsRef.current.map((tab) => (tab.id === id ? { ...tab, color } : tab)),
      );
    },
    [updateTabs],
  );

  const closeTabs = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const remove = new Set(ids);
      for (const id of remove) {
        autoTitledIdsRef.current.delete(id);
      }
      const next = tabsRef.current.filter((tab) => !remove.has(tab.id));
      updateTabs(next);
      const nextTree = removeTabsFromTree(paneTreeRef.current, remove);
      updatePaneTree(nextTree);
      const remainingLeaves = collectLeaves(nextTree);
      if (
        !remainingLeaves.some((leaf) => leaf.id === activePaneIdRef.current)
      ) {
        const fallbackLeaf = remainingLeaves[0];
        if (fallbackLeaf) {
          activePaneIdRef.current = fallbackLeaf.id;
          setActivePaneId(fallbackLeaf.id);
        }
      }
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
      if (index < 0) return;
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
    const tab = tabsRef.current.find((item) => item.id === id);
    if (!api || !tab) return;
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

  const openSearch = useCallback(
    (id?: string) => {
      if (id) {
        setActiveTabId(id);
      }
      setSearchOpen(true);
    },
    [setActiveTabId],
  );

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
      if (!activeApi?.searchAddon) return;
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

  useEffect(() => {
    if (!searchOpen || !searchTerm || !activeApi?.searchAddon) return;
    performSearch(searchTerm, searchCaseSensitive, searchUseRegex, "next", true);
  }, [
    activeApi,
    performSearch,
    searchCaseSensitive,
    searchOpen,
    searchTerm,
    searchUseRegex,
  ]);

  useEffect(() => {
    if (!activeApi?.searchAddon) return;
    const disposable = activeApi.searchAddon.onDidChangeResults((event) => {
      setSearchResultIndex(event.resultIndex);
      setSearchResultCount(event.resultCount);
    });
    return () => disposable.dispose();
  }, [activeApi]);

  // Scoped Ctrl+Shift+F inside the editor terminal opens terminal Find.
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const targetInPanel =
        (event.target instanceof Node && panel.contains(event.target)) ||
        (document.activeElement instanceof Node &&
          panel.contains(document.activeElement));
      if (!targetInPanel) return;

      const ctrlShift =
        event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
      if (
        ctrlShift &&
        (event.code === "KeyF" || event.key.toLowerCase() === "f")
      ) {
        event.preventDefault();
        event.stopPropagation();
        openSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [openSearch, visible]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dragRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    setHeight(
      Math.round(
        Math.max(
          MIN_TERMINAL_HEIGHT,
          Math.min(
            MAX_TERMINAL_HEIGHT,
            resizeState.startHeight + resizeState.startY - event.clientY,
          ),
        ),
      ),
    );
  };

  const handleResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dragRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(resizeState.pointerId)) {
      event.currentTarget.releasePointerCapture(resizeState.pointerId);
    }
    fitAllSessions();
  };

  return (
    <motion.div
      ref={panelRef}
      // surface 层：底部终端面板从下边缘长出来，收起时原路返回并保留内部会话继续运行
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: visible ? height : 0, opacity: visible ? 1 : 0 }}
      transition={
        resizing
          ? { height: { duration: 0 }, opacity: { duration: 0 } }
          : MOTION_SPRING.soft
      }
      aria-hidden={!visible}
      className={`km-editor-terminal-panel shrink-0 overflow-hidden ${
        visible ? "" : "pointer-events-none"
      }`}
    >
      <div
        style={{ height }}
        className={`flex w-full flex-col overflow-hidden ${
          hasBackground
            ? "border-t border-white/[0.08] bg-[#121212]/48 backdrop-blur-[6px]"
            : "border-t border-[#2b2b2b] bg-[#000000]"
        }`}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("terminal.title", "Terminal")}
          className="h-1 w-full shrink-0 cursor-row-resize touch-none bg-transparent transition-colors hover:bg-[#55a7e0]/60"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        />
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <TerminalPaneStage
            tabs={tabs}
            paneTree={paneTree}
            leaves={leaves}
            activePaneId={resolvedActivePane?.id ?? activePaneId}
            clients={clients}
            clientsLoading={false}
            editingTabId={editingTabId}
            renameDraft={renameDraft}
            tabLatencies={tabLatencies}
            sessionsReady={twoFaResolved}
            twoFaEnabled={twoFaEnabled}
            disconnectMessage={t("terminal.disconnect", "Connection lost")}
            searchOpen={searchOpen}
            searchTerm={searchTerm}
            searchResultIndex={searchResultIndex}
            searchResultCount={searchResultCount}
            searchCaseSensitive={searchCaseSensitive}
            searchUseRegex={searchUseRegex}
            onSearchTermChange={setSearchTerm}
            onFindNext={handleFindNext}
            onFindPrevious={handleFindPrevious}
            onToggleCaseSensitive={handleToggleCaseSensitive}
            onToggleUseRegex={handleToggleUseRegex}
            onCloseSearch={closeSearch}
            onApiChange={handleApiChange}
            onLatencyChange={handleLatencyChange}
            onTitleChange={handleTitleChange}
            onFocusPane={focusPane}
            onActivateTab={activateTabInPane}
            onCreateSingleServerTab={createNewTab}
            onStartRename={startRename}
            onDraftChange={setRenameDraft}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDuplicate={duplicateTab}
            onExportText={exportText}
            onFind={openSearch}
            onColor={colorTab}
            onClose={closeTab}
            onReorderTab={reorderTab}
            onSplitPane={splitPane}
            onMoveTab={moveTab}
            onResizeSplit={resizeSplit}
            onResizeSplitEnd={fitAllSessions}
            terminalSettings={terminalSettings}
            fontSize={editorFontSize}
            padding={EDITOR_TERMINAL_PADDING}
            hasBackground={hasBackground}
            tabBarPosition="right"
            singleServerMode
            onHidePanel={onClose}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default EditorTerminalPanel;
