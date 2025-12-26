import { Outlet } from "react-router-dom";

import AdminPanelBar from "../../components/admin/AdminPanelBar";
import { AccountProvider } from "@/contexts/AccountContext";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { Button, Dialog } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Eula } from "@/utils/field";
const AdminLayout = () => {
  const { settings, loading } = useSettings();
  const lang = localStorage.getItem("i18nextLng") || "en";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading) {
      setOpen(false);
    }
    else if (settings && !settings.eula_accepted && lang.startsWith("zh")) {
      setOpen(true);
    }
  }, [loading, settings, lang]);
  return (
    <>
      <Dialog.Root open={open}>
        <Dialog.Content>
          <Dialog.Content>
            <Dialog.Title>法律声明与合规指引</Dialog.Title>
            <div className="flex flex-col gap-2">
              <div className="max-h-[70vh] overflow-y-auto space-y-4">
                <pre className="text-wrap">{Eula}</pre>
              </div>
              <div className="flex flex-row gap-2 justify-end items-center">
                <Button
                  variant="soft"
                  color="red"
                  onClick={() => window.close()}
                >
                  不接受
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
                  我已详细阅读并接受
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Content>
      </Dialog.Root>
      <AccountProvider>
        <AdminPanelBar content={<Outlet />} />
      </AccountProvider>
    </>
  );
};

export default AdminLayout;
