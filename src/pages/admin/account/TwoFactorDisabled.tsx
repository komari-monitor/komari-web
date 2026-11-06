import React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Flex, TextField } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "./accountData";
import { Skeleton } from "@/components/ui/skeleton";
import { SKELETON_MOTION } from "@/lib/motion";
import { ApiError, api, serverMessage } from "@/lib/http";

/** 2FA 未开启：扫码 + 输入验证码开启 */
const TwoFactorDisabled = () => {
  const { t } = useTranslation();
  const { refresh } = useAccount();
  const [saving, setSaving] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [qrcode, setQRCode] = React.useState<string | null>(null);
  const [code, setCode] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch("/api/admin/2fa/generate")
        .then((response) => {
          if (!response.ok) {
            throw new Error(t("account.qr_fetch_error"));
          }
          return response.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setQRCode(url);
        })
        .catch((err) => toast.error(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleEnable2fa = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code) {
      toast.error(t("account.otp_empty_error"));
      return;
    }
    setSaving(true);
    // 只看 HTTP 状态，不检查响应体的 status 字段
    api
      .post(`/api/admin/2fa/enable?code=${encodeURIComponent(code)}`, undefined, {
        expectSuccess: false,
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          throw new Error(
            serverMessage(error) || `Failed to enable 2FA (${error.status})`
          );
        }
        throw error;
      })
      .then(() => {
        toast.success(t("common.updated_successfully"));
        setIsOpen(false);
        refresh();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <Flex direction="column" gap="2" className="km-account-2fa-enable">
      <label className="text-lg font-bold">{t("account.2fa_disabled")}</label>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Trigger>
          <div>
            <Button className="w-full">{t("account.enable_2fa")}</Button>
          </div>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>{t("account.enable_2fa")}</Dialog.Title>
          <Flex direction="column" gap="2">
            <label>{t("account.2fa_qr_code_hint")}</label>
            {/* 二维码骨架与二维码同尺寸（200×200），到达时交叉淡化，对话框不变高 */}
            <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
              <AnimatePresence initial={false}>
                {isLoading || !qrcode ? (
                  <motion.span
                    key="qr-skeleton"
                    className="absolute inset-0"
                    exit={{ opacity: 0, transition: SKELETON_MOTION.exit }}
                  >
                    <Skeleton width={200} height={200} radius={8} />
                  </motion.span>
                ) : (
                  <motion.img
                    key="qr"
                    src={qrcode}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={SKELETON_MOTION.reveal.transition.opacity}
                  />
                )}
              </AnimatePresence>
            </div>
            <label>{t("account.2fa_otp_input_prompt")}</label>
            <form className="km-account-2fa-form flex flex-col gap-2" onSubmit={handleEnable2fa}>
              <TextField.Root
                type="number"
                name="code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode((e.target as HTMLInputElement).value)}
              />
              <Button disabled={saving} type="submit">
                {t("account.enable_2fa")}
              </Button>
            </form>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};

export default TwoFactorDisabled;
