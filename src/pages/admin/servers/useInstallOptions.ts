import React from "react";
import { DEFAULT_INSTALL_OPTIONS, type InstallOptions, type Platform } from "./types";

/**
 * 安装指令表单状态：平台、安装选项、各个「勾选后才生效」的开关。
 * active 为 true 且后端是 snapshot 时，自动勾选「指定安装版本」并填入 snapshot。
 */
export default function useInstallOptions(isSnapshotBackend: boolean, active = true) {
  const [selectedPlatform, setSelectedPlatform] =
    React.useState<Platform>("linux");
  const [installOptions, setInstallOptions] =
    React.useState<InstallOptions>(DEFAULT_INSTALL_OPTIONS);

  const [enableGhproxy, setEnableGhproxy] = React.useState(false);
  const [enableCustomDir, setEnableCustomDir] = React.useState(false);
  const [enableCustomServiceName, setEnableCustomServiceName] =
    React.useState(false);
  const [enableIncludeNics, setEnableIncludeNics] = React.useState(false);
  const [enableExcludeNics, setEnableExcludeNics] = React.useState(false);
  const [enableIncludeMountpoints, setEnableIncludeMountpoints] =
    React.useState(false);
  const [enableInterval, setEnableInterval] = React.useState(false);
  const [enableMonthRotate, setEnableMonthRotate] = React.useState(false);
  const [enableInstallVersion, setEnableInstallVersion] = React.useState(false);

  React.useEffect(() => {
    if (!active || !isSnapshotBackend) {
      return;
    }

    setEnableInstallVersion(true);
    setInstallOptions((prev) => ({
      ...prev,
      installVersion: prev.installVersion.trim() || "snapshot",
    }));
  }, [active, isSnapshotBackend]);

  return {
    selectedPlatform,
    setSelectedPlatform,
    installOptions,
    setInstallOptions,
    enableGhproxy,
    setEnableGhproxy,
    enableCustomDir,
    setEnableCustomDir,
    enableCustomServiceName,
    setEnableCustomServiceName,
    enableIncludeNics,
    setEnableIncludeNics,
    enableExcludeNics,
    setEnableExcludeNics,
    enableIncludeMountpoints,
    setEnableIncludeMountpoints,
    enableInterval,
    setEnableInterval,
    enableMonthRotate,
    setEnableMonthRotate,
    enableInstallVersion,
    setEnableInstallVersion,
  };
}

export type InstallOptionsState = ReturnType<typeof useInstallOptions>;
