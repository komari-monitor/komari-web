import * as React from "react";
import { Box } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { resolveCountryCode } from "@/utils/regionCode";

interface FlagProps {
  flag: string; // 地区代码 (例如 "SG", "US") 或旗帜 emoji (例如 "🇸🇬", "🇺🇳")
  size?: string; // 可选的尺寸 prop，用于未来扩展
}

const Flag = React.memo(({ flag, size }: FlagProps) => {
  const resolvedFlagFileName = resolveCountryCode(flag);

  // 构建本地图片路径
  const imgSrc = `/assets/flags/${resolvedFlagFileName}.svg`;
  // 构建 alt 文本和 aria-label
  const { t } = useTranslation();
  const altText = t("common.region_flag_alt", { name: resolvedFlagFileName });

  return (
    <Box
      as="span"
      className={`km-flag m-2 self-center ${size ? `w-${size} h-${size}` : "w-6 h-6"}`}
      style={{ display: "inline-flex", alignItems: "center" }}
      aria-label={altText}
    >
      <img
        src={imgSrc}
        alt={altText}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
});

// 确保 displayName 以便在 React DevTools 中识别
Flag.displayName = "Flag";

export default Flag;