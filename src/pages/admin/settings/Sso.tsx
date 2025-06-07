import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/contexts/SettingsContext";
import type { SettingsData } from "@/contexts/SettingsContext";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function SsoSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, refetchSettings, isUpdating, isFetching } =
    useSettings();

  const [formData, setFormData] = useState<Partial<SettingsData> | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (formData) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleEnableSsoChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, o_auth_enabled: checked });
    }
  };
  const handleDisablePasswordLoginChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, disable_password_login: checked });
    }
  };

  const handleProviderChange = (value: string) => {
    if (formData) {
      setFormData({ ...formData, geo_ip_provider: value });
    }
  };

  const handleSave = () => {
    if (formData) {
      updateSettings(formData);
    }
  };

  if (isFetching && !settings) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!formData) {
    return <div>{t("admin.sso.load_failed")}</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">{t("admin.sso.enable_sso")}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t("admin.sso.enable_sso_desc")}
        </div>
        <Switch
          checked={formData.o_auth_enabled || false}
          onCheckedChange={handleEnableSsoChange}
        />
      </div>

      {formData.o_auth_enabled && (
        <>
          <div className="mb-6">
            <div className="font-semibold">{t("admin.sso.provider")}</div>
            <div className="text-gray-500 text-sm mb-2">
              {t("admin.sso.provider_desc")}
            </div>
            <Select
              value={formData.geo_ip_provider || "github"}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("admin.sso.provider_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">{t("admin.sso.provider_github")}</SelectItem>
                <SelectItem value="google" disabled>
                  {t("admin.sso.provider_google")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6">
            <div className="font-semibold">{t("admin.sso.client_id")}</div>
            <div className="text-gray-500 text-sm mb-2">
              {t("admin.sso.client_id_desc")}
            </div>
            <Input
              name="o_auth_client_id"
              value={formData.o_auth_client_id || ""}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>

          <div className="mb-6">
            <div className="font-semibold">{t("admin.sso.client_secret")}</div>
            <div className="text-gray-500 text-sm mb-2">
              {t("admin.sso.client_secret_desc")}
            </div>
            <Input
              name="o_auth_client_secret"
              type="password"
              value={formData.o_auth_client_secret || ""}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div className="mb-6">
            <div className="font-semibold">{t("admin.sso.disable_password_login")}</div>
            <div className="text-gray-500 text-sm mb-2">
              {t("admin.sso.disable_password_login_desc")}
            </div>
            <Switch
              checked={formData.disable_password_login || false}
              onCheckedChange={handleDisablePasswordLoginChange}
              disabled={!formData.o_auth_enabled}
            />
          </div>
        </>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={handleSave} disabled={isUpdating || isFetching}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("admin.sso.save")}
        </Button>
        <Button
          onClick={refetchSettings}
          variant="outline"
          disabled={isFetching || isUpdating}
        >
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("admin.sso.refresh")}
        </Button>
      </div>
    </div>
  );
}