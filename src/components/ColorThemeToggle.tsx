import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const availableColorThemes = [
  "default",
  "red",
  "rose",
  "orange",
  "green",
  "blue",
  "yellow",
  "violet",
] as const;

export function ColorThemeToggle() {
  const { setColorTheme, colorTheme } = useTheme();
  const { t } = useTranslation();

  const themeColors: Record<string, string> = {
    default: "#64748b",
    red: "#ef4444",
    rose: "#f43f5e",
    orange: "#f97316",
    green: "#22c55e",
    blue: "#3b82f6",
    yellow: "#eab308",
    violet: "#8b5cf6",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("color.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableColorThemes.map((themeName) => (
          <DropdownMenuItem
            key={themeName}
            onClick={() => setColorTheme(themeName)}
            style={{ color: themeColors[themeName] }}
          >
            {t(`color.${themeName}`)}
            {colorTheme === themeName && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}