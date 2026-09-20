import ThemeSwitch from "./ThemeSwitch";
import ColorSwitch from "./ColorSwitch";
import LanguageSwitch from "./Language";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { Button, IconButton } from "@radix-ui/themes";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogIn } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTranslation } from "react-i18next";
import { loginPath } from "@/utils/loginRedirect";
const NavBar = () => {
  const { publicInfo } = usePublicInfo();
  const { t } = useTranslation();
  const location = useLocation();
  const { account } = useAccount();
  const loginRedirect = loginPath(location.pathname, location.search);
  return (
    <nav className="km-navbar nav-bar flex rounded-b-lg items-center gap-2 md:gap-3 max-h-16 justify-end min-w-full p-2 px-4">
      <div className="km-navbar-brand mr-auto flex items-center min-w-0">
        <Link to="/" className="flex items-center min-w-0">
          <span className="font-bold text-[clamp(1.25rem,5vw,1.875rem)] whitespace-nowrap truncate leading-tight">
            {publicInfo?.sitename}
          </span>
        </Link>
        <div className="hidden flex-row items-baseline md:flex ml-3">
          <div
            style={{ borderColor: "var(--accent-3)" }}
            className="border-r-2 mr-2 h-4 self-center"
          />
          <span
            className="text-base font-bold whitespace-nowrap"
            style={{ color: "var(--accent-4)" }}
          >
            Komari Monitor
          </span>
        </div>
      </div>

      <div className="km-navbar-controls flex items-center gap-2 flex-shrink-0">
        <IconButton
          variant="soft"
          onClick={() => {
            window.open("https://github.com/komari-monitor", "_blank");
          }}
        >
          <GitHubLogoIcon />
        </IconButton>

        <ThemeSwitch />
        <ColorSwitch />
        <LanguageSwitch />
        <Button
          onClick={() => {
            window.location.href =
              account?.logged_in ? "/admin/dashboard" : loginRedirect;
          }}
        >
          <LogIn size={16} />
          {account?.logged_in ? t("settings.title", "Settings") : t("login.title")}
        </Button>
      </div>
    </nav>
  );
};

const NavBarWithAccount = () => (
  <AccountProvider>
    <NavBar />
  </AccountProvider>
);

export default NavBarWithAccount;
