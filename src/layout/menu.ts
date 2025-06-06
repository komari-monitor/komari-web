export interface MenuItem {
  labelKey: string;
  path: string;
  icon: string;
  children?: MenuItem[];
}
export interface MenuConfig {
  menu: MenuItem[];
}
export const menuConfig: MenuConfig = {
  menu: [
    {
      labelKey: "admin.menu.server",
      path: "/manage",
      icon: "server",
    },
    {
      labelKey: "admin.menu.settings.title",
      path: "/manage/settings",
      icon: "settings",
      children: [
        {
          labelKey: "admin.menu.settings.site",
          path: "/manage/settings/site",
          icon: "house",
        },
        {
          labelKey: "admin.menu.settings.custom",
          path: "/manage/settings/custom",
          icon: "code",
        },
        {
          labelKey: "admin.menu.settings.sso",
          path: "/manage/settings/sso",
          icon: "key-round",
        },
        {
          labelKey: "admin.menu.settings.general",
          path: "/manage/settings/general",
          icon: "ellipsis",
        },
      ],
    },
    {
      labelKey: "admin.menu.sessions",
      path: "/manage/sessions",
      icon: "users",
    },
    {
      labelKey: "admin.menu.account",
      path: "/manage/account",
      icon: "user-round-cog",
    },
    {
      labelKey: "admin.menu.documentation",
      path: "https://komari-monitor.github.io/komari-document",
      icon: "book",
    },
  ],
};

