import { Badge, Box, Card, Flex, IconButton, Text } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { Image as ImageIcon, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CONTROL_MOTION, MOTION_SPRING } from "@/lib/motion";
import { Pressable } from "@/components/motion";
import type { I18nText } from "@/utils/i18nText";
import type { Theme } from "./types";

interface ThemeCardProps {
  theme: Theme;
  displayText: (value: I18nText | undefined) => string;
  settingTheme: string | null;
  setPreviewDialogOpen: (open: boolean) => void;
  setSelectedTheme: (theme: Theme) => void;
  setActiveTheme: (themeShort: string) => void;
}

/** 已安装主题卡片：预览图、当前主题徽标、名称/作者/版本、启用按钮 */
export default function ThemeCard({
  theme,
  displayText,
  settingTheme,
  setPreviewDialogOpen,
  setSelectedTheme,
  setActiveTheme,
}: ThemeCardProps) {
  const { t } = useTranslation();
  return (
    <Card size="2" className="relative group hover:shadow-lg transition-all duration-200 h-full">
      <Box
        onClick={() => {
          setPreviewDialogOpen(true);
          setSelectedTheme(theme);
        }}
        className="aspect-video bg-gradient-to-br rounded-t-lg overflow-hidden relative "
      >
        {/* 预览图位置的骨架形状：只在骨架期间可见，和真实预览交叉淡化 */}
        <span aria-hidden className="km-skeleton-shape absolute inset-0" style={{ backgroundColor: "currentColor" }} />
        {theme.preview ? (
          <img
            src={`/themes/${theme.short}/${theme.preview}`}
            alt={displayText(theme.name)}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove(
                "hidden",
              );
            }}
          />
        ) : null}
        <Flex
          align="center"
          justify="center"
          className={`w-full h-full ${theme.preview ? "hidden" : ""}`}
        >
          <ImageIcon size={48} className="text-gray-400" />
        </Flex>
        {/* 覆盖层 */}
        <Box className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <Flex gap="2">{/* 预留操作位 */}</Flex>
        </Box>

        {/*
          共享元素：「当前主题」徽标全页只有一个，用 layoutId 让它从旧卡片飞到新卡片，
          看起来是同一个徽标换了主人，而不是一处消失、另一处凭空出现。
          徽标尺寸固定，layout 只做位移，不会拉伸文字。
        */}
        {theme.active && (
          <motion.div
            layoutId="km-theme-active-badge"
            className="absolute right-2 top-2"
            transition={MOTION_SPRING.shared}
          >
            <Badge
              color="green"
              className="px-2 py-1 text-xs"
            >
              {t("theme.active")}
            </Badge>
          </motion.div>
        )}
      </Box>

      <Flex
        onClick={() => {
          setPreviewDialogOpen(true);
          setSelectedTheme(theme);
        }}
        direction="column"
        gap="2"
        pt="4"
      >
        <Text weight="bold" size="3">
          {displayText(theme.name)}
        </Text>
        <Flex justify="between" align="center">
          <Text size="1" color="gray">
            by {displayText(theme.author)}
          </Text>
          <Text size="1" color="gray">
            v{theme.version}
          </Text>
        </Flex>
      </Flex>
      <Flex justify="end" align="center">
        {/* control 性格：启用主题按钮按下回弹；切换中图标持续旋转（与改造前一致的加载指示） */}
        <AnimatePresence initial={false}>
          {!theme.active ? (
            <Pressable
              key="km-theme-set-active"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={CONTROL_MOTION.transition}
            >
              <IconButton
                size="2"
                variant="ghost"
                onClick={() => setActiveTheme(theme.short)}
                disabled={settingTheme === theme.short}
                title={t("theme.set_active", "Set as Active Theme")}
                aria-label={t("theme.set_active", "Set as Active Theme")}
              >
                {settingTheme === theme.short ? (
                  <Box className="animate-spin">
                    <Settings size={16} />
                  </Box>
                ) : (
                  <Settings size={16} />
                )}
              </IconButton>
            </Pressable>
          ) : null}
        </AnimatePresence>
      </Flex>
    </Card>
  );
}
