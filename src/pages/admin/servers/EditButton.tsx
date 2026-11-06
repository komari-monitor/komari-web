import React, { useState } from "react";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { Flex, TextField, Button, Dialog, IconButton, TextArea } from "@radix-ui/themes";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatBytes, stringToBytes } from "@/utils/unitHelper";
import Tips from "@/components/ui/tips";
import { SettingCardCollapse, SettingCardSelect, SettingCardShortTextInput, SettingCardSwitch } from "@/components/admin/SettingCard";
import { Collapse } from "@/components/motion";
import { editClient } from "./api";

export default function EditButton({ node }: { node: NodeDetail }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { refresh } = useNodeDetails();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const groupRef = React.useRef<HTMLInputElement>(null);
  const tagsRef = React.useRef<HTMLInputElement>(null);
  const publicRemarkRef = React.useRef<HTMLTextAreaElement>(null);
  const privateRemarkRef = React.useRef<HTMLTextAreaElement>(null);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [traffic_limit, setTrafficLimit] = useState(0);
  const [traffic_limit_type, setTrafficLimitType] = useState("sum");
  const [trafficLimitInput, setTrafficLimitInput] = useState("0 B");
  const [trafficLimitInvalid, setTrafficLimitInvalid] = useState(false);

  React.useEffect(() => {
    setHidden(node.hidden);
    setTrafficLimit(node.traffic_limit || 0);
    setTrafficLimitType(node.traffic_limit_type || "sum");
    setTrafficLimitInput(formatBytes(node.traffic_limit || 0));
    setTrafficLimitInvalid(false);
  }, [node.hidden, node.traffic_limit, node.traffic_limit_type]);

  const save = async () => {
    if (trafficLimitInvalid) {
      toast.error(
        t(
          "admin.nodeEdit.trafficLimitInvalidSave",
          "流量阈值格式无法解析，请先修正"
        )
      );
      return;
    }
    try {
      setSaving(true);
      await editClient(node.uuid, {
        name: nameRef.current?.value,
        remark: privateRemarkRef.current?.value,
        public_remark: publicRemarkRef.current?.value,
        group: groupRef.current?.value,
        tags: tagsRef.current?.value,
        hidden,
        traffic_limit,
        traffic_limit_type,
      });
      refresh();
      setOpen(false);
      toast.success(t("admin.nodeEdit.saveSuccess", "保存成功"));
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error(t("admin.nodeEdit.saveError", "保存失败"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton
          variant="ghost"
          title={t("admin.nodeEdit.editInfo", "编辑信息")}
        >
          <Pencil size="18" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("admin.nodeEdit.editInfo", "编辑信息")}</Dialog.Title>
        <div className="flex flex-col gap-km-block">
          <div>
            <label className="block mb-km-group text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.name", "名称")}
            </label>
            <TextField.Root
              defaultValue={node.name}
              placeholder={t("admin.nodeEdit.namePlaceholder", "请输入名称")}
              ref={nameRef}
            />
          </div>
          <div>
            <label className="block mb-km-group text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.token", "Token 令牌")}
            </label>
            <TextField.Root
              value={node.token}
              placeholder={t("admin.nodeEdit.tokenPlaceholder", "请输入 Token")}
              readOnly
            />
          </div>
          <div>
            <label className="mb-km-group text-sm font-medium text-muted-foreground flex items-center">
              {t("common.tags")}
              <label className="text-muted-foreground ml-1 text-xs self-end">
                {t("common.tagsDescription")}
              </label>
              <Tips>
                <span
                  dangerouslySetInnerHTML={{ __html: t("common.tagsTips") }}
                />
              </Tips>
            </label>
            <TextField.Root defaultValue={node.tags} ref={tagsRef} />
          </div>
          <div>
            <label className="block mb-km-group text-sm font-medium text-muted-foreground">
              {t("common.group")}
            </label>
            <TextField.Root defaultValue={node.group} ref={groupRef} />
          </div>
          <div>
            <label className="block mb-km-group text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.remark", "私有备注")}
            </label>
            <TextArea
              defaultValue={node.remark}
              ref={privateRemarkRef}
              resize={"vertical"}
              placeholder={t(
                "admin.nodeEdit.remarkPlaceholder",
                "请输入私有备注"
              )}
            />
          </div>
          <div>
            <label className="block mb-km-group text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.publicRemark", "公开备注")}
            </label>
            <TextArea
              defaultValue={node.public_remark}
              resize={"vertical"}
              placeholder={t(
                "admin.nodeEdit.publicRemarkPlaceholder",
                "请输入公开备注"
              )}
              ref={publicRemarkRef}
            />
          </div>
          <div>
            <SettingCardSwitch
              title={t("admin.nodeEdit.hidden")}
              description={t("admin.nodeEdit.hidden_description")}
              defaultChecked={hidden}
              onChange={setHidden}
            />
          </div>
          <SettingCardCollapse title={t("admin.nodeEdit.trafficLimit")}>
            <SettingCardSelect
              bordless
              title={t("admin.nodeEdit.trafficLimitType")}
              defaultValue={node.traffic_limit_type || "max"}
              options={[
                {
                  label: t("admin.nodeEdit.trafficLimitType_sum"),
                  value: "sum",
                },
                {
                  label: t("admin.nodeEdit.trafficLimitType_max"),
                  value: "max",
                },
                {
                  label: t("admin.nodeEdit.trafficLimitType_min"),
                  value: "min",
                },
                {
                  label: t("admin.nodeEdit.trafficLimitType_up"),
                  value: "up",
                },
                {
                  label: t("admin.nodeEdit.trafficLimitType_down"),
                  value: "down",
                },
              ]}
              OnSave={(value) => {
                setTrafficLimitType(value);
              }}
            />
            <SettingCardShortTextInput
              bordless
              title={t("admin.nodeEdit.trafficLimit")}
              description={t("admin.nodeEdit.trafficLimit_description")}
              value={trafficLimitInput}
              showSaveButton={false}
              onChange={(e) => {
                const raw = e.currentTarget.value;
                setTrafficLimitInput(raw);
                const bytes = stringToBytes(raw);
                if (bytes === null) {
                  // 解析失败：标记错误，保留原值与用户输入，不静默置 0
                  setTrafficLimitInvalid(true);
                } else {
                  setTrafficLimitInvalid(false);
                  setTrafficLimit(bytes);
                }
              }}
              onBlur={() => {
                // 仅在解析成功时规范显示；解析失败时保留原始输入供用户修正
                if (!trafficLimitInvalid) {
                  setTrafficLimitInput(formatBytes(traffic_limit));
                }
              }}
            >
              {/* feedback 层：格式错误提示展开/收起用高度弹簧，不把下方内容顶跳 */}
              <Collapse open={trafficLimitInvalid} aria-hidden={!trafficLimitInvalid || undefined}>
                <span className="mt-1 block text-sm text-red-500">
                  {t(
                    "admin.nodeEdit.trafficLimitInvalid",
                    "无法解析该数值，支持如 100 GB / 512 MiB / 2T（最大 PB）"
                  )}
                </span>
              </Collapse>
            </SettingCardShortTextInput>
          </SettingCardCollapse>
        </div>
        <Flex gap="2" justify="end" mt="5">
          <Button
            type="submit"
            className="w-full"
            disabled={saving}
            onClick={save}
          >
            {saving
              ? t("admin.nodeEdit.waiting", "等待...")
              : t("common.save", "保存")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
