// WebSocket hook — connects to the backend WS and dispatches events to the store.
import { useEffect, useRef, useCallback } from 'react';
import { env } from '../config/env';
import { useAppStore } from '../store/store';

export type WsMessageType =
  | 'event_result'
  | 'device_update'
  | 'regime_change'
  | 'rule_proposed'
  | 'stats_update'
  | 'ping';

export interface WsMessage {
  type: WsMessageType;
  payload?: Record<string, unknown>;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsCallbacksRef = useRef<Array<(msg: WsMessage) => void>>([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = env.BACKEND_URL.replace(/^http/, 'ws') + `/ws?home_id=${env.HOME_ID}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('[WS] Connected to backend');
      };

      ws.onmessage = (e) => {
        try {
          const msg: WsMessage = JSON.parse(e.data);
          if (msg.type === 'ping') return;

          // Dispatch to all registered callbacks
          wsCallbacksRef.current.forEach((cb) => cb(msg));

          // Handle known message types globally
          if (msg.type === 'regime_change' && msg.payload) {
            const regime = msg.payload.new_regime as string;
            const emoji = regimeEmoji(regime);
            addNotification(`${emoji} Regime changed to ${regime}`, 'info');
          }

          if (msg.type === 'rule_proposed' && msg.payload) {
            addNotification(`⚡ New rule proposed: "${msg.payload.title ?? 'Auto rule'}"`, 'success');
          }

          if (msg.type === 'device_update' && msg.payload) {
            const { device_id, property, new_value } = msg.payload;
            addNotification(`🔧 ${device_id}: ${property} → ${new_value}`, 'info');
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 5s
        reconnectRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available
    }
  }, [addNotification]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((cb: (msg: WsMessage) => void) => {
    wsCallbacksRef.current.push(cb);
    return () => {
      wsCallbacksRef.current = wsCallbacksRef.current.filter((c) => c !== cb);
    };
  }, []);

  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return { subscribe, isConnected };
}

function regimeEmoji(regime: string) {
  const map: Record<string, string> = {
    normal: '🟢',
    festival: '🎉',
    guest: '👤',
    sleep: '🌙',
    away: '🏠',
  };
  return map[regime] ?? '⚙️';
}
