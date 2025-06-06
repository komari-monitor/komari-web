import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { ModeToggle } from "@/components/modeToggle";
import { ColorThemeToggle } from "@/components/ColorThemeToggle";
import LanguageSwitch from "@/components/LanguageSwitch";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
const NavBar = () => {
  const { publicInfo } = usePublicInfo();
  const title = publicInfo?.sitename || "Komari";
  const description = publicInfo?.description || "Komari Monitor";
  return (
    <nav className="flex rounded-b-lg items-center gap-3 max-h-16 justify-end min-w-full p-2">
      <div className="mr-auto flex">
        <Link to="/">
          <label className="text-3xl font-bold ">{title}</label>
        </Link>
        <div className="hidden flex-row items-end md:flex">
          <div
            style={{ color: "var(--accent-3)" }}
            className="border-solid border-r-2 mr-1 mb-1 w-2 h-2/3"
          />
          <label
            className="text-base font-bold"
            style={{ color: "var(--accent-4)" }}
          >
            {description}
          </label>
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          window.open("https://github.com/komari-monitor", "_blank");
        }}
      >
        <Github />
      </Button>

      <ModeToggle />
      <ColorThemeToggle />
      <LanguageSwitch />
      {/* <LoginDialog /> */}
    </nav>
  );
};
export default NavBar;
