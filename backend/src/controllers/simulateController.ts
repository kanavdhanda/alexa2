import { Request, Response } from 'express';
import { stateStore } from '../stateStore';
import { runSupervisorAgent } from '../bedrockClient';
import { v4 as uuidv4 } from 'uuid';
import { runT0RuleEngine } from '../ruleEngine';
import { buildSpokenResponse, synthesizeSpeech } from '../voiceModule';
import { wsServer } from '../websocket';

// ─── SCENARIO 1: Daily Geyser — T0 handles, $0, <1ms ─────────────────────────
export async function simulateGeyser(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const outdoor_temp = req.body.outdoor_temp ?? 18;
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);

  const t0Start = process.hrtime.bigint();
  const t0Fired = outdoor_temp < 28;
  const latencyMs = Number(process.hrtime.bigint() - t0Start) / 1_000_000;

  if (t0Fired) {
    // Find geyser device (any device of type geyser/water_heater)
    const geyserDevice = Object.values(home.devices).find(d => d.type === 'geyser' || d.type === 'water_heater');
    const device_id = geyserDevice?.device_id || 'master_geyser';
    stateStore.setDeviceProperty(home_id, device_id, 'power', true);

    const t0Result = {
      handled: true, tier: 'T0', action: 'TURN_ON', device_id, property: 'power', new_value: true,
      latency: `${latencyMs}ms`,
      rule_id: 'learned_geyser_morning',
      explanation: `Morning geyser automation. Outdoor temp ${outdoor_temp}°C < 28°C. Rule promoted from T3 after 7 days of pattern mining (confidence: 0.91).`,
      cost: '$0.00 (local reflex)',
    };

    stateStore.addEvent(home_id, {
      event_id: uuidv4(), timestamp: new Date().toISOString(), event_type: 'sensor_trigger', tier: 'T0',
      data: { sensor: 'geyser', sub_type: 'morning_timer', outdoor_temp }, action_taken: t0Result,
      regime_at_time: home.current_regime,
    });
    wsServer?.broadcastEventResult(home_id, 'T0', t0Result, t0Result.latency, '$0.00');

    const response: any = {
      scenario: 'DAILY_GEYSER', home_id, result_tier: 'T0', bedrock_called: false,
      cost_this_event: '$0.00', vs_naive_cloud_cost: '~$0.002 USD',
      savings_demo: `T0 in ${latencyMs.toFixed(3)}ms. At 1M homes × 365 days = ~$730K/year saved vs cloud-everything.`,
      action: t0Result,
      t0_rule_origin: 'Promoted from T3: geyser follows weekday alarm by 30min, outdoor_temp<28°C, support=28 days, confidence=0.91',
      device_state: stateStore.get(home_id).devices[device_id],
      stats: stateStore.getStats(home_id),
    };

    if (voice_response) {
      const spoken = buildSpokenResponse('T0', t0Result, home_id);
      try { response.voice = await synthesizeSpeech(spoken); response.spoken_text = spoken; } catch {}
    }
    return res.json(response);
  }

  return res.json({
    scenario: 'DAILY_GEYSER', home_id, result_tier: 'T0_SUPPRESSED',
    reason: `outdoor_temp (${outdoor_temp}°C) >= 28°C — geyser not needed in warm weather. Rule correctly suppressed.`,
    bedrock_called: false, cost_this_event: '$0.00',
  });
}

// ─── SCENARIO 2: Amazon Now (T3 + commerce agent) ─────────────────────────────
export async function simulateInventoryDrop(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const item = req.body.item || 'milk';
  const quantity = req.body.quantity ?? 0.3;
  const unit = req.body.unit || 'liters';
  const threshold = req.body.threshold ?? 1;
  const voice_response = req.body.voice_response ?? false;

  stateStore.setInventory(home_id, item, quantity);
  const home = stateStore.get(home_id);

  const snapshot = { devices: home.devices, inventory: home.inventory, regime: home.current_regime, rooms: home.rooms };

  try {
    const t3Start = Date.now();
    const t3Result = await runSupervisorAgent({
      home_id,
      anomaly_description: `Inventory drop: ${item} is now at ${quantity} ${unit}, below threshold of ${threshold} ${unit}. Order immediately via Amazon Now if budget allows.`,
      home_state_snapshot: snapshot,
      event_data: { item, quantity, unit, threshold, trigger: 'inventory_sensor' },
    });

    const latency = `${Date.now() - t3Start}ms`;
    stateStore.addEvent(home_id, {
      event_id: uuidv4(), timestamp: new Date().toISOString(), event_type: 'inventory_drop', tier: 'T3',
      data: { item, quantity, unit, threshold }, action_taken: t3Result,
      regime_at_time: home.current_regime, latency_ms: Date.now() - t3Start,
    });
    wsServer?.broadcastEventResult(home_id, 'T3', t3Result, latency, t3Result.escalation_cost_estimate);

    const response: any = {
      scenario: 'AMAZON_NOW_ESCALATION', home_id, result_tier: 'T3', bedrock_called: !t3Result.is_mock,
      latency, item_dropped: { item, quantity, unit, below_threshold: threshold },
      supervisor_result: t3Result, home_state: stateStore.get(home_id),
    };
    if (voice_response) {
      const spoken = buildSpokenResponse('T3', t3Result, home_id);
      try { response.voice = await synthesizeSpeech(spoken); response.spoken_text = spoken; } catch {}
    }
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ scenario: 'AMAZON_NOW_ESCALATION', error: err.message });
  }
}

