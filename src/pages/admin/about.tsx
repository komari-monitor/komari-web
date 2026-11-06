import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown.css";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import { useTranslation } from "react-i18next";
import { SquareArrowOutUpRight } from "lucide-react";
import { SegmentedControl } from "@radix-ui/themes";
import { Apache2_LICENSE, MIT_LICENSE } from "@/utils/field";
import webDependencies from "@/utils/openSource.web.json";
import goDependencies from "@/utils/openSource.go.json";
import { getEula } from "@/utils/eula";
import { SettingCardCollapse } from "@/components/admin/SettingCard";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import PageHeader from "@/components/PageHeader";
import { useRouteQuery } from "@/lib/routeData";
import { aboutReadmeQuery } from "@/routeQueries/system";

/** 分段切换的方向：越往右，内容沿弧线自右滑入（surface 层）。 */
const switchVariants = {
  initial: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      x: MOTION_SPRING.soft,
      opacity: MOTION_TRANSITION.fadeIn,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -12,
    transition: MOTION_TRANSITION.fadeOut,
  }),
};

/**
 * README 还没下载完时的占位：与 markdown-body 同样的标签结构（标题、段落、列表），
 * Skeletonize 把文字画成等宽的条；README 到达后外层 AutoHeight 把高度弹簧到真实长度。
 */
const ReadmePlaceholder = () => (
  <div className="p-km-block">
    <h1>{skeletonText(12)}</h1>
    <p>{skeletonText(60)}</p>
    <p>{skeletonText(44)}</p>
    <h2>{skeletonText(9)}</h2>
    <ul>
      {[28, 34, 22, 30].map((chars, index) => (
        <li key={index}>{skeletonText(chars)}</li>
      ))}
    </ul>
    <h2>{skeletonText(11)}</h2>
    <p>{skeletonText(52)}</p>
  </div>
);

/** 视图顺序：用于判断切换方向（overlay 的「方向感」）。 */
const VIEW_ORDER = ["open_source", "eula", "readme"] as const;

export default function AboutPage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState("open_source");
  const [direction, setDirection] = useState(1);
  // README 在 Readme 分段里才显示，切换页面时不等它：routePreload 已提前请求，
  // 挂载后再接手（不随导航挂起），用户切到 Readme 时多半已经到了，没到就显示原来的骨架
  const [readmeArmed, setReadmeArmed] = useState(false);
  useEffect(() => setReadmeArmed(true), []);
  const readme = useRouteQuery(readmeArmed ? aboutReadmeQuery : null);
  const markdown = readme.data ?? "";
  const readmeFailed = Boolean(readme.error);

  const dependencies = [
    ...webDependencies,
    ...goDependencies.map((entry) => ({ ...entry, dev: false })),
  ].map((entry) => ({
    ...entry,
    license: entry.license === "(Unlicense OR Apache-2.0)" ? "Apache-2.0" : entry.license,
  })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.version.localeCompare(b.version));

  return (
    <div className="km-page km-page-admin-about km-about-content">
      <PageHeader className="km-about-title" title={t("common.about")} />
      {/* 分段切换与它控制的内容是同一区块：两者之间 block */}
      <div className="flex flex-col gap-km-block">
      <SegmentedControl.Root
        defaultValue={view}
        onValueChange={(next) => {
          // surface 层：按分段控件左右顺序给内容一个方向，避免无意义的原地淡入
          setDirection(
            VIEW_ORDER.indexOf(next as (typeof VIEW_ORDER)[number]) >=
              VIEW_ORDER.indexOf(view as (typeof VIEW_ORDER)[number])
              ? 1
              : -1,
          );
          setView(next);
        }}
      >
        <SegmentedControl.Item value="open_source">
          {t("about.open_source_title")}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="eula">
          {t("eula.title")}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="readme">Readme</SegmentedControl.Item>
      </SegmentedControl.Root>
      {/* surface 层：三段内容切换时按方向轻微位移 + 淡入 */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={view}
        custom={direction}
        variants={switchVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
      {(() => {
        switch (view) {
          case "eula":
            return (
              <>
                <div className="km-about-license license-text p-km-block border rounded-md bg-accent-1 flex flex-col gap-2">
                  <pre className="text-wrap">{getEula(i18n.language)}</pre>
                </div>
              </>
            );
          case "open_source":
            return (
              <div className="flex flex-col gap-km-block">
                <div className="km-about-license text-foreground flex flex-col gap-km-block">
                  <SettingCardCollapse
                    title="MIT License"
                    description="Copyright (C) 2025 Komari Monitor"
                  >
                    <pre className="text-wrap">{MIT_LICENSE}</pre>
                  </SettingCardCollapse>
                  <SettingCardCollapse
                    title="Apache License"
                    description="Version 2.0, January 2004"
                  >
                    <pre className="text-wrap">{Apache2_LICENSE}</pre>
                  </SettingCardCollapse>
                </div>
                {/* 区块小标题：离上方许可证卡片 section，离下方列表 group */}
                <h2 className="km-section-title text-xl font-semibold text-foreground">
                  {t("about.open_source")}
                </h2>
                <div className="km-about-copyright copyright text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-km-block">
                  <ul className="list-disc list-inside break-words">
                    {dependencies.map((entry) => (
                      <li key={entry.name + "@" + entry.version}>
                        <a href={entry.url} target="_blank" rel="noreferrer" className="text-accent-11 hover:underline">{entry.name}</a>
                        {" "}<span>{entry.version.startsWith("v") ? entry.version : `v${entry.version}`}</span>
                        {" · "}<span>{entry.license}</span>
                      </li>
                    ))}
                  </ul>
                  <p>Twemoji © Twitter, Inc. and other contributors · {t("about.twemoji_notice")} · <a className="text-accent-11 hover:underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC-BY-4.0</a></p>
                  <p>{t("about.ai")}</p>
                </div>
              </div>
            );
          case "readme":
            return (
              <div className="flex flex-col gap-km-group">
                {/* 卡片内的局部加载：不用整页骨架（那会让整页再淡入一次），只把这块画成同结构的骨架 */}
                <AutoHeight className="km-about-changelog markdown-body border border-muted/20 rounded-md">
                  <Skeletonize loading={!markdown && !readmeFailed} label>
                    {readmeFailed ? (
                      <p className="text-sm text-muted-foreground">README unavailable.</p>
                    ) : markdown ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        children={markdown}
                      />
                    ) : (
                      <ReadmePlaceholder />
                    )}
                  </Skeletonize>
                </AutoHeight>
                <a
                  href="https://github.com/komari-monitor/komari/blob/main/README.md"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-row gap-2 text-sm items-center"
                >
                  {t("about.readme_open_in_new_tab")}
                  <SquareArrowOutUpRight size="16"></SquareArrowOutUpRight>
                </a>
              </div>
            );
        }
      })()}
      </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}
