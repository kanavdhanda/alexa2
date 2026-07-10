import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { runT1Engine } from './t1Engine';
import { runSupervisorAgent } from './bedrockClient';
import { buildSpokenResponse, synthesizeSpeech } from './voiceModule';
import { stateStore } from './stateStore';
import { updateHomeRegime } from './regimeEngine';
import { semanticCache, buildCacheKey } from './semanticCache';
import { financialSafety } from './financialSafety';

export interface WsMessage {
  type:
    | 'event_result'
    | 'device_update'
    | 'regime_change'
    | 'rule_proposed'
    | 'stats_update'
    | 'ping'
    | 'error'
    // Voice chat messages
    | 'voice_command'
    | 'voice_thinking'
    | 'voice_response'
    | 'lookup_request'
    | 'lookup_approved'
    | 'lookup_result'
    | 'khata_entry';
  home_id: string;
  payload: any;
  timestamp: string;
}

const buffers = new Map<string, { seq: number; msg: unknown }[]>();
let seqCounter = 0;
const BUFFER_CAP = 100;

export function getBufferedEvents(homeId: string, since: number): { seq: number; msg: unknown }[] {
  const buf = buffers.get(homeId) || [];
  return buf.filter(e => e.seq > since);
}

export function getLatestSeq(): number {
  return seqCounter;
}

class HomeWsServer {
  private wss: WebSocketServer | null = null;
  private subscriptions = new Map<string, Set<WebSocket>>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(httpServer?: Server) {
    if (httpServer) this.attachServer(httpServer);
  }

  /** Attaches a live WebSocketServer transport. Safe to skip entirely (headless mode) —
   * broadcasting/buffering must still work with zero clients / no server (e.g. in tests). */
  attachServer(httpServer: Server): void {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '/', `http://localhost`);
      const home_id = url.searchParams.get('home_id');

      if (!home_id) {
        ws.send(JSON.stringify({ type: 'error', payload: 'home_id query param required. Connect to /ws?home_id=demo_home_001', timestamp: new Date().toISOString() }));
        ws.close();
        return;
      }

      // API key guard for WebSocket — same key as REST
      const wsSecret = process.env.API_SECRET_KEY || '';
      if (wsSecret) {
        const wsToken = url.searchParams.get('token');
        if (wsToken !== wsSecret) {
          ws.send(JSON.stringify({ type: 'error', payload: 'Unauthorized: invalid or missing token query param', timestamp: new Date().toISOString() }));
          ws.close();
          return;
        }
      }

      if (!this.subscriptions.has(home_id)) this.subscriptions.set(home_id, new Set());
      this.subscriptions.get(home_id)!.add(ws);

      console.log(`[WS] Client connected for home_id=${home_id} (${this.subscriptions.get(home_id)!.size} total)`);

      ws.send(JSON.stringify({
        type: 'event_result',
        home_id,
        payload: { message: `Connected to Alexa+ India Context Layer. Listening for events on home ${home_id}.`, tier: 'SYSTEM' },
        timestamp: new Date().toISOString(),
      } as WsMessage));

      // Handle incoming messages from the frontend
      ws.on('message', async (rawData) => {
        try {
          const msg: WsMessage = JSON.parse(rawData.toString());
          if (msg.type === 'voice_command') {
            await this.handleVoiceCommand(ws, home_id, msg.payload);
          } else if (msg.type === 'lookup_approved') {
            await this.handleLookupApproved(ws, home_id, msg.payload);
          }
        } catch (e) {
          console.error('[WS] Message parse error:', e);
        }
      });

      ws.on('close', () => {
        this.subscriptions.get(home_id)?.delete(ws);
        if (this.subscriptions.get(home_id)?.size === 0) this.subscriptions.delete(home_id);
        console.log(`[WS] Client disconnected from home_id=${home_id}`);
      });

