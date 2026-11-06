import { Flex, Text } from "@radix-ui/themes";
import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import { Skeletonize, skeletonText } from "./ui/skeleton";

const Footer = () => {
  //const currentYear = new Date().getFullYear();

  // 格式化 build 时间
  const formatBuildTime = (isoString: string) => {
    const date = new Date(isoString);
    return (
      date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Shanghai",
      }) + " (GMT+8)"
    );
  };

  const buildTime =
    typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : null;
  const [versionInfo, setVersionInfo] = useState<{
    hash: string;
    version: string;
  } | null>(null);
  const [versionFailed, setVersionFailed] = useState(false);
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const customFooterHtml = publicInfo?.theme_settings?.customFooterHtml || "";
  // 页脚内容与 main 同宽、同左右安全边距，左边缘和页面内容对齐（边框仍铺满整行）
  const mainContentWidth = publicInfo?.theme_settings?.mainContentWidth ?? 100;
  const innerStyle: CSSProperties = {
    width: `${mainContentWidth}vw`,
    maxWidth: "100%",
    marginLeft: "auto",
    marginRight: "auto",
  };
  const innerClass = "box-border px-km-block md:px-km-section";
  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        //const response = await fetch('/api/version');
        const data = await call("common:getVersion");
        setVersionInfo({ hash: data.hash?.slice(0, 7), version: data.version });
      } catch (error) {
        setVersionFailed(true);
        console.error("Failed to fetch version info:", error);
      }
    };

    fetchVersionInfo();
  }, []);

  return (
    <motion.div
      className="km-footer footer py-km-block border-t-1 border-t-[var(--gray-7)]"
      // surface 层：页脚是页面的一部分，随页面一起轻轻落位
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        y: MOTION_SPRING.soft,
        opacity: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
      }}
    >
      {/* Copyright and ICP Filing */}

      {customFooterHtml ? (
        <Text
          size="1"
          color="gray"
          className={"flex flex-col justify-center items-center " + innerClass}
          style={innerStyle}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: customFooterHtml,
            }}
          ></span>
          <Text size="2" color="gray">
            Powered by Komari Monitor.
          </Text>
        </Text>
      ) : (
        <Flex
          direction={{ initial: "column", md: "row" }}
          justify="between"
          align={{ initial: "center", md: "start" }}
          gap="4"
          className={innerClass}
          style={innerStyle}
        >
          <Flex
            direction="column"
            gap="1"
            align={{ initial: "center", md: "start" }}
          >
            <Text size="2" color="gray">
              Powered by Komari Monitor.
            </Text>
            {buildTime && (
              <Text size="1" color="gray">
                Build Time: {formatBuildTime(buildTime)}
              </Text>
            )}
            <Text size="1" color="gray">
              {/* 版本号异步到达：先是一条与「1.2.3 (abcdef0)」等宽的小骨架，到达后原位淡入 */}
              <Skeletonize as="span" loading={!versionInfo && !versionFailed}>
                {versionInfo
                  ? `${versionInfo.version} (${versionInfo.hash})`
                  : versionFailed
                    ? null
                    : skeletonText(15)}
              </Skeletonize>
            </Text>
          </Flex>
        </Flex>
      )}
    </motion.div>
  );
};

export default Footer;
