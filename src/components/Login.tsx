import * as React from "react";
import {
  Dialog,
  Flex,
  Text,
  TextField,
  Button,
  Box,
  IconButton,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { TablerSettings } from "./Icones/Tabler";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

type LoginDialogProps = {
  trigger?: React.ReactNode | string;
  autoOpen?: boolean;
  showSettings?: boolean;
  info?: string | React.ReactNode;
  onLoginSuccess?: () => void;
};

const LoginDialog = ({ trigger, autoOpen = false, showSettings = true, info, onLoginSuccess }: LoginDialogProps) => {
  const InnerLayout = () => {
    const { account, loading, error, refresh } = useAccount();
    const [t] = useTranslation();
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [twoFac, setTwoFac] = React.useState("");
    const [errorMsg, setErrorMsg] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [require2FA, setRequire2FA] = React.useState(false);
    const [open, setOpen] = React.useState(autoOpen || false);
    const {publicInfo} = usePublicInfo();
    // Validate inputs
    const isFormValid = username.trim() !== "" && password.trim() !== "";
    console.log(autoOpen, open);
    React.useEffect(() => {
      if (autoOpen) {
        setOpen(true);
      }
    }, [autoOpen]);
    // Handle login
    const handleLogin = async () => {
      if (!isFormValid) {
        setErrorMsg("Username and password are required");
        return;
      }

      setErrorMsg("");
      setIsLoading(true);
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            ...(twoFac && !account?.["2fa_enabled"] ? { "2fa_code": twoFac } : {}),
          }),
        });
        const data = await res.json();
        if (res.status === 200) {
          refresh();
          if (typeof onLoginSuccess === "function") {
            onLoginSuccess();
            return
          }
          window.open("/admin", "_self");
        } else {
          if (data.message === "2FA code is required") {
            setRequire2FA(true);
            return;
          }
          setErrorMsg(data.message || "Login failed");
        }
      } catch (err) {
        setErrorMsg("Network error");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    // Handle Enter key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isLoading && isFormValid) {
        e.preventDefault(); // Prevent form submission issues
        handleLogin();
      }
    };

    if (loading) {
      return <Button disabled>{t("loading")}</Button>;
    }
    if (error || !account) {
      return (
        <Button disabled color="red">
          Error
        </Button>
      );
    }
    if (account.logged_in) {
      if (!showSettings) {
        return null;
      }
      return (
        <a href="/admin" target="_blank">
          <IconButton>
            <TablerSettings></TablerSettings>
          </IconButton>
        </a>
      );
    }
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger>
          {trigger ? trigger : <Button>{t("login.title")}</Button>}
        </Dialog.Trigger>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>{t("login.title")}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            <div className="flex justify-center flex-col gap-2">
              <label>{t("login.desc")}</label>
              {info && (
                <label>
                  {info}
                </label>
              )}
            </div>

          </Dialog.Description>
          <Box
            onSubmit={(e) => {
              e.preventDefault(); // Prevent native form submission
              if (isFormValid && !isLoading) {
                handleLogin();
              }
            }}
          >
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t("login.username")}
                </Text>
                <TextField.Root
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="admin"
                  disabled={isLoading}
                  autoFocus // Focus on username by default
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t("login.password")}
                </Text>
                <TextField.Root
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  type="password"
                  placeholder={t("login.password_placeholder")}
                  disabled={isLoading}
                />
              </label>
              <label hidden={!require2FA}>
                <Text as="div" size="2" mb="1" weight="bold">
                  {t("login.two_factor")}
                </Text>
                <TextField.Root
                  value={twoFac}
                  onChange={(e) => setTwoFac(e.target.value)}
                  onKeyDown={handleKeyDown}
                  type="text"
                  placeholder="000000"
                  disabled={isLoading}
                />
              </label>
              {errorMsg && (
                <Text as="div" size="2" color="red">
                  {errorMsg}
                </Text>
              )}
              <Button
                type="submit"
                disabled={isLoading || !isFormValid}
                style={{ opacity: isLoading || !isFormValid ? 0.6 : 1 }}
                onClick={handleLogin}
              >
                {isLoading ? "Logging in..." : t("login.title")}
              </Button>
              <Button
                onClick={() => {
                  window.location.href = "/api/oauth";
                }}
                variant="soft"
                disabled={isLoading}
                type="button" // Prevent form submission
              >
                {t(
                  "login.login_with",
                  {
                    provider:
                      publicInfo?.oauth_provider === "generic"
                        ? "OAuth"
                        : publicInfo?.oauth_provider
                          ? publicInfo.oauth_provider === "qq" 
                            ? "QQ" 
                            : publicInfo.oauth_provider.charAt(0).toUpperCase() + publicInfo.oauth_provider.slice(1)
                          : ""
                  }
                )}
              </Button>
            </Flex>
          </Box>
        </Dialog.Content>
      </Dialog.Root>
    );
  };
  return (
    <AccountProvider>
      <InnerLayout />
    </AccountProvider>
  );
};

export default LoginDialog;
