import { useState, useEffect } from "react";
import type { NodeResponse } from "@/types/NodeInfo";

export function useNodeData() {
  const [node, setNode] = useState<NodeResponse | null>(null);

  useEffect(() => {
    fetch("./api/nodes")
      .then((res) => res.json())
      .then((data) => setNode(data))
      .catch((err) => console.error(err));
  }, []);

  return node;
}