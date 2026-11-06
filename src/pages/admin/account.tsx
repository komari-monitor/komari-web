import { useTranslation } from "react-i18next";
import { AccountPageProvider, useAccount } from "./account/accountData";
import { Flex } from "@radix-ui/themes";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import UsernameForm from "./account/UsernameForm";
import PasswordForm from "./account/PasswordForm";
import TwoFactorSection from "./account/TwoFactorSection";
import SsoSection from "./account/SsoSection";

const Account = () => {
  return (
    // 页面切换时 /api/me 已由 routePreload 提前请求（routeQueries/settings 的 accountQuery）
    <AccountPageProvider>
      <InnerLayout />
    </AccountPageProvider>
  );
};

const InnerLayout = () => {
  const { t } = useTranslation();
  const { account, loading, error } = useAccount();
  if (error) {
    return <div>{error.message}</div>;
  }

  return (
    // 页头和不依赖账户数据的表单直接渲染；用户名、2FA、单点登录各自显示色块
    <div className="km-page km-page-admin-account">
      <PageHeader
        title={t("account.title")}
        description={
          <Skeletonize as="span" loading={loading}>
            {t("account.greeting", { username: account?.username ?? skeletonText(6) })}
          </Skeletonize>
        }
      />
      {/*
        分组：更改用户名 / 修改密码 / 2FA / 单点登录 各是一组，组与组之间 section（km-page 的 gap），
        组内标题、字段、按钮之间 group，组标题统一 text-xl 粗体（与设置页 SettingCardLabel 一致）。
      */}
      <Skeletonize loading={loading} className="km-setting-card-skeleton">
        <UsernameForm />
      </Skeletonize>
      <PasswordForm />
      <Skeletonize loading={loading} className="km-setting-card-skeleton">
        <TwoFactorSection />
      </Skeletonize>
      <Skeletonize loading={loading} className="km-setting-card-skeleton">
        <SsoSection />
      </Skeletonize>
      <Flex gap="4" align="center" justify="start">
        <label className="text-muted-foreground text-sm">
          {t("account_settings.looking_for_backup")}
        </label>
      </Flex>
    </div>
  );
};

export default Account;
