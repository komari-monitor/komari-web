import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  type ReactNode,
} from "react";

interface Client {
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
  billing_cycle: number;
  expired_at: string;
  created_at: string;
  updated_at: string;
}
interface ManageProviderProps {
  children: ReactNode;
}
interface ManageContextState {
  clients: Client[];
  loading: boolean;
  error: Error | null;
}

const ManageContext = createContext<ManageContextState | undefined>(undefined);

export const ManageProvider: React.FC<ManageProviderProps> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/client/list");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data: Client[] = await response.json();
        setClients(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const value = { clients, loading, error};

  return (
    <ManageContext.Provider value={value}>{children}</ManageContext.Provider>
  );
};

export const useManage = (): ManageContextState => {
  const context = useContext(ManageContext);
  if (context === undefined) {
    throw new Error("useManage must be used within a ManageProvider");
  }
  return context;
};
