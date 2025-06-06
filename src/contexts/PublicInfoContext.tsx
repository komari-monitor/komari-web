import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface PublicInfo {
  allow_cors: boolean;
  custom_head: string;
  custom_body: string;
  description: string;
  disable_password_login: boolean;
  oauth_enable: boolean;
  sitename: string;
}

interface ApiResponse {
  data: PublicInfo;
  status: string;
}

interface MeResponse {
  logged_in: boolean;
  sso_id: string;
  sso_type: string;
  username: string;
  uuid: string;
}

interface PublicInfoContextType {
  publicInfo: PublicInfo | null;
  loading: boolean;
  error: Error | null;
  isLogin: boolean;
}

const PublicInfoContext = createContext<PublicInfoContextType | undefined>(
  undefined
);

export const PublicInfoProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLogin, setIsLogin] = useState<boolean>(false); // 新增 isLogin 状态

  useEffect(() => {
    const fetchPublicInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/public");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: ApiResponse = await response.json();
        if (result.status === "success" && result.data) {
          setPublicInfo(result.data);
          if (result.data.custom_head) {
            const head = document.querySelector("head");
            if (head) {
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = result.data.custom_head;
              Array.from(tempDiv.childNodes).forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const existingNode =
                    head.querySelector(
                      `${node.nodeName}[src="${(
                        node as HTMLElement
                      ).getAttribute("src")}"]`
                    ) ||
                    (node.nodeName === "STYLE" &&
                      head.querySelector(
                        `style[data-custom-style="${node.textContent?.substring(
                          0,
                          30
                        )}"]`
                      ));
                  if (!existingNode) {
                    if (node.nodeName === "STYLE" && node.textContent) {
                      (node as HTMLElement).setAttribute(
                        "data-custom-style",
                        node.textContent.substring(0, 30)
                      );
                    }
                    head.appendChild(node.cloneNode(true));
                  }
                } else if (node.nodeType === Node.COMMENT_NODE) {
                  // 可以选择性地添加注释节点
                  // head.appendChild(node.cloneNode(true));
                }
              });
            }
          }
        } else {
          throw new Error(result.status || "Failed to fetch public info");
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    const fetchLoginStatus = async () => {
      const cookie = document.cookie;
      if (!cookie) {
        setIsLogin(false);
        return;
      }
      try {
        const response = await fetch("/api/me");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: MeResponse = await response.json();
        setIsLogin(result.logged_in);
      } catch (e) {
        console.error("Failed to fetch login status:", e);
        setIsLogin(false);
      }finally{
        console.log("Login status fetched:", isLogin);
      }
    };

    fetchPublicInfo();
    fetchLoginStatus();
  }, []);

  return (
    <PublicInfoContext.Provider value={{ publicInfo, loading, error, isLogin }}>
      {children}
    </PublicInfoContext.Provider>
  );
};

export const usePublicInfo = () => {
  const context = useContext(PublicInfoContext);
  if (context === undefined) {
    throw new Error("usePublicInfo must be used within a PublicInfoProvider");
  }
  return context;
};