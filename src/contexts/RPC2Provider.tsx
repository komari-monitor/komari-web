import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import i18n from "../i18n/config";
import { RPC2Client } from "../lib/rpc2";
import { RPC2Context } from "./RPC2Context";

// 模块级单例，避免在开发环境 StrictMode 或路由切换时产生多个连接
let __rpc2_singleton__: RPC2Client | null = null;
let __rpc2_refcount = 0;

export const RPC2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 创建/复用客户端实例，默认启用自动连接
  const [client] = useState(() => {
    if (!__rpc2_singleton__) {
      __rpc2_singleton__ = new RPC2Client("/api/rpc2", { autoConnect: true });
    }
    return __rpc2_singleton__;
  });
  const [connectionState, setConnectionState] = useState(client.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    __rpc2_refcount++;
    // 设置事件监听器
    client.setEventListeners({
      onConnect: () => {
        setConnectionState(client.state);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionState(client.state);
      },
      onError: (err) => {
        setError(err.message);
        setConnectionState(client.state);
      },
      onReconnecting: (attempt) => {
        setConnectionState(client.state);
        console.log(`RPC2 重连尝试 ${attempt}`);
      },
    });

    // 清理函数
    return () => {
      __rpc2_refcount = Math.max(0, __rpc2_refcount - 1);
      // 只有在最后一个 Provider 卸载时才断开连接
      if (__rpc2_refcount === 0) {
        client.clearEventListeners();
        client.disconnect();
      }
    };
  }, [client]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await client.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("rpc2.connection_failed"));
      throw err;
    }
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  const isConnected = connectionState === "connected";
  const contextValue = useMemo(
    () => ({
      client,
      connectionState,
      isConnected,
      error,
      connect,
      disconnect,
    }),
    [client, connectionState, isConnected, error, connect, disconnect],
  );

  return (
    <RPC2Context.Provider value={contextValue}>
      {children}
    </RPC2Context.Provider>
  );
};
