import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import { Flex, Button, Dialog, IconButton, TextArea, SegmentedControl } from "@radix-ui/themes";
import { Copy, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Platform } from "./types";
import { buildInstallCommand, copyText } from "./installCommand";
import useInstallOptions from "./useInstallOptions";
import InstallOptionFields from "./InstallOptionFields";

export default function GenerateCommandButton({
  node,
  settings,
  isSnapshotBackend,
}: {
  node: NodeDetail;
  settings: any;
  isSnapshotBackend: boolean;
}) {
  const installState = useInstallOptions(isSnapshotBackend);
  const { selectedPlatform, setSelectedPlatform } = installState;

  const generateCommand = () =>
    buildInstallCommand(installState, {
      scriptDomain: settings.script_domain,
      identityArgs: ["-t", node.token || ""],
    });

  const copyToClipboard = (text: string) =>
    copyText(text, t("copy_success", "已复制到剪贴板"));
  const { t } = useTranslation();
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <IconButton variant="ghost" title={t("admin.nodeTable.installCommand")}>
          <Download size="18" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>
          {t("admin.nodeTable.installCommand", "一键部署指令")}
        </Dialog.Title>
        <div className="flex flex-col gap-km-block">
          <SegmentedControl.Root
            value={selectedPlatform}
            onValueChange={(value) => setSelectedPlatform(value as Platform)}
          >
            <SegmentedControl.Item value="linux">Linux</SegmentedControl.Item>
            <SegmentedControl.Item value="windows">
              Windows
            </SegmentedControl.Item>
            <SegmentedControl.Item value="macos">macOS</SegmentedControl.Item>
            <SegmentedControl.Item value="docker">Docker</SegmentedControl.Item>
          </SegmentedControl.Root>

          <Flex direction="column" gap="2">
            <label className="text-base font-bold">
              {t("admin.nodeTable.installOptions", "安装选项")}
            </label>
            <InstallOptionFields
              state={installState}
              optionLabelClassName="text-sm font-normal"
            />
          </Flex>
          <Flex direction="column" gap="2">
            <label className="text-base font-bold">
              {t("admin.nodeTable.generatedCommand", "生成的指令")}
            </label>
            <div className="relative">
              <TextArea
                disabled
                className="w-full"
                style={{ minHeight: "80px" }}
                value={generateCommand()}
              />
            </div>
          </Flex>
        </div>
        <Flex justify="center" mt="5">
          <Button
            style={{ width: "100%" }}
            onClick={() => copyToClipboard(generateCommand())}
          >
            <Copy size={16} />
            {t("common.copy")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
