import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown.css";
import Loading from "@/components/loading";
import { useTranslation } from "react-i18next";
import { SquareArrowOutUpRight } from "lucide-react";
import { SegmentedControl } from "@radix-ui/themes";
import { Apache2_LICENSE, MIT_LICENSE } from "@/utils/field";
import webDependencies from "@/utils/openSource.web.json";
import goDependencies from "@/utils/openSource.go.json";
import { getEula } from "@/utils/eula";
import { SettingCardCollapse } from "@/components/admin/SettingCard";

export default function AboutPage() {
  const [markdown, setMarkdown] = useState("");
  const { t, i18n } = useTranslation();
  const [view, setView] = useState("open_source");
  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/komari-monitor/komari/refs/heads/main/README.md"
    )
      .then((res) => res.text())
      .then(setMarkdown);
  }, []);

  const dependencies = [
    ...webDependencies,
    ...goDependencies.map((entry) => ({ ...entry, dev: false })),
  ].map((entry) => ({
    ...entry,
    license: entry.license === "(Unlicense OR Apache-2.0)" ? "Apache-2.0" : entry.license,
  })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.version.localeCompare(b.version));

  return (
    <div className="km-page-admin-about km-about-content flex flex-col gap-4">
      <h1 className="km-about-title text-2xl font-bold text-foreground">{t("common.about")}</h1>
      <SegmentedControl.Root defaultValue={view} onValueChange={setView}>
        <SegmentedControl.Item value="open_source">
          {t("about.open_source_title")}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="eula">
          {t("eula.title")}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="readme">Readme</SegmentedControl.Item>
      </SegmentedControl.Root>
      {(() => {
        switch (view) {
          case "eula":
            return (
              <>
                <div className="km-about-license license-text mb-4 p-4 border rounded-md bg-accent-1 flex flex-col gap-2">
                  <pre className="text-wrap">{getEula(i18n.language)}</pre>
                </div>
              </>
            );
          case "open_source":
            return (
              <>
                <div className="km-about-license text-foreground flex flex-col gap-4">
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
                <h2 className="text-xl font-semibold text-foreground">
                  {t("about.open_source")}
                </h2>
                <div className="km-about-copyright copyright text-sm text-gray-500 dark:text-gray-400">
                  <ul className="list-disc list-inside break-words mb-4">
                    {dependencies.map((entry) => (
                      <li key={entry.name + "@" + entry.version}>
                        <a href={entry.url} target="_blank" rel="noreferrer" className="text-accent-11 hover:underline">{entry.name}</a>
                        {" "}<span>{entry.version.startsWith("v") ? entry.version : `v${entry.version}`}</span>
                        {" · "}<span>{entry.license}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-4">Twemoji © Twitter, Inc. and other contributors · {t("about.twemoji_notice")} · <a className="text-accent-11 hover:underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC-BY-4.0</a></p>
                  {t("about.ai")}
                </div>
              </>
            );
          case "readme":
            return (
              <>
                <div className="km-about-changelog markdown-body border border-muted/20 rounded-md">
                  {markdown ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      children={markdown}
                    />
                  ) : (
                    <Loading />
                  )}
                </div>
                <a
                  href="https://github.com/komari-monitor/komari/blob/main/README.md"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-row gap-2 text-sm items-center"
                >
                  {t("about.readme_open_in_new_tab")}
                  <SquareArrowOutUpRight size="16"></SquareArrowOutUpRight>
                </a>
              </>
            );
        }
      })()}
    </div>
  );
}
