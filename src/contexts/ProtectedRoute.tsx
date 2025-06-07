import { Navigate, Outlet } from "react-router";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

export const ProtectedRoute = () => {
  const { isLogin } = usePublicInfo();

  if (!isLogin) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};
