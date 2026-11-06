import { DropdownMenu } from "@radix-ui/themes";
import { useContext, type ReactNode } from "react";
import { motion } from "motion/react";
import { ThemeContext, type Appearance } from "../contexts/ThemeContext";
import { SunIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { CONTROL_MOTION } from "@/lib/motion";
import { MotionIconButton } from "./ui/motion-radix";

interface ThemeSwitchProps {
  icon?: ReactNode;
}

/** 每种外观对应图标的一个姿态（Pose to Pose）；切换时弹簧转过去，连点可顺势转向 */
const APPEARANCE_POSE: Record<Appearance, { rotate: number; scale: number }> = {
  light: { rotate: 0, scale: 1 },
  dark: { rotate: 90, scale: 0.86 },
  system: { rotate: 45, scale: 0.94 },
};

const ThemeSwitch = ({ icon }: ThemeSwitchProps = {}) => {
  const { appearance, setAppearance } = useContext(ThemeContext);
  const { t } = useTranslation();
  const pose = APPEARANCE_POSE[appearance] ?? APPEARANCE_POSE.system;
  // control 层：按钮本身就是 motion 元素（不额外包 div），Trigger 的属性/焦点直接落在按钮上
  const trigger = icon ?? (
    <MotionIconButton
      variant="soft"
      title={t("common.appearance", "Appearance")}
      aria-label={t("common.appearance", "Appearance")}
      whileHover={CONTROL_MOTION.hover}
      whileTap={CONTROL_MOTION.tap}
      transition={CONTROL_MOTION.transition}
    >
      <motion.span
        className="inline-flex"
        initial={false}
        animate={pose}
        transition={CONTROL_MOTION.transition}
      >
        <SunIcon />
      </motion.span>
    </MotionIconButton>
  );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="km-theme-switch">{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onSelect={() => setAppearance("light")}>
          {t("theme.light", "Light")}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => setAppearance("dark")}>
          {t("theme.dark", "Dark")}
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => setAppearance("system")}>
          {t("theme.system", "System")}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

export default ThemeSwitch;
