import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WsMessage {
  type: 'event_result' | 'device_update' | 'regime_change' | 'rule_proposed' | 'stats_update' | 'ping' | 'error';
  home_id: string;
  payload: any;
  timestamp: string;
}

class HomeWsServer {
  private wss: WebSocketServer;
  private subscriptions = new Map<string, Set<WebSocket>>();
  private pingInterval: NodeJS.Timeout;

  constructor(httpServer: Server) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '/', `http://localhost`);
      const home_id = url.searchParams.get('home_id');

      if (!home_id) {
        ws.send(JSON.stringify({ type: 'error', payload: 'home_id query param required. Connect to /ws?home_id=demo_home_001', timestamp: new Date().toISOString() }));
        ws.close();
        return;
      }

      if (!this.subscriptions.has(home_id)) this.subscriptions.set(home_id, new Set());
      this.subscriptions.get(home_id)!.add(ws);

      console.log(`[WS] Client connected for home_id=${home_id} (${this.subscriptions.get(home_id)!.size} total)`);

      // Welcome message with current state
      ws.send(JSON.stringify({
        type: 'event_result',
        home_id,
        payload: { message: `Connected to Alexa+ India Context Layer. Listening for events on home ${home_id}.`, tier: 'SYSTEM' },
        timestamp: new Date().toISOString(),
      } as WsMessage));

      ws.on('close', () => {
        this.subscriptions.get(home_id)?.delete(ws);
        if (this.subscriptions.get(home_id)?.size === 0) this.subscriptions.delete(home_id);
        console.log(`[WS] Client disconnected from home_id=${home_id}`);
      });

      ws.on('error', (err) => console.error(`[WS] Error for home_id=${home_id}:`, err.message));
    });

    // Ping every 30s to keep connections alive and prune dead sockets
    this.pingInterval = setInterval(() => {
      for (const [home_id, clients] of this.subscriptions) {
        const dead: WebSocket[] = [];
        clients.forEach(ws => {
          if (ws.readyState !== WebSocket.OPEN) { dead.push(ws); return; }
          ws.send(JSON.stringify({ type: 'ping', home_id, payload: { ts: Date.now() }, timestamp: new Date().toISOString() }));
        });
        dead.forEach(ws => clients.delete(ws));
      }
    }, 30000);
  }

  broadcast(home_id: string, message: WsMessage): void {
    const clients = this.subscriptions.get(home_id);
    if (!clients || clients.size === 0) return;
    const payload = JSON.stringify(message);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch (e) { /* ignore */ }
      }
    });
  }

  broadcastEventResult(home_id: string, tier: string, result: any, latency: string, cost: string): void {
    this.broadcast(home_id, {
      type: 'event_result',
      home_id,
      payload: { tier, result, latency, cost },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastDeviceUpdate(home_id: string, device_id: string, property: string, new_value: any): void {
    this.broadcast(home_id, {
      type: 'device_update',
      home_id,
      payload: { device_id, property, new_value },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRegimeChange(home_id: string, new_regime: string, reason: string): void {
    this.broadcast(home_id, {
      type: 'regime_change',
      home_id,
      payload: { new_regime, reason },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRuleProposed(home_id: string, proposal: any): void {
    this.broadcast(home_id, {
      type: 'rule_proposed',
      home_id,
      payload: proposal,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastStats(home_id: string, stats: any): void {
    this.broadcast(home_id, {
      type: 'stats_update',
      home_id,
      payload: stats,
      timestamp: new Date().toISOString(),
    });
  }

  getConnectionCount(home_id: string): number {
    return this.subscriptions.get(home_id)?.size || 0;
  }

  getStats() {
    let total = 0;
    this.subscriptions.forEach(s => { total += s.size; });
    return { total_connections: total, homes_with_connections: this.subscriptions.size };
  }

  shutdown(): void {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
}

export let wsServer: HomeWsServer | null = null;

export function initWebSocket(httpServer: Server): HomeWsServer {
  wsServer = new HomeWsServer(httpServer);
  console.log('[WS] WebSocket server initialized on /ws?home_id=<id>');
  return wsServer;
}
