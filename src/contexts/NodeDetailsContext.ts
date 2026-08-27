import React from "react";

export type NodeDetail = {
  uuid: string;
  token: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  gpu_name: string;
  ipv4: string;
  ipv6: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version: string;
  weight: number;
  price: number;
  remark: string | undefined;
  public_remark: string;
  group: string | undefined;
  billing_cycle: number;
  expired_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
};

export interface NodeDetailsContextType {
  nodeDetail: NodeDetail[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export const NodeDetailsContext = React.createContext<
  NodeDetailsContextType | undefined
>(undefined);

export const useNodeDetails = () => {
  const context = React.useContext(NodeDetailsContext);
  if (context === undefined) {
    throw new Error(
      "useNodeDetails must be used within a NodeDetailsProvider",
    );
  }
  return context;
};
