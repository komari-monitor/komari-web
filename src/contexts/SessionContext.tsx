import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface Session {
  uuid: string;
  session: string;
  user_agent: string;
  ip: string;
  login_method: string;
  latest_online: string;
  latest_user_agent: string;
  latest_ip: string;
  expires: string;
  created_at: string;
}

interface ApiResponse {
  current: string;
  data: Session[];
  status: 'success' | 'error';
  message?: string;
}

interface SessionContextType {
  sessions: Session[];
  currentSessionId: string | null;
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  removeAllSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/session/get');
      if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
      }
      const data: ApiResponse = await response.json();
      if (data.status !== 'success') {
        throw new Error(data.message || '获取会话列表失败');
      }
      setSessions(data.data);
      setCurrentSessionId(data.current);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '一个未知的错误发生了';
      setError(errorMessage);
      console.error("Fetch sessions error:", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSession = async (sessionId: string) => {
    const originalSessions = [...sessions];
    setSessions(prev => prev.filter(s => s.session !== sessionId));
    try {
      const response = await fetch('/api/admin/session/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session: sessionId }),
      });
      if (!response.ok) {
        throw new Error('删除会话的网络请求失败');
      }
      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || '删除会话失败');
      }
      console.log(`Session ${sessionId} removed successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '一个未知的错误发生了';
      setError(errorMessage);
      setSessions(originalSessions);
      alert(`删除失败: ${errorMessage}`);
    }
  };

  const removeAllSessions = async () => {
    try {
      const response = await fetch('/api/admin/session/remove/all', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('删除所有会话的网络请求失败');
      }
      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || '删除所有会话失败');
      }
      await fetchSessions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '一个未知的错误发生了';
      setError(errorMessage);
      alert(`操作失败: ${errorMessage}`);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <SessionContext.Provider value={{ sessions, currentSessionId, loading, error, fetchSessions, removeSession, removeAllSessions }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession 必须在 SessionProvider 内部使用');
  }
  return context;
};