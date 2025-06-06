import * as React from "react";
import { z } from "zod";
import type { schema } from "@/types/node";

import { DataTableRefreshContext } from "@/components/table/DataTableRefreshContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

import { Terminal, Trash2, Copy, Link } from "lucide-react";
import { t } from "i18next";
import type { Row } from "@tanstack/react-table";
import { EditDialog } from "./NodeEditDialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

async function removeClient(uuid: string) {
  await fetch(`/api/admin/client/${uuid}/remove`, {
    method: "POST",
  });
}

type InstallOptions = {
  disableWebSsh: boolean;
  disableAutoUpdate: boolean;
  ignoreUnsafeCert: boolean;
  ghproxy: string;
  dir: string;
  serviceName: string;
};

type Platform = "linux" | "windows";

export function ActionsCell({ row }: { row: Row<z.infer<typeof schema>> }) {
  const refreshTable = React.useContext(DataTableRefreshContext);
  const [removing, setRemoving] = React.useState(false);
  const [selectedPlatform, setSelectedPlatform] =
    React.useState<Platform>("linux");
  const [installOptions, setInstallOptions] = React.useState<InstallOptions>({
    disableWebSsh: false,
    disableAutoUpdate: false,
    ignoreUnsafeCert: false,
    ghproxy: "",
    dir: "",
    serviceName: "",
  });

  const generateCommand = () => {
    const host = window.location.origin;
    const token = row.original.token;

    let baseCommand = "";
    let options = "";

    // 根据安装选项生成参数
    if (installOptions.disableWebSsh) {
      options += " --disable-web-ssh";
    }
    if (installOptions.disableAutoUpdate) {
      options += " --disable-auto-update";
    }
    if (installOptions.ignoreUnsafeCert) {
      options += " --ignore-unsafe-cert";
    }
    if (installOptions.ghproxy) {
      if (!installOptions.ghproxy.startsWith("http")) {
        installOptions.ghproxy = `http://${installOptions.ghproxy}`;
      }
      options += ` --install-ghproxy ${installOptions.ghproxy}`;
    }
    if (installOptions.dir) {
      options += ` --install-dir ${installOptions.dir}`;
    }
    if (installOptions.serviceName) {
      options += ` --install-service-name ${installOptions.serviceName}`;
    }

    switch (selectedPlatform) {
      case "linux":
        baseCommand = `bash <(curl -sL https://raw.githubusercontent.com/komari-monitor/komari-agent/refs/heads/main/install.sh) -e ${host} -t ${token}`;
        break;
      case "windows":
        baseCommand = `powershell -Command "Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/komari-monitor/komari-agent/refs/heads/main/install.ps1' | Invoke-Expression" -Host ${host} -Token ${token}`;
        break;
    }
    return baseCommand + options;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copy_success", "已复制到剪贴板"));
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Link />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.nodeTable.installCommand", "一键部署指令")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <ToggleGroup
              type="single"
              value={selectedPlatform}
              onValueChange={(value: Platform) => {
                if (value) setSelectedPlatform(value);
              }}
              className="w-full grid grid-cols-2"
            >
              <ToggleGroupItem value="linux" className="w-full">
                Linux
              </ToggleGroupItem>
              <ToggleGroupItem value="windows" className="w-full">
                Windows (暂未实现)
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex flex-col gap-3">
              <Label className="text-base font-bold">
                {t("admin.nodeTable.installOptions", "安装选项")}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="disableWebSsh"
                    checked={installOptions.disableWebSsh}
                    onCheckedChange={(checked) =>
                      setInstallOptions((prev) => ({
                        ...prev,
                        disableWebSsh: !!checked,
                      }))
                    }
                  />
                  <Label
                    htmlFor="disableWebSsh"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("admin.nodeTable.disableWebSsh", "禁用 WebSSH")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="disableAutoUpdate"
                    checked={installOptions.disableAutoUpdate}
                    onCheckedChange={(checked) =>
                      setInstallOptions((prev) => ({
                        ...prev,
                        disableAutoUpdate: !!checked,
                      }))
                    }
                  />
                  <Label
                    htmlFor="disableAutoUpdate"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("admin.nodeTable.disableAutoUpdate", "禁用自动更新")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ignoreUnsafeCert"
                    checked={installOptions.ignoreUnsafeCert}
                    onCheckedChange={(checked) =>
                      setInstallOptions((prev) => ({
                        ...prev,
                        ignoreUnsafeCert: !!checked,
                      }))
                    }
                  />
                  <Label
                    htmlFor="ignoreUnsafeCert"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("admin.nodeTable.ignoreUnsafeCert", "忽略不安全证书")}
                  </Label>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label className="text-sm font-bold">
                  {t("admin.nodeTable.ghproxy", "GitHub 代理")}
                </Label>
                <Input
                  placeholder={t(
                    "admin.nodeTable.ghproxy_placeholder",
                    "GitHub 代理，为空则不适用代理"
                  )}
                  onChange={(e) =>
                    setInstallOptions((prev) => ({
                      ...prev,
                      ghproxy: e.target.value,
                    }))
                  }
                />
                <Label className="text-sm font-bold">
                  {t("admin.nodeTable.install_dir", "安装目录")}
                </Label>
                <Input
                  placeholder={t(
                    "admin.nodeTable.install_dir_placeholder",
                    "安装目录，为空则使用默认目录(/opt/komari-agent)"
                  )}
                  onChange={(e) =>
                    setInstallOptions((prev) => ({
                      ...prev,
                      dir: e.target.value,
                    }))
                  }
                />
                <Label className="text-sm font-bold">
                  {t("admin.nodeTable.serviceName", "服务名称")}
                </Label>
                <Input
                  placeholder={t(
                    "admin.nodeTable.serviceName_placeholder",
                    "服务名称，为空则使用默认名称(komari-agent)"
                  )}
                  onChange={(e) =>
                    setInstallOptions((prev) => ({
                      ...prev,
                      serviceName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-base font-bold">
                {t("admin.nodeTable.generatedCommand", "生成的指令")}
              </Label>
              <div className="relative">
                <Textarea
                  disabled
                  className="w-full min-h-[80px]"
                  value={generateCommand()}
                />
              </div>
            </div>
            <div className="flex justify-center">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => copyToClipboard(generateCommand())}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("copy")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          window.open(`/terminal?uuid=${row.original.uuid}`, "_blank")
        }
      >
        <Terminal />
      </Button>
      <EditDialog item={row.original} />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-destructive">
            <Trash2 />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.nodeTable.confirmDelete")}</DialogTitle>
            <DialogDescription>
              {t("admin.nodeTable.cannotUndo")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" asChild>
              <DialogTrigger>{t("admin.nodeTable.cancel")}</DialogTrigger>
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                await removeClient(row.original.uuid);
                setRemoving(false);
                if (refreshTable) refreshTable();
              }}
              asChild
            >
              <DialogTrigger>
                {removing
                  ? t("admin.nodeTable.deleting")
                  : t("admin.nodeTable.confirm")}
              </DialogTrigger>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}