      ws.on('error', (err) => console.error(`[WS] Error for home_id=${home_id}:`, err.message));
    });

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

  private send(ws: WebSocket, msg: WsMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  /** Synthesize speech (Sarvam → Polly → mock) then send the voice_response */
  private async sendVoiceResponse(ws: WebSocket, home_id: string, payload: Record<string, any>) {
    const spoken_text: string = payload.spoken_text ?? '';
    try {
      const tts = await synthesizeSpeech(spoken_text);
      payload.audio_base64 = tts.audio_base64;
      payload.audio_content_type = tts.content_type;
      payload.audio_is_mock = tts.is_mock;
      payload.tts_engine = tts.voice_used ?? 'browser';
      if (tts.debug) payload.tts_debug = tts.debug;
    } catch (e: any) {
      payload.tts_error = e.message;
    }
    this.send(ws, { type: 'voice_response', home_id, payload, timestamp: new Date().toISOString() });
  }

  /** Process a voice_command from the browser. T0 is handled on the browser; here we run T1 → T3. */
  private async handleVoiceCommand(ws: WebSocket, home_id: string, payload: any) {
    const { transcript, speaker_id = 'owner_1', request_id } = payload ?? {};
    if (!transcript) return;

    console.log(`[WS] voice_command home=${home_id} transcript="${transcript}"`);

    // Signal "thinking" immediately so the UI can show a spinner
    this.send(ws, {
      type: 'voice_thinking',
      home_id,
      payload: { request_id, transcript },
      timestamp: new Date().toISOString(),
    });

    updateHomeRegime(home_id);

    const lowerTranscript = transcript.toLowerCase();
    
    // Check if query is about Bruno the dog
    const isDogQuery = (lowerTranscript.includes('feed') || lowerTranscript.includes('fed')) && lowerTranscript.includes('bruno');
    if (isDogQuery) {
      console.log(`[WS] Intercepted Bruno dog query: "${transcript}"`);
      try {
        const startMs = Date.now();
        const speech = 'Yes, Bruno was fed by you (Arman) just 2 hours ago according to the smart dog feeder.';
        
        // Send response back to WS
        await this.sendVoiceResponse(ws, home_id, {
          request_id,
          transcript,
          tier: 'T0',
          spoken_text: speech,
          routing: null
        });
        return;
      } catch (err) {
        console.error('WS Bruno dog processing error:', err);
      }
    }

    const isLedgerQuery =
      lowerTranscript.includes('doodhwala') ||
      lowerTranscript.includes('milkman') ||
      lowerTranscript.includes('dhobi') ||
      lowerTranscript.includes('laundry') ||
      lowerTranscript.includes('maid') ||
      lowerTranscript.includes('help') ||
      lowerTranscript.includes('newspaper') ||
      lowerTranscript.includes('khata') ||
      lowerTranscript.includes('ledger') ||
      lowerTranscript.includes('hisab');

    if (isLedgerQuery) {
      console.log(`[WS] Intercepted ledger command: "${transcript}"`);
      try {
        const startMs = Date.now();
        const { parseKhataUtteranceMock, khataStore } = require('./khata');
        const entry = parseKhataUtteranceMock(transcript);
        khataStore.add(home_id, entry);
        
        const latencyMs = Date.now() - startMs;
        const speech = `Recorded — ${entry.vendor_hi}, ${entry.quantity} ${entry.unit}, ₹${entry.amount_inr}.`;
        
        // Broadcast the khata_entry to update all widgets
        this.broadcast(home_id, {
          type: 'khata_entry',
          home_id,
          payload: { entry, trace: { tier: 'T0·local', latency_ms: latencyMs, cost_usd: 0 } },
          timestamp: new Date().toISOString(),
        });

        // Send voice response back to the widget to display in chat
        await this.sendVoiceResponse(ws, home_id, {
          request_id,
          transcript,
          tier: 'T0',
          spoken_text: speech,
          routing: null
        });
        
        return;
      } catch (err) {
        console.error('WS ledger processing error:', err);
      }
    }

    const homeState = stateStore.get(home_id);
    const event = { home_id, event_type: 'voice_command' as const, data: { utterance: transcript, speaker_id, source: 'ws_voice' }, speaker_id };

    // ── T1 ────────────────────────────────────────────────────────────────────
    const t1Result = runT1Engine(event as any, homeState);
    if (t1Result) {
      const spokenText = buildSpokenResponse('T1', t1Result, home_id);
      this.broadcast(home_id, {
        type: 'event_result',
        home_id,
        payload: { tier: 'T1', result: t1Result, latency: t1Result.latency, cost: '$0.00' },
        timestamp: new Date().toISOString(),
      });
      await this.sendVoiceResponse(ws, home_id, { request_id, transcript, tier: 'T1', spoken_text: spokenText, routing: null });
      return;
    }

    // ── T3 ────────────────────────────────────────────────────────────────────
    const cacheKey = buildCacheKey('voice_command', { utterance: transcript });
    const cached = semanticCache.get(cacheKey);
    if (cached) {
      const spokenText = buildSpokenResponse('CACHED', cached, home_id);
      await this.sendVoiceResponse(ws, home_id, { request_id, transcript, tier: 'CACHED', spoken_text: spokenText, routing: (cached as any).routing ?? null });
      return;
    }

    const rateCheck = financialSafety.checkRateLimit(home_id);
    if (!rateCheck.allowed) {
      await this.sendVoiceResponse(ws, home_id, {
        request_id, transcript, tier: 'RATE_LIMITED',
        spoken_text: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    try {
      const t3Start = Date.now();
      const snapshot = {
        devices: homeState.devices,
        inventory: homeState.inventory,
        regime: homeState.current_regime,
        rooms: Object.fromEntries(Object.entries(homeState.rooms).map(([k, v]) => [k, { ...v }])),
        recent_events: homeState.event_history.slice(0, 5),
      };

      const anomalyDesc = `Voice command: "${transcript}". Speaker: ${speaker_id}. Requires complex NLU + possible agentic action beyond T1 intent patterns.`;
      const t3Result = await runSupervisorAgent({
        home_id, anomaly_description: anomalyDesc, home_state_snapshot: snapshot, event_data: { utterance: transcript },
      });

      const latencyMs = Date.now() - t3Start;
      if (!t3Result.is_mock) semanticCache.set(cacheKey, t3Result);

      this.broadcast(home_id, {
        type: 'event_result',
        home_id,
        payload: { tier: 'T3', result: t3Result, latency: `${latencyMs}ms`, cost: t3Result.escalation_cost_estimate },
        timestamp: new Date().toISOString(),
      });

      const spokenText = buildSpokenResponse('T3', t3Result, home_id);

      // Detect web search request
      const lookupMatch = spokenText.match(/\[LOOKUP_PENDING:([^\]]+)\]/);
      if (lookupMatch) {
        const query = lookupMatch[1];
        this.send(ws, {
          type: 'lookup_request',
          home_id,
          payload: { request_id, transcript, query, spoken_text: spokenText.replace(/\s*\[LOOKUP_PENDING:[^\]]+\]/, '') },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.sendVoiceResponse(ws, home_id, {
        request_id, transcript, tier: 'T3', spoken_text: spokenText,
        routing: t3Result.routing ?? null,
        specialist: t3Result.routing?.specialist ?? null,
      });
    } catch (err: any) {
      console.error('[WS] T3 error:', err.message);
      await this.sendVoiceResponse(ws, home_id, {
        request_id, transcript, tier: 'ERROR',
        spoken_text: 'Sorry, I had trouble processing that. Please try again.',
      });
    }
  }

  private async handleLookupApproved(ws: WebSocket, home_id: string, payload: any) {
    const { query, request_id } = payload ?? {};
    if (!query) return;
    console.log(`[WS] lookup_approved home=${home_id} query="${query}"`);
    const resultText = `[MOCK] Web search for "${query}": In production with real internet access, Bedrock would retrieve current results here and summarize them.`;
    await this.sendVoiceResponse(ws, home_id, { request_id, tier: 'T3', spoken_text: resultText, lookup_query: query });
  }

  broadcast(home_id: string, message: WsMessage): void {
    let buf = buffers.get(home_id);
    if (!buf) { buf = []; buffers.set(home_id, buf); }
    buf.push({ seq: ++seqCounter, msg: message });
    if (buf.length > BUFFER_CAP) buf.splice(0, buf.length - BUFFER_CAP);

    const clients = this.subscriptions.get(home_id);
    if (!clients || clients.size === 0) return;
    const payload = JSON.stringify(message);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch { /* ignore */ }
      }
    });
  }

  broadcastEventResult(home_id: string, tier: string, result: any, latency: string, cost: string, trace?: any): void {
    this.broadcast(home_id, { type: 'event_result', home_id, payload: { tier, result, latency, cost, ...(trace !== undefined ? { trace } : {}) }, timestamp: new Date().toISOString() });
  }

  broadcastDeviceUpdate(home_id: string, device_id: string, property: string, new_value: any): void {
    this.broadcast(home_id, { type: 'device_update', home_id, payload: { device_id, property, new_value }, timestamp: new Date().toISOString() });
  }

  broadcastRegimeChange(home_id: string, new_regime: string, reason: string): void {
    this.broadcast(home_id, { type: 'regime_change', home_id, payload: { new_regime, reason }, timestamp: new Date().toISOString() });
  }

  broadcastRuleProposed(home_id: string, proposal: any): void {
    this.broadcast(home_id, { type: 'rule_proposed', home_id, payload: proposal, timestamp: new Date().toISOString() });
  }

  broadcastStats(home_id: string, stats: any): void {
    this.broadcast(home_id, { type: 'stats_update', home_id, payload: stats, timestamp: new Date().toISOString() });
  }

  getConnectionCount(home_id: string): number { return this.subscriptions.get(home_id)?.size || 0; }

  getStats() {
    let total = 0;
    this.subscriptions.forEach(s => { total += s.size; });
    return { total_connections: total, homes_with_connections: this.subscriptions.size };
  }

  shutdown(): void { if (this.pingInterval) clearInterval(this.pingInterval); this.wss?.close(); }
}

// Always a live instance (headless until attachServer/initWebSocket runs) so that
// broadcast/buffering works in tests and other server-less contexts.
export let wsServer: HomeWsServer | null = new HomeWsServer();

export function initWebSocket(httpServer: Server): HomeWsServer {
  if (!wsServer) wsServer = new HomeWsServer();
  wsServer.attachServer(httpServer);
  console.log('[WS] WebSocket server initialized on /ws?home_id=<id>');
  return wsServer;
}
