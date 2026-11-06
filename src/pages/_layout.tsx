import { LiveDataProvider } from "@/contexts/LiveDataContext";
import Footer from "../components/Footer";
import NavBar from "../components/NavBar";
import { Outlet, useLocation } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import { useViewTransitionActive } from "@/lib/viewTransitionState";
import { RevealBoundary } from "@/components/motion/reveal";

const IndexLayout = () => {
  // 使用我们的LiveDataContext
  const InnerLayout = () => {
    const { publicInfo } = usePublicInfo();
    const isMobile = useIsMobile();
    const location = useLocation();
    // 原生 View Transition 进行中时，不再叠加 React 侧的路由过渡，
    // 否则「共享元素补间」和「整页淡入上浮」会同时跑，看起来像抖了一下。
    const viewTransitionActive = useViewTransitionActive();
    /*
      过渡的粒度按「路由区块」而不是完整 pathname：
      /instance/a -> /instance/b 属于同一区块，页面组件本来就会就地更新，
      若按 pathname 做 key 会整块卸载重挂，导致切换服务器时白屏一下。
      只有真正换了区块（列表 <-> 详情）才播放一次进场。
    */
    const routeSection = location.pathname.split("/").filter(Boolean)[0] ?? "home";
    const bgUrlDesktop = publicInfo?.theme_settings?.backgroundImageUrlDesktop;
    const bgUrlMobile = publicInfo?.theme_settings?.backgroundImageUrlMobile;
    const bgUrl = isMobile ? bgUrlMobile || bgUrlDesktop : bgUrlDesktop;
    const mainContentWidth =
      publicInfo?.theme_settings?.mainContentWidth ?? 100;
    return (
      <>
        <div
          className={
            bgUrl
              ? "km-layout layout flex flex-col w-full min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
              : "km-layout layout flex flex-col w-full min-h-screen bg-accent-1"
          }
          style={{
            backgroundImage: bgUrl ? `url(${bgUrl})` : "none",
            transition:
              "background-image var(--km-dur-slow) var(--km-ease-standard)",
          }}
        >
          {/*
            页面安全边距统一由 main 提供（窄屏 block 16 / 宽屏 section 24），页面根元素不再自带外边距；
            NavBar 与页面内容之间 block，加上 NavBar 自身的 group 内边距，视觉上约等于 section。
          */}
          <main
            className="km-main main-content flex flex-col gap-km-block px-km-block md:px-km-section pb-km-section h-full box-border"
            style={{
              width: `${mainContentWidth}vw`,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <NavBar />
            {/*
              路由级过渡（surface 性格）：只做很轻的淡入上浮，不做 scale。

              这里刻意「只进场、不退出」：
              mode="wait" 会先把旧页面淡出到 0 再挂新页面，中间那段时间整页是空的——
              切换服务器时就会看到明显白屏。改成默认的同步替换后，新页面在旧页面
              卸载的同一帧就开始淡入，视觉上是「内容就地换掉」，不会出现空洞。
              命中共享元素跳转时（viewTransitionActive）跳过整段，把过渡交给浏览器。
            */}
            <motion.div
              key={routeSection}
              initial={viewTransitionActive ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                y: MOTION_SPRING.soft,
                opacity: {
                  duration: MOTION_DURATION.base,
                  ease: MOTION_EASE.out,
                },
              }}
            >
              {/* 页面里的整页骨架卸载时，内容从骨架的位置淡入上浮（见 RevealBoundary） */}
              <RevealBoundary>
                <Outlet />
              </RevealBoundary>
            </motion.div>
          </main>
          <Footer />
        </div>
      </>
    );
  };

  return (
    <LiveDataProvider>
      <InnerLayout />
    </LiveDataProvider>
  );
};

export default IndexLayout;
