import React from "react";

export type CommandClipboard = {
  id: number;
  text: string;
  name: string;
  remark: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
};

export interface CommandClipboardContextType {
  commands: CommandClipboard[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addCommand: (
    name: string,
    text: string,
    remark: string,
    weight: number,
  ) => Promise<void>;
  updateCommand: (
    id: number,
    name: string,
    text: string,
    remark: string,
    weight: number,
  ) => Promise<void>;
  deleteCommand: (id: number) => Promise<void>;
}

export const CommandClipboardContext = React.createContext<
  CommandClipboardContextType | undefined
>(undefined);

export const useCommandClipboard = (): CommandClipboardContextType => {
  const context = React.useContext(CommandClipboardContext);
  if (!context) {
    throw new Error(
      "useCommandClipboard must be used within a CommandClipboardProvider",
    );
  }
  return context;
};
