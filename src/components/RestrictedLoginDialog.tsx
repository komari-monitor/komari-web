import Loading from "@/components/loading";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { GapCollapse } from "@/components/GapCollapse";
import { SPACE } from "@/lib/spacing";
import LoginField from "@/components/auth/LoginField";
import { useLogin } from "@/components/auth/useLogin";

export type RestrictedAuthStatus = {
  oauth_enabled: boolean;
  oauth_provider: string;
  password_login_enabled: boolean;
  logged_in: boolean;
  username?: string;
};

type RestrictedLoginDialogProps = {
  auth: RestrictedAuthStatus | null;
  onAuthenticated: () => Promise<void>;
  requestFailedKey?: string;
};

export default function RestrictedLoginDialog({
  auth,
  onAuthenticated,
  requestFailedKey = "login.request_failed",
}: RestrictedLoginDialogProps) {
  const { t } = useTranslation();
  const {
    username,
    setUsername,
    password,
    setPassword,
    twoFactor,
    setTwoFactor,
    requireTwoFactor,
    error,
    busy,
    login,
  } = useLogin({ onSuccess: onAuthenticated, requestFailedKey });

  return (
    <Dialog.Root open={auth !== null && !auth.logged_in}>
      <Dialog.Content
        className="km-restricted-login-dialog"
        maxWidth="430px"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Dialog.Title>{t("login.title")}</Dialog.Title>
        <Dialog.Description>{t("login.desc")}</Dialog.Description>
        {/* 说明 → 表单 section；字段之间 block；字段区 → 提交按钮 section；提交 → OAuth group */}
        <Flex direction="column" gap="2" mt="5">
        {auth?.password_login_enabled && (
          <form
            className="km-restricted-login-form flex flex-col gap-km-section"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <Flex direction="column" gap="4">
            <LoginField
              label={t("login.username")}
              id="restricted-login-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              disabled={busy}
            />
            <LoginField
              label={t("login.password")}
              id="restricted-login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
            {/* 条件字段/错误：高度与所在栈的 gap 4（SPACE.block）一起展开，提交按钮不被顶一下 */}
            <AnimatePresence initial={false}>
            {requireTwoFactor && (
              <GapCollapse key="restricted-2fa" gap={SPACE.block}>
              <LoginField
                label={t("login.two_factor")}
                id="restricted-login-2fa-code"
                name="2fa_code"
                value={twoFactor}
                onChange={(event) => setTwoFactor(event.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                disabled={busy}
              />
              </GapCollapse>
            )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
            {error && (
              <GapCollapse key="restricted-error" gap={SPACE.block}>
              <Text as="div" size="2" color="red">
                {error}
              </Text>
              </GapCollapse>
            )}
            </AnimatePresence>
            </Flex>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !username.trim() || !password}
            >
              {!busy && <LogIn size={16} />}
              {busy ? <Loading compact /> : t("login.title")}
            </Button>
          </form>
        )}
        {auth?.oauth_enabled && (
          <Button
            variant={auth.password_login_enabled ? "soft" : "solid"}
            className="w-full"
            onClick={() => {
              window.location.href = "/api/oauth";
            }}
          >
            {t("login.login_with", {
              provider: auth.oauth_provider || "OAuth",
            })}
          </Button>
        )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}