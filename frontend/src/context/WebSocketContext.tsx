import React, { createContext, useContext, useState, useEffect } from 'react';

type EventHandler = (data: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [handlers] = useState<Map<string, Set<EventHandler>>>(new Map());

  useEffect(() => {
    // Connect to SSE stream
    const sseUrl = 'http://localhost:8000/api/v1/events/sse';
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type;
          const data = payload.data;
          
          if (handlers.has(type)) {
            handlers.get(type)?.forEach(cb => cb(data));
          }
          if (handlers.has('*')) {
            handlers.get('*')?.forEach(cb => cb(payload));
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch (_) {
      setIsConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [handlers]);

  const subscribe = (eventType: string, handler: EventHandler) => {
    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }
    handlers.get(eventType)?.add(handler);

    return () => {
      handlers.get(eventType)?.delete(handler);
    };
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
};
