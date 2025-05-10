import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import Index from "./Index";
import "./global.css";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { ThemeContext, THEME_DEFAULTS, type Appearance, type Colors } from "./contexts/ThemeContext";
import { useLocalStorage } from "./hooks/useLocalStorage";

const App = () => {
  const [appearance, setAppearance] = useLocalStorage<Appearance>("appearance", THEME_DEFAULTS.appearance);
  const [color, setColor] = useLocalStorage<Colors>("color", THEME_DEFAULTS.color);

  const themeContextValue = useMemo(() => ({
    appearance,
    setAppearance,
    color,
    setColor,
  }), [appearance, setAppearance, color, setColor]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <Theme appearance={appearance} accentColor={color} scaling="110%">
        <Index />
      </Theme>
    </ThemeContext.Provider>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
