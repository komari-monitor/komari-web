import TerminalDialog, { type TerminalDialogProps } from "./TerminalDialog";

export function ConfirmDialog({ onConfirm, ...props }: Omit<TerminalDialogProps, "fields" | "onSubmit"> & {
  onConfirm: TerminalDialogProps["onSubmit"];
}) {
  return <TerminalDialog {...props} onSubmit={onConfirm} />;
}

export default ConfirmDialog;
