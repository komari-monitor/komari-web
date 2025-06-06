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
      labelKey: "server",
      path: "/manage",
      icon: "server",
    },
    {
      labelKey: "settings.title",
      path: "/admin/settings",
      icon: "settings",
      children: [
        {
          labelKey: "settings.site.title",
          path: "/admin/settings/site",
          icon: "house",
        },
        {
          labelKey: "settings.custom.title",
          path: "/admin/settings/custom",
          icon: "code",
        },
        {
          labelKey: "settings.sso.title",
          path: "/admin/settings/sso",
          icon: "key-round",
        },
        {
          labelKey: "settings.general.title",
          path: "/admin/settings/general",
          icon: "ellipsis",
        },
      ],
    },
    {
      labelKey: "sessions.title",
      path: "/admin/sessions",
      icon: "users",
    },
    {
      labelKey: "account",
      path: "/admin/account",
      icon: "user-round-cog",
    },
    {
      labelKey: "documentation",
      path: "https://komari-monitor.github.io/komari-document",
      icon: "book",
    },
  ],
};

