import { Cross1Icon, ExitIcon } from "@radix-ui/react-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown.css";
import {
  Button,
  Callout,
  Flex,
  Grid,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { RevealBoundary } from "@/components/motion/reveal";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  SURFACE_MOTION,
} from "@/lib/motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation /*useNavigate*/ } from "react-router-dom";
import ColorSwitch from "../ColorSwitch";
import LanguageSwitch from "../Language";
import ThemeSwitch from "../ThemeSwitch";
import { useIsMobile } from "@/hooks/use-mobile";
import menuConfig from "../../config/menuConfig.json";
import type { MenuItem } from "../../types/menu";
import { iconMap } from "../../utils/iconHelper";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { TablerMenu2 } from "../Icones/Tabler";
import InlineSvgIcon from "../InlineSvgIcon";
import { useAdminNavigation } from "@/contexts/AdminNavigationContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import Tips from "../ui/tips";
import { CircleFadingArrowUp } from "lucide-react";
import GuidedTour from "@/components/onboarding/GuidedTour";
import { useAdminGuide } from "@/components/onboarding/useAdminGuide";
import type { ExtendedMenuItem } from "./adminPanel/types";
import { useAdminExtraMenus } from "./adminPanel/useAdminExtraMenus";
import { useReleaseCheck } from "./adminPanel/useReleaseCheck";
import SidebarItem from "./adminPanel/SidebarItem";

// 将JSON配置转换为类型安全的菜单项数组 (基础静态菜单)
const baseMenuItems = (menuConfig as { menu: MenuItem[] }).menu;

/**
 * 内容区进场动画的「路由区块」key（surface 性格）。
 * - 只看 pathname，不看 search：很多页面用 query 做 tab/筛选/选中插件，
 *   query 变化若让外层容器重挂载，会把表单、图表、iframe 整块卸载重载。
 * - 共用 settings/_layout 的设置子页归为同一区块：子页切换由该布局内层负责淡入，
 *   外层不再整块重挂（否则布局本身也被卸载，内外两段位移叠加成 16px）。
 */
const SETTINGS_SECTION_PREFIX = "/admin/settings/";
const contentSectionKey = (pathname: string) =>
  pathname.startsWith(SETTINGS_SECTION_PREFIX) ? SETTINGS_SECTION_PREFIX : pathname;

interface AdminPanelBarProps {
  content: ReactNode;
  onboardingReady?: boolean;
}

