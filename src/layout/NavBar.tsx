
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { ModeToggle } from "@/components/modeToggle";
import { ColorThemeToggle } from "@/components/ColorThemeToggle";
const NavBar = () => {
  return (
    <nav className="flex rounded-b-lg items-center gap-3 max-h-16 justify-end min-w-full p-2">
      <div className="mr-auto flex">
        <Link to="/">
          <label className="text-3xl font-bold ">Komari</label>
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
            Komari Monitor
          </label>
        </div>
      </div>

      <Button 
        variant="outline"
        onClick={() => {
          window.open("https://github.com/komari-monitor", "_blank");
        }}
      >
        <Github />
      </Button>

      <ModeToggle />
      <ColorThemeToggle />
      {/* <LanguageSwitch />
      <LoginDialog /> */}
    </nav>
  );
};
export default NavBar;
