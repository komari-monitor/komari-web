import type { LiveDataResponse, NodeResponse } from "@/types/NodeInfo"; // 修改：导入 NodeResponse
import React, { createContext, useContext, useEffect, useState } from "react";

// 创建Context
interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  node_data: NodeResponse | null; // 新增：节点静态数据
  showCallout: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => void;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  node_data: null, // 新增
  showCallout: true,
  onRefresh: () => {},
});

// 创建Provider组件
export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [node_data, setNodeData] = useState<NodeResponse | null>(null); // 新增
  const [showCallout, setShowCallout] = useState(false);
  const [refreshCallbacks] = useState<Set<(data: LiveDataResponse) => void>>(new Set());

  // 注册刷新回调函数
  const onRefresh = (callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
  };

  // 当数据更新时通知所有回调函数
  const notifyRefreshCallbacks = React.useCallback((data: LiveDataResponse) => {
    refreshCallbacks.forEach(callback => callback(data));
  }, [refreshCallbacks]);

  // 获取节点静态数据
  useEffect(() => {
    fetch("/api/nodes") // 修改：确保路径正确，通常以 / 开头表示根路径
      .then((res) => res.json())
      .then((data) => setNodeData(data))
      .catch((err) => console.error("Failed to fetch node data:", err)); // 修改：添加错误日志
  }, []);

  // WebSocket connection effect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: number;

    const connect = () => {
      // 确保 API 路径正确
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/api/clients`);
      ws.onopen = () => {
        // 连接成功时，隐藏 Callout
        setShowCallout(true);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
          // 当收到新数据时，通知所有已注册的回调函数
          notifyRefreshCallbacks(data);
        } catch (e) {
          console.error(e);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        // 断开连接时，显示 Callout
        setShowCallout(false);
        reconnectTimeout = window.setTimeout(connect, 2000);
      };
    };

    connect();

    const interval = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("get");
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [notifyRefreshCallbacks]);

  return (
    <LiveDataContext.Provider value={{ live_data, node_data, showCallout, onRefresh }}>
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);

export default LiveDataContext;