import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stateStore } from '../stateStore';
import { runT0RuleEngine, needsT3Escalation, EventPayload } from '../ruleEngine';
import { runT1Engine } from '../t1Engine';
import { runSupervisorAgent } from '../bedrockClient';
import { semanticCache, buildCacheKey } from '../semanticCache';
import { updateHomeRegime } from '../regimeEngine';
import { wsServer } from '../websocket';
import { buildSpokenResponse, synthesizeSpeech } from '../voiceModule';
import { financialSafety } from '../financialSafety';
import { buildTrace } from '../trace';

export async function handleEvent(req: Request, res: Response) {
  const { home_id, event_type, data, room_id, speaker_id, voice_response = false } = req.body;

  if (!home_id || !event_type) {
    return res.status(400).json({ error: 'home_id and event_type are required' });
  }

  // Update regime before processing (zero cost, local only)
  updateHomeRegime(home_id);

  const homeState = stateStore.get(home_id);
  const event: EventPayload = { home_id, event_type, data: data || {}, room_id, speaker_id };
  const receivedAt = new Date().toISOString();
  const eventId = uuidv4();
  const regime = homeState.current_regime;

  // ── T0 Rule Engine ────────────────────────────────────────────────────────
  const t0Result = runT0RuleEngine(event);
  if (t0Result) {
    const latencyMs = parseFloat(t0Result.latency);
    const trace = buildTrace('t0', latencyMs);
    stateStore.addEvent(home_id, {
      event_id: eventId, timestamp: receivedAt, event_type, tier: 'T0',
      room_id, speaker_id, data, action_taken: t0Result,
      regime_at_time: regime, latency_ms: latencyMs, cost_usd: 0,
    });

    wsServer?.broadcastEventResult(home_id, 'T0', t0Result, t0Result.latency, '$0.00', trace);
    wsServer?.broadcastDeviceUpdate(home_id, t0Result.device_id, t0Result.property, t0Result.new_value);
    wsServer?.broadcastStats(home_id, stateStore.getStats(home_id));

    const response: any = {
      event_id: eventId, home_id, received_at: receivedAt, resolved_at: new Date().toISOString(),
      tier: 'T0', cost: '$0.00', result: t0Result,
      home_state: stateStore.get(home_id),
      regime,
      trace,
    };

    if (voice_response) {
      try {
        const spokenText = buildSpokenResponse('T0', t0Result, home_id);
        response.voice = await synthesizeSpeech(spokenText);
        response.spoken_text = spokenText;
      } catch (e: any) {
        response.voice_error = e.message;
      }
    }

    return res.json(response);
  }

  // ── T1 Engine (local NLU) ─────────────────────────────────────────────────
  const t1Result = runT1Engine(event, homeState);
  if (t1Result) {
    const latencyMs = parseFloat(t1Result.latency);
    const trace = buildTrace('t1', latencyMs);
    stateStore.addEvent(home_id, {
      event_id: eventId, timestamp: receivedAt, event_type, tier: 'T1',
      room_id, speaker_id, data, action_taken: t1Result,
      regime_at_time: regime, latency_ms: latencyMs, cost_usd: 0,
    });

    wsServer?.broadcastEventResult(home_id, 'T1', t1Result, t1Result.latency, '$0.00', trace);
    if (t1Result.action_taken) {
      wsServer?.broadcastDeviceUpdate(home_id, t1Result.action_taken.device_id, t1Result.action_taken.property, t1Result.action_taken.new_value);
    }
    wsServer?.broadcastStats(home_id, stateStore.getStats(home_id));

    const response: any = {
      event_id: eventId, home_id, received_at: receivedAt, resolved_at: new Date().toISOString(),
      tier: 'T1', cost: '$0.00', result: t1Result,
      home_state: stateStore.get(home_id),
      regime,
      trace,
    };

    if (voice_response) {
      try {
        const spokenText = buildSpokenResponse('T1', t1Result, home_id);
        response.voice = await synthesizeSpeech(spokenText);
        response.spoken_text = spokenText;
      } catch (e: any) {
        response.voice_error = e.message;
      }
    }

    return res.json(response);
  }

  // ── T3 Cloud Escalation ───────────────────────────────────────────────────
  if (!needsT3Escalation(event)) {
    stateStore.addEvent(home_id, {
      event_id: eventId, timestamp: receivedAt, event_type, tier: 'LOGGED',
      room_id, speaker_id, data, regime_at_time: regime,
    });
    return res.json({ event_id: eventId, home_id, tier: 'LOGGED', message: 'Event logged. No T0/T1 match and T3 not required.' });
  }

  // Semantic cache check
  const cacheKey = buildCacheKey(event_type, data || {});
  const cached = semanticCache.get(cacheKey);
  if (cached) {
    stateStore.addEvent(home_id, {
      event_id: eventId, timestamp: receivedAt, event_type, tier: 'CACHED',
      room_id, speaker_id, data, action_taken: cached, regime_at_time: regime, cost_usd: 0,
    });
    const cacheTrace = buildTrace('cache', 0);
    wsServer?.broadcastEventResult(home_id, 'CACHED', cached, '0ms', '$0.00 (cache hit)', cacheTrace);
    wsServer?.broadcastStats(home_id, stateStore.getStats(home_id));
    return res.json({
      event_id: eventId, home_id, received_at: receivedAt, resolved_at: new Date().toISOString(),
      tier: 'CACHED', cost: '$0.00 (semantic cache hit)', result: cached,
      home_state: stateStore.get(home_id), regime,
      trace: cacheTrace,
    });
  }

  // Rate limit check before hitting Bedrock
  const rateCheck = financialSafety.checkRateLimit(home_id);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      detail: `Max 15 Bedrock calls/min per home. ${rateCheck.calls_this_minute}/15 used. Retry in ${rateCheck.retry_after_seconds}s.`,
      home_id, tier: 'RATE_LIMITED',
    });
  }

  // Run T3 Bedrock supervisor
  try {
    const t3Start = Date.now();
    const snapshot = {
      devices: homeState.devices,
      inventory: homeState.inventory,
      regime: homeState.current_regime,
      rooms: Object.fromEntries(Object.entries(homeState.rooms).map(([k, v]) => [k, { ...v, device_ids: v.device_ids }])),
      recent_events: homeState.event_history.slice(0, 5),
      t0_rules_count: homeState.t0_rules.length,
    };

    const anomalyDescription = buildAnomalyDescription(event_type, data, homeState);
    const t3Result = await runSupervisorAgent({
      home_id, anomaly_description: anomalyDescription, home_state_snapshot: snapshot,
      event_data: data, room_type: room_id ? homeState.rooms[room_id]?.type : undefined,
    });

    const latencyMs = Date.now() - t3Start;
    const costUsd = parseFloat(t3Result.escalation_cost_estimate.replace(/[^0-9.]/g, '')) || 0.00004;

    // Cache the result for similar future events
    if (!t3Result.is_mock) semanticCache.set(cacheKey, t3Result);

    stateStore.addEvent(home_id, {
      event_id: eventId, timestamp: receivedAt, event_type, tier: 'T3',
      room_id, speaker_id, data, action_taken: t3Result,
      regime_at_time: regime, latency_ms: latencyMs, cost_usd: costUsd,
    });

    const t3Trace = buildTrace('t3', latencyMs, costUsd);
    wsServer?.broadcastEventResult(home_id, 'T3', t3Result, `${latencyMs}ms`, t3Result.escalation_cost_estimate, t3Trace);
    wsServer?.broadcastStats(home_id, stateStore.getStats(home_id));

    const response: any = {
      event_id: eventId, home_id, received_at: receivedAt, resolved_at: new Date().toISOString(),
      tier: 'T3', latency: `${latencyMs}ms`, cost: t3Result.escalation_cost_estimate,
      result: t3Result, home_state: stateStore.get(home_id), regime,
      rate_limit: { calls_this_minute: rateCheck.calls_this_minute, max: 15 },
      trace: t3Trace,
    };

    if (voice_response) {
      try {
        const spokenText = buildSpokenResponse('T3', t3Result, home_id);
        response.voice = await synthesizeSpeech(spokenText);
        response.spoken_text = spokenText;
      } catch (e: any) {
        response.voice_error = e.message;
      }
    }

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      error: 'T3 agent failed', detail: err.message,
      fallback: 'Event logged. Consider checking AWS credentials or enabling MOCK_LLM=true.',
      hint: err.message.includes('Rate limit') ? 'Too many requests — wait 60s' : 'Check .env for AWS credentials',
    });
  }
}

function buildAnomalyDescription(event_type: string, data: any, homeState: any): string {
  if (event_type === 'voice_command') {
    return `Voice command: "${data.utterance || data.command}". Speaker: ${data.speaker_id || 'unknown'}. Requires complex NLU + possible agentic action beyond T1 intent patterns.`;
  }
  if (event_type === 'inventory_drop') {
    return `Inventory drop: ${data.item} is now at ${data.quantity} ${data.unit}, below threshold of ${data.threshold} ${data.unit}. Current home inventory: ${JSON.stringify(homeState.inventory)}. Consider ordering via Amazon Now.`;
  }
  if (event_type === 'unknown_sound') {
    return `Unknown acoustic embedding (ID: ${data.embedding_id}). CLAP zero-shot: "${data.clap_guess || 'unclassified'}". Occurrence pattern: ${data.frequency || 'unknown'}. Privacy: raw audio never left device. Need clustering + user classification.`;
  }
  return `Unclassified T3 event: type=${event_type}. Data: ${JSON.stringify(data)}.`;
}
