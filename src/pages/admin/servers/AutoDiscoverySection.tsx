import React from "react";
import { Flex, Button, Checkbox, Text, TextArea, SegmentedControl, Callout } from "@radix-ui/themes";
import { Copy, Radar, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LoadingSwap } from "@/components/motion";
import Loading from "@/components/loading";
import type { Platform } from "./types";
import { buildInstallCommand, copyText } from "./installCommand";
import useIsSnapshotBackend from "./useIsSnapshotBackend";
import useInstallOptions from "./useInstallOptions";
import OptionField from "./OptionField";
import InstallOptionFields from "./InstallOptionFields";

const AutoDiscoverySection = ({
  settings,
  loading,
}: {
  settings: any;
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  const adKey: string = settings?.auto_discovery_key || "";
  const enabled = Boolean(adKey);

  const [showOptions, setShowOptions] = React.useState(false);
  const isSnapshotBackend = useIsSnapshotBackend();
  // 展开「安装选项」后，snapshot 后端自动勾选「指定安装版本」
  const installState = useInstallOptions(isSnapshotBackend, showOptions);
  const { selectedPlatform, setSelectedPlatform } = installState;

  const generateCommand = () =>
    buildInstallCommand(installState, {
      scriptDomain: settings?.script_domain,
      identityArgs: ["--auto-discovery", adKey],
      persistAutoDiscovery: true,
    });

  const copyToClipboard = (text: string) =>
    copyText(text, t("copy_success", "已复制到剪贴板"));

  // 设置未到：同一位置放骨架，到达后交叉淡化 + 高度弹簧（对话框里不能用整页骨架，会让整页淡一下）
  return (
    <LoadingSwap
      loading={Boolean(loading)}
      skeleton={
        <div className="mt-km-section flex justify-center">
          <Loading compact reveal={false} />
        </div>
      }
    >
      {() => renderAutoDiscoveryBody()}
    </LoadingSwap>
  );

  function renderAutoDiscoveryBody() {
  if (!enabled) {
    return (
      <Callout.Root color="blue" mt="5" size="1">
        <Callout.Icon>
          <Radar size={16} />
        </Callout.Icon>
        <Callout.Text>
          <Flex direction="column" gap="2" align="start">
            <Text weight="bold">
              {t("admin.nodeTable.autoDiscovery.tryIt", "试试自动发现")}
            </Text>
            <Text size="2">
              {t(
                "admin.nodeTable.autoDiscovery.disabledDescription",
                "开启自动发现后，无需逐台手动添加节点。只要在目标服务器上运行一条命令，Agent 就会携带密钥自动注册并上线，非常适合批量部署多台服务器。"
              )}
            </Text>
            <Link to="/admin/settings/general">
              <Button variant="soft" size="1">
                <Settings size={14} />
                {t(
                  "admin.nodeTable.autoDiscovery.goToSettings",
                  "前往“常规设置”开启自动发现"
                )}
              </Button>
            </Link>
          </Flex>
        </Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <Flex direction="column" gap="4" mt="5">
      <Flex direction="column" gap="1">
        <Flex gap="2" align="center">
          <Radar size={16} />
          <Text weight="bold">
            {t("admin.nodeTable.autoDiscovery.title", "自动发现")}
          </Text>
        </Flex>
        <Text size="2" color="gray">
          {t(
            "admin.nodeTable.autoDiscovery.enabledDescription",
            "在目标服务器上运行下面的命令，Agent 将自动注册并上线，无需手动添加节点。"
          )}
        </Text>
      </Flex>

      <SegmentedControl.Root
        value={selectedPlatform}
        onValueChange={(value) => setSelectedPlatform(value as Platform)}
      >
        <SegmentedControl.Item value="linux">Linux</SegmentedControl.Item>
        <SegmentedControl.Item value="windows">Windows</SegmentedControl.Item>
        <SegmentedControl.Item value="macos">macOS</SegmentedControl.Item>
        <SegmentedControl.Item value="docker">Docker</SegmentedControl.Item>
      </SegmentedControl.Root>

      <Flex gap="2" align="center">
        <Checkbox
          checked={showOptions}
          onCheckedChange={(checked) => setShowOptions(Boolean(checked))}
        />
        <label
          className="text-sm font-bold cursor-pointer"
          onClick={() => setShowOptions((prev) => !prev)}
        >
          {t("admin.nodeTable.installOptions", "安装选项")}
        </label>
      </Flex>

      <OptionField open={showOptions} gap="var(--space-4)">
        <Flex direction="column" gap="2">
          <InstallOptionFields
            state={installState}
            optionLabelClassName="text-sm font-normal cursor-pointer"
          />
        </Flex>
      </OptionField>

      <Flex direction="column" gap="2">
        <label className="text-sm font-bold">
          {t("admin.nodeTable.generatedCommand", "指令")}
        </label>
        <TextArea
          disabled
          className="w-full"
          style={{ minHeight: "80px" }}
          value={generateCommand()}
        />
      </Flex>
      <Button
        style={{ width: "100%" }}
        onClick={() => copyToClipboard(generateCommand())}
      >
        <Copy size={16} />
        {t("common.copy")}
      </Button>
    </Flex>
  );
  }
};

export default AutoDiscoverySection;
