import { SettingCardShortTextInput } from "@/components/admin/SettingCard";
import { Button } from "@radix-ui/themes";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveSettings } from "./request";

const KEY_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * 密钥类设置卡片（自动发现密钥、API 密钥）：输入框 + 「生成」按钮。
 * 保存空值即清除；少于 12 位提示长度错误。children 追加在「生成」按钮后面。
 */
export function ApiKeyCard({
  settingKey,
  savedValue,
  title,
  description,
  prefix = "",
  length,
  children,
}: {
  settingKey: string;
  savedValue: string | undefined;
  title: string;
  description: string;
  /** 生成的密钥前缀 */
  prefix?: string;
  /** 生成的随机部分长度 */
  length: number;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [apiValues, setApiValues] = React.useState<string>(savedValue || "");

  // 处理生成按钮点击
  const handleGenerateApiKey = () => {
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += KEY_CHARS.charAt(Math.floor(Math.random() * KEY_CHARS.length));
    }
    setApiValues(result);
  };

  // 初始化API值
  React.useEffect(() => {
    if (savedValue) {
      setApiValues(savedValue);
    }
  }, [savedValue]);

  return (
    <SettingCardShortTextInput
      title={title}
      description={description}
      value={apiValues}
      onChange={(e) => setApiValues(e.target.value)}
      OnSave={async (values) => {
        if (!values) {
          await saveSettings({ [settingKey]: "" }, t);
          return;
        }
        if (values.length < 12) {
          toast.error(t("settings.api.key_length_error"));
          return;
        }
        await saveSettings({ [settingKey]: values }, t);
      }}
    >
      <div className="flex flex-row gap-2 justify-start items-center">
        <Button variant="soft" color="green" onClick={handleGenerateApiKey}>
          {t("common.generate")}
        </Button>
        {children}
      </div>
    </SettingCardShortTextInput>
  );
}
