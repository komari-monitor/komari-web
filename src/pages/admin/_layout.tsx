import { Outlet } from "react-router-dom";

import AdminPanelBar from "../../components/admin/AdminPanelBar";
import { AdminNavigationProvider } from "@/contexts/AdminNavigationContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { Button, Dialog } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { getEula } from "@/utils/eula";
import { normalizeLanguage, readStoredLanguage } from "@/utils/language";
import { useTranslation } from "react-i18next";
const AdminLayout = () => {
  const { t, i18n } = useTranslation();
  const { settings, loading } = useSettings();
  const lang = readStoredLanguage() || "en";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading) {
      setOpen(false);
    }
    else if (
      settings &&
      !settings.eula_accepted &&
      normalizeLanguage(lang).startsWith("zh")
    ) {
      setOpen(true);
    }
  }, [loading, settings, lang]);
  return (
    <>
      <Dialog.Root open={open}>
        <Dialog.Content className="km-admin-eula-dialog">
          <Dialog.Content>
            <Dialog.Title>{t("eula.title")}</Dialog.Title>
            <div className="km-admin-eula-content flex flex-col gap-2">
              <div className="max-h-[70vh] overflow-y-auto space-y-4">
                <pre className="text-wrap">{getEula(i18n.language)}</pre>
              </div>
              <div className="flex flex-row gap-2 justify-end items-center">
                <Button
                  variant="soft"
                  color="red"
                  onClick={() => window.close()}
                >
                  {t("eula.reject")}
                </Button>
                <Button
                  variant="solid"
                  onClick={() => {
                    setOpen(false);
                    updateSettingsWithToast(
                      { eula_accepted: true },
                      (key) => key
                    );
                  }}
                >
                  {t("eula.accept")}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Content>
      </Dialog.Root>
      <AccountProvider>
        <AdminNavigationProvider>
          <AdminPanelBar content={<Outlet />} />
        </AdminNavigationProvider>
      </AccountProvider>
    </>
  );
};

export default AdminLayout;
