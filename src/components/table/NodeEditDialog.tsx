import * as React from "react";
import { z } from "zod";
import {
  schema,
  type ClientFormData,
} from "@/types/node";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { t } from "i18next";
import { toast } from "sonner";
import { DataTableRefreshContext } from "./DataTableRefreshContext";

export function EditDialog({ item }: { item: z.infer<typeof schema> }) {
  const [form, setForm] = React.useState<ClientFormData & { weight: number }>({
    name: item.name || "",
    token: item.token || "", // 从 item 初始化 token
    remark: item.remark || "", // 从 item 初始化 remark
    public_remark: item.public_remark || "", // 从 item 初始化 public_remark
    weight: item.weight || 0,
  });
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const refreshTable = React.useContext(DataTableRefreshContext);

  function saveClientData(
    uuid: string,
    formData: ClientFormData,
    setLoadingCallback: (b: boolean) => void,
    onSuccess?: () => void
  ) {
    setLoadingCallback(true);
    fetch(`/api/admin/client/${uuid}/edit`, {
      method: "POST",
      body: JSON.stringify(formData),
    })
      .then(async (res) => {
        if (onSuccess) onSuccess();
        if (res.status === 200) {
          if (refreshTable) refreshTable();
          toast.success(t("admin.nodeEdit.saveSuccess", "保存成功"));
        } else {
          toast.error(t("admin.nodeEdit.saveError", "保存失败"));
        }
      })
      .catch(() => {
        toast.error(t("admin.nodeEdit.saveError", "保存失败"));
      })
      .finally(() => setLoadingCallback(false));
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.nodeEdit.editInfo", "编辑信息")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.name", "名称")}
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("admin.nodeEdit.namePlaceholder", "请输入名称")}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.token", "Token 令牌")}
            </label>
            <Input
              value={form.token}
              onChange={(e) =>
                setForm((f) => ({ ...f, token: e.target.value }))
              }
              placeholder={t("admin.nodeEdit.tokenPlaceholder", "请输入 Token")}
              disabled={loading}
              readOnly
              className="bg-gray-200"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.remark", "私有备注")}
            </label>
            <Textarea
              value={form.remark}
              onChange={(e) =>
                setForm((f) => ({ ...f, remark: e.target.value }))
              }
              placeholder={t(
                "admin.nodeEdit.remarkPlaceholder",
                "请输入私有备注"
              )}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-muted-foreground">
              {t("admin.nodeEdit.publicRemark", "公开备注")}
            </label>
            <Textarea
              value={form.public_remark}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_remark: e.target.value }))
              }
              placeholder={t(
                "admin.nodeEdit.publicRemarkPlaceholder",
                "请输入公开备注"
              )}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            className="w-full"
            onClick={() => {
              const payload: ClientFormData = {
                name: form.name,
                token: form.token,
                remark: form.remark,
                public_remark: form.public_remark,
              };
              saveClientData(item.uuid, payload, setLoading, () =>
                setOpen(false)
              );
            }}
            disabled={loading}
          >
            {loading
              ? t("admin.nodeEdit.waiting", "等待...")
              : t("admin.nodeEdit.save", "保存")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
