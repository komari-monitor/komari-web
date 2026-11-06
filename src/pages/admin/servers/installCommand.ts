import { quotePowerShellArg, quoteShellArg, quoteShellArgs } from "@/utils/shellQuote";
import { toast } from "sonner";
import type { InstallOptionsState } from "./useInstallOptions";

export interface InstallCommandTarget {
  /** 设置里的脚本域名，为空时使用当前站点地址 */
  scriptDomain?: string;
  /** 身份参数：一键部署为 ["-t", token]，自动发现为 ["--auto-discovery", key] */
  identityArgs: string[];
  /** Docker 指令是否挂载自动发现的身份文件（仅自动发现） */
  persistAutoDiscovery?: boolean;
}

/** 生成 Agent 安装指令（自动发现与一键部署共用） */
export function buildInstallCommand(
  state: InstallOptionsState,
  { scriptDomain, identityArgs, persistAutoDiscovery = false }: InstallCommandTarget
): string {
  const {
    selectedPlatform,
    installOptions,
    enableGhproxy,
    enableCustomDir,
    enableCustomServiceName,
    enableIncludeNics,
    enableExcludeNics,
    enableIncludeMountpoints,
    enableInterval,
    enableMonthRotate,
    enableInstallVersion,
  } = state;
  const host = (function () {
    if (!scriptDomain) {
      return window.location.origin;
    }
    if (scriptDomain.startsWith("http")) {
      return scriptDomain.replace(/\/+$/, "");
    }
    return `http://${scriptDomain.replace(/\/+$/, "")}`;
  })();
  const args: string[] = ["-e", host, ...identityArgs];
  if (installOptions.disableWebSsh) {
    args.push("--disable-web-ssh");
  }
  if (installOptions.disableAutoUpdate) {
    args.push("--disable-auto-update");
  }
  if (installOptions.ignoreUnsafeCert) {
    args.push("--ignore-unsafe-cert");
  }
  if (installOptions.memoryIncludeCache) {
    args.push("--memory-include-cache");
  }
  if (installOptions.getIpAddrFromNic) {
    args.push("--get-ip-addr-from-nic");
  }
  if (installOptions.enableGpu) {
    args.push("--gpu");
  }
  const ghproxy = installOptions.ghproxy.trim();
  if (enableGhproxy && ghproxy) {
    const finalUrl = (
      ghproxy.startsWith("http") ? ghproxy : `http://${ghproxy}`
    ).replace(/\/+$/, "");
    args.push(`--install-ghproxy`);
    args.push(finalUrl);
  }
  const installDir = installOptions.dir.trim();
  if (enableCustomDir && installDir) {
    args.push(`--install-dir`);
    args.push(installDir);
  }
  const serviceName = installOptions.serviceName.trim();
  if (enableCustomServiceName && serviceName) {
    args.push(`--install-service-name`);
    args.push(serviceName);
  }
  const installVersion = installOptions.installVersion.trim();
  if (enableInstallVersion && installVersion) {
    args.push(`--install-version`);
    args.push(installVersion);
  }
  const includeNics = installOptions.includeNics.trim();
  if (enableIncludeNics && includeNics) {
    args.push(`--include-nics`);
    args.push(includeNics);
  }
  const excludeNics = installOptions.excludeNics.trim();
  if (enableExcludeNics && excludeNics) {
    args.push(`--exclude-nics`);
    args.push(excludeNics);
  }
  const includeMountpoints = installOptions.includeMountpoints.trim();
  if (enableIncludeMountpoints && includeMountpoints) {
    args.push(`--include-mountpoint`);
    args.push(includeMountpoints);
  }
  if (enableInterval) {
    const intervalVal = Number.parseFloat(
      (installOptions.interval || "").trim()
    );
    args.push("-i");
    args.push(
      Number.isFinite(intervalVal) && intervalVal >= 1
        ? String(intervalVal)
        : "1"
    );
  }
  if (enableMonthRotate) {
    const rotateVal = (installOptions.monthRotate || "").trim() || "1";
    args.push(`--month-rotate`);
    args.push(rotateVal);
  }

  let scriptFile = "install.sh";
  if (selectedPlatform === "windows") {
    scriptFile = "install.ps1";
  }
  let scriptUrl = `https://raw.githubusercontent.com/komari-monitor/komari-agent/refs/heads/main/${scriptFile}`;
  if (enableGhproxy && ghproxy) {
    scriptUrl = scriptUrl.slice(8); // 去掉 https://
    if (ghproxy.endsWith("/")) {
      scriptUrl = `${ghproxy}${scriptUrl}`;
    } else {
      scriptUrl = `${ghproxy}/${scriptUrl}`;
    }
    if (!scriptUrl.startsWith("http")) {
      scriptUrl = `http://${scriptUrl}`;
    }
  }

  let finalCommand = "";
  switch (selectedPlatform) {
    case "linux":
      finalCommand =
        `wget -qO- ${quoteShellArg(scriptUrl)} | sudo bash -s -- ` +
        quoteShellArgs(args);
      break;
    case "windows":
      finalCommand =
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ` +
        `"iwr ${quotePowerShellArg(scriptUrl)}` +
        ` -UseBasicParsing -OutFile 'install.ps1'; &` +
        ` '.\\install.ps1'`;
      args.forEach((arg) => {
        finalCommand += ` ${quotePowerShellArg(arg)}`;
      });
      finalCommand += `"`;
      break;
    case "macos":
      finalCommand =
        `zsh <(curl -sL ${quoteShellArg(scriptUrl)}) ` +
        quoteShellArgs(args);
      break;
    case "docker": {
      // Docker 运行时不支持安装脚本专用参数，剔除它们及其取值
      const installOnlyFlags = [
        "--install-ghproxy",
        "--install-dir",
        "--install-service-name",
        "--install-version",
      ];
      const dockerArgs: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (installOnlyFlags.includes(args[i])) {
          i++; // 跳过该标志的取值
          continue;
        }
        dockerArgs.push(args[i]);
      }
      // 自动发现会在 /app/auto-discovery.json 写入注册得到的 uuid/token，
      // 通过 bind mount 持久化该文件，容器更新重建后复用同一身份，避免重复注册。
      // 注意：文件挂载要求宿主机上文件已存在，否则 Docker 会将其创建为目录。
      finalCommand = persistAutoDiscovery
        ? `touch .komari-auto-discovery.json && ` +
          `docker run -d --name komari-agent --restart=always ` +
          `-v .komari-auto-discovery.json:/app/auto-discovery.json ` +
          `ghcr.io/komari-monitor/komari-agent:latest ` +
          quoteShellArgs(dockerArgs)
        : `docker run -d --name komari-agent --restart=always ` +
          `ghcr.io/komari-monitor/komari-agent:latest ` +
          quoteShellArgs(dockerArgs);
      break;
    }
  }
  return finalCommand;
}

/** 复制到剪贴板并提示成功；失败只记到控制台 */
export async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }
}
