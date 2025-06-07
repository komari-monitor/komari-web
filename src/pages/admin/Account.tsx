import { Input } from "@/components/ui/input";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import React from "react";
import { useTranslation } from "react-i18next";

const Account: React.FC = () => {
  const { loading, meInfo } = usePublicInfo();
  const { t } = useTranslation();

  if (loading) return <div>{t("admin.account.loading")}</div>;

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">{t("admin.account.username.label")}</div>
        <Input
          name="sitename"
          value={meInfo?.username || ""}
          className="w-full"
          placeholder={t("admin.account.username.placeholder")}
        />
      </div>
    </div>
  );
};

export default Account;