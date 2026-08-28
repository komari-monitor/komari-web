import "@xterm/xterm/css/xterm.css";
import { Theme } from "@radix-ui/themes";
import { TerminalContext } from "@/contexts/TerminalContext";
import TerminalNotices from "./TerminalNotices";
import TerminalResourceMonitor from "./TerminalResourceMonitor";
import TerminalTabBar from "./TerminalTabBar";
import TerminalWorkspace from "./TerminalWorkspace";
import { useTerminalPage } from "./useTerminalPage";
import { lazy, Suspense, useState } from "react";

const FileEditorDialog = lazy(() => import("./FileEditorDialog"));

const TerminalPage = () => {
  const {
    t,
    resolvedSettings,
    appearance,
    clients,
    clientsLoading,
    tabs,
    activeTabId,
    editingTabId,
    renameDraft,
    serverMenuOpen,
    isClipboardOpen,
    sidebarTab,
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
    containerRef,
    contextValue,
    sessionsReady,
    setActiveTabId,
    setServerMenuOpen,
    setRenameDraft,
    setIsClipboardOpen,
    setSidebarTab,
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
    startDragging,
    openClient,
    startRename,
    commitRename,
    cancelRename,
    duplicateTab,
    exportText,
    colorTab,
    closeTab,
    reorderTab,
  } = useTerminalPage();

  const [editorUuid, setEditorUuid] = useState<string | null>(null);
  const [workbenchMenuOpen, setWorkbenchMenuOpen] = useState(false);

  return (
    <TerminalContext.Provider value={contextValue}>
      <Theme
        appearance="dark"
        className="km-page-terminal fixed inset-0 h-screen w-screen overflow-hidden bg-[#1e1e1e]"
      >
        <TerminalNotices
          httpsCalloutOpen={httpsCalloutOpen}
          onDismissHttpsCallout={() => setHttpsCalloutOpen(false)}
        />

        <div
          className="km-terminal-shell flex h-screen w-screen min-w-0 flex-col bg-[#1e1e1e] text-[#cccccc]"
          style={appearance}
        >
          <TerminalTabBar
            tabs={tabs}
            clients={clients}
            clientsLoading={clientsLoading}
            activeTabId={activeTabId}
            editingTabId={editingTabId}
            renameDraft={renameDraft}
            serverMenuOpen={serverMenuOpen}
            onServerMenuOpenChange={(open) => {
              setServerMenuOpen(open);
              if (open) setWorkbenchMenuOpen(false);
            }}
            workbenchMenuOpen={workbenchMenuOpen}
            onWorkbenchMenuOpenChange={(open) => {
              setWorkbenchMenuOpen(open);
              if (open) setServerMenuOpen(false);
            }}
            onActivate={setActiveTabId}
            onOpenTerminalClient={openClient}
            onOpenWorkbenchClient={(client) => {
              setEditorUuid(client.uuid);
              setWorkbenchMenuOpen(false);
            }}
            onStartRename={startRename}
            onDraftChange={setRenameDraft}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDuplicate={duplicateTab}
            onExportText={exportText}
            onFind={openSearch}
            onOpenFileManager={openFileManager}
            onOpenEditor={(tabId) => {
              const uuid = tabs.find((tab) => tab.id === tabId)?.uuid;
              if (uuid) setEditorUuid(uuid);
            }}
            resourceMonitorServers={resourceMonitorServers}
            onToggleResourceWindow={toggleResourceMonitor}
            onColor={colorTab}
            onClose={closeTab}
            onReorder={reorderTab}
          />

          <TerminalWorkspace
            containerRef={containerRef}
            isClipboardOpen={isClipboardOpen}
            sidebarTab={sidebarTab}
            leftWidth={leftWidth}
            tabs={tabs}
            clientsLoading={clientsLoading}
            activeTabId={activeTabId}
            sessionsReady={sessionsReady}
            settings={resolvedSettings}
            twoFaEnabled={twoFaEnabled}
            disconnectMessage={t("terminal.disconnect")}
            searchOpen={searchOpen}
            searchTerm={searchTerm}
            searchResultIndex={searchResultIndex}
            searchResultCount={searchResultCount}
            searchCaseSensitive={searchCaseSensitive}
            searchUseRegex={searchUseRegex}
            onSearchTermChange={handleSearchTermChange}
            onFindNext={handleFindNext}
            onFindPrevious={handleFindPrevious}
            onToggleCaseSensitive={handleToggleCaseSensitive}
            onToggleUseRegex={handleToggleUseRegex}
            onCloseSearch={closeSearch}
            onApiChange={handleApiChange}
            onToggleSidebar={() => setIsClipboardOpen((open) => !open)}
            onSidebarTabChange={(tab) => {
              setSidebarTab(tab);
              setIsClipboardOpen(true);
            }}
            onStartDragging={startDragging}
            onOpenTerminalMenu={() => {
              setWorkbenchMenuOpen(false);
              setServerMenuOpen(true);
            }}
            onOpenWorkbenchMenu={() => {
              setServerMenuOpen(false);
              setWorkbenchMenuOpen(true);
            }}
          />
        </div>

        <TerminalResourceMonitor
          clients={clients}
          servers={resourceMonitorServers}
          onRemove={toggleResourceMonitor}
        />

        {editorUuid && (
          <Suspense fallback={null}>
            <FileEditorDialog
              open
              uuid={editorUuid}
              initialFile={null}
              fontFamily={resolvedSettings.terminalOptions.fontFamily}
              onOpenChange={(open) => {
                if (!open) setEditorUuid(null);
              }}
            />
          </Suspense>
        )}
      </Theme>
    </TerminalContext.Provider>
  );
};

export default TerminalPage;
