import React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TextField } from "@radix-ui/themes";
import { useAccount } from "./accountData";
import { ApiError, api } from "@/lib/http";
import SavingButton from "./SavingButton";

/** 账户页：更改用户名 */
export default function UsernameForm() {
  const { t } = useTranslation();
  const { account, loading } = useAccount();
  const [usernameSaving, setUsernameSaving] = React.useState(false);

  function handleSubmitUsernameChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameSaving(true);
    // 只看 HTTP 状态，不检查响应体的 status 字段
    api
      .post(
        "/api/admin/update/user",
        {
          uuid: account?.uuid,
          username: (event.currentTarget as HTMLFormElement).username.value,
        },
        { expectSuccess: false },
      )
      .catch((error) => {
        if (error instanceof ApiError) {
          throw new Error("Failed to update username");
        }
        throw error;
      })
      .then(() => {
        toast.success(t("common.updated_successfully"));
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => {
        setUsernameSaving(false);
      });
  }

  return (
    <form
      className="km-account-profile-form flex gap-2 flex-col"
      onSubmit={handleSubmitUsernameChange}
    >
      <label className="text-xl font-bold" htmlFor="username">
        {t("account.change_username_title")}
      </label>

      {/* defaultValue 只在挂载时生效：账户到达后重挂输入框，才能填上真实用户名 */}
      <TextField.Root
        key={loading ? "loading" : "ready"}
        className="max-w-128"
        id="username"
        name="username"
        defaultValue={account?.username}
      ></TextField.Root>
      <SavingButton saving={usernameSaving}>
        {t("account.change_username_button")}
      </SavingButton>
    </form>
  );
}
