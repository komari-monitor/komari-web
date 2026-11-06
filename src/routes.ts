// routes.js
import { lazy, use, useState, type ComponentType } from "react";
import type { RouteObject } from "react-router-dom";
import React from "react";
import { Navigate } from "react-router-dom";
import { currentNavigationSeq, pendingNavigationGate } from "@/lib/routeData";

/**
 * 页面切换时等数据：随某次导航挂载的路由元素，在这次导航登记的请求到达（或 ROUTE_DATA_BUDGET_MS 预算用完）前挂起，
 * transition 让旧页面继续显示。只有挂载时所属的那次导航会挂起：已挂载的布局之后再重渲染不会挂起，
 * 同步更新也就不会意外露出 Suspense 的 fallback。这里只有一个 hook，use() 放在最后。
 */
const RouteGate = ({ component: Component }: { component: ComponentType }) => {
  const [seq] = useState(currentNavigationSeq);
  const gate = pendingNavigationGate(seq);
  if (gate) use(gate);
  return React.createElement(Component);
};

/**
 * 懒加载页面：element 用 React.lazy，handle.preload 指向同一个 import()，
 * 悬停 / 点击时 routePreload 按地址匹配并提前下载代码块（同一模块只下载一次）。
 */
const page = (importer: () => Promise<{ default: ComponentType }>) => {
  const Component = lazy(importer);
  return { element: React.createElement(RouteGate, { component: Component }), handle: { preload: importer } };
};

const Index = page(() => import("./pages/Index"));
const AdminLayout = page(() => import("./pages/admin/_layout"));
const Admin = page(() => import("./pages/admin"));
const Dashboard = page(() => import("./pages/admin/dashboard"));
const NotFound = page(() => import("./pages/404"));

export const routes: RouteObject[] = [
  {
    path: "/",
    ...page(() => import("./pages/_layout")),
    children: [
      { index: true, ...Index },
      {
        path: "instance/:uuid",
        ...page(() => import("./pages/instance")),
      },
      {
        path: "plugin/:short/*",
        ...page(() => import("./pages/plugin_page")),
      },
    ],
  },
  {
    path: "/admin/database-migration",
    ...page(() => import("./pages/database_migration")),
  },
  {
    path: "/install",
    ...page(() => import("./pages/install")),
  },
  {
    path: "/database-recovery",
    ...page(() => import("./pages/database_recovery")),
  },
  {
    path: "/admin/login",
    ...page(() => import("./pages/admin/login")),
  },
  {
    path: "/admin",
    ...AdminLayout,
    children: [
      { index: true, element: React.createElement(Navigate, { to: "/admin/dashboard", replace: true }) },
      {
        path: "dashboard",
        ...Dashboard,
      },
      {
        path: "servers",
        ...Admin,
      },
      {
        path: "theme_managed",
        ...page(() => import("./pages/admin/theme_managed.tsx")),
      },
      {
        path: "theme_raw",
        ...page(() => import("./pages/admin/theme_raw.tsx")),
      },
      {
        path: "themes",
        ...page(() => import("./pages/admin/settings/_layout")),
        children: [
          {
            index: true,
            ...page(() => import("./pages/admin/themes")),
          },
        ],
      },
      {
        path: "theme",
        element: React.createElement(Navigate, {
          to: "/admin/themes",
          replace: true,
        }),
      },
      {
        path: "plugins",
        ...page(() => import("./pages/admin/plugins")),
      },
      {
        path: "plugins/config",
        ...page(() => import("./pages/admin/plugin_config")),
      },
      {
        path: "plugin-page",
        ...page(() => import("./pages/admin/plugin_page")),
      },
      {
        path: "market/themes",
        ...page(() => import("./pages/admin/market/themes")),
      },
      {
        path: "market/plugins",
        ...page(() => import("./pages/admin/market/plugins")),
      },
      {
        path: "sessions",
        ...page(() => import("./pages/admin/sessions")),
      },
      {
        path: "account",
        ...page(() => import("./pages/admin/account")),
      },
      {
        path: "settings",
        ...page(() => import("./pages/admin/settings/_layout")),
        children: [
          {
            index: true,
            element: React.createElement(Navigate, {
              to: "/admin/settings/site",
              replace: true,
            }),
          },
          {
            path: "site",
            ...page(() => import("./pages/admin/settings/site")),
          },
          {
            path: "theme",
            element: React.createElement(Navigate, {
              to: "/admin/themes",
              replace: true,
            }),
          },
          {
            path: "custom",
            ...page(() => import("./pages/admin/settings/custom")),
          },
          {
            path: "sign-on",
            ...page(() => import("./pages/admin/settings/sign-on")),
          },
          {
            path: "notification",
            element: React.createElement(Navigate, {
              to: "/admin/notification/channels",
              replace: true,
            }),
          },
          {
            path: "general",
            ...page(() => import("./pages/admin/settings/general")),
          },
          {
            path: "metrics",
            ...page(() => import("./pages/admin/settings/metrics")),
          },
        ],
      },
      {
        path: "notification",
        children: [
          {
            index: true,
            element: React.createElement(Navigate, {
              to: "/admin/notification/channels",
              replace: true,
            }),
          },
          {
            path: "channels",
            ...page(() => import("./pages/admin/settings/_layout")),
            children: [
              {
                index: true,
                ...page(() => import("./pages/admin/notification/channels")),
              },
            ],
          },
          {
            path: "offline",
            ...page(() => import("./pages/admin/notification/offline")),
          },
          {
            path: "general",
            ...page(() => import("./pages/admin/notification/general")),
          },
        ],
      },
      {
        path: "ping",
        ...page(() => import("./pages/admin/pingTask")),
      },
      {
        path: "about",
        ...page(() => import("./pages/admin/about")),
      },
      {
        path: "logs",
        ...page(() => import("./pages/admin/log")),
      },
      {
        path: "pprof",
        ...page(() => import("./pages/admin/pprof")),
      },
      {
        path: "exec",
        ...page(() => import("./pages/admin/exec")),
      }
    ],
  },
  {
    path: "/terminal",
    ...page(() => import("./pages/terminal")),
  },
  {
    path: "/manage/*",
    ...page(() => import("./pages/manage")),
  },
  // Catch-all 404 route
  { path: "*", ...NotFound },
];
