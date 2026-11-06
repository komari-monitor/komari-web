import React, { useEffect, useMemo, useState } from "react";
import { Callout, Button } from "@radix-ui/themes";
import PageHeader from "@/components/PageHeader";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import ConfigFormTabs from "@/components/admin/ConfigFormTabs";
import {
  buildConfigInitialValues,
  CONFIG_FORM_PLACEHOLDER_ITEMS,
} from "@/components/admin/configFormValues";
import { toast } from "sonner";
import { saveThemeSettings } from "@/utils/saveThemeSettings";
import { useTranslation } from "react-i18next";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import {
  getThemeConfigurationType,
  THEME_CONFIGURATION_MANAGED,
} from "@/utils/themeConfiguration";
import { useRouteQuery } from "@/lib/routeData";
import { rememberActiveTheme, themeManifestQuery } from "@/routeQueries/appearance";
import { AnimatePresence, motion } from "motion/react";
import { CONTROL_MOTION, MOTION_VARIANTS } from "@/lib/motion";

interface ThemeFieldBase {
  name?: I18nText; // 显示名（字符串或多语言字典）
  help?: I18nText; // 帮助文本（字符串或多语言字典）
  type:
    | "title"
    | "textbox"
    | "switch"
    | "select"
    | "number"
    | "string"
    | "richtext"
    | "nodes"
    | "pingtasks";
  key?: string; // 对应设置键（title 无需）
  default?: any; // 默认值
  options?: string; // 仅 select 支持，逗号分隔
  required?: boolean;
}

