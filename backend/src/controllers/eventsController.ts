import { Request, Response } from 'express';
import { stateStore, EventRecord } from '../stateStore';
import { runT0RuleEngine, needsT3Escalation } from '../ruleEngine';
import { runSupervisorAgent } from '../bedrockClient';

export async function handleEvent(req: Request, res: Response) {
  const { home_id, event_type, data } = req.body;

  if (!home_id || !event_type) {
    return res.status(400).json({ error: 'home_id and event_type are required' });
  }

  const homeState = stateStore.get(home_id);
  const eventPayload = { home_id, event_type, data: data || {} };
  const receivedAt = new Date().toISOString();

  // ── T0 Rule Engine ────────────────────────────────────────────────
  const t0Result = runT0RuleEngine(eventPayload);
  if (t0Result) {
    // Apply device state change
    if (t0Result.device_id && t0Result.new_state) {
      stateStore.updateDevice(home_id, t0Result.device_id, { state: t0Result.new_state });
    }

    const record: EventRecord = {
      timestamp: receivedAt,
      event_type,
      tier: 'T0',
      data,
      action_taken: t0Result,
    };
    stateStore.addEventRecord(home_id, record);

    return res.json({
      home_id,
      received_at: receivedAt,
      resolved_at: new Date().toISOString(),
      tier: 'T0',
      cost: '$0.00',
      result: t0Result,
      home_state: stateStore.get(home_id),
    });
  }

  // ── T3 Cloud Escalation ───────────────────────────────────────────
  if (needsT3Escalation(eventPayload)) {
    try {
      const t3StartTime = Date.now();

      // Build compact home state snapshot (avoid sending all history)
      const snapshot = {
        devices: homeState.devices,
        inventory: homeState.inventory,
        recent_events: homeState.event_history.slice(0, 5),
        active_rules: homeState.t0_rules.length,
      };

      const anomalyDescription = buildAnomalyDescription(event_type, data);
      const t3Result = await runSupervisorAgent({
        home_id,
        anomaly_description: anomalyDescription,
        home_state_snapshot: snapshot,
        event_data: data,
      });

      const latency = `${Date.now() - t3StartTime}ms`;
      const record: EventRecord = {
        timestamp: receivedAt,
        event_type,
        tier: 'T3',
        data,
        action_taken: t3Result,
      };
      stateStore.addEventRecord(home_id, record);

      return res.json({
        home_id,
        received_at: receivedAt,
        resolved_at: new Date().toISOString(),
        tier: 'T3',
        latency,
        cost: t3Result.escalation_cost_estimate,
        result: t3Result,
        home_state: stateStore.get(home_id),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Bedrock T3 agent failed',
        detail: err.message,
        fallback_action: 'Event logged, manual review required',
      });
    }
  }

  // ── Unhandled: log and acknowledge ───────────────────────────────
  const record: EventRecord = { timestamp: receivedAt, event_type, tier: 'LOGGED', data };
  stateStore.addEventRecord(home_id, record);

  return res.json({
    home_id,
    received_at: receivedAt,
    tier: 'LOGGED',
    message: 'Event logged. No T0 rule matched and T3 escalation not required.',
  });
}

function buildAnomalyDescription(event_type: string, data: any): string {
  if (event_type === 'voice_command') {
    return `Voice command received: "${data.utterance || data.command}". Speaker: ${data.speaker_id || 'unknown'}. Requires NLU + possible agentic action.`;
  }
  if (event_type === 'inventory_drop') {
    return `Inventory drop detected: ${data.item} is now at ${data.quantity} ${data.unit}, below threshold of ${data.threshold} ${data.unit}. Evaluate ordering via Amazon Now.`;
  }
  if (event_type === 'unknown_sound') {
    return `Unknown acoustic embedding detected (ID: ${data.embedding_id}). No matching label in local model. Zero-shot discovery required. Frequency: ${data.frequency || 'unknown'}.`;
  }
  return `Unclassified event type=${event_type}. Data: ${JSON.stringify(data)}. Requires cloud reasoning.`;
}
