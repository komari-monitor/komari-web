import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

interface LanguageSwitchProps {
  icon?: ReactNode;
}

const languages: { code: string; name: string }[] = [
  { code: "zh-CN", name: "简体中文" },
  { code: "en-US", name: "English" },
];

const LanguageSwitch = ({
  icon = (
    <Button variant="outline" size="icon">
      <Languages />
    </Button>
  ),
}: LanguageSwitchProps = {}) => {
  const { i18n } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{icon}</DropdownMenuTrigger>
      <DropdownMenuContent>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitch;
