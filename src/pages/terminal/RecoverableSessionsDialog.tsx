import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

export interface RecoverableSessionGroup {
  uuid: string;
  name: string;
  count: number;
}

interface RecoverableSessionsDialogProps {
  open: boolean;
  totalCount: number;
  groups: RecoverableSessionGroup[];
  submitting: boolean;
  onTerminate: () => void;
  onRecover: () => void;
}

const RecoverableSessionsDialog = ({
  open,
  totalCount,
  groups,
  submitting,
  onTerminate,
  onRecover,
}: RecoverableSessionsDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open}>
      <Dialog.Content
        className="km-recoverable-sessions-dialog"
        maxWidth="440px"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <Dialog.Title>
          {t("terminal.recoverable.title", "可恢复的会话")}
        </Dialog.Title>
        <Dialog.Description size="2">
          {t(
            "terminal.recoverable.description",
            "自上次离开之后，还有 {{count}} 个终端会话在继续运行：",
            { count: totalCount },
          )}
        </Dialog.Description>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--gray-12)]">
          {groups.map((group) => (
            <li key={group.uuid}>
              {t(
                "terminal.recoverable.server_item",
                "{{name}} 共 {{count}} 个会话",
                {
                  name: group.name,
                  count: group.count,
                },
              )}
            </li>
          ))}
        </ul>
        <Flex gap="2" justify="end" wrap="wrap" mt="5">
          <Button
            variant="soft"
            color="red"
            disabled={submitting}
            onClick={onTerminate}
          >
            {t("terminal.recoverable.terminate", "结束会话")}
          </Button>
          <Button disabled={submitting} onClick={onRecover}>
            {t("terminal.recoverable.continue", "在新标签页中继续")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default RecoverableSessionsDialog;
