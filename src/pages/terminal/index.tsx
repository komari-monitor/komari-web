import "@xterm/xterm/css/xterm.css";
import { Theme } from "@radix-ui/themes";
import TerminalNotices from "./TerminalNotices";
import TerminalResourceMonitor from "./TerminalResourceMonitor";
import TerminalWorkspace from "./TerminalWorkspace";
import RecoverableSessionsDialog from "./RecoverableSessionsDialog";
import TerminalSettingsDialog from "./TerminalSettingsDialog";
import { useTerminalPage } from "./useTerminalPage";
import { lazy, Suspense, useState } from "react";
import TerminalGuide from "@/components/onboarding/TerminalGuide";

const FileEditorDialog = lazy(() => import("./FileEditorDialog"));

const TerminalPage = () => {
  const {
    onboardingAuthenticated,
    t,
    appearance,
    clients,
    clientsLoading,
    showRecoverableDialog,
    recoverableSessionsCount,
    recoverableSessionGroups,
    recoverableSubmitting,
    tabs,
    paneTree,
    leaves,
    activePaneId,
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
    terminalSettings,
    settingsOpen,
    setSettingsOpen,
    updateTerminalSettings,
    resetTerminalSettings,
    containerRef,
    sessionsReady,
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
    handleTitleChange,
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
    splitPane,
    moveTab,
    resizeSplit,
    fitAllSessions,
    handleRecoverSessions,
    handleTerminateRecoverableSessions,
  } = useTerminalPage();

  const [editorUuid, setEditorUuid] = useState<string | null>(null);
  const [workbenchMenuPaneId, setWorkbenchMenuPaneId] = useState<string | null>(
    null,
  );
  const editorClient = editorUuid
    ? clients.find((item) => item.uuid === editorUuid)
    : undefined;

  return (
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
          <TerminalWorkspace
            containerRef={containerRef}
            isSidebarOpen={isSidebarOpen}
            leftWidth={leftWidth}
            tabs={tabs}
            paneTree={paneTree}
            leaves={leaves}
            activePaneId={activePaneId}
            clients={clients}
            clientsLoading={clientsLoading}
            activeTabId={activeTabId}
            editingTabId={editingTabId}
            renameDraft={renameDraft}
            serverMenuPaneId={serverMenuPaneId}
            workbenchMenuPaneId={workbenchMenuPaneId}
            resourceMonitorServers={resourceMonitorServers}
            tabLatencies={tabLatencies}
            sessionsReady={sessionsReady}
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
            onLatencyChange={handleLatencyChange}
            onTitleChange={handleTitleChange}
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            onStartDragging={startDragging}
            onFocusPane={focusPane}
            onActivateTab={activateTabInPane}
            onServerMenuOpenChange={(paneId, open) => {
              setServerMenuPaneId(open ? paneId : null);
              if (open) setWorkbenchMenuPaneId(null);
            }}
            onWorkbenchMenuOpenChange={(paneId, open) => {
              setWorkbenchMenuPaneId(open ? paneId : null);
              if (open) setServerMenuPaneId(null);
            }}
            onOpenTerminalClient={(client, paneId) => openClient(client, paneId)}
            onOpenWorkbenchClient={(client) => {
              setEditorUuid(client.uuid);
              setWorkbenchMenuPaneId(null);
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
            onToggleResourceWindow={toggleResourceMonitor}
            onColor={colorTab}
            onClose={closeTab}
            onReorderTab={reorderTab}
            onSplitPane={splitPane}
            onMoveTab={moveTab}
            onResizeSplit={resizeSplit}
            onResizeSplitEnd={fitAllSessions}
            terminalSettings={terminalSettings}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        <TerminalSettingsDialog
          open={settingsOpen}
          settings={terminalSettings}
          onChange={updateTerminalSettings}
          onReset={resetTerminalSettings}
          onClose={() => setSettingsOpen(false)}
        />

        <TerminalResourceMonitor
          clients={clients}
          servers={resourceMonitorServers}
          onRemove={toggleResourceMonitor}
        />
        <TerminalGuide
          authenticated={onboardingAuthenticated}
          hasTabs={!clientsLoading && tabs.length > 0}
          blocked={
            Boolean(showRecoverableDialog) ||
            Boolean(editorUuid) ||
            Boolean(serverMenuPaneId) ||
            Boolean(workbenchMenuPaneId) ||
            Boolean(editingTabId) ||
            Boolean(settingsOpen)
          }
        />

        <RecoverableSessionsDialog
          open={showRecoverableDialog}
          totalCount={recoverableSessionsCount}
          groups={recoverableSessionGroups}
          submitting={recoverableSubmitting}
          onTerminate={() => {
            void handleTerminateRecoverableSessions();
          }}
          onRecover={() => {
            void handleRecoverSessions();
          }}
        />

        {editorUuid && (
          <Suspense fallback={null}>
            <FileEditorDialog
              open
              uuid={editorUuid}
              serverName={editorClient?.name}
              serverOs={editorClient?.os}
              initialFile={null}
              fontFamily={terminalSettings.fontFamily}
              terminalSettings={terminalSettings}
              onOpenChange={(open) => {
                if (!open) setEditorUuid(null);
              }}
            />
          </Suspense>
        )}
      </Theme>
  );
};

export default TerminalPage;
