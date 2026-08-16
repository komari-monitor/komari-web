import React from "react";
import {
  NodeDetailsContext,
  type NodeDetail,
} from "./NodeDetailsContext";

export const NodeDetailsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [nodeDetail, setNodeDetail] = React.useState<NodeDetail[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    fetch("/api/admin/client/list")
      .then((response) => response.json())
      .then((data: NodeDetail[]) => {
        setNodeDetail(data);
        setError(null);
      })
      .catch((error) => {
        setError(error.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    refresh();
  }, [refresh]);

  return (
    <NodeDetailsContext.Provider value={{ nodeDetail, isLoading, error, refresh }}>
      {children}
    </NodeDetailsContext.Provider>
  );
};
