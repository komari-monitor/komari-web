import type React from "react";
import { Text, TextField } from "@radix-ui/themes";

type LoginFieldProps = React.ComponentProps<typeof TextField.Root> & {
  label: React.ReactNode;
};

/** 登录表单的一个字段：粗体标签 + 输入框（登录页与受限页面登录对话框共用） */
export default function LoginField({ label, ...inputProps }: LoginFieldProps) {
  return (
    <label className="block">
      <Text as="div" size="2" weight="bold" mb="2">
        {label}
      </Text>
      <TextField.Root {...inputProps} />
    </label>
  );
}