// ─── SCENARIO 3: Unknown Sound / Zero-Shot Discovery ─────────────────────────
export async function simulateUnknownSound(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const embedding_id = req.body.embedding_id || uuidv4();
  const frequency = req.body.frequency || 'daily_6am';
  const clap_guess = req.body.clap_guess || 'metallic beep, possibly electrical inverter low-battery alert';
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);

  try {
    const t3Start = Date.now();
    const t3Result = await runSupervisorAgent({
      home_id,
      anomaly_description: `Unknown acoustic embedding detected by on-device OOD (Out-of-Distribution) detector.\nEmbedding ID: ${embedding_id}\nCLAP zero-shot: "${clap_guess}"\nPattern: ${frequency}\nThis sound has NO label in the local YAMNet/AST model. Cluster it and queue user classification.`,
      home_state_snapshot: { devices: home.devices, inventory: home.inventory },
      event_data: { embedding_id, frequency, clap_description: clap_guess, ood_confidence: 0.87, occurrence_count: 14, raw_audio_retained: false },
    });

    const latency = `${Date.now() - t3Start}ms`;
    stateStore.addEvent(home_id, {
      event_id: uuidv4(), timestamp: new Date().toISOString(), event_type: 'unknown_sound', tier: 'T3',
      data: { embedding_id, frequency, clap_guess }, action_taken: t3Result,
      regime_at_time: home.current_regime,
    });
    wsServer?.broadcastEventResult(home_id, 'T3', t3Result, latency, t3Result.escalation_cost_estimate);

    const response: any = {
      scenario: 'ZERO_SHOT_SOUND_DISCOVERY', home_id, result_tier: 'T3', bedrock_called: !t3Result.is_mock,
      latency, embedding_id,
      privacy_note: 'Raw audio NEVER left the device. Only the 512-dim embedding vector was forwarded.',
      clap_zero_shot_guess: clap_guess,
      discovery_pipeline: [
        '1. YAMNet/AST on-device: no label match (OOD score 0.87)',
        `2. CLAP zero-shot projection: "${clap_guess}"`,
        '3. T3 escalation with embedding_id (not audio)',
        '4. Bedrock Supervisor: log_new_sound_cluster tool called',
        '5. User classification prompt queued for next Alexa interaction',
      ],
      sound_clusters: stateStore.get(home_id).sound_clusters,
      supervisor_result: t3Result,
    };
    if (voice_response) {
      const spoken = buildSpokenResponse('T3', t3Result, home_id);
      try { response.voice = await synthesizeSpeech(spoken); response.spoken_text = spoken; } catch {}
    }
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ scenario: 'ZERO_SHOT_SOUND_DISCOVERY', error: err.message });
  }
}

// ─── SCENARIO 4: Water Motor Safety (T0 dead-man timer) ───────────────────────
export async function simulateMotorSafety(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const duration = req.body.duration ?? 50;
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);

  const event = { home_id, event_type: 'sensor_trigger', data: { sensor: 'water_motor', duration }, room_id: 'utility_room' };
  const t0Result = runT0RuleEngine(event as any);

  const response: any = {
    scenario: 'WATER_MOTOR_SAFETY', home_id,
    result_tier: t0Result ? 'T0' : 'NOT_TRIGGERED',
    bedrock_called: false, cost_this_event: '$0.00',
    duration_minutes: duration,
    action: t0Result || `No T0 rule triggered (duration ${duration} <= 45 min)`,
    home_state: stateStore.get(home_id),
  };
  if (voice_response && t0Result) {
    const spoken = buildSpokenResponse('T0', t0Result, home_id);
    try { response.voice = await synthesizeSpeech(spoken); response.spoken_text = spoken; } catch {}
  }
  return res.json(response);
}

// ─── SCENARIO 5: Multi-device voice command (T1 → resolves locally) ───────────
export async function simulateVoiceCommand(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const utterance = req.body.utterance || 'turn off the fan';
  const speaker_id = req.body.speaker_id || 'owner_1';
  const voice_response = req.body.voice_response ?? false;

  // This routes through the full event pipeline
  req.body = { home_id, event_type: 'voice_command', data: { utterance, speaker_id }, speaker_id, voice_response };
  const { handleEvent } = await import('./eventsController');
  return handleEvent(req, res);
}
