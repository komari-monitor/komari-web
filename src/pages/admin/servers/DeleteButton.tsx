import React from "react";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { Flex, Button, Dialog, IconButton } from "@radix-ui/themes";
import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { removeClient } from "./api";

export default function DeleteButton({ node }: { node: NodeDetail }) {
  const { t } = useTranslation();
  const { refresh } = useNodeDetails();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await removeClient(node.uuid);
      toast.success(`Delete ${node.name}`);
      setOpen(false);
      refresh();
    } catch (error) {
      toast.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton variant="ghost" color="red" title={t("common.delete")}>
          <Trash2Icon size="18" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("common.delete")}</Dialog.Title>
        <Dialog.Description>
          {t("common.confirm_delete")}
        </Dialog.Description>
        <Flex justify="end" gap="2" mt="5">
          <Dialog.Trigger>
            <Button variant="soft">{t("common.cancel")}</Button>
          </Dialog.Trigger>
          <Button disabled={deleting} color="red" onClick={handleDelete}>
            {t("common.confirm_delete")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
