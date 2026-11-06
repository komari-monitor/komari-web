import { useEffect, useState } from "react";
import { Button, Dialog, Flex } from "@radix-ui/themes";
import { Check, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { motion } from "motion/react";
import { CONTROL_MOTION } from "@/lib/motion";

const seenKey = "_komari_notification_channels_1_6_0_seen";

function isLegacyNotificationVersion(version: string | null): boolean {
  if (version === null) return false;
  if (version === "") return true;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  return match !== null &&
    (Number(match[1]) < 1 || (Number(match[1]) === 1 && Number(match[2]) < 6));
}

export default function NotificationUpgradeNotice({
  ready,
  onPendingChange,
}: {
  ready: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const { call } = useRPC2Call();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void call<undefined, { last_run_version: string | null }>("admin:getLastRunVersion")
      .then(({ last_run_version }) => {
        if (cancelled) return;
        const pending = isLegacyNotificationVersion(last_run_version) &&
          localStorage.getItem(seenKey) !== "true";
        setOpen(pending);
        onPendingChange(pending);
      })
      .catch(() => {
        if (!cancelled) onPendingChange(false);
      });
    return () => { cancelled = true; };
  }, [ready, call, onPendingChange]);

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey, "true");
    } catch {
      // Closing the notice must still work when browser storage is unavailable.
    }
    setOpen(false);
    onPendingChange(false);
  };

  return (
    <Dialog.Root open={ready && open}>
      <Dialog.Content
        maxWidth="480px"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <Dialog.Title>{t("notificationUpgrade.title")}</Dialog.Title>
        <Dialog.Description>{t("notificationUpgrade.description")}</Dialog.Description>
        {/*
          control 性格：弹窗里的两个动作按钮，按压回弹保持一致；
          弹层本身的方向/淡入交给 Radix Dialog + 全局弹层时序（overlay 层），这里不重复做。
        */}
        <Flex gap="2" justify="end" wrap="wrap" mt="5">
          <motion.div
            whileTap={CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
          >
            <Button variant="soft" onClick={dismiss}>
              <Check size={16} />
              {t("notificationUpgrade.acknowledge")}
            </Button>
          </motion.div>
          <motion.div
            whileTap={CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
          >
            <Button onClick={() => {
              dismiss();
              navigate("/admin/notification/channels");
            }}>
              <Settings2 size={16} />
              {t("notificationUpgrade.configure")}
            </Button>
          </motion.div>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
