import { useEffect } from "react";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { LoaderCircle, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import LanguageSwitch from "@/components/Language";
import ThemeSwitch from "@/components/ThemeSwitch";
import ColorSwitch from "@/components/ColorSwitch";
import LoginField from "@/components/auth/LoginField";
import { useLogin } from "@/components/auth/useLogin";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { Skeletonize } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import { resolveLoginRedirect } from "@/utils/loginRedirect";
import { AnimatePresence, motion } from "motion/react";
import { CONTROL_MOTION, FEEDBACK_MOTION, SURFACE_MOTION } from "@/lib/motion";
import { PresenceBox } from "@/components/motion";

const AdminLoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account, loading, refresh } = useAccount();
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  const redirect = resolveLoginRedirect(searchParams.get("redirect"));
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
  } = useLogin({
    onSuccess: async () => {
      await refresh();
      navigate(redirect, { replace: true });
    },
  });
  const passwordLoginEnabled = !publicInfo?.disable_password_login;
  const oauthEnabled = !!publicInfo?.oauth_enable;
  const canSubmit =
    passwordLoginEnabled && username.trim() !== "" && password !== "";

  useEffect(() => {
    if (!loading && account?.logged_in) {
      navigate(redirect, { replace: true });
    }
  }, [account, loading, navigate, redirect]);

  // 不再整页 early return：登录卡片照常渲染，账户/站点信息未到时 Skeletonize 画骨架（期间 inert，不能提交）
  const pageLoading = loading || publicInfoLoading;
  if (!pageLoading && account?.logged_in) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <div className="km-login-page flex min-h-screen items-center justify-center bg-accent-1 px-km-block py-km-hero">
      <div className="absolute right-km-block top-km-block flex items-center gap-2">
        <ThemeSwitch />
        <ColorSwitch />
        <LanguageSwitch />
      </div>
      {/*
        surface 性格：登录卡片是整页唯一的主舞台，进场沉稳（8px 抬起 + 淡入、弹簧收尾），
        不弹跳，不抢后续表单控件的注意力（Staging）。
      */}
      <motion.div
        className="w-full max-w-[430px]"
        initial={SURFACE_MOTION.enter.initial}
        animate={SURFACE_MOTION.enter.animate}
        transition={SURFACE_MOTION.enter.transition}
      >
      <Skeletonize loading={pageLoading} label>
      <Card size="3" className="km-login-card w-full max-w-[430px]">
        {/* 站点信息到达后「OAuth 登录」按钮可能出现/密码表单可能隐藏：卡片高度弹簧过渡 */}
        <AutoHeight>
        <Flex direction="column" gap="5">
          <div>
            <Heading size="6">{t("login.title")}</Heading>
            <Text as="p" size="2" color="gray" mt="1">
              {t("login.desc")}
            </Text>
          </div>
          <form
            className="km-login-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit && !busy) {
                void login();
              }
            }}
          >
            {/* 字段之间 block，字段区与按钮区之间 section，按钮之间 group */}
            <Flex direction="column" gap="5">
              {passwordLoginEnabled && (
                <Flex direction="column" gap="4">
                <LoginField
                  label={t("login.username")}
                  // 骨架期间整卡 inert，autoFocus 会落空：加载完成后重挂一次，焦点才回到用户名
                  key={pageLoading ? "loading" : "ready"}
                  className="km-login-input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  name="username"
                  autoComplete="username"
                  placeholder="admin"
                  disabled={busy}
                  autoFocus
                />
                <LoginField
                  label={t("login.password")}
                  className="km-login-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.password_placeholder")}
                  disabled={busy}
                />
                {/* overlay 性格：需要二次验证时，字段从下方「长出来」，不硬切 */}
                <AnimatePresence initial={false}>
                {requireTwoFactor && (
                  <PresenceBox key="two-factor">
                  <LoginField
                    label={t("login.two_factor")}
                    className="km-login-input"
                    value={twoFactor}
                    onChange={(event) => setTwoFactor(event.target.value)}
                    name="2fa_code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    placeholder="000000"
                    disabled={busy}
                  />
                  </PresenceBox>
                )}
                </AnimatePresence>
                {/*
                  feedback 性格：错误提示带轻微过冲（pop 弹簧）出现，
                  同时整块高度平滑让步，错误消失时不会把提交按钮弹跳一下。
                */}
                <AnimatePresence initial={false} mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    initial={FEEDBACK_MOTION.pop.initial}
                    animate={FEEDBACK_MOTION.pop.animate}
                    exit={FEEDBACK_MOTION.pop.exit}
                    transition={FEEDBACK_MOTION.pop.transition}
                  >
                    <Text as="div" size="2" color="red" className="km-login-error">
                      {error}
                    </Text>
                  </motion.div>
                )}
                </AnimatePresence>
                </Flex>
              )}
              {(passwordLoginEnabled || oauthEnabled) && (
              <Flex direction="column" gap="2">
                {/* control 性格：按下回弹；提交中图标/文案做一次干脆的交叉切换 */}
                {passwordLoginEnabled && (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !canSubmit}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={busy ? "busy" : "idle"}
                      className="inline-flex items-center gap-2"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={CONTROL_MOTION.transition}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <LogIn size={16} />
                      )}
                      {busy ? t("loading") : t("login.title")}
                    </motion.span>
                  </AnimatePresence>
                </Button>
                )}
              {oauthEnabled && (
                <Button
                  variant={passwordLoginEnabled ? "soft" : "solid"}
                  className="w-full"
                  disabled={busy}
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem("oauth_redirect", redirect);
                    window.location.href = "/api/oauth";
                  }}
                >
                  {t("login.login_with", {
                    provider:
                      publicInfo?.oauth_provider === "generic"
                        ? "OAuth"
                        : publicInfo?.oauth_provider
                          ? publicInfo.oauth_provider.charAt(0).toUpperCase() +
                            publicInfo.oauth_provider.slice(1)
                          : "",
                  })}
                </Button>
              )}
              </Flex>
              )}
            </Flex>
          </form>
        </Flex>
        </AutoHeight>
      </Card>
      </Skeletonize>
      </motion.div>
    </div>
  );
};

const AdminLogin = () => (
  <AccountProvider>
    <AdminLoginPage />
  </AccountProvider>
);

export default AdminLogin;
