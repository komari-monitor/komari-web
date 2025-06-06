import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { AlignJustify, Github } from "lucide-react";
import { ModeToggle } from "@/components/modeToggle";
import { ColorThemeToggle } from "@/components/ColorThemeToggle";
import LanguageSwitch from "@/components/LanguageSwitch";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import LoginDialog from "@/components/LoginButton";

const NavBar = () => {
  const { publicInfo, sidebarOpen, setSidebarOpen } = usePublicInfo();
  const location = useLocation();
  const title = publicInfo?.sitename || "Komari";
  const description = publicInfo?.description || "Komari Monitor";
  const isManagePath = location.pathname.startsWith("/manage");

  return (
    <div className="flex items-center gap-3 max-h-16 justify-end min-w-full p-2 border-b border-solid border-gray-200">
      <div className="mr-auto flex">
        {isManagePath && (
          <Button
            className="ml-1 mr-2"
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <AlignJustify />
          </Button>
        )}
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
      {process.env.NODE_ENV === "development" && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            window.open("https://github.com/komari-monitor", "_blank");
          }}
        >
          <Github />
        </Button>
      )}

      <ModeToggle />
      <ColorThemeToggle />
      <LanguageSwitch />
      <LoginDialog />
    </div>
  );
};

export default NavBar;
