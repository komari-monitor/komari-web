import { Button, Dialog, Flex, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

interface TerminalOtpDialogProps {
  open: boolean;
  otpCode: string | null;
  otpInput: string;
  onOpenChange: (open: boolean) => void;
  onOtpInputChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const TerminalOtpDialog = ({
  open,
  otpCode,
  otpInput,
  onOpenChange,
  onOtpInputChange,
  onSubmit,
  onCancel,
}: TerminalOtpDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && otpCode === null) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Content
        maxWidth="400px"
        className="border border-neutral-800 bg-[#161616]"
      >
        <Dialog.Title>{t("login.two_factor")}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {t("account.2fa_otp_input_prompt")}
        </Dialog.Description>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Flex direction="column" gap="3">
            <TextField.Root
              type="number"
              autoFocus
              value={otpInput}
              placeholder="123456"
              onChange={(event) => onOtpInputChange(event.target.value)}
            />
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                color="gray"
                type="button"
                onClick={onCancel}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!otpInput}>
                {t("common.confirm")}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default TerminalOtpDialog;
