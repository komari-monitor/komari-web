import React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TextField } from "@radix-ui/themes";
import { useAccount } from "./accountData";
import { ApiError, api, serverMessage } from "@/lib/http";
import SavingButton from "./SavingButton";

/** 账户页：修改密码（已开启 2FA 时需要输入验证码） */
export default function PasswordForm() {
  const { t } = useTranslation();
  const { account } = useAccount();
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordTwoFa, setPasswordTwoFa] = React.useState("");

  function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const password = form.password.value;
    const password_repeat = form.password_repeat.value;
    if (!password || !password_repeat) {
      toast.error(t("account.password_empty_error"));
      return;
    }
    if (password !== password_repeat) {
      toast.error(t("account.password_mismatch_error"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("account.password_too_short_error"));
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      toast.error(t("account.password_strength_error"));
      return;
    }
    if (account?.["2fa_enabled"] && !passwordTwoFa) {
      toast.error(t("account.otp_empty_error"));
      return;
    }
    setPasswordSaving(true);
    // 只看 HTTP 状态，不检查响应体的 status 字段
    api
      .post(
        "/api/admin/update/user",
        {
          uuid: account?.uuid,
          password: password,
          "2fa_code": passwordTwoFa,
        },
        { expectSuccess: false },
      )
      .catch((error) => {
        if (error instanceof ApiError) {
          throw new Error(serverMessage(error) || "Failed to update password");
        }
        throw error;
      })
      .then(() => {
        toast.success(t("common.updated_successfully"));
        setPasswordTwoFa("");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => {
        setPasswordSaving(false);
      });
  }

  return (
    <form onSubmit={changePassword} className="km-account-password-form flex flex-col gap-2">
      <label className="text-xl font-bold" htmlFor="old_password">
        {t("account.change_password_title")}
      </label>
      <label htmlFor="password">{t("account.new_password")}</label>
      <TextField.Root
        className="max-w-128"
        id="password"
        name="password"
        type="password"
      ></TextField.Root>
      <label htmlFor="password_repeat">
        {t("account.new_password_repeat")}
      </label>
      <TextField.Root
        className="max-w-128"
        id="password_repeat"
        name="password_repeat"
        type="password"
      ></TextField.Root>
      {account?.["2fa_enabled"] ? (
        <>
          <label htmlFor="password_2fa">
            {t("account.2fa_otp_input_prompt")}
          </label>
          <TextField.Root
            className="max-w-128"
            id="password_2fa"
            name="password_2fa"
            type="number"
            placeholder="000000"
            value={passwordTwoFa}
            onChange={(e) =>
              setPasswordTwoFa((e.target as HTMLInputElement).value)
            }
          />
        </>
      ) : null}
      <SavingButton saving={passwordSaving}>
        {t("account.change_password_button")}
      </SavingButton>
    </form>
  );
}
