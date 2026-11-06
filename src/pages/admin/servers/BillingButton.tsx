import React, { useState } from "react";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { Flex, TextField, Button, Dialog, IconButton } from "@radix-ui/themes";
import { CircleDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Tips from "@/components/ui/tips";
import { SettingCardSwitch } from "@/components/admin/SettingCard";
import { SelectOrInput } from "@/components/ui/select-or-input";
import { saveClientBilling } from "./api";

export default function BillingButton({ node }: { node: NodeDetail }) {
  const { t } = useTranslation();
  const { refresh } = useNodeDetails();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billingCycle, setBillingCycle] = React.useState<string>(
    node.billing_cycle.toString()
  );
  const [autoRenewal, setAutoRenewal] = React.useState<boolean>(
    node.auto_renewal || false
  );
  const [currency, setCurrency] = React.useState<string>(node.currency || "$");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const formData = new FormData(e.target as HTMLFormElement);
      const priceValue = (formData.get("price") as string) || "0";

      const price = parseFloat(priceValue);

      if (isNaN(price) || (price < 0 && price !== -1)) {
        toast.error(t("admin.nodeTable.invalidPrice"));
        return;
      }
      const billingCycleValue = parseInt(
        (formData.get("billingCycle") as string) || "30"
      );
      const expiredAtValue = (formData.get("expiredAt") as string) || "";
      const expiredAt = expiredAtValue
        ? new Date(`${expiredAtValue}T00:00:00Z`).toISOString()
        : null;
      const currencyValue = (formData.get("currency") as string) || "$";

      await saveClientBilling(node.uuid, {
        price,
        billing_cycle: billingCycleValue,
        expired_at: expiredAt,
        currency: currencyValue,
        auto_renewal: autoRenewal,
      });
      refresh();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save billing information:" + error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton
          variant="ghost"
          title={t("admin.nodeTable.billing", "账单")}
        >
          <CircleDollarSign size="18" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("admin.nodeTable.billing", "账单")}</Dialog.Title>
        <form onSubmit={handleSave}>
          <Flex direction="column" gap="4">
            <Flex direction="column" gap="2">
              <label className="font-bold">
                <label>{t("admin.nodeTable.price")}</label>
                <label className="text-muted-foreground text-sm ml-1 font-medium">
                  {t("admin.nodeTable.priceTips")}
                </label>
              </label>
              <TextField.Root name="price" defaultValue={node.price} />
            </Flex>

            <Flex direction="column" gap="2">
              <label className="font-bold">
                <label>{t("admin.nodeTable.currency", "货币")}</label>
                <label className="text-muted-foreground text-sm ml-1 font-medium">
                  {t("admin.nodeTable.currencyTips")}
                </label>
              </label>
              <TextField.Root
                name="currency"
                defaultValue={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </Flex>

            <Flex direction="column" gap="2">
              <label className="font-bold flex items-center gap-1">
                {t("admin.nodeTable.billingCycle")} <Tips><span dangerouslySetInnerHTML={{ __html: t("admin.nodeTable.billingCycleTips") }}></span></Tips>
              </label>
              <SelectOrInput
                options={[
                  { label: t("common.monthly"), value: "30" },
                  { label: t("common.quarterly"), value: "92" },
                  { label: t("common.semi_annual"), value: "184" },
                  { label: t("common.annual"), value: "365" },
                  { label: t("common.biennial"), value: "730" },
                  { label: t("common.triennial"), value: "1095" },
                  { label: t("common.quinquennial"), value: "1825" },
                  { label: t("common.once"), value: "-1" },
                ]}
                type="number"
                name="billingCycle"
                value={billingCycle === "0" ? "" : billingCycle}
                onChange={setBillingCycle}
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Flex gap="2" align="center">
                <label className="font-bold">
                  {t("admin.nodeTable.expiredAt")}
                </label>
              </Flex>
              <TextField.Root
                name="expiredAt"
                defaultValue={
                  node.expired_at
                    ? new Date(node.expired_at).toISOString().slice(0, 10)
                    : "0001-01-01"
                }
                type="date"
              >
                <TextField.Slot side="right">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const dateInput = document.querySelector(
                        'input[name="expiredAt"]'
                      ) as HTMLInputElement;
                      if (dateInput) {
                        const futureDate = new Date();
                        futureDate.setFullYear(futureDate.getFullYear() + 200);
                        dateInput.value = futureDate.toISOString().slice(0, 10);
                      }
                    }}
                  >
                    {t("admin.nodeTable.setToLongTerm", "设置为长期")}
                  </Button>
                </TextField.Slot>
              </TextField.Root>
            </Flex>
            <SettingCardSwitch
              title={t("admin.nodeTable.autoRenewal")}
              description={t("admin.nodeTable.autoRenewalDescription")}
              defaultChecked={node.auto_renewal || false}
              onChange={setAutoRenewal}
            />
          </Flex>
          <Flex direction="column" mt="5">
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
