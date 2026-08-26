import "@xterm/xterm/css/xterm.css";
import { Theme } from "@radix-ui/themes";
import { Toaster } from "@/components/ui/sonner";
import { TerminalContext } from "@/contexts/TerminalContext";
import TerminalNotices from "./TerminalNotices";
import TerminalOtpDialog from "./TerminalOtpDialog";
import TerminalTabBar from "./TerminalTabBar";
import TerminalWorkspace from "./TerminalWorkspace";
import { useTerminalPage } from "./useTerminalPage";

const TerminalPage = () => {
  const {
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
  } = useTerminalPage();

  return (
    <TerminalContext.Provider value={contextValue}>
      <Theme
        appearance="dark"
        className="km-page-terminal fixed inset-0 h-screen w-screen overflow-hidden bg-[#1e1e1e]"
      >
        <Toaster theme="dark" />
        <TerminalNotices
          settingsError={settingsError}
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
            activeTabId={activeTabId}
            editingTabId={editingTabId}
            renameDraft={renameDraft}
            serverMenuOpen={serverMenuOpen}
            onServerMenuOpenChange={setServerMenuOpen}
            onActivate={setActiveTabId}
            onAdd={addTab}
            onOpenClient={openClient}
            onStartRename={startRename}
            onDraftChange={setRenameDraft}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDuplicate={duplicateTab}
            onExportText={exportText}
            onFind={openSearch}
            onColor={colorTab}
            onClose={closeTab}
            onReorder={reorderTab}
          />

          <TerminalWorkspace
            containerRef={containerRef}
            isClipboardOpen={isClipboardOpen}
            leftWidth={leftWidth}
            tabs={tabs}
            activeTabId={activeTabId}
            sessionsReady={sessionsReady}
            settings={resolvedSettings}
            twoFaEnabled={twoFaEnabled}
            otpCode={otpCode}
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
            onToggleClipboard={() => setIsClipboardOpen((open) => !open)}
            onStartDragging={startDragging}
            onAdd={addTab}
          />
        </div>

        <TerminalOtpDialog
          open={otpDialogOpen}
          otpCode={otpCode}
          otpInput={otpInput}
          onOpenChange={setOtpDialogOpen}
          onOtpInputChange={setOtpInput}
          onSubmit={submitOtp}
          onCancel={() => {
            window.location.href = "/";
          }}
        />
      </Theme>
    </TerminalContext.Provider>
  );
};

export default TerminalPage;