const AdminPanelBar = ({ content, onboardingReady = false }: AdminPanelBarProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 每次进入后台（刷新）二级菜单全部折叠，只展开当前页面所在的分组（见下方路由 effect）；
  // 手动展开/折叠只在本次会话内保留，不再写入 localStorage
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  const previousMenuRoute = useRef<string | null>(null);
  const initializedMenuGroups = useRef(new Set<string>());
  const isMobile = useIsMobile();
  const ishttps = window.location.protocol === "https:";
  const [t, i18n] = useTranslation();
  const location = useLocation();
  const onboarding = useAdminGuide(onboardingReady);
  const sidebarBeforeGuide = useRef<{
    open: boolean;
    subMenus: Record<string, boolean>;
  } | null>(null);
  useEffect(() => {
    if (onboarding.guide) {
      if (!sidebarBeforeGuide.current) {
        sidebarBeforeGuide.current = { open: sidebarOpen, subMenus: openSubMenus };
      }
      const needsSidebar = !(onboarding.guide === "install" && onboarding.step === 1);
      setSidebarOpen(needsSidebar || !isMobile);
      if (onboarding.menu) {
        setOpenSubMenus((previous) => ({ ...previous, [onboarding.menu!]: true }));
      }
    } else if (sidebarBeforeGuide.current) {
      setSidebarOpen(sidebarBeforeGuide.current.open);
      setOpenSubMenus(sidebarBeforeGuide.current.subMenus);
      sidebarBeforeGuide.current = null;
    }
    // Capture navigation state once before temporarily revealing guide targets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.guide, onboarding.step, onboarding.menu, isMobile]);
  const isConfigFormPage =
    location.pathname === "/admin/theme_managed" ||
    location.pathname === "/admin/plugins/config";
  const { publicInfo } = usePublicInfo();
  const { refreshVersion } = useAdminNavigation();
  //const navigate = useNavigate();
  const currentLanguage =
    i18n.resolvedLanguage ||
    i18n.language ||
    (typeof navigator !== "undefined" ? navigator.language : "");
  const currentTheme = publicInfo?.theme;

  // 动态扩展菜单（主题 + 插件注入页面）与版本更新检测
  const { extraMenuItems, pluginMenuItems } = useAdminExtraMenus(currentTheme, currentLanguage, refreshVersion);
  const { versionInfo, latestRelease, updateAvailable, releasesSince } = useReleaseCheck(publicInfo);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => setSidebarOpen(!isMobile);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  // 外观与插件保留管理入口；插件自定义页面使用独立的插件功能菜单。
  const mergedBaseMenuItems: ExtendedMenuItem[] = useMemo(() => {
    return baseMenuItems.flatMap((item): ExtendedMenuItem[] => {
      if (item.labelKey === "adminNavigation.extensions") {
        const children = item.children || [];
        return [
          {
            ...item,
            children: [
              ...children.filter((child) => !child.path.includes("/plugins")),
              ...extraMenuItems,
              ...children.filter((child) => child.path.includes("/plugins")),
            ],
          },
          ...(pluginMenuItems.length > 0
            ? [{
                labelKey: "adminNavigation.pluginFeatures",
                path: "/admin/plugin-page",
                icon: "PanelsTopLeft",
                children: pluginMenuItems,
              }]
            : []),
        ];
      }
      return [item];
    });
  }, [extraMenuItems, pluginMenuItems]);
  const bottomStartPath = mergedBaseMenuItems.find(
    (item) => item.bottom,
  )?.path;

  // 菜单刷新保留手动状态；首次加载或路由切换时展开当前页面所在分组。
  useEffect(() => {
    const route = location.pathname + location.search;
    const routeChanged = previousMenuRoute.current !== route;
    previousMenuRoute.current = route;
    const groups = mergedBaseMenuItems.filter((item) => item.children?.length);
    const newGroups = new Set(groups.filter((item) => !initializedMenuGroups.current.has(item.path)).map((item) => item.path));
    groups.forEach((item) => initializedMenuGroups.current.add(item.path));
    setOpenSubMenus((previous) => {
      const next = { ...previous };
      for (const item of groups) {
        const active = item.children!.some((child) => {
          if (child.path.includes("?")) return child.path === route;
          const path = child.path;
          return location.pathname === path || (path !== "/" && location.pathname.startsWith(path + "/"));
        });
        if (active && (routeChanged || newGroups.has(item.path))) next[item.path] = true;
      }
      if (onboarding.menu) next[onboarding.menu] = true;
      return Object.keys(next).some((key) => next[key] !== previous[key]) ? next : previous;
    });
  }, [location.pathname, location.search, mergedBaseMenuItems, onboarding.menu]);

  // 清掉旧版本保存的展开状态（现在不再读取）
  useEffect(() => {
    try {
      localStorage.removeItem("komari.admin.submenus");
    } catch {
      // 存储不可用：本来就没有旧状态
    }
  }, []);

  // 首帧不播放侧栏展开：桌面端初始为关闭态、挂载后才被 resize 逻辑打开，
  // 否则每次进入后台都会看到侧栏从 0 宽「弹」出来（surface 不该抢首屏的戏）。
  const [sidebarAnimated, setSidebarAnimated] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSidebarAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // 侧边栏动画变体：宽度用弹簧，展开到一半再点收起会保留速度顺势转向
  const sidebarVariants = {
    open: {
      width: isMobile ? "100vw" : "240px",
      opacity: 1,
      transition: sidebarAnimated ? SURFACE_MOTION.slide : { duration: 0 },
    },
    closed: {
      width: 0,
      opacity: isMobile ? 0 : 1, // 移动端完全透明
      transition: SURFACE_MOTION.slide,
    },
  };

  // 内容区域动画变体：与侧边栏共用同一条曲线，避免两段动画打架
  const contentVariants = {
    open: {
      opacity: isMobile ? 0 : 1,
      x: isMobile ? "100%" : 0,
      transition: SURFACE_MOTION.slide,
    },
    closed: {
      opacity: 1,
      x: 0,
      transition: SURFACE_MOTION.slide,
    },
  };

  function logout() {
    window.open("/api/logout", "_self");
  }
  return (
    <>
      <Grid
        className="km-admin-layout km-admin-panel-bar"
        // 侧栏列用 auto：列宽每帧跟随侧栏的弹簧宽度，内容区与侧栏同步收放（同一条弹簧、可被打断），
        // 而不是网格列先瞬间跳到 0/240px、侧栏再慢慢追上去。
        columns={{ initial: "1fr", md: "auto 1fr" }}
        rows={{ initial: "auto 1fr", md: "auto 1fr" }}
        style={{
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          backgroundColor: "var(--accent-1)",
        }}
      >
        {/* Navbar */}
        <motion.nav
          className="km-admin-panel-topbar col-span-2"
          initial={{ y: 0 }}
          animate={{ y: 0 }}
          transition={{ duration: MOTION_DURATION.slower, ease: MOTION_EASE.out }}
        >
          <Flex
            gap="3"
            p="2"
            justify="between"
            align="center"
            className="border-b-1"
          >
            <Flex gap="3" align="center">
              <IconButton
                variant="ghost"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={t("common.menu_sidebar", "Menu")}
                aria-label={t("common.menu_sidebar", "Menu")}
                style={{
                  display: isMobile && sidebarOpen ? "none" : "flex",
                  color: "var(--gray-11)",
                }}
              >
                <TablerMenu2 />
              </IconButton>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <label className="text-xl font-bold">Komari</label>
              </a>
              {updateAvailable && releasesSince.length > 0 && (
                <Tips
                  mode="dialog"
                  className="check-update"
                  trigger={<CircleFadingArrowUp color="#FB4141" size="16" />}
                >
                  <div className="flex flex-col gap-2 max-w-[80vw] md:max-w-[720px]">
                    <label className="font-bold">
                      {t("common.update_available")}
                    </label>
                    <div className="text-sm text-muted-foreground">
                      <span style={{ marginRight: 8 }}>
                        {(publicInfo as any)?.version || versionInfo?.version}
                      </span>
                      <span>{"> "}</span>
                      <span>
                        {(latestRelease?.tag_name || latestRelease?.name) ?? ""}
                      </span>
                    </div>

                    <div className="rounded-md p-2 overflow-auto max-h-80">
                      <div className="flex flex-col gap-4 text-sm">
                        {releasesSince.map((r) => (
                          <div key={r.html_url} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">
                                {r.name || r.tag_name}
                              </div>
                              {r.published_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(r.published_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                            <div className="km-update-changelog markdown-body break-words">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {r.body || ""}
                              </ReactMarkdown>
                            </div>
                            <div
                              style={{
                                height: 1,
                                background: "var(--accent-5)",
                                opacity: 0.5,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={latestRelease?.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="soft">Github</Button>
                      </a>
                    </div>
                  </div>
                </Tips>
              )}
              <label
                className="text-sm text-muted-foreground self-end overflow-hidden"
                hidden={isMobile}
              >
                {(publicInfo as any)?.version ||
                  (versionInfo &&
                    `${versionInfo.version} (${versionInfo.hash})`)}
              </label>
            </Flex>
            <Flex gap="2" align="center" overflowX="auto" className="km-admin-panel-controls">
              <ThemeSwitch />
              <ColorSwitch />
              <LanguageSwitch />
              <IconButton
                variant="soft"
                color="orange"
                className="km-admin-panel-account"
                onClick={logout}
                title={t("common.logout", "Logout")}
                aria-label={t("common.logout", "Logout")}
              >
                <ExitIcon />
              </IconButton>
            </Flex>
          </Flex>
        </motion.nav>

        {/* Sidebar */}
        <AnimatePresence>
          <motion.div
            variants={sidebarVariants}
            initial="closed"
            animate={sidebarOpen ? "open" : "closed"}
            exit="closed"
            className="km-admin-panel-nav"
            // 侧栏自身可滚动：layoutScroll 让 layoutId 高亮块在滚动后仍按正确位置滑动
            layoutScroll
            style={{
              backgroundColor: "var(--accent-1)",
              height: "100%",
              position: isMobile ? "absolute" : "relative",
              zIndex: isMobile ? 10 : 1,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <Flex
              gap="3"
              className="p-2 border-r-1"
              direction="column"
              justify="start"
              align="start"
              style={{ height: "100%", minWidth: "240px" }}
            >
              {/* 关闭按钮 */}
              <IconButton
                variant="soft"
                title={t("common.close_sidebar", "Close menu")}
                aria-label={t("common.close_sidebar", "Close menu")}
                style={{
                  display: isMobile ? "flex" : "none",
                  margin: "8px 0px 0px 8px",
                }}
                onClick={() => setSidebarOpen(false)}
              >
                <Cross1Icon />
              </IconButton>
              {/* 侧边连链接 */}
              <Flex
                direction="column"
                gap="1"
                className="h-full md:mt-0 mt-6"
                style={{ width: "100%" }}
              >
                {mergedBaseMenuItems.map(
                  (item: ExtendedMenuItem) => {
                    // 支持 icon 为 URL/相对路径
                    const isOpen = openSubMenus[item.path];
                    const renderIcon = (
                      icon: string,
                      labelKey: string,
                      className?: string,
                      active?: boolean,
                    ) => {
                      const link = /^(https?:\/\/|\/|\.\/|\.\.\/)/.test(icon);
                      if (link) {
                        return (
                          <InlineSvgIcon
                            src={icon}
                            alt={t(labelKey)}
                            style={{
                              width: 16,
                              height: 16,
                              objectFit: "contain",
                              opacity: active ? 1 : 0.7,
                              filter: active ? "none" : "grayscale(20%)",
                            }}
                            className={className}
                            loading="lazy"
                          />
                        );
                      }
                      const Cmp = iconMap[icon];
                      if (Cmp) {
                        return (
                          <Cmp
                            className={className}
                            style={{
                              color: active
                                ? "var(--accent-10)"
                                : "var(--gray11)",
                            }}
                          />
                        );
                      }
                      // fallback: simple dot
                      return (
                        <span
                          className={className}
                          style={{
                            width: 16,
                            height: 16,
                            display: "inline-block",
                            borderRadius: 4,
                            background: "var(--accent-8)",
                          }}
                        />
                      );
                    };
                    if (item.children && item.children.length) {
                      return (
                        <div key={item.path}>
                          <Flex
                            className="p-2 gap-2 border-l-[4px] border-transparent cursor-pointer hover:bg-accent-3 rounded-md"
                            align="center"
                            onClick={() => {
                              //const currentlyOpen = openSubMenus[item.path];
                              // 检查当前路径是否已经在该父菜单的子菜单中
                              //const isCurrentlyInThisMenu = item.children?.some(
                              //  (child) =>
                              //    location.pathname === child.path ||
                              //    location.pathname.startsWith(child.path)
                              //);

                              // 切换子菜单的展开状态
                              setOpenSubMenus((prev) => ({
                                ...prev,
                                [item.path]: !prev[item.path],
                              }));

                              //// 只有在非展开状态且不在当前菜单组中时才导航到第一个子菜单项
                              //if (
                              //  !currentlyOpen &&
                              //  !isCurrentlyInThisMenu &&
                              //  item.children &&
                              //  item.children.length > 0
                              //) {
                              //  //navigate(item.children[0].path);
                              //  // 如果是移动端，关闭侧边栏
                              //  if (isMobile) {
                              //    setSidebarOpen(false);
                              //  }
                              //}
                            }}
                          >
                            {renderIcon(
                              item.icon,
                              item.labelKey,
                              "flex w-4 h-5 items-center justify-center",
                            )}
                            <Text
                              className="text-base"
                              weight="medium"
                              style={{
                                flex: 1,
                              }}
                            >
                              {item.rawLabel || t(item.labelKey)}
                            </Text>

                            <ChevronDownIcon
                              className="km-chevron"
                              style={{
                                transform: isOpen
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                              }}
                            />
                          </Flex>
                          <motion.div
                            initial={false}
                            animate={
                              isOpen
                                ? { height: "auto", opacity: 1 }
                                : { height: 0, opacity: 0 }
                            }
                            transition={MOTION_SPRING.soft}
                            style={{ overflow: "hidden" }}
                          >
                            <motion.div
                              initial={false}
                              animate={
                                isOpen
                                  ? { y: 0, opacity: 1 }
                                  : { y: -6, opacity: 0 }
                              }
                              transition={{
                                y: MOTION_SPRING.snappy,
                                opacity: {
                                  duration: MOTION_DURATION.fast,
                                  ease: MOTION_EASE.standard,
                                },
                              }}
                            >
                              <Flex direction="column" className="ml-4 gap-1">
                                {item.children.map((child: MenuItem) => (
                                  <SidebarItem
                                    key={child.path}
                                    to={child.path}
                                    icon={renderIcon(
                                      child.icon,
                                      child.labelKey,
                                      "flex w-4 h-5 items-center justify-center",
                                    )}
                                    children={
                                      (child as ExtendedMenuItem).rawLabel ||
                                      t(child.labelKey)
                                    }
                                    onClick={() =>
                                      isMobile && setSidebarOpen(false)
                                    }
                                    newTab={child.newTab}
                                    reloadDocument={
                                      (child as ExtendedMenuItem).reloadDocument
                                    }
                                  />
                                ))}
                              </Flex>
                            </motion.div>
                          </motion.div>
                        </div>
                      );
                    }
                    const isBottomStart =
                      item.bottom && item.path === bottomStartPath;
                    return (
                      <div
                        key={item.path}
                        style={
                          isBottomStart
                            ? { marginTop: "auto" }
                            : undefined
                        }
                      >
                        <SidebarItem
                          to={item.path}
                          icon={renderIcon(
                            item.icon,
                            item.labelKey,
                            "flex w-4 h-5 items-center justify-center",
                          )}
                          children={item.rawLabel || t(item.labelKey)}
                          onClick={() => isMobile && setSidebarOpen(false)}
                          newTab={item.newTab}
                          reloadDocument={item.reloadDocument}
                        />
                      </div>
                    );
                  },
                )}
              </Flex>
            </Flex>
          </motion.div>
        </AnimatePresence>

        {/* Main Content */}
        <motion.div
          variants={contentVariants}
          animate={sidebarOpen ? "open" : "closed"}
          className="km-admin-panel-content"
          style={{
            backgroundColor: "var(--accent-3)",
            display: isMobile && sidebarOpen ? "none" : "block",
            height: "100%", // Ensure the container takes full height
            minHeight: 0,
            overflow: "hidden", // Prevent this container from scrolling
          }}
        >
          <div
            style={{
              backgroundColor: "var(--accent-1)",
              height: "100%",
              minHeight: 0,
              borderRadius: "0",
              // 间距系统：窄屏 block(16)、宽屏 section(24)；页面自身不再另加外边距
              padding: isMobile ? "var(--space-4)" : "var(--space-5)",
              overflowY: isConfigFormPage ? "hidden" : "auto",
              display: isConfigFormPage ? "flex" : "block",
              flexDirection: isConfigFormPage ? "column" : undefined,
              boxSizing: "border-box",
            }}
          >
            <Callout.Root mb="5" hidden={ishttps} color="red">
              <Callout.Icon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M10.03 3.659c.856-1.548 3.081-1.548 3.937 0l7.746 14.001c.83 1.5-.255 3.34-1.969 3.34H4.254c-1.715 0-2.8-1.84-1.97-3.34zM12.997 17A.999.999 0 1 0 11 17a.999.999 0 0 0 1.997 0m-.259-7.853a.75.75 0 0 0-1.493.103l.004 4.501l.007.102a.75.75 0 0 0 1.493-.103l-.004-4.502z"
                  />
                </svg>
              </Callout.Icon>
              <Callout.Text>
                <Text size="2" weight="medium">
                  {t("warn_https")}
                </Text>
              </Callout.Text>
            </Callout.Root>
            {/*
              后台页面切换（surface 性格）：同样只进场、不退出。
              key 只取路由区块（见 contentSectionKey），同一页面内的 query 变化不会重挂载。
              mode="wait" 会先淡出旧页再挂新页，后台页面普遍较重（表格/图表），
              中间会看到一段空白；同步替换让新页面在旧页卸载的同一帧开始淡入。
            */}
            <motion.div
              key={contentSectionKey(location.pathname)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                opacity: {
                  duration: MOTION_DURATION.fast,
                  ease: MOTION_EASE.standard,
                },
                y: MOTION_SPRING.soft,
              }}
              className={isConfigFormPage ? "min-h-0 flex-1" : undefined}
            >
              {/* 页面骨架 -> 内容 的接棒入场；配置表单页需要保持 flex 撑满 */}
              <RevealBoundary
                className={isConfigFormPage ? "flex h-full min-h-0 flex-col" : undefined}
              >
                {content}
              </RevealBoundary>
            </motion.div>
          </div>
        </motion.div>
      </Grid>
      {onboarding.guide && (
        <GuidedTour
          steps={onboarding.steps}
          step={onboarding.step}
          onStepChange={onboarding.changeStep}
          onDismiss={onboarding.dismiss}
          onShown={onboarding.onShown}
          action={{
            label: t(`onboarding.${onboarding.guide}.action`),
            onClick: onboarding.act,
          }}
        />
      )}
    </>
  );
};

export default AdminPanelBar;