const ThemeManaged: React.FC = () => {
  const { publicInfo, isLoading: publicInfoLoading, refresh } = usePublicInfo();
  const theme = publicInfo?.theme;
  const rawThemeSettings = publicInfo?.theme_settings;
  const themeSettings = useMemo(() => rawThemeSettings || {}, [rawThemeSettings]); // 当前值
  const { t, i18n } = useTranslation();

  const currentLanguage =
    i18n.resolvedLanguage ||
    i18n.language ||
    (typeof navigator !== "undefined" ? navigator.language : "");

  const [saving, setSaving] = useState(false);

  // 拉取主题配置：主题已知时切换页面前就已预取（见 routeQueries/appearance.ts），等待预算内到达直接显示
  const manifestQuery = useMemo(() => (theme ? themeManifestQuery(theme) : null), [theme]);
  const manifest = useRouteQuery(manifestQuery);
  useEffect(() => rememberActiveTheme(theme), [theme]);
  const loading = manifest.loading;
  const manifestData = theme ? manifest.data : undefined;
  const fields = useMemo<ThemeFieldBase[]>(() => {
    const configuration = manifestData?.configuration;
    if (
      getThemeConfigurationType(configuration) !== THEME_CONFIGURATION_MANAGED ||
      !Array.isArray(configuration?.data)
    ) {
      return [];
    }
    return configuration.data as ThemeFieldBase[];
  }, [manifestData]);
  const manifestError = manifest.error as { message?: string } | undefined;
  const error = theme && manifestError ? manifestError.message || t("theme.load_config_failed") : null;

  // 初始值：优先 publicInfo.theme_settings，其次 default；配置或已保存的值变化（例如保存后刷新）时重置
  const initialValues = useMemo(
    () => buildConfigInitialValues(fields, themeSettings),
    [fields, themeSettings],
  );
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [valuesFor, setValuesFor] = useState(initialValues);
  if (valuesFor !== initialValues) {
    setValuesFor(initialValues);
    setValues(initialValues);
  }

  const handleValueChange = (key: string, val: any) => {
    setValues((v) => ({ ...v, [key]: val }));
  };

  const payload = useMemo(() => {
    // 全量：对所有字段（非 title）输出当前值
    const obj: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === "title" || f.type === "textbox" || !f.key) return;
      const current = values[f.key];
      // 直接使用当前值，undefined 时才用默认值
      if (current !== undefined) {
        obj[f.key] = current;
      } else if (f.default !== undefined) {
        obj[f.key] = f.default;
      } else {
        obj[f.key] =
          f.type === "nodes" || f.type === "pingtasks" ? "[]" : "";
      }
    });
    return obj;
  }, [fields, values]);

  const saveAll = async () => {
    if (!theme) return;
    console.log("保存前的 values:", values);
    console.log("保存前的 payload:", payload);
    setSaving(true);
    try {
      await saveThemeSettings(theme, payload);
      toast.success(t("settings.settings_saved"));
      // 刷新 publicInfo 以反映最新设置
      refresh();
    } catch (e: any) {
      toast.error(`${t("settings.settings_save_failed")}: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // 首次拉取配置前：用占位字段渲染同样的表单结构，每张设置卡显示色块。
  // 换主题后重新请求期间保留旧表单（与原来一致），只有还没有任何结果时才显示色块。
  // 公共信息还没到（还不知道当前主题）时也先显示色块，不先闪「无配置」提示。
  const showSkeleton = theme
    ? !error && manifestData === undefined
    : publicInfoLoading;
  const formFields = showSkeleton ? CONFIG_FORM_PLACEHOLDER_ITEMS : fields;
  const pageTitle = theme
    ? t("theme.manage_with_name", {
        name: theme === "default" ? "" : theme,
      })
    : t("theme.title");

  return (
    // 页面骨架：页头固定在顶部，表单在下方 flex-1 内独立滚动；外边距由后台内容区统一提供
    <div className="km-page km-page-admin-theme-managed h-full min-h-0">
      <PageHeader
        className="shrink-0"
        title={pageTitle}
        actions={
          formFields.length > 0 ? (
            // control 性格：保存是「提交类」控件，按压回弹 + 保存中轻微压暗
            <motion.div
              whileTap={saving ? undefined : CONTROL_MOTION.tap}
              animate={saving ? { scale: 0.98, opacity: 0.75 } : { scale: 1, opacity: 1 }}
              transition={CONTROL_MOTION.transition}
            >
              <Button onClick={saveAll} disabled={saving || showSkeleton}>
                {t("common.save")}
              </Button>
            </motion.div>
          ) : undefined
        }
      />
      {/* feedback 性格：错误 / 无配置提示出现时高度展开，下方表单被平滑推开 */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="theme-managed-error"
            className="shrink-0"
            variants={MOTION_VARIANTS.collapse}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Callout.Root color="red">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          </motion.div>
        )}
        {!showSkeleton && !loading && !error && fields.length === 0 && theme !== "default" && (
          <motion.div
            key="theme-managed-empty"
            className="shrink-0"
            variants={MOTION_VARIANTS.collapse}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Callout.Root>
              <Callout.Text>{t("theme.no_config")}</Callout.Text>
            </Callout.Root>
          </motion.div>
        )}
      </AnimatePresence>
      {formFields.length > 0 ? (
        // 配置表单页：外层 flex 撑满，内部 ConfigFormTabs 才能保留独立滚动区；加载中逐卡色块
        <div className="flex min-h-0 flex-1 flex-col">
        <ConfigFormTabs
          items={formFields}
          loading={showSkeleton}
          values={showSkeleton ? {} : values}
          onValueChange={handleValueChange}
          resolveText={(v) => resolveI18nText(v, currentLanguage)}
          className="km-admin-theme-managed-config min-h-0 flex-1"
          formClassName="km-theme-managed-form"
          footer={
            <div className="mt-km-section flex">
              <motion.div
                whileTap={saving ? undefined : CONTROL_MOTION.tap}
                animate={saving ? { scale: 0.98, opacity: 0.75 } : { scale: 1, opacity: 1 }}
                transition={CONTROL_MOTION.transition}
              >
                <Button onClick={saveAll} disabled={saving || showSkeleton}>
                  {t("common.save")}
                </Button>
              </motion.div>
            </div>
          }
        />
        </div>
      ) : null}
    </div>
  );
};

export default ThemeManaged;
