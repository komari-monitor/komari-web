import React from "react";
import {
  CommandClipboardContext,
  type CommandClipboard,
} from "./CommandClipboardContext";

export const CommandClipboardProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [commands, setCommands] = React.useState<CommandClipboard[]>([]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/clipboard");
      if (!response.ok) {
        throw new Error("Failed to fetch commands");
      }
      const resp = await response.json();
      setCommands(resp && Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addCommand = React.useCallback(
    async (name: string, text: string, remark: string, weight: number) => {
      try {
        const response = await fetch("/api/admin/clipboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, text, remark, weight }),
        });
        if (!response.ok) throw new Error("Failed to add command");
        await refresh();
      } catch (err) {
        setError(err as Error);
      }
    },
    [refresh],
  );

  const updateCommand = React.useCallback(
    async (
      id: number,
      name: string,
      text: string,
      remark: string,
      weight: number,
    ) => {
      try {
        const response = await fetch(`/api/admin/clipboard/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, text, remark, weight }),
        });
        if (!response.ok) throw new Error("Failed to update command");
        await refresh();
      } catch (err) {
        setError(err as Error);
      }
    },
    [refresh],
  );

  const deleteCommand = React.useCallback(
    async (id: number) => {
      try {
        const response = await fetch(`/api/admin/clipboard/${id}/remove`, {
          method: "POST",
        });
        if (!response.ok) throw new Error("Failed to delete command");
        await refresh();
      } catch (err) {
        setError(err as Error);
      }
    },
    [refresh],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <CommandClipboardContext.Provider
      value={{
        commands,
        loading,
        error,
        refresh,
        addCommand,
        updateCommand,
        deleteCommand,
      }}
    >
      {children}
    </CommandClipboardContext.Provider>
  );
};
