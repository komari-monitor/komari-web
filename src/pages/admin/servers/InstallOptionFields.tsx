import { Flex, TextField, Checkbox } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import Tips from "@/components/ui/tips";
import type { InstallOptionsState } from "./useInstallOptions";
import OptionField from "./OptionField";

/**
 * 安装选项：功能开关（两列复选框）+ 勾选后展开的输入框。
 * 「添加节点」里的自动发现和每行的「一键部署指令」共用；
 * 两处唯一的差别是开关标签的 class（自动发现的标签带 cursor-pointer），由 optionLabelClassName 传入。
 */
export default function InstallOptionFields({
  state,
  optionLabelClassName,
}: {
  state: InstallOptionsState;
  optionLabelClassName: string;
}) {
  const { t } = useTranslation();
  const {
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
  } = state;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.disableWebSsh}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                disableWebSsh: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                disableWebSsh: !prev.disableWebSsh,
              }))
            }
          >
            {t("admin.nodeTable.disableWebSsh")}
          </label>
        </Flex>
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.disableAutoUpdate}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                disableAutoUpdate: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                disableAutoUpdate: !prev.disableAutoUpdate,
              }))
            }
          >
            {t("admin.nodeTable.disableAutoUpdate", "禁用自动更新")}
          </label>
        </Flex>
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.ignoreUnsafeCert}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                ignoreUnsafeCert: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                ignoreUnsafeCert: !prev.ignoreUnsafeCert,
              }))
            }
          >
            {t("admin.nodeTable.ignoreUnsafeCert", "忽略不安全证书")}
          </label>
        </Flex>
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.memoryIncludeCache}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                memoryIncludeCache: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                memoryIncludeCache: !prev.memoryIncludeCache,
              }))
            }
          >
            {t("admin.nodeTable.memoryModeAvailable", "监测可用内存")}
          </label>
          <Tips size="14">
            {t("admin.nodeTable.memoryModeAvailable_tip")}
          </Tips>
        </Flex>
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.getIpAddrFromNic}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                getIpAddrFromNic: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                getIpAddrFromNic: !prev.getIpAddrFromNic,
              }))
            }
          >
            {t("admin.nodeTable.getIpAddrFromNic", "从网卡获取 IP 地址")}
          </label>
        </Flex>
        <Flex gap="2" align="center">
          <Checkbox
            checked={installOptions.enableGpu}
            onCheckedChange={(checked) =>
              setInstallOptions((prev) => ({
                ...prev,
                enableGpu: Boolean(checked),
              }))
            }
          />
          <label
            className={optionLabelClassName}
            onClick={() =>
              setInstallOptions((prev) => ({
                ...prev,
                enableGpu: !prev.enableGpu,
              }))
            }
          >
            {t("admin.nodeTable.enableGpuMonitoring", "启用详细 GPU 监控")}
          </label>
        </Flex>
      </div>

      <Flex direction="column" gap="2">
        <Flex gap="2" align="center">
          <Checkbox
            checked={enableInstallVersion}
            onCheckedChange={(checked) => {
              setEnableInstallVersion(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({
                  ...prev,
                  installVersion: "",
                }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              const willEnable = !enableInstallVersion;
              setEnableInstallVersion(willEnable);
              if (!willEnable) {
                setInstallOptions((prev) => ({
                  ...prev,
                  installVersion: "",
                }));
              }
            }}
          >
            {t("admin.nodeTable.installVersion", "指定安装版本")}
          </label>
        </Flex>
        <OptionField open={enableInstallVersion}>
          <TextField.Root
            placeholder="snapshot"
            value={installOptions.installVersion}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                installVersion: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableGhproxy}
            onCheckedChange={(checked) => {
              setEnableGhproxy(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({ ...prev, ghproxy: "" }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableGhproxy(!enableGhproxy);
              if (enableGhproxy) {
                setInstallOptions((prev) => ({ ...prev, ghproxy: "" }));
              }
            }}
          >
            {t("admin.nodeTable.ghproxy", "GitHub 代理")}
          </label>
        </Flex>
        <OptionField open={enableGhproxy}>
          <TextField.Root
            placeholder="https://ghfast.top/"
            value={installOptions.ghproxy}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                ghproxy: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableCustomDir}
            onCheckedChange={(checked) => {
              setEnableCustomDir(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({ ...prev, dir: "" }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableCustomDir(!enableCustomDir);
              if (enableCustomDir) {
                setInstallOptions((prev) => ({ ...prev, dir: "" }));
              }
            }}
          >
            {t("admin.nodeTable.install_dir", "安装目录")}
          </label>
        </Flex>
        <OptionField open={enableCustomDir}>
          <TextField.Root
            placeholder={t(
              "admin.nodeTable.install_dir_placeholder",
              "安装目录，为空则使用默认目录(/opt/komari-agent)"
            )}
            value={installOptions.dir}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                dir: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableCustomServiceName}
            onCheckedChange={(checked) => {
              setEnableCustomServiceName(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({ ...prev, serviceName: "" }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableCustomServiceName(!enableCustomServiceName);
              if (enableCustomServiceName) {
                setInstallOptions((prev) => ({ ...prev, serviceName: "" }));
              }
            }}
          >
            {t("admin.nodeTable.serviceName", "服务名称")}
          </label>
        </Flex>
        <OptionField open={enableCustomServiceName}>
          <TextField.Root
            placeholder={t(
              "admin.nodeTable.serviceName_placeholder",
              "服务名称，为空则使用默认名称(komari-agent)"
            )}
            value={installOptions.serviceName}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                serviceName: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableIncludeNics}
            onCheckedChange={(checked) => {
              setEnableIncludeNics(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({ ...prev, includeNics: "" }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableIncludeNics(!enableIncludeNics);
              if (enableIncludeNics) {
                setInstallOptions((prev) => ({ ...prev, includeNics: "" }));
              }
            }}
          >
            {t("admin.nodeTable.includeNics", "只监测特定网卡")}
          </label>
        </Flex>
        <OptionField open={enableIncludeNics}>
          <TextField.Root
            placeholder="eth0,eth1"
            value={installOptions.includeNics}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                includeNics: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableExcludeNics}
            onCheckedChange={(checked) => {
              setEnableExcludeNics(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({ ...prev, excludeNics: "" }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableExcludeNics(!enableExcludeNics);
              if (enableExcludeNics) {
                setInstallOptions((prev) => ({ ...prev, excludeNics: "" }));
              }
            }}
          >
            {t("admin.nodeTable.excludeNics", "排除特定网卡")}
          </label>
        </Flex>
        <OptionField open={enableExcludeNics}>
          <TextField.Root
            placeholder="lo"
            value={installOptions.excludeNics}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                excludeNics: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableIncludeMountpoints}
            onCheckedChange={(checked) => {
              setEnableIncludeMountpoints(Boolean(checked));
              if (!checked) {
                setInstallOptions((prev) => ({
                  ...prev,
                  includeMountpoints: "",
                }));
              }
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              setEnableIncludeMountpoints(!enableIncludeMountpoints);
              if (enableIncludeMountpoints) {
                setInstallOptions((prev) => ({
                  ...prev,
                  includeMountpoints: "",
                }));
              }
            }}
          >
            {t("admin.nodeTable.includeMountpoints", "只监测特定挂载点")}
          </label>
        </Flex>
        <OptionField open={enableIncludeMountpoints}>
          <TextField.Root
            placeholder="/;/home;/var"
            value={installOptions.includeMountpoints}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                includeMountpoints: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableInterval}
            onCheckedChange={(checked) => {
              const en = Boolean(checked);
              setEnableInterval(en);
              setInstallOptions((prev) => ({
                ...prev,
                interval: en
                  ? prev.interval?.trim()
                    ? prev.interval
                    : "1"
                  : "",
              }));
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              const willEnable = !enableInterval;
              setEnableInterval(willEnable);
              setInstallOptions((prev) => ({
                ...prev,
                interval: willEnable
                  ? prev.interval?.trim()
                    ? prev.interval
                    : "1"
                  : "",
              }));
            }}
          >
            {t("admin.nodeTable.interval", "采集间隔(秒)")}
          </label>
        </Flex>
        <OptionField open={enableInterval}>
          <TextField.Root
            placeholder="1"
            type="number"
            min="1"
            step="0.1"
            value={installOptions.interval}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                interval: e.target.value,
              }))
            }
          />
        </OptionField>

        <Flex gap="2" align="center">
          <Checkbox
            checked={enableMonthRotate}
            onCheckedChange={(checked) => {
              const en = Boolean(checked);
              setEnableMonthRotate(en);
              setInstallOptions((prev) => ({
                ...prev,
                monthRotate: en
                  ? prev.monthRotate?.trim()
                    ? prev.monthRotate
                    : "1"
                  : "",
              }));
            }}
          />
          <label
            className="text-sm font-bold cursor-pointer"
            onClick={() => {
              const willEnable = !enableMonthRotate;
              setEnableMonthRotate(willEnable);
              setInstallOptions((prev) => ({
                ...prev,
                monthRotate: willEnable
                  ? prev.monthRotate?.trim()
                    ? prev.monthRotate
                    : "1"
                  : "",
              }));
            }}
          >
            {t("admin.nodeTable.monthRotate", "网络统计月重置")}
          </label>
        </Flex>
        <OptionField open={enableMonthRotate}>
          <TextField.Root
            placeholder="1"
            type="number"
            min="1"
            max="31"
            value={installOptions.monthRotate}
            onChange={(e) =>
              setInstallOptions((prev) => ({
                ...prev,
                monthRotate: e.target.value,
              }))
            }
          />
        </OptionField>
      </Flex>
    </>
  );
}
