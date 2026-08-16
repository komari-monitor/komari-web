import React, { Suspense, useMemo } from "react";
import { Theme } from "@radix-ui/themes";
import { useRoutes } from "react-router-dom";
import Loading from "./components/loading";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { Toaster } from "./components/ui/sonner";
import {
  ThemeContext,
  THEME_DEFAULTS,
  type Appearance,
  type Colors,
} from "./contexts/ThemeContext";
import { NodeListProvider } from "./contexts/NodeListProvider";
import { PublicInfoProvider } from "./contexts/PublicInfoProvider";
import { RPC2Provider } from "./contexts/RPC2Provider";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useSystemTheme } from "./hooks/useSystemTheme";
import { routes } from "./routes";

const App = () => {
  const restrictedPath = window.location.pathname.replace(/\/$/, "");
  const isRestrictedGuideRoute = [
    "/admin/database-migration",
    "/install",
    "/database-recovery",
  ].includes(restrictedPath);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tempKey = params.get("temp_key");

    if (tempKey) {
      document.cookie = `temp_key=${tempKey}; path=/; max-age=${60 * 60 * 24 * 365 * 100}`;
      params.delete("temp_key");
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`,
      );
    }
  }, []);

  const [appearance, setAppearance] = useLocalStorage<Appearance>(
    "appearance",
    THEME_DEFAULTS.appearance,
  );
  const [color, setColor] = useLocalStorage<Colors>(
    "color",
    THEME_DEFAULTS.color,
  );
  const resolvedAppearance = useSystemTheme(appearance);

  React.useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      resolvedAppearance === "dark",
    );
  }, [resolvedAppearance]);

  const themeContextValue = useMemo(
    () => ({ appearance, setAppearance, color, setColor }),
    [appearance, setAppearance, color, setColor],
  );
  const routing = useRoutes(routes);

  return (
    <Suspense fallback={<Loading />}>
      <ThemeContext.Provider value={themeContextValue}>
        <Theme
          appearance={resolvedAppearance}
          accentColor={color}
          scaling="110%"
          className="theme-root"
          style={{
            backgroundColor: "transparent",
            minHeight: "100vh",
          }}
        >
          {isRestrictedGuideRoute ? (
            <>
              <Toaster />
              {routing}
            </>
          ) : (
            <RPC2Provider>
              <PublicInfoProvider>
                <NodeListProvider>
                  <Toaster />
                  <OfflineIndicator />
                  {routing}
                  <PWAInstallPrompt />
                  <PWAUpdatePrompt />
                </NodeListProvider>
              </PublicInfoProvider>
            </RPC2Provider>
          )}
        </Theme>
      </ThemeContext.Provider>
    </Suspense>
  );
};

export default App;
