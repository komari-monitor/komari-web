import React from "react";
import { Button, Flex, TextField, TextArea } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { SettingCardCollapse } from "./SettingCard";

interface InputItem {
  tag: string;
  label: string;
  type?: "short" | "long";
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
}

type OnSaveHandler = (values: Record<string, string>) => Promise<any> | any;

export function SettingCardMultiInputCollapse({
  title = "",
  description = "",
  defaultOpen = false,
  items,
  onSave,
  isSaving,
  children,
}: {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  items: InputItem[];
  onSave: OnSaveHandler;
  /** 外部控制的保存状态，如果提供则覆盖内部状态 */
  isSaving?: boolean;
  /** 在保存按钮之前渲染的额外节点 */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [values, setValues] = React.useState<Record<string, string>>(
    () =>
      items.reduce((acc, item) => {
        acc[item.tag] = item.defaultValue || "";
        return acc;
      }, {} as Record<string, string>)
  );
  const [saving, setSaving] = React.useState(false);
  const savingState = isSaving !== undefined ? isSaving : saving;

  const handleChange = (tag: string, value: string) => {
    setValues((prev) => ({ ...prev, [tag]: value }));
  };

  const handleSave = async () => {
    if (isSaving === undefined) setSaving(true);
    try {
      await onSave(values);
    } finally {
      if (isSaving === undefined) setSaving(false);
    }
  };

  return (
    <SettingCardCollapse title={title} description={description} defaultOpen={defaultOpen}>
      <Flex direction="column" gap="2" className="w-full">
        {items.map((item) => (
          <React.Fragment key={item.tag}>
            <label className="text-sm font-semibold">{item.label}</label>
            {item.type === "long" ? (
              <TextArea
                className="w-full"
                defaultValue={item.defaultValue}
                value={values[item.tag]}
                placeholder={item.placeholder}
                disabled={item.disabled}
                onChange={(e) => handleChange(item.tag, e.target.value)}
                resize="vertical"
                ref={undefined}
              />
            ) : (
              <TextField.Root
                className="w-full"
                defaultValue={item.defaultValue}
                value={values[item.tag]}
                placeholder={item.placeholder}
                disabled={item.disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange(item.tag, e.target.value)
                }
                ref={undefined}
              />
            )}
          </React.Fragment>
        ))}
        {/* 渲染额外 children */}
        {children}
        <div>
          <Button variant="solid" className="mt-2" onClick={handleSave} disabled={savingState}>
            {t("save")}
          </Button>
        </div>
      </Flex>
    </SettingCardCollapse>
  );
}
