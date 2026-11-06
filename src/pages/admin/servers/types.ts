export type Platform = "linux" | "windows" | "macos" | "docker";

/** 安装选项（自动发现与一键部署共用） */
export type InstallOptions = {
  disableWebSsh: boolean;
  disableAutoUpdate: boolean;
  ignoreUnsafeCert: boolean;
  memoryIncludeCache: boolean;
  getIpAddrFromNic: boolean;
  enableGpu: boolean;
  ghproxy: string;
  dir: string;
  serviceName: string;
  includeNics: string;
  excludeNics: string;
  includeMountpoints: string;
  interval: string;
  monthRotate: string;
  installVersion: string;
};

export const DEFAULT_INSTALL_OPTIONS: InstallOptions = {
  disableWebSsh: false,
  disableAutoUpdate: false,
  ignoreUnsafeCert: false,
  memoryIncludeCache: false,
  getIpAddrFromNic: false,
  enableGpu: false,
  ghproxy: "",
  dir: "",
  serviceName: "",
  includeNics: "",
  excludeNics: "",
  includeMountpoints: "",
  interval: "",
  monthRotate: "",
  installVersion: "",
};
