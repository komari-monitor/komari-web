import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "dark" | "light" | "system";

type ColorTheme =
  | "default"
  | "red"
  | "rose"
  | "orange"
  | "green"
  | "blue"
  | "yellow"
  | "violet";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultThemeMode?: ThemeMode;
  defaultColorTheme?: ColorTheme;
  storageKeyMode?: string;
  storageKeyColor?: string;
};

type ThemeProviderState = {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
  themeMode: "system",
  setThemeMode: () => null,
  colorTheme: "default",
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultThemeMode = "system",
  defaultColorTheme = "default",
  storageKeyMode = "theme-mode",
  storageKeyColor = "theme-color",
  ...props
}: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () =>
      (localStorage.getItem(storageKeyMode) as ThemeMode) || defaultThemeMode
  );
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(
    () =>
      (localStorage.getItem(storageKeyColor) as ColorTheme) || defaultColorTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");
    if (themeMode === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(themeMode);
    }

    root.setAttribute("data-color-theme", colorTheme);
  }, [themeMode, colorTheme]);

  const value = {
    themeMode,
    setThemeMode: (newThemeMode: ThemeMode) => {
      localStorage.setItem(storageKeyMode, newThemeMode);
      setThemeModeState(newThemeMode);
    },
    colorTheme,
    setColorTheme: (newColorTheme: ColorTheme) => {
      localStorage.setItem(storageKeyColor, newColorTheme);
      setColorThemeState(newColorTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
