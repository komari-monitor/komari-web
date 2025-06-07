import * as React from "react";
import { z } from "zod";
import { toast } from "sonner";
import { t } from "i18next";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import type { schema } from "@/types/node";

type DataTableState = {
  data: z.infer<typeof schema>[];
  isLoading: boolean;
  error: string | null;
  newNodeName: string;
  isAddingNode: boolean;
};

type DataTableActions = {
  setData: React.Dispatch<React.SetStateAction<z.infer<typeof schema>[]>>;
  setNewNodeName: React.Dispatch<React.SetStateAction<string>>;
  refreshTable: () => void;
  handleAddNode: () => Promise<void>;
  handleDragEnd: (event: DragEndEvent) => void;
};

const DataTableContext = React.createContext<
  | {
      state: DataTableState;
      actions: DataTableActions;
    }
  | undefined
>(undefined);

export function DataTableProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<z.infer<typeof schema>[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [newNodeName, setNewNodeName] = React.useState("");
  const [isAddingNode, setIsAddingNode] = React.useState(false);

  const refreshTable = React.useCallback(() => {
    setError(null);
    fetch("/api/admin/client/list")
      .then((res) => {
        if (!res.ok) {
          toast.error(t("admin.nodeTable.errorLoadNodeList"));
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((list: z.infer<typeof schema>[]) => {
        setData([...list].sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0)));
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("Failed to refresh node list:", e);
        setError(t("admin.nodeTable.errorRefreshNodeList"));
        setIsLoading(false);
      });
  }, []);
  React.useEffect(() => {
    refreshTable();
  }, [refreshTable]);

  const handleAddNode = React.useCallback(async () => {
    setIsAddingNode(true);
    try {
      const response = await fetch("/api/admin/client/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNodeName }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setNewNodeName("");
      refreshTable();
    } catch (error) {
      console.error("Failed to add node:", error);
      toast.error(t("admin.nodeTable.errorAddNode"));
    } finally {
      setIsAddingNode(false);
    }
  }, [newNodeName, refreshTable, t]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setData((currentData) => {
          const oldIndex = currentData.findIndex(
            (item) => item.uuid === active.id
          );
          const newIndex = currentData.findIndex(
            (item) => item.uuid === over.id
          );
          if (oldIndex === -1 || newIndex === -1) return currentData;
          const newData = arrayMove(currentData, oldIndex, newIndex);
          const updatedData = newData.map((item, index) => ({
            ...item,
            weight: index,
          }));

          const orderPayload = updatedData.reduce((acc, cur) => {
            acc[cur.uuid] = cur.weight!;
            return acc;
          }, {} as Record<string, number>);
          fetch("/api/admin/client/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderPayload),
          }).catch((e) => {
            console.error("Failed to reorder nodes:", e);
            toast.error(t("admin.nodeTable.errorReorderNodes"));
            refreshTable();
          });

          return updatedData;
        });
      }
    },
    [setData, refreshTable]
  );

  const value = React.useMemo(
    () => ({
      state: { data, isLoading, error, newNodeName, isAddingNode },
      actions: {
        setData,
        setNewNodeName,
        refreshTable,
        handleAddNode,
        handleDragEnd,
      },
    }),
    [
      data,
      isLoading,
      error,
      newNodeName,
      isAddingNode,
      refreshTable,
      handleAddNode,
      handleDragEnd,
    ]
  );

  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}

export function useDataTable() {
  const context = React.useContext(DataTableContext);
  if (context === undefined) {
    throw new Error("useDataTable must be used within a DataTableProvider");
  }
  return context;
}
