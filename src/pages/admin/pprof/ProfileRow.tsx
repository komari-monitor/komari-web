import { Button, Flex, Text } from "@radix-ui/themes";
import { Download, Eye, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import type { PprofProfile } from "./model";

export default function ProfileRow({
  profile,
  index,
  busy,
  activeAction,
  onPreview,
  onDownload,
}: {
  profile: PprofProfile;
  index: number;
  busy: boolean;
  activeAction: string | null;
  onPreview: (profile: PprofProfile) => void;
  onDownload: (profile: PprofProfile) => void;
}) {
  const { t } = useTranslation();
  const previewing = activeAction === `${profile.name}:preview`;
  const downloading = activeAction === `${profile.name}:download`;
  const profileKey = `pprof.profiles.${profile.name}`;

  return (
    <motion.div
      // 只补间位置（行内有文字，尺寸补间会拉伸文字；高度变化直接生效）
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        layout: MOTION_SPRING.layout,
        y: MOTION_SPRING.layout,
        opacity: { ...MOTION_TRANSITION.fadeIn, delay: Math.min(index * 0.03, 0.18) },
      }}
      className="grid grid-cols-1 gap-2 border-b border-[var(--gray-a5)] py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <Text as="div" size="2" weight="medium">
          {t(`${profileKey}.title`)}
        </Text>
        <Text as="div" size="1" color="gray" className="break-words">
          {t(`${profileKey}.description`)}
        </Text>
        <Text as="div" size="1" color="gray" className="pt-1">
          {profile.timed
            ? t("pprof.timed_profile")
            : t("pprof.sample_count", { samples: profile.samples ?? 0 })}
        </Text>
      </div>
      <Flex gap="2" wrap="wrap" className="sm:justify-end">
        {profile.preview ? (
          <Button
            variant="soft"
            disabled={busy}
            onClick={() => onPreview(profile)}
          >
            {previewing ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Eye size={16} />
            )}
            {previewing ? t("pprof.loading") : t("pprof.view")}
          </Button>
        ) : null}
        <Button
          variant="soft"
          disabled={busy}
          onClick={() => onDownload(profile)}
        >
          {downloading ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {downloading ? t("pprof.loading") : t("pprof.download")}
        </Button>
      </Flex>
    </motion.div>
  );
}
