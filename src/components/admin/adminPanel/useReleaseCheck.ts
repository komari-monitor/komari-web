import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type { GithubReleaseInfo } from "./types";
import { isNewerVersion } from "./semver";

/**
 * 读取当前后端版本，并从 GitHub releases 中找出所有比当前版本新的正式版，
 * 用于顶栏的「有可用更新」提示。
 */
export function useReleaseCheck(publicInfo: unknown) {
  const { call } = useRPC2Call();
  // 获取版本信息
  const [versionInfo, setVersionInfo] = useState<{
    hash: string;
    version: string;
  } | null>(null);
  // GitHub 最新发布信息与更新检测
  const [latestRelease, setLatestRelease] = useState<GithubReleaseInfo | null>(
    null,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [releasesSince, setReleasesSince] = useState<GithubReleaseInfo[]>([]);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        //const response = await fetch("/api/version");
        const data = await call("common:getVersion");
        setVersionInfo({
          hash: data.hash?.slice(0, 7),
          version: data.version,
        });
      } catch (error) {
        console.error("Failed to fetch version info:", error);
      }
    };

    fetchVersionInfo();
  }, []);

  // 获取 GitHub releases 列表，并筛选出“比当前版本新的所有 release”
  useEffect(() => {
    let ignore = false;
    const currentVersion = (publicInfo as any)?.version || versionInfo?.version;
    if (!currentVersion) return;

    async function loadReleases() {
      try {
        const resp = await fetch(
          "https://api.github.com/repos/komari-monitor/komari/releases?per_page=100",
          {
            headers: {
              Accept: "application/vnd.github+json",
            },
            cache: "no-cache",
          },
        );
        if (!resp.ok) throw new Error(`GitHub HTTP ${resp.status}`);
        const data: GithubReleaseInfo[] = await resp.json();
        if (ignore) return;
        const valid = (data || [])
          .filter((r) => !r.draft && !r.prerelease)
          .filter((r) =>
            isNewerVersion(r?.tag_name || r?.name, currentVersion),
          );
        setReleasesSince(valid);
        setLatestRelease(valid.length ? valid[0] : null);
        setUpdateAvailable(valid.length > 0);
      } catch (e) {
        console.warn("加载 GitHub 最新发布失败:", e);
        if (!ignore) {
          setLatestRelease(null);
          setReleasesSince([]);
          setUpdateAvailable(false);
        }
      }
    }

    loadReleases();
    return () => {
      ignore = true;
    };
  }, [publicInfo, versionInfo]);

  return { versionInfo, latestRelease, updateAvailable, releasesSince };
}
