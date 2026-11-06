import ThemeSwitch from "./ThemeSwitch";
import ColorSwitch from "./ColorSwitch";
import LanguageSwitch from "./Language";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogIn } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTranslation } from "react-i18next";
import { loginPath } from "@/utils/loginRedirect";
import { motion } from "motion/react";
import { CONTROL_MOTION, SURFACE_MOTION } from "@/lib/motion";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { MotionButton, MotionIconButton } from "./ui/motion-radix";
import { Skeletonize, skeletonText } from "./ui/skeleton";

/** 首页相关 chunk 预取：悬停品牌名时先下载，点下去时新页面能在共享元素过渡的窗口内挂好 */
const preloadIndex = () => {
  void import("../pages/Index");
  void import("./NodeDisplay");
};

const INSTANCE_PATH = /^\/instance\/([^/]+)/;

/**
 * 导航栏控件：按下时轻微回弹（control 层），整体在页面加载时从上方落入（surface 层）。
 * 注意导航栏本身不参与 layout 动画，避免滚动时抖动。
 */
const NavBar = () => {
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  const { t } = useTranslation();
  // 站点信息还没到（且没失败）：站名位置先放一条与常见站名等宽的骨架
  const siteNameLoading = !publicInfo && publicInfoLoading;
  const location = useLocation();
  const { account } = useAccount();
  const { navigate: navigateWithTransition } = useViewTransitionNavigate();
  const loginRedirect = loginPath(location.pathname, location.search);
  // 在详情页时，品牌链接回首页走共享元素回程：标题「飞回」它在列表里的那张卡片
  const currentInstance = INSTANCE_PATH.exec(location.pathname)?.[1];
  return (
    <motion.nav
      // 左右边距由 _layout 的 main 统一提供，导航栏只留上下 group；品牌区与控件组之间 group
      className="km-navbar nav-bar flex rounded-b-lg items-center gap-km-group max-h-16 justify-end min-w-full py-km-group"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        y: SURFACE_MOTION.slide,
        opacity: SURFACE_MOTION.fade,
      }}
    >
      <div className="km-navbar-brand mr-auto flex items-center min-w-0">
        <Link
          to="/"
          className="flex items-center min-w-0"
          onPointerEnter={currentInstance ? preloadIndex : undefined}
          onFocus={currentInstance ? preloadIndex : undefined}
          onClick={(event) => {
            if (
              !currentInstance ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            navigateWithTransition("/", { sharedHero: currentInstance });
          }}
        >
          <Skeletonize
            as="span"
            loading={siteNameLoading}
            className="font-bold text-[clamp(1.25rem,5vw,1.875rem)] whitespace-nowrap truncate leading-tight"
          >
            {publicInfo?.sitename ?? (siteNameLoading ? skeletonText(8) : null)}
          </Skeletonize>
        </Link>
        <div className="hidden flex-row items-baseline md:flex ml-3">
          <div
            style={{ borderColor: "var(--accent-3)" }}
            className="border-r-2 mr-2 h-4 self-center"
          />
          <span
            className="text-base font-bold whitespace-nowrap"
            style={{ color: "var(--accent-4)" }}
          >
            Komari Monitor
          </span>
        </div>
      </div>

      {/*
        控件组本身不做按压缩放：按下单个按钮时整组一起缩会显得「整条栏在晃」。
        每个按钮自己就是 motion 元素（不额外包 div），保持原有 DOM 层级与选择器。
      */}
      <div className="km-navbar-controls flex items-center gap-2 flex-shrink-0">
        <MotionIconButton
          variant="soft"
          onClick={() => {
            window.open("https://github.com/komari-monitor", "_blank");
          }}
          whileHover={CONTROL_MOTION.hover}
          whileTap={CONTROL_MOTION.tap}
          transition={CONTROL_MOTION.transition}
        >
          <GitHubLogoIcon />
        </MotionIconButton>

        <ThemeSwitch />
        <ColorSwitch />
        <LanguageSwitch />
        <MotionButton
          onClick={() => {
            window.location.href =
              account?.logged_in ? "/admin/dashboard" : loginRedirect;
          }}
          whileHover={CONTROL_MOTION.hover}
          whileTap={CONTROL_MOTION.tap}
          transition={CONTROL_MOTION.transition}
        >
          <LogIn size={16} />
          {account?.logged_in ? t("settings.title", "Settings") : t("login.title")}
        </MotionButton>
      </div>
    </motion.nav>
  );
};

const NavBarWithAccount = () => (
  <AccountProvider>
    <NavBar />
  </AccountProvider>
);

export default NavBarWithAccount;
