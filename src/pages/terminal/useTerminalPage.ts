import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import throttle from "lodash/throttle";
import {
  defaultXtermjsSettings,
  useXtermjsSettings,
} from "@/hooks/useXtermjsSettings";
import type { XtermjsSettings } from "@/hooks/useXtermjsSettings";
import type { TerminalSessionApi } from "./TerminalSession";
import {
  createTab,
  createTabId,
  type CloseMode,
  type TerminalClient,
  type TerminalTab,
} from "./terminalTypes";

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
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
  } = useXtermjsSettings();
  const { t } = useTranslation();
  const [clients, setClients] = useState<TerminalClient[]>([]);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(window.innerWidth * 0.7);
  const [httpsCalloutOpen, setHttpsCalloutOpen] = useState(
    window.location.protocol !== "https:",
  );
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaResolved, setTwoFaResolved] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpInput, setOtpInput] = useState("");

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchUseRegex, setSearchUseRegex] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const initialUuidRef = useRef(
    new URLSearchParams(window.location.search).get("uuid"),
  );
  const tabsRef = useRef<TerminalTab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const sessionApisRef = useRef(new Map<string, TerminalSessionApi>());
  const [activeApi, setActiveApi] = useState<TerminalSessionApi | null>(null);

  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;

  const resolvedSettings: XtermjsSettings = settingsError
    ? defaultXtermjsSettings
    : settings;
  const appearance = {
    "--xterm-padding": `${resolvedSettings.terminalPadding}px`,
  } as CSSProperties;

  const updateTabs = useCallback((next: TerminalTab[]) => {
    tabsRef.current = next;
    setTabs(next);
  }, []);

  const orderedClients = useMemo(
    () =>
      [...clients].sort(
        (left, right) => (left.weight ?? 0) - (right.weight ?? 0),
      ),
    [clients],
  );

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/client/list")
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!mounted) {
          return;
        }
        const list = Array.isArray(data) ? (data as TerminalClient[]) : [];
        setClients(list);
        const initialUuid = initialUuidRef.current;
        if (!initialUuid) {
          return;
        }
        const client = list.find((item) => item.uuid === initialUuid);
        if (!client) {
          if (list.length === 0) {
            window.alert(t("terminal.no_active_connection"));
          }
          return;
        }
        if (tabsRef.current.length === 0) {
          const tab = createTab(client, undefined, t("terminal.server"));
          updateTabs([tab]);
          setActiveTabId(tab.id);
        }
      })
      .catch((error) => console.error("Failed to load clients:", error));

    return () => {
      mounted = true;
    };
  }, [t, updateTabs]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/me")
      .then((response) => response.json())
      .then((data: { two_factor?: boolean }) => {
        if (!mounted) {
          return;
        }
        const enabled = Boolean(data?.two_factor);
        setTwoFaEnabled(enabled);
        setTwoFaResolved(true);
        if (enabled) {
          setOtpDialogOpen(true);
        }
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
    if (tabs.length === 0) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }
    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!resolvedSettings.customCss) {
      return;
    }
    const style = document.createElement("style");
    style.id = "custom-xtermjs-style";
    style.textContent = resolvedSettings.customCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [resolvedSettings.customCss]);

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
    const resize = window.setTimeout(() => activeApiRef.current?.fit(), 100);
    return () => window.clearTimeout(resize);
  }, [activeApi, isClipboardOpen]);

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
    activeApiRef.current?.fit();
  }, []);

  const handleDrag = useCallback((clientX: number) => {
    if (!draggingRef.current || !containerRef.current) {
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const minLeft = Math.max(bounds.width * 0.3, 300);
    const maxLeft = bounds.width - 200;
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
    (client: TerminalClient) => {
      const tab = createTab(client, undefined, t("terminal.server"));
      updateTabs([...tabsRef.current, tab]);
      setActiveTabId(tab.id);
      setServerMenuOpen(false);
    },
    [t, updateTabs],
  );

  const duplicateTab = useCallback(
    (id: string) => {
      const source = tabsRef.current.find((item) => item.id === id);
      if (!source) {
        setServerMenuOpen(true);
        return;
      }
      const duplicate: TerminalTab = {
        ...source,
        id: createTabId(),
        color: null,
      };
      updateTabs([...tabsRef.current, duplicate]);
      setActiveTabId(duplicate.id);
    },
    [updateTabs],
  );

  const addTab = useCallback(() => {
    if (activeTabIdRef.current) {
      duplicateTab(activeTabIdRef.current);
    } else {
      setServerMenuOpen(true);
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
  }, []);

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

  const closeTabs = useCallback(
    (ids: string[]) => {
      const remove = new Set(ids);
      const previous = tabsRef.current;
      const activeId = activeTabIdRef.current;
      const activeIndex = previous.findIndex((tab) => tab.id === activeId);
      const next = previous.filter((tab) => !remove.has(tab.id));
      updateTabs(next);
      setEditingTabId((id) => (id && remove.has(id) ? null : id));
      if (activeId && remove.has(activeId)) {
        const nextActive =
          next[Math.min(Math.max(activeIndex, 0), next.length - 1)];
        setActiveTabId(nextActive?.id ?? null);
      }
    },
    [updateTabs],
  );

  const closeTab = useCallback(
    (id: string, mode: CloseMode) => {
      const index = tabsRef.current.findIndex((tab) => tab.id === id);
      if (index < 0) {
        return;
      }
      if (mode === "current") {
        closeTabs([id]);
      } else if (mode === "left") {
        closeTabs(tabsRef.current.slice(0, index).map((tab) => tab.id));
      } else if (mode === "right") {
        closeTabs(tabsRef.current.slice(index + 1).map((tab) => tab.id));
      } else {
        closeTabs(
          tabsRef.current.filter((tab) => tab.id !== id).map((tab) => tab.id),
        );
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

  const openSearch = useCallback((id?: string) => {
    if (id) {
      setActiveTabId(id);
    }
    setSearchOpen(true);
  }, []);

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
    (sourceId: string, targetId: string) => {
      const next = [...tabsRef.current];
      const sourceIndex = next.findIndex((tab) => tab.id === sourceId);
      const targetIndex = next.findIndex((tab) => tab.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return;
      }
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      updateTabs(next);
    },
    [updateTabs],
  );

  const switchTab = useCallback((direction: 1 | -1) => {
    const tabs = tabsRef.current;
    if (tabs.length < 2) {
      return;
    }
    const activeIndex = tabs.findIndex(
      (tab) => tab.id === activeTabIdRef.current,
    );
    const currentIndex = activeIndex < 0 ? 0 : activeIndex;
    const nextIndex =
      (currentIndex + direction + tabs.length) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  }, []);

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
        if (index >= 0 && index < tabsRef.current.length) {
          event.preventDefault();
          setActiveTabId(tabsRef.current[index].id);
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

    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    addTab,
    clearActiveTerminal,
    closeTab,
    openClient,
    openSearch,
    orderedClients,
    switchTab,
    toggleFullscreen,
  ]);

  const sendCommand = useCallback((command: string) => {
    const api = activeTabIdRef.current
      ? sessionApisRef.current.get(activeTabIdRef.current)
      : undefined;
    api?.send(`${command}\r`);
  }, []);

  const submitOtp = useCallback(() => {
    if (!otpInput) {
      return;
    }
    setOtpCode(otpInput);
    setOtpDialogOpen(false);
  }, [otpInput]);

  const otpReady = !twoFaEnabled || otpCode !== null;
  const sessionsReady = !settingsLoading && twoFaResolved && otpReady;
  const contextValue = useMemo(
    () => ({ terminal: activeApi?.terminal ?? null, sendCommand }),
    [activeApi, sendCommand],
  );

  return {
    t,
    settingsError,
    resolvedSettings,
    appearance,
    clients,
    tabs,
    activeTabId,
    editingTabId,
    renameDraft,
    serverMenuOpen,
    isClipboardOpen,
    leftWidth,
    httpsCalloutOpen,
    twoFaEnabled,
    otpCode,
    otpDialogOpen,
    otpInput,
    searchOpen,
    searchTerm,
    searchResultIndex,
    searchResultCount,
    searchCaseSensitive,
    searchUseRegex,
    containerRef,
    contextValue,
    sessionsReady,
    setActiveTabId,
    setServerMenuOpen,
    setRenameDraft,
    setOtpDialogOpen,
    setOtpInput,
    setIsClipboardOpen,
    setHttpsCalloutOpen,
    handleSearchTermChange,
    handleFindNext,
    handleFindPrevious,
    handleToggleCaseSensitive,
    handleToggleUseRegex,
    openSearch,
    closeSearch,
    handleApiChange,
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
    submitOtp,
  };
};
