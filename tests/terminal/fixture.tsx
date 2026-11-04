import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "../../src/i18n/config";
import "../../src/global.css";
import "@xterm/xterm/css/xterm.css";
import TerminalSession from "../../src/pages/terminal/TerminalSession";
import type { TerminalSessionApi } from "../../src/pages/terminal/TerminalSession";

declare global {
  interface Window {
    terminalApi: TerminalSessionApi | null;
  }
}

createRoot(document.getElementById("root")!).render(
  <>
    <TerminalSession
      uuid="test-client"
      active
      twoFaEnabled={false}
      disconnectMessage="Disconnected"
      onApiChange={(api) => { window.terminalApi = api; }}
    />
    <Toaster />
  </>,
);
