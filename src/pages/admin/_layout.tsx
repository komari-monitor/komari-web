import { Outlet } from "react-router-dom";

import AdminPanelBar from "../../components/admin/AdminPanelBar";
import LoginDialog from "../../components/Login";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { Button, Dialog, Flex, Spinner } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Eula } from "@/utils/field";
import { normalizeLanguage, readStoredLanguage } from "@/utils/language";

// AdminGuard 在后台框架渲染前进行鉴权：
// - loading 中：仅显示加载占位，不渲染后台框架
// - 未登录：仅显示登录框（不渲染后台框架/侧边栏，避免框架泄露）
// - 已登录：正常渲染后台
//
// 修复 #585：此前 AdminLayout 直接渲染 AdminPanelBar，其内部的 AccountProvider
// 在 /api/me 返回前 account 为 null，登录框条件 (account && !account.logged_in)
// 不成立，导致未登录时后台框架先裸露出来。
const AdminGuard = () => {
  const { account, loading } = useAccount();

  if (loading || !account) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  if (!account.logged_in) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <LoginDialog
          autoOpen={true}
          showSettings={false}
          onLoginSuccess={() => {
            window.location.reload();
          }}
        />
      </Flex>
    );
  }

  return <AdminPanelBar content={<Outlet />} />;
};

const AdminLayout = () => {
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
        <AdminGuard />
      </AccountProvider>
    </>
  );
};

export default AdminLayout;
