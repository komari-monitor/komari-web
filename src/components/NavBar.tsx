import ThemeSwitch from "./ThemeSwitch";
import ColorSwitch from "./ColorSwitch";
import LanguageSwitch from "./Language";
import LoginDialog from "./Login";
import { IconButton, Flex, Box, Separator } from "@radix-ui/themes";
import { GitHubLogoIcon, HamburgerMenuIcon, Cross1Icon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTranslation } from "react-i18next";
import { useState } from "react";

const NavBar = () => {
  const { publicInfo } = usePublicInfo();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <>
      <nav className="nav-bar flex rounded-b-lg items-center gap-3 max-h-16 justify-end min-w-full p-2 px-4 sticky top-0 z-50 backdrop-blur-sm bg-background/90 shadow-sm">
        <div className="mr-auto flex items-center">
          {/* <img src="/assets/logo.png" alt="Komari Logo" className="w-10 object-cover mr-2 self-center"/> */}
          <Link to="/" className="flex items-center">
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              {publicInfo?.sitename}
            </span>
          </Link>
          <div className="hidden flex-row items-end md:flex ml-2">
            <Separator orientation="vertical" size="2" className="mx-2 h-6" />
            <span
              className="text-base font-medium"
              style={{ color: "var(--accent-9)" }}
            >
              Komari Monitor
            </span>
          </div>
        </div>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-2">
          <IconButton
            variant="soft"
            radius="full"
            className="transition-transform hover:scale-105"
            onClick={() => {
              window.open("https://github.com/komari-monitor", "_blank");
            }}
          >
            <GitHubLogoIcon />
          </IconButton>

          <ThemeSwitch />
          <ColorSwitch />
          <LanguageSwitch />
          {publicInfo?.private_site ? (
            <LoginDialog
              autoOpen={publicInfo?.private_site}
              info={t('common.private_site')}
              onLoginSuccess={() => { window.location.reload(); }}
            />
          ) : (
            <LoginDialog />
          )}
        </div>
        
        {/* Mobile menu button */}
        <IconButton
          variant="ghost"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <Cross1Icon /> : <HamburgerMenuIcon />}
        </IconButton>
      </nav>
      
      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <Box className="md:hidden fixed top-16 right-0 left-0 z-40 bg-background/95 backdrop-blur-md shadow-md p-4 border-t border-border animate-in slide-in-from-top duration-300">
          <Flex direction="column" gap="3" align="center">
            <Flex gap="2" className="w-full justify-center">
              <ThemeSwitch />
              <ColorSwitch />
              <LanguageSwitch />
            </Flex>
            
            <Flex gap="2" className="w-full justify-center">
              <IconButton
                variant="soft"
                radius="full"
                onClick={() => {
                  window.open("https://github.com/komari-monitor", "_blank");
                  setMobileMenuOpen(false);
                }}
              >
                <GitHubLogoIcon />
              </IconButton>
              
              {publicInfo?.private_site ? (
                <LoginDialog
                  autoOpen={publicInfo?.private_site}
                  info={t('common.private_site')}
                  onLoginSuccess={() => { window.location.reload(); }}
                />
              ) : (
                <LoginDialog />
              )}
            </Flex>
          </Flex>
        </Box>
      )}
    </>
  );
};

export default NavBar;
