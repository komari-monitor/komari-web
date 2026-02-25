import React from "react";
import { LiveDataProvider } from "@/contexts/LiveDataContext";
import Footer from "../components/Footer";
import NavBar from "../components/NavBar";
import { Outlet } from "react-router-dom";
import { NodeListProvider } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import PasswordMigrationDialog, {
  shouldShowPasswordMigrationDialog,
} from "@/components/PasswordMigrationDialog";

const IndexLayout = () => {
  // 使用我们的LiveDataContext
  const InnerLayout = () => {
    const { publicInfo } = usePublicInfo();
    const { account } = useAccount();
    const isMobile = useIsMobile();
    const bgUrlDesktop = publicInfo?.theme_settings?.backgroundImageUrlDesktop;
    const bgUrlMobile = publicInfo?.theme_settings?.backgroundImageUrlMobile;
    const bgUrl = isMobile ? bgUrlMobile || bgUrlDesktop : bgUrlDesktop;
    const mainContentWidth =
      publicInfo?.theme_settings?.mainContentWidth ?? 100;
    
    // 密码迁移提示
    const [showMigrationDialog, setShowMigrationDialog] = React.useState(false);

    React.useEffect(() => {
      if (account?.logged_in && shouldShowPasswordMigrationDialog(account.password_migration_required)) {
        setShowMigrationDialog(true);
      }
    }, [account]);

    return (
      <>
        <div
          className={
            bgUrl
              ? "layout flex flex-col w-full min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
              : "layout flex flex-col w-full min-h-screen bg-accent-1"
          }
          style={{
            backgroundImage: bgUrl ? `url(${bgUrl})` : "none",
          }}
        >
          <main
            className="main-content m-1 h-full"
            style={{
              width: `${mainContentWidth}vw`,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <NavBar />
            <Outlet />
          </main>
          <Footer />
        </div>
        <PasswordMigrationDialog
          open={showMigrationDialog}
          onOpenChange={setShowMigrationDialog}
        />
      </>
    );
  };

  return (
    <LiveDataProvider>
      <NodeListProvider>
        <AccountProvider>
          <InnerLayout />
        </AccountProvider>
      </NodeListProvider>
    </LiveDataProvider>
  );
};

export default IndexLayout;
