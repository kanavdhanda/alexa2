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

  req.body = { home_id, event_type: 'voice_command', data: { utterance, speaker_id }, speaker_id, voice_response };
  const { handleEvent } = await import('./eventsController');
  return handleEvent(req, res);
}

// ─── SCENARIO 6: Study Mode at 6 PM ──────────────────────────────────────────
export async function simulateStudyMode(req: Request, res: Response) {
  try {
  const home_id = req.body.home_id || 'demo_home_001';
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);
  const t0Start = process.hrtime.bigint();

  // Find study/bedroom light + TV
  const studyLight = Object.values(home.devices).find(d => d.room_id.includes('study') || d.room_id.includes('bedroom')) ;
  const tv = Object.values(home.devices).find(d => d.type === 'tv');

  if (studyLight) stateStore.setDeviceProperty(home_id, studyLight.device_id, 'power', true);
  if (tv) stateStore.setDeviceProperty(home_id, tv.device_id, 'power', false);

  const latencyMs = Number(process.hrtime.bigint() - t0Start) / 1_000_000;

  const actions = [
    studyLight ? { device: studyLight.device_id, action: 'TURN_ON', reason: 'Study mode: light on' } : null,
    tv ? { device: tv.device_id, action: 'TURN_OFF', reason: 'Study mode: TV suppressed during tuition hours' } : null,
  ].filter(Boolean);

  const eventAction = {
    scenario: 'STUDY_MODE', home_id, result_tier: 'T0', bedrock_called: false,
    cost_this_event: '$0.00', latency: `${latencyMs.toFixed(3)}ms`, actions,
  };

  stateStore.addEvent(home_id, {
    event_id: uuidv4(), timestamp: new Date().toISOString(),
    event_type: 'sensor_trigger', tier: 'T0', data: { trigger: 'study_mode_6pm' },
    action_taken: eventAction, regime_at_time: home.current_regime,
  });

  const result: any = {
    ...eventAction,
    trigger: '6 PM tuition schedule — learned routine, confidence 0.88',
    explanation: 'Study mode activated: bedroom/study light on, TV muted. Learned from 14 days of consistent 6 PM pattern.',
    home_state: stateStore.get(home_id),
  };
  wsServer?.broadcastEventResult(home_id, 'T0', result, result.latency, '$0.00');

  if (voice_response) {
    const spoken = `Study mode is ready. I've turned on the study light and muted the TV. Good luck with tuition!`;
    try { (result as any).voice = await synthesizeSpeech(spoken); (result as any).spoken_text = spoken; } catch {}
  }
  return res.json(result);
  } catch (err: any) {
    console.error('simulateStudyMode error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

// ─── SCENARIO 7: Night Safety Check ──────────────────────────────────────────
export async function simulateNightSafetyCheck(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);
  const t0Start = process.hrtime.bigint();

  const tv = Object.values(home.devices).find(d => d.type === 'tv');
  const lgpSensor = Object.values(home.devices).find(d => d.type === 'lpg_sensor');
  const waterMotor = Object.values(home.devices).find(d => d.type === 'water_pump' || d.type === 'water_motor');

  if (tv) stateStore.setDeviceProperty(home_id, tv.device_id, 'power', false);
  stateStore.setRegime(home_id, 'sleep', 'night_safety_check');

  const latencyMs = Number(process.hrtime.bigint() - t0Start) / 1_000_000;

  const checks = [
    { item: 'TV', status: tv ? 'TURNED_OFF' : 'NOT_FOUND' },
    { item: 'LPG Sensor', status: lgpSensor ? (lgpSensor.properties['gas_detected']?.current_value ? 'ALERT_GAS_DETECTED' : 'SAFE') : 'NOT_FOUND' },
    { item: 'Water Motor', status: waterMotor ? (waterMotor.properties['power']?.current_value ? 'TURNED_OFF' : 'ALREADY_OFF') : 'NOT_FOUND' },
    { item: 'Night Mode', status: 'SLEEP_REGIME_ACTIVATED' },
  ];

  if (waterMotor?.properties['power']?.current_value) {
    stateStore.setDeviceProperty(home_id, waterMotor.device_id, 'power', false);
  }

  const result = {
    scenario: 'NIGHT_SAFETY_CHECK',
    home_id,
    result_tier: 'T0',
    bedrock_called: false,
    cost_this_event: '$0.00',
    latency: `${latencyMs.toFixed(3)}ms`,
    checks,
    regime_set: 'sleep',
    explanation: 'Night safety check complete: TV off, LPG safe, water motor off, sleep mode active. All checks passed locally.',
  };

  stateStore.addEvent(home_id, {
    event_id: uuidv4(), timestamp: new Date().toISOString(),
    event_type: 'sensor_trigger', tier: 'T0', data: { trigger: 'night_safety_check' },
    action_taken: result, regime_at_time: home.current_regime,
  });
  wsServer?.broadcastEventResult(home_id, 'T0', result, result.latency, '$0.00');

  if (voice_response) {
    const safe = checks.every(c => !c.status.includes('ALERT'));
    const spoken = safe
      ? `Good night! All safety checks passed. TV is off, gas sensor is clear, water motor is off, and sleep mode is active.`
      : `Attention! Night safety check found issues. Please review the companion app.`;
    try { (result as any).voice = await synthesizeSpeech(spoken); (result as any).spoken_text = spoken; } catch {}
  }
  return res.json(result);
}

// ─── SCENARIO 8: Power Cut / Inverter Protection ─────────────────────────────
export async function simulatePowerCut(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const battery_percent = req.body.battery_percent ?? 40;
  const voice_response = req.body.voice_response ?? false;
  const home = stateStore.get(home_id);
  const t0Start = process.hrtime.bigint();

  const inverter = Object.values(home.devices).find(d => d.type === 'inverter');
  const ac = Object.values(home.devices).find(d => d.type === 'ac');
  const tv = Object.values(home.devices).find(d => d.type === 'tv');

  // Activate inverter battery mode, shed non-essential loads
  if (inverter) stateStore.setDeviceProperty(home_id, inverter.device_id, 'battery_mode', true);
  if (ac && battery_percent < 50) stateStore.setDeviceProperty(home_id, ac.device_id, 'power', false);

  const latencyMs = Number(process.hrtime.bigint() - t0Start) / 1_000_000;

  const actions = [
    inverter ? { device: inverter.device_id, action: 'BATTERY_MODE_ON', reason: 'Grid power cut — inverter switched to battery' } : null,
    ac && battery_percent < 50 ? { device: ac?.device_id, action: 'TURN_OFF', reason: 'Load shedding: AC suspended to extend battery life' } : null,
    battery_percent < 20 ? { alert: 'CRITICAL_BATTERY', message: 'Inverter battery below 20%. Consider essential-only mode.' } : null,
  ].filter(Boolean);

  const result = {
    scenario: 'POWER_CUT_INVERTER_PROTECTION',
    home_id,
    result_tier: 'T0',
    bedrock_called: false,
    cost_this_event: '$0.00',
    latency: `${latencyMs.toFixed(3)}ms`,
    battery_percent,
    grid_status: 'CUT',
    inverter_status: 'BATTERY_MODE',
    actions,
    explanation: `Power cut detected. Inverter on battery (${battery_percent}%). Non-essential loads shed locally. Actuator-local fail-safe: smart plug dead-man timers still active independently.`,
  };

  stateStore.addEvent(home_id, {
    event_id: uuidv4(), timestamp: new Date().toISOString(),
    event_type: 'sensor_trigger', tier: 'T0', data: { trigger: 'power_cut', battery_percent },
    action_taken: result, regime_at_time: home.current_regime,
  });
  wsServer?.broadcastEventResult(home_id, 'T0', result, result.latency, '$0.00');

  if (voice_response) {
    const spoken = battery_percent < 20
      ? `Power cut detected. Inverter is on battery, but charge is critically low at ${battery_percent}%. I've turned off the AC and non-essential appliances.`
      : `Power cut. Switched to inverter battery at ${battery_percent}%. AC suspended to save power.`;
    try { (result as any).voice = await synthesizeSpeech(spoken); (result as any).spoken_text = spoken; } catch {}
  }
  return res.json(result);
}

// ─── SEED LEARNING HISTORY (for rule mining demo) ────────────────────────────
export async function seedLearningHistory(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const home = stateStore.get(home_id);

  const days = 7;
  const seededEvents: any[] = [];

  for (let d = 0; d < days; d++) {
    const base = new Date();
    base.setDate(base.getDate() - d);

    // Geyser: 6:00 AM daily (weekday pattern)
    if (base.getDay() !== 0 && base.getDay() !== 6) {
      const geyser = Object.values(home.devices).find(d => d.type === 'geyser' || d.type === 'water_heater');
      const geyserEvent = {
        event_id: uuidv4(),
        timestamp: new Date(base.setHours(6, 0, 0, 0)).toISOString(),
        event_type: 'sensor_trigger', tier: 'T3' as const,
        data: { sensor: 'geyser', outdoor_temp: 18, trigger: 'morning_routine' },
        action_taken: { action: 'TURN_ON', device_id: geyser?.device_id || 'master_geyser' },
        regime_at_time: 'normal' as const,
      };
      stateStore.addEvent(home_id, geyserEvent);
      seededEvents.push(geyserEvent);
    }

    // Study mode: 6 PM daily
    const studyEvent = {
      event_id: uuidv4(),
      timestamp: new Date(new Date(base).setHours(18, 0, 0, 0)).toISOString(),
      event_type: 'sensor_trigger', tier: 'T1' as const,
      data: { trigger: 'study_mode_6pm', room: 'bedroom' },
      action_taken: { action: 'STUDY_MODE_ON' },
      regime_at_time: 'normal' as const,
    };
    stateStore.addEvent(home_id, studyEvent);
    seededEvents.push(studyEvent);

    // Water motor: 7 AM daily, runs 40 min
    const motorEvent = {
      event_id: uuidv4(),
      timestamp: new Date(new Date(base).setHours(7, 0, 0, 0)).toISOString(),
      event_type: 'sensor_trigger', tier: 'T0' as const,
      data: { sensor: 'water_motor', duration: 40, trigger: 'morning_fill' },
      action_taken: { action: 'SHUT_OFF', reason: 'Tank full' },
      regime_at_time: 'normal' as const,
    };
    stateStore.addEvent(home_id, motorEvent);
    seededEvents.push(motorEvent);
  }

  return res.json({
    message: `Seeded ${seededEvents.length} historical events across ${days} days`,
    home_id,
    patterns_seeded: ['geyser_morning_6am', 'study_mode_6pm', 'water_motor_7am'],
    next_step: `POST /api/homes/${home_id}/rules/mine to discover T0 rule proposals`,
  });
}

// ─── ANTICIPATIONS endpoint helper ───────────────────────────────────────────
export function getAnticipations(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const hour = new Date().getHours();
  const regime = home?.current_regime ?? 'normal';

  const anticipations: any[] = [];

  // Helper: returns "Today HH:MM" or "Tomorrow HH:MM" based on whether the event is still upcoming today
  const nextOccurrence = (targetHour: number, targetMin = 0) => {
    const label = hour < targetHour ? 'Today' : 'Tomorrow';
    const h = String(targetHour).padStart(2, '0');
    const m = String(targetMin).padStart(2, '0');
    return `${label} at ${h}:${m}`;
  };

  // ── Always-on predictions (shown regardless of current time) ─────────────────

  // Geyser: morning routine — show as "next occurrence"
  anticipations.push({
    id: 'ant_geyser_morning',
    action: 'Heat geyser for morning shower',
    trigger_window: nextOccurrence(6, 30),
    reason: 'Pattern: geyser follows weekday alarm by ~30 min (28 days observed)',
    confidence: 0.91,
    tier: 'T0',
  });

  // Study mode: evening routine
  anticipations.push({
    id: 'ant_study_mode',
    action: 'Activate study mode — mute TV, bright lights',
    trigger_window: nextOccurrence(17, 0),
    reason: 'Consistent 5 PM tuition pattern across 14 school days',
    confidence: 0.88,
    tier: 'T0',
  });

  // Night safety: bedtime routine
  anticipations.push({
    id: 'ant_night_safety',
    action: 'Night check — LPG off, TV off, motor off',
    trigger_window: nextOccurrence(22, 30),
    reason: 'Nightly safety audit before sleep (confidence from 45-day history)',
    confidence: 0.95,
    tier: 'T0',
  });

  // ── Regime-specific additions ─────────────────────────────────────────────────

  if (regime === 'festival') {
    anticipations.push({
      id: 'ant_festival_lighting',
      action: 'Festival lighting — decorative LEDs on',
      trigger_window: 'Active now',
      reason: 'Festival regime detected — learning paused, celebration mode',
      confidence: 1.0,
      tier: 'T0',
    });
  }

  if (regime === 'guest') {
    anticipations.push({
      id: 'ant_guest_welcome',
      action: 'Guest mode — suppress personal alerts',
      trigger_window: 'Active now',
      reason: 'Occupancy spike + guest BLE token detected',
      confidence: 0.82,
      tier: 'T1',
    });
  }

  // ── Device-specific ───────────────────────────────────────────────────────────

  const inverter = Object.values(home?.devices || {}).find(d => d.type === 'inverter');
  if (inverter) {
    anticipations.push({
      id: 'ant_inverter_protection',
      action: 'Inverter dead-man timer — auto-cutoff armed',
      trigger_window: 'Continuous',
      reason: 'Firmware-level protection — survives hub restarts and power cuts',
      confidence: 1.0,
      tier: 'T0',
    });
  }

  return res.json({ home_id, regime, anticipations, generated_at: new Date().toISOString() });
}
