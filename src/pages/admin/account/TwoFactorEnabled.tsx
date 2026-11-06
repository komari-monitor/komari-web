import React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Flex, TextField } from "@radix-ui/themes";
import { useAccount } from "./accountData";
import { ApiError, api, serverMessage } from "@/lib/http";

/** 2FA 已开启：输入验证码关闭 */
const TwoFactorEnabled = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [code, setCode] = React.useState("");
  const { refresh } = useAccount();
  const disable2fa = () => {
    if (!code) {
      toast.error(t("account.otp_empty_error"));
      return;
    }
    setSaving(true);
    // 只看 HTTP 状态，不检查响应体的 status 字段
    api
      .post(`/api/admin/2fa/disable?2fa_code=${encodeURIComponent(code)}`, undefined, {
        expectSuccess: false,
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          throw new Error(serverMessage(error) || "Failed to disable 2FA");
        }
        throw error;
      })
      .then(() => {
        toast.success(t("common.updated_successfully"));
        setIsOpen(false);
        setCode("");
        refresh();
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => {
        setSaving(false);
      });
  };
  return (
    <Flex direction="column" gap="2" className="km-account-2fa-disable">
      <label>{t("account.2fa_enabled")}</label>
      <div>
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
          <Dialog.Trigger>
            <Button color="red">
              {t("account.disable_2fa")}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t("account.disable_2fa")}</Dialog.Title>
            <Dialog.Description>
              {t("account.disable_2fa_confirmation")}
            </Dialog.Description>
            <Flex direction="column" gap="2" mt="4">
              <label htmlFor="disable_2fa_code">
                {t("account.2fa_otp_input_prompt")}
              </label>
              <TextField.Root
                id="disable_2fa_code"
                type="number"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode((e.target as HTMLInputElement).value)}
              />
            </Flex>
            <Flex gap="2" justify="end" mt="5">
              <Button variant="soft" onClick={() => setIsOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saving} color="red" onClick={disable2fa}>
                {t("common.confirm")}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </Flex>
  );
};

export default TwoFactorEnabled;
