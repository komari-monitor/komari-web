import "./global.css";
import "./i18n/config";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PublicInfoProvider } from "./contexts/PublicInfoContext";
import { AppContent } from "./pages/App";

const root = createRoot(document.getElementById("root")!);

root.render(
  <BrowserRouter>
    <PublicInfoProvider>
      <ThemeProvider
        defaultThemeMode="system"
        storageKeyMode="theme-mode"
        defaultColorTheme="default"
        storageKeyColor="theme-color"
      >
        <AppContent />
      </ThemeProvider>
    </PublicInfoProvider>
  </BrowserRouter>
);
