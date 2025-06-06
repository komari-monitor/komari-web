import type { LiveDataResponse, NodeResponse } from "@/types/NodeInfo";
import React, { createContext, useEffect, useState } from "react";

interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  node_data: NodeResponse | null;
  showCallout: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => void;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  node_data: null,
  showCallout: true,
  onRefresh: () => {},
});

export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [node_data, setNodeData] = useState<NodeResponse | null>(null);
  const [showCallout, setShowCallout] = useState(false);
  const [refreshCallbacks] = useState<Set<(data: LiveDataResponse) => void>>(new Set());


  const onRefresh = (callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
  };

  const notifyRefreshCallbacks = React.useCallback((data: LiveDataResponse) => {
    refreshCallbacks.forEach(callback => callback(data));
  }, [refreshCallbacks]);

  useEffect(() => {
    fetch("/api/nodes")
      .then((res) => res.json())
      .then((data) => setNodeData(data))
      .catch((err) => console.error("Failed to fetch node data:", err));
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: number;

    const connect = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/api/clients`);
      ws.onopen = () => {
        setShowCallout(true);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
          notifyRefreshCallbacks(data);
        } catch (e) {
          console.error(e);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
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

export default LiveDataContext;