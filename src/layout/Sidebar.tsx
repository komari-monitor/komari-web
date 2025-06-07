import { type ReactNode, Fragment, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { menuConfig, type MenuItem } from "./menu";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

import {
  Server,
  Settings,
  House,
  KeyRound,
  Ellipsis,
  Users,
  UserRoundCog,
  Book,
  ChevronDown,
  type LucideIcon,
  AtSign,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const iconMap: { [key: string]: LucideIcon } = {
  server: Server,
  settings: Settings,
  house: House,
  "key-round": KeyRound,
  ellipsis: Ellipsis,
  users: Users,
  "at-sign": AtSign,
  "user-round-cog": UserRoundCog,
  book: Book,
};

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;
  return <IconComponent className={className || "h-5 w-5"} />;
};
const menuItems = menuConfig.menu;

const AdminSidebar = () => {
  const { sidebarOpen, setSidebarOpen } = usePublicInfo();
  const initialSetRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile && !initialSetRef.current) {
      if (!sidebarOpen) {
        setSidebarOpen(true);
      }
      initialSetRef.current = true;
    }
  }, [isMobile, sidebarOpen, setSidebarOpen]);

  const handleItemClick = () => {
    if (isMobile) {
      setSidebarOpen(true);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {isMobile && <div className="min-h-10"></div>}
      <div className="flex-1 flex flex-col gap-1 p-2">
        {menuItems.map((item) => (
          <SidebarMenu
            item={item}
            key={item.path}
            onItemClick={handleItemClick}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Fragment>
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[240px] bg-background border-r-0"
          >
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`h-full transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden border-r bg-background ${
            sidebarOpen ? "w-60" : "w-0"
          }`}
        >
          <div className="w-60 h-full">{sidebarContent}</div>
        </aside>
      )}
    </Fragment>
  );
};
const SidebarMenu = ({
  item,
  onItemClick,
}: {
  item: MenuItem;
  onItemClick: () => void;
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const isChildActive =
    item.children?.some((child) => location.pathname.startsWith(child.path)) ??
    false;

  if (item.children && item.children.length) {
    return (
      <Collapsible defaultOpen={isChildActive}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 pr-2">
            <Icon name={item.icon} />
            <span className="flex-1 text-left text-base font-medium">
              {t(item.labelKey)}
            </span>
            <ChevronDown />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="py-1 pl-6">
          <div className="flex flex-col gap-1">
            {item.children.map((child) => (
              <SidebarItem
                key={child.path}
                to={child.path}
                icon={child.icon}
                onClick={onItemClick}
              >
                {t(child.labelKey)}
              </SidebarItem>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <SidebarItem to={item.path} icon={item.icon} onClick={onItemClick}>
      {t(item.labelKey)}
    </SidebarItem>
  );
};

const SidebarItem = ({
  to,
  icon,
  onClick,
  children,
}: {
  to: string;
  icon: string;
  onClick: () => void;
  children: ReactNode;
}) => {
  const location = useLocation();
  const isExternal = to.startsWith("http");
  const isActive = !isExternal && location.pathname === to;

  const content = (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start gap-2"
    >
      <Icon name={icon} />
      <span className="text-base font-medium">{children}</span>
    </Button>
  );

  if (isExternal) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="block"
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={to} onClick={onClick} className="block">
      {content}
    </Link>
  );
};

export default AdminSidebar;
