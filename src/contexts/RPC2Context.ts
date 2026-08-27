import { createContext, useCallback, useContext } from "react";
import i18n from "../i18n/config";
import type { RPC2Client } from "../lib/rpc2";
import type { RPC2ConnectionStateType } from "../types/rpc2";

export interface RPC2ContextType {
  client: RPC2Client;
  connectionState: RPC2ConnectionStateType;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const RPC2Context = createContext<RPC2ContextType | undefined>(undefined);

export const useRPC2 = (): RPC2ContextType => {
  const context = useContext(RPC2Context);
  if (context === undefined) {
    throw new Error(i18n.t("rpc2.provider_required"));
  }
  return context;
};

export const useRPC2Call = () => {
  const { client, isConnected } = useRPC2();

  const call = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any,
    ): Promise<TResult> => client.call(method, params, options),
    [client],
  );

  const callViaWebSocket = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any,
    ): Promise<TResult> => client.callViaWebSocket(method, params, options),
    [client],
  );

  const callViaHTTP = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any,
    ): Promise<TResult> => client.callViaHTTP(method, params, options),
    [client],
  );

  const batchCall = useCallback(
    (
      requests: Array<{
        method: string;
        params?: any;
        notification?: boolean;
      }>,
    ) => client.batchCall(requests),
    [client],
  );

  return {
    call,
    callViaWebSocket,
    callViaHTTP,
    batchCall,
    isConnected,
  };
};
