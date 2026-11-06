import { Flex } from "@radix-ui/themes";
import { useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { MOTION_TRANSITION } from "@/lib/motion";

export default function SettingLayout() {
  const location = useLocation();
  // 用 pathname 作为页面切换的稳定 key：只在「设置页之间」切换时做过渡（query 变化不重挂载）
  const routeKey = location.pathname;
  // 布局首次挂载时整块进场已由外层 AdminPanelBar 负责，这里不再叠一层淡入
  const mountedKey = useRef(routeKey);

  return (
    <Flex
      direction="column"
      className="km-admin-settings-layout km-admin-settings-content"
      style={{ minHeight: 0 }}
    >
      {/*
        surface 性格，但只做「淡」不做「移」：
        外层 AdminPanelBar 把 /admin/settings/* 视为同一路由区块，不会重挂载本布局，
        子页之间的切换只在这里做一次很短的淡入，负责讲清「同一块设置区换了内容」。
        不用 AnimatePresence mode="wait"：<Outlet /> 读取的是「当前」路由，
        退场中的旧节点会被立刻渲染成新页面（新页面挂载两次、先闪一下再淡出）。
        子页组件本身随路由更换必然重挂载，所以这里给 key 不会额外卸载任何东西。
        内层 flex-column + block 档（16）：同类设置卡之间的距离；小标题用 .km-section-title 与上一组拉开。
        外层不再加 padding：后台内容区已经有统一的页面边距，再加一层会让设置页比其它页缩进更深。
      */}
      <motion.div
        key={routeKey}
        className="km-admin-settings-page flex w-full flex-col gap-km-block"
        style={{ minHeight: 0 }}
        initial={routeKey === mountedKey.current ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={MOTION_TRANSITION.fadeIn}
      >
        <Outlet />
      </motion.div>
    </Flex>
  );
}
