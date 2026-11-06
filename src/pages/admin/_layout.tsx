import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import AdminPanelBar from "../../components/admin/AdminPanelBar";
import { AdminNavigationProvider } from "@/contexts/AdminNavigationContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { Button, Dialog, Flex } from "@radix-ui/themes";
import NotificationUpgradeNotice from "@/components/admin/NotificationUpgradeNotice";
import { useEffect, useState } from "react";
import { getEula } from "@/utils/eula";
import { normalizeLanguage, readStoredLanguage } from "@/utils/language";
import { useTranslation } from "react-i18next";
import { useAccount } from "@/contexts/AccountContext";
import Loading from "@/components/loading";
import { loginPath, resolveLoginRedirect } from "@/utils/loginRedirect";

const AdminLayout = () => {
  const { t, i18n } = useTranslation();
  const { settings, loading, error, setSettings } = useSettings();
  const lang = readStoredLanguage() || "en";
  const [open, setOpen] = useState(false);
  const [noticePending, setNoticePending] = useState(true);
  const eulaPending =
    normalizeLanguage(lang).startsWith("zh") && settings?.eula_accepted === false;
  const noticesReady = !loading && !error && !open && !eulaPending;
  useEffect(() => {
    if (loading || error || !settings || settings.eula_accepted !== false) {
      setOpen(false);
      return;
    }
    if (normalizeLanguage(lang).startsWith("zh")) {
      setOpen(true);
    }
  }, [loading, error, settings, lang]);
  return (
    <>
      <Dialog.Root open={open}>
        {/* 原先 Dialog.Content 里又套了一层 Dialog.Content（两层面板/遮罩），合并为一层 */}
        <Dialog.Content className="km-admin-eula-dialog">
          <Dialog.Title>{t("eula.title")}</Dialog.Title>
          <div className="km-admin-eula-content">
            <div className="max-h-[70vh] overflow-y-auto">
              <pre className="text-wrap">{getEula(i18n.language)}</pre>
            </div>
            <Flex gap="2" justify="end" align="center" mt="5">
              <Button
                variant="soft"
                color="red"
                onClick={() => window.close()}
              >
                {t("eula.reject")}
              </Button>
              <Button
                variant="solid"
                onClick={async () => {
                  try {
                    await updateSettingsWithToast(
                      { eula_accepted: true },
                      (key) => key
                    );
                    setSettings((prev) => ({
                      ...prev,
                      eula_accepted: true,
                    }));
                    setOpen(false);
                  } catch {
                    setOpen(true);
                  }
                }}
              >
                {t("eula.accept")}
              </Button>
            </Flex>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <NotificationUpgradeNotice
        ready={noticesReady}
        onPendingChange={setNoticePending}
      />
      <AdminNavigationProvider>
        <AdminPanelBar
          content={<Outlet />}
          onboardingReady={
            noticesReady && !noticePending
          }
        />
      </AdminNavigationProvider>
    </>
  );
};

const AdminRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const account = useAccount();
  const [oauthRedirect, setOauthRedirect] = useState<string | null>(() => {
    const value = sessionStorage.getItem("oauth_redirect");
    sessionStorage.removeItem("oauth_redirect");
    return value ? resolveLoginRedirect(value) : null;
  });

  useEffect(() => {
    if (!account.loading && account.account?.logged_in && oauthRedirect) {
      const target = oauthRedirect;
      setOauthRedirect(null);
      navigate(target, { replace: true });
    }
  }, [account.account?.logged_in, account.loading, navigate, oauthRedirect]);

  if (account.loading) {
    return <Loading />;
  }
  if (!account.account?.logged_in) {
    return (
      <Navigate
        to={loginPath(location.pathname, location.search)}
        replace
      />
    );
  }
  if (oauthRedirect) {
    return <Loading />;
  }
  return <AdminLayout />;
};

export default function Admin() {
  return (
    <AccountProvider>
      <AdminRoute />
    </AccountProvider>
  );
}
