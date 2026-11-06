import React from "react";
import Selector, { type SelectorProps } from "./Selector";
import SelectorDialogShell from "./SelectorDialogShell";

export interface SelectorDialogProps<T>
  extends Pick<
    SelectorProps<T>,
    | "items"
    | "getId"
    | "getLabel"
    | "sortItems"
    | "filterItem"
    | "searchPlaceholder"
    | "headerLabel"
  > {
  value: string[];
  onChange: (ids: string[]) => void;
  title: React.ReactNode;
  trigger: React.ReactNode;
  className?: string;
}

export default function SelectorDialog<T>({
  value,
  onChange,
  title,
  trigger,
  className,
  ...selectorProps
}: SelectorDialogProps<T>) {
  return (
    <SelectorDialogShell
      value={value}
      onChange={onChange}
      title={title}
      trigger={trigger}
      className={className}
    >
      {(temporaryValue, setTemporaryValue) => (
        <Selector
          {...selectorProps}
          value={temporaryValue}
          onChange={setTemporaryValue}
          hiddenDescription
        />
      )}
    </SelectorDialogShell>
  );
}
