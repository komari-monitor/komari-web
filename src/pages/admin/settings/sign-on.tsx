import {
  SettingCardLabel,
  SettingCardSelect,
  SettingCardsLoading,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Skeletonize } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import React from "react";
import { renderProviderInputs } from "@/utils/renderProviders";
import { api } from "@/lib/http";
import { useRouteQuery } from "@/lib/routeData";
import {
  DEFAULT_SETTINGS,
  initialOidcProvider,
  oidcProvidersQuery,
  oidcProviderValuesQuery,
  settingsErrorText,
  settingsQuery,
} from "@/routeQueries/settings";
import { ApiKeyCard } from "./shared/ApiKeyCard";
import { saveSettings, serverError } from "./shared/request";

export default function SignOnSettings() {
  const { t } = useTranslation();
  // 页面切换时设置、provider 列表、当前 provider 的字段值都已由 routePreload 提前请求（见 routeQueries/settings）
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const loading = settingsResult.loading;
  const error = settingsErrorText(settingsResult.error);
  // provider 列表在设置到达后才用（与原来一样），请求本身与设置并行
  const defsResult = useRouteQuery(oidcProvidersQuery);
  const defsReady = !loading && !error && defsResult.data !== undefined;
  const providerDefs: any = (defsReady && defsResult.data) || {};
  const providerList = Object.keys(providerDefs);
  // 用户切换过 provider 后以选择为准；否则取设置里的 provider（不在列表里为空）
  const [selectedProvider, setSelectedProvider] = React.useState<string | null>(null);
  const currentProvider =
    selectedProvider ?? (defsReady && defsResult.data ? initialOidcProvider(settings, defsResult.data) : "");
  const valuesResult = useRouteQuery(currentProvider ? oidcProviderValuesQuery(currentProvider) : null);
  const setValuesData = valuesResult.setData;
  const providerValues: any = valuesResult.data ?? {};
  const setProviderValues = React.useCallback(
    (updater: (prev: any) => any) => setValuesData((prev) => updater(prev ?? {})),
    [setValuesData],
  );
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  // 字段区骨架：切换 provider 后读取字段值、保存中（provider 列表未到时整页本来就是色块）
  const providerLoading = valuesResult.loading || saving;

  // 错误文字与原来一致：服务器 message 优先，接口没有 data 时用默认文案
  const defsError = defsResult.error
    ? serverError(defsResult.error)?.message || t("settings.sso.provider_fetch_failed")
    : defsReady && defsResult.data === null
      ? t("settings.sso.provider_fetch_failed")
      : "";
  const valuesError = valuesResult.error
    ? serverError(valuesResult.error)?.message || t("settings.sso.provider_settings_fetch_failed")
    : valuesResult.data === null
      ? t("settings.sso.provider_settings_fetch_failed")
      : "";
  // 设置出错时整页只显示设置的错误（原来 provider 请求要等设置到达才发）
  const providerError = loading || error ? "" : saveError || valuesError || defsError;

  // 处理保存
  const handleOidcSave = async (values: any) => {
    setSaving(true);
    setSaveError("");
    const body = {
      name: currentProvider,
      addition: JSON.stringify(values),
    };
    try {
      await api.post("/api/admin/settings/oidc", body);
      setValuesData(values);
    } catch (error) {
      setSaveError(serverError(error)?.message || t("settings.sso.provider_save_failed"));
    }
    setSaving(false);
  };

  // 渲染 provider 的输入项已抽象到 utils/renderProviders.tsx 中

  // 首屏：设置或 provider 列表还没到，设置卡显示色块（不再 early return）
  const pageLoading =
    loading || (providerList.length === 0 && !providerError);
  if (error) {
    return <Text color="red">{error}</Text>;
  }
  if (providerError) {
    return <Text color="red">{providerError}</Text>;
  }

  return (
    <div className="flex w-full flex-col gap-km-block">
      <SettingCardsLoading loading={pageLoading}>
      <SettingCardLabel>{t("settings.sign_on.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.sign_on.disable_password")}
        defaultChecked={settings.disable_password_login}
        onChange={async (checked) => {
          await saveSettings({ disable_password_login: checked }, t);
        }}
        className="km-page-admin-settings-sign-on km-setting-card"
      />
      <SettingCardLabel>{t("settings.sso.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.sso.enable")}
        defaultChecked={settings.o_auth_enabled}
        description={t("settings.sso.enable_description")}
        onChange={async (checked) => {
          await saveSettings({ o_auth_enabled: checked }, t);
        }}
        className="km-setting-card"
      />
      <SettingCardSelect
        title={String(t("settings.sso.provider"))}
        description={String(t("settings.sso.provider_description"))}
        options={providerList.map((p) => ({ value: p, label: p }))}
        value={currentProvider}
        OnSave={async (val: string) => {
          if (val === currentProvider) return;
          await saveSettings({ o_auth_provider: val }, t);
          setSelectedProvider(val);
        }}
      />
      {/*
        切换 provider / 保存中：字段区保持原结构，只画成骨架（不再整块换成转圈），
        字段数变化时高度弹簧过渡。
      */}
      <AutoHeight>
        <Skeletonize loading={providerLoading && !pageLoading}>
          {renderProviderInputs({
            currentProvider,
            providerDefs,
            providerValues,
            translationPrefix: "settings.sso." + currentProvider,
            title: t("settings.sso.provider_fields"),
            description: t("settings.sso.provider_fields_description"),
            footer: t("settings.sso.callback_url_tips", { url: `${window.location.origin}/api/oauth_callback` }),
            setProviderValues,
            handleSave: handleOidcSave,
            t,
          })}
        </Skeletonize>
      </AutoHeight>
      <SettingCardLabel>API</SettingCardLabel>
      {/* 原来 ApiCard 自己再调一次 useSettings（重复请求设置）；改为用本页已取到的设置 */}
      <ApiCard apiKey={settings.api_key} />
      </SettingCardsLoading>
    </div>
  );
}

const ApiCard = ({ apiKey }: { apiKey: string | undefined }) => {
  const { t } = useTranslation();

  return (
    <ApiKeyCard
      settingKey="api_key"
      savedValue={apiKey}
      title={t("settings.api.title")}
      description={t("settings.api.description")}
      prefix="komari-"
      length={32}
    />
  );
};
