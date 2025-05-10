import { createContext } from 'react';

export const allowedColors = [
  "gray", "gold", "bronze", "brown", "yellow", "amber",
  "orange", "tomato", "red", "ruby", "crimson", "pink",
  "plum", "purple", "violet", "iris", "indigo", "blue",
  "cyan", "teal", "jade", "green", "grass", "lime",
  "mint", "sky",
] as const;

export type Colors = typeof allowedColors[number];

export const allowedAppearances = ["light", "dark", "inherit"] as const;
export type Appearance = typeof allowedAppearances[number];

export const THEME_DEFAULTS = {
  appearance: "inherit" as Appearance,
  color: "iris" as Colors,
} as const;

export interface ThemeContextType {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  color: Colors;
  setColor: (color: Colors) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  appearance: THEME_DEFAULTS.appearance,
  setAppearance: () => {},
  color: THEME_DEFAULTS.color,
  setColor: () => {},
});

export const allowedLanguages = ["en", "zh-CN"] as const;

export type Languages = typeof allowedLanguages[number];
export const LANGUAGE_DEFAULTS = {
  language: "en" as Languages,
} as const;

export interface LanguageContextType {
  language: Languages;
  setLanguage: (language: Languages) => void;
}
export const LanguageContext = createContext<LanguageContextType>({
  language: LANGUAGE_DEFAULTS.language,
  setLanguage: () => {},
});