import LanguageSwitch from "@/components/Language";
import Loading from "@/components/loading";
import {
  CommandClipboardProvider,
  useCommandClipboard,
  type CommandClipboard,
} from "@/contexts/CommandClipboardContext";
import { useTerminal } from "@/contexts/TerminalContext";
import {
  Button,
  Card,
  Code,
  Dialog,
  Flex,
  IconButton,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { PlusIcon, Trash2Icon, Edit2Icon } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const CommandClipboardPanel = ({ ...props }: { [key: string]: any }) => {
  const InnerLayout = () => {
    const { t } = useTranslation();
    const { commands, loading, error } = useCommandClipboard();
    if (loading) {
      return <Loading />;
    }
    if (error) {
      return <div>Error loading commands: {error.message}</div>;
    }
    return (
      <Flex
        {...props}
        direction="column"
        gap="2"
        overflowX={"clip"}
        overflowY={"scroll"}
        style={{ height: "100%" }}
        className="km-command-clipboard km-command-clipboard-list command-clipboard-container"
      >
        <Flex>
          <label className="text-lg font-semibold">
            {t("command_clipboard.title")}
          </label>
        </Flex>
        <Flex justify="between" align="center" className="mr-2">
          <AddButton />
          <LanguageSwitch />
        </Flex>

        {commands
          .sort((a, b) => b.weight - a.weight)
          .map((item) => (
            <CommandCard key={item.id} {...item} />
          ))}
      </Flex>
    );
  };
  return (
    <CommandClipboardProvider>
      <InnerLayout />
    </CommandClipboardProvider>
  );
};

const AddButton = () => {
  const { t } = useTranslation();
  const [isOpen, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const { addCommand } = useCommandClipboard();
  const handleAddCommand = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const text = formData.get("text") as string;
    const remark = formData.get("remark") as string;
    const weight = formData.get("weight") as string;

    try {
      setAdding(true);
      await addCommand(name, text, remark, weight ? parseInt(weight) : 0);
      setOpen(false);
      toast.success(t("common.added_successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setAdding(false);
    }
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton aria-label="Add Command">
          <PlusIcon size="16" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content className="km-command-clipboard-input">
        <Dialog.Title>{t("common.add")}</Dialog.Title>
        <form onSubmit={handleAddCommand}>
          <Flex direction="column" gap="2">
            <label htmlFor="name">{t("common.name")}</label>
            <TextField.Root
              id="name"
              name="name"
              defaultValue={Math.random().toString(36).substring(7)}
            />
            <label htmlFor="text">{t("common.content")}</label>
            <TextArea id="text" name="text" />
            <label htmlFor="remark">{t("common.remark")}</label>
            <TextField.Root id="remark" name="remark" />
            <label htmlFor="weight">{t("common.weight")}</label>
            <TextField.Root
              defaultValue={0}
              type="number"
              id="weight"
              name="weight"
            />
            <Button type="submit" variant="solid" disabled={adding}>
              {t("common.add")}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

// DeleteButton: 删除命令
const DeleteButton = ({ id }: { id: number }) => {
  const { t } = useTranslation();
  const { deleteCommand } = useCommandClipboard();
  const [isOpen, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteCommand(id);
      toast.success(t("common.deleted_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton aria-label="Delete Command" color="red">
          <Trash2Icon size="16" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("common.delete")}</Dialog.Title>
        <Dialog.Description>{t("common.confirm_delete")}</Dialog.Description>
        <Flex justify="end" gap="2" className="mt-4">
          <Dialog.Close>
            <Button variant="soft">{t("common.cancel")}</Button>
          </Dialog.Close>
          <Button onClick={handleDelete} disabled={deleting} color="red">
            {t("common.delete")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

// EditButton: 编辑命令
const EditButton = ({ id, name, text, remark, weight }: CommandClipboard) => {
  const { t } = useTranslation();
  const { updateCommand } = useCommandClipboard();
  const [isOpen, setOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const newName = formData.get("name") as string;
    const newText = formData.get("text") as string;
    const newRemark = formData.get("remark") as string;
    const weight = formData.get("weight") as string;
    try {
      setUpdating(true);
      await updateCommand(
        id,
        newName,
        newText,
        newRemark,
        weight ? parseInt(weight) : 0
      );
      setOpen(false);
      toast.success(t("common.updated_successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setUpdating(false);
    }
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton aria-label="Edit Command">
          <Edit2Icon size="16" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("common.edit")}</Dialog.Title>
        <form onSubmit={handleUpdate}>
          <Flex direction="column" gap="2">
            <label htmlFor={`name`}>{t("common.name")}</label>
            <TextField.Root id={`name`} name="name" defaultValue={name} />
            <label htmlFor={`text`}>{t("common.content")}</label>
            <TextArea id={`text`} name="text" defaultValue={text} />
            <label htmlFor={`remark`}>{t("common.remark")}</label>
            <TextField.Root id={`remark`} name="remark" defaultValue={remark} />
            <label htmlFor={`weight`}>{t("common.weight")}</label>
            <TextField.Root
              type="number"
              id={`weight`}
              name="weight"
              defaultValue={weight}
            />
            <Flex justify="end" gap="2" className="mt-4">
              <Dialog.Close>
                <Button variant="soft">{t("common.cancel")}</Button>
              </Dialog.Close>
              <Button type="submit" disabled={updating}>
                {t("common.update")}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

const CommandCard = (item: CommandClipboard) => {
  const { t } = useTranslation();
  const { sendCommand } = useTerminal();
  return (
    <Flex key={item.id} direction="column" className="km-command-clipboard-item">
      <Card>
        <Flex direction="column" gap="2">
          <Flex justify="between" align="center">
            <label className="text-lg font-semibold">{item.name}</label>
            <Button onClick={() => sendCommand(item.text)}>
              {t("common.execute")}
            </Button>
          </Flex>
          <Code className="command-text" style={{ whiteSpace: "pre-wrap" }}>
            {item.text.length > 300
              ? item.text.substring(0, 300) +
                `\n...(${t("common.have_been_omitted", {
                  count: item.text.length - 300,
                })})`
              : item.text}
          </Code>
          <label className="text-sm text-gray-500">{item.remark}</label>
          <Flex justify="end" gap="2">
            <EditButton {...item} />
            <DeleteButton id={item.id} />
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};

export default CommandClipboardPanel;
