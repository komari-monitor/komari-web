import { Input } from "@/components/ui/input";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import React from "react";

const Account: React.FC = () => {
  const { loading, meInfo } = usePublicInfo();

  if (loading) return <div>加载中...</div>;

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">用户名</div>
        {/* <div className="text-gray-500 text-sm mb-2">用户名</div> */}
        <Input
          name="sitename"
          value={meInfo?.username || ""}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default Account;
