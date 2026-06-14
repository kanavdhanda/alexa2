import { Request, Response } from 'express';
import { stateStore, EventRecord } from '../stateStore';
import { runT0RuleEngine } from '../ruleEngine';
import { runSupervisorAgent } from '../bedrockClient';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Daily Geyser — T0 handles instantly, zero Bedrock cost
// Shows the cost cascade: T3 costs money, T0 is free
// ─────────────────────────────────────────────────────────────────────────────
export async function simulateGeyser(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const outdoor_temp = req.body.outdoor_temp ?? 18;
  // Simulate scenario: morning 6 AM trigger regardless of actual server time
  const simulated_hour = req.body.simulated_hour ?? 6;

  const t0Start = process.hrtime.bigint();

  // Deterministic T0 check (demo: bypass real-time hour)
  const t0Fired = outdoor_temp < 28;
  const t0Latency = `${Number(process.hrtime.bigint() - t0Start) / 1_000_000}ms`;

  if (t0Fired) {
    const t0Result = {
      handled: true,
      tier: 'T0' as const,
      action: 'TURN_ON',
      device_id: 'geyser',
      new_state: 'ON',
      latency: t0Latency,
      rule_id: 'geyser_morning',
      explanation: `Morning timer at ${simulated_hour}:00, outdoor temp ${outdoor_temp}°C < 28°C. Geyser ON per promoted T0 rule (promoted from T3 after 7 days of pattern mining).`,
      cost: '$0.00 (local reflex — promoted from T3)',
    };

    stateStore.updateDevice(home_id, 'geyser', { state: 'ON' });
    stateStore.addEventRecord(home_id, {
      timestamp: new Date().toISOString(),
      event_type: 'sensor_trigger',
      tier: 'T0',
      data: { sensor: 'geyser', sub_type: 'morning_timer', outdoor_temp, simulated_hour },
      action_taken: t0Result,
    });

    return res.json({
      scenario: 'DAILY_GEYSER',
      home_id,
      result_tier: 'T0',
      bedrock_called: false,
      cost_this_event: '$0.00',
      vs_naive_cloud_cost: '~$0.002 USD',
      savings_demo: 'T0 handled this in <1ms. At 1M homes × 365 days = $730,000/year saved vs cloud-everything.',
      latency: t0Latency,
      action: t0Result,
      geyser_state: stateStore.get(home_id).devices['geyser'],
      t0_rule_origin: 'Promoted from T3 after 7-day pattern miner detected: geyser follows weekday alarm by 30min, confidence=0.92',
    });
  }

  return res.json({
    scenario: 'DAILY_GEYSER',
    home_id,
    result_tier: 'T0_SKIPPED',
    reason: `outdoor_temp (${outdoor_temp}°C) >= 28°C — geyser not needed, rule correctly suppressed`,
    bedrock_called: false,
    cost_this_event: '$0.00',
    tip: 'Set outdoor_temp < 28 to trigger geyser automation.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: Amazon Now Escalation — inventory drop triggers T3 + commerce tool
// ─────────────────────────────────────────────────────────────────────────────
export async function simulateInventoryDrop(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const item = req.body.item || 'milk';
  const quantity = req.body.quantity ?? 0.5;
  const unit = req.body.unit || 'liters';
  const threshold = req.body.threshold ?? 1;

  // Update state to reflect the drop
  stateStore.updateInventory(home_id, item, quantity);
  const homeState = stateStore.get(home_id);

  const snapshot = {
    devices: homeState.devices,
    inventory: homeState.inventory,
    recent_events: homeState.event_history.slice(0, 3),
  };

  try {
    const t3Start = Date.now();
    const t3Result = await runSupervisorAgent({
      home_id,
      anomaly_description: `Inventory drop: ${item} is now at ${quantity} ${unit}, below threshold of ${threshold} ${unit}. Consider ordering via Amazon Now for immediate delivery.`,
      home_state_snapshot: snapshot,
      event_data: { item, quantity, unit, threshold, trigger: 'inventory_sensor' },
    });

    stateStore.addEventRecord(home_id, {
      timestamp: new Date().toISOString(),
      event_type: 'inventory_drop',
      tier: 'T3',
      data: { item, quantity, unit, threshold },
      action_taken: t3Result,
    });

    return res.json({
      scenario: 'AMAZON_NOW_ESCALATION',
      home_id,
      result_tier: 'T3',
      bedrock_called: true,
      latency: `${Date.now() - t3Start}ms`,
      item_dropped: { item, quantity, unit, below_threshold: threshold },
      supervisor_result: t3Result,
      home_state: stateStore.get(home_id),
    });
  } catch (err: any) {
    return res.status(500).json({
      scenario: 'AMAZON_NOW_ESCALATION',
      error: err.message,
      note: 'Ensure AWS credentials are set in .env and Bedrock is enabled in your region.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: Zero-Shot Sound Discovery — unknown acoustic embedding
// T3 + CLAP zero-shot + log_new_sound_cluster tool + user prompt
// ─────────────────────────────────────────────────────────────────────────────
export async function simulateUnknownSound(req: Request, res: Response) {
  const home_id = req.body.home_id || 'demo_home_001';
  const embedding_id = req.body.embedding_id || uuidv4();
  const frequency = req.body.frequency || 'daily_6am';
  const clap_guess = req.body.clap_guess || 'metallic beep, possibly electrical equipment';

  const homeState = stateStore.get(home_id);
  const snapshot = { devices: homeState.devices, inventory: homeState.inventory };

  try {
    const t3Start = Date.now();
    const t3Result = await runSupervisorAgent({
      home_id,
      anomaly_description: `Unknown acoustic embedding detected by on-device OOD (Out-of-Distribution) detector.
Embedding ID: ${embedding_id}
CLAP zero-shot description: "${clap_guess}"
Occurrence pattern: ${frequency}
This sound has no matching label in the local YAMNet/AST model.
Cluster this embedding and prepare a user classification prompt.`,
      home_state_snapshot: snapshot,
      event_data: {
        embedding_id,
        frequency,
        clap_description: clap_guess,
        ood_confidence: 0.87,
        embedding_vector_dim: 512,
        first_occurrence: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        occurrence_count: 14,
        raw_audio_retained: false, // Privacy: raw audio never leaves device
      },
    });

    stateStore.addEventRecord(home_id, {
      timestamp: new Date().toISOString(),
      event_type: 'unknown_sound',
      tier: 'T3',
      data: { embedding_id, frequency, clap_guess },
      action_taken: t3Result,
    });

    const clusters = stateStore.get(home_id).sound_clusters;
    return res.json({
      scenario: 'ZERO_SHOT_SOUND_DISCOVERY',
      home_id,
      result_tier: 'T3',
      bedrock_called: true,
      latency: `${Date.now() - t3Start}ms`,
      embedding_id,
      privacy_note: 'Raw audio NEVER left the device. Only the 512-dim embedding vector was forwarded.',
      clap_zero_shot_guess: clap_guess,
      discovery_pipeline: [
        '1. YAMNet/AST on-device: no label match (OOD score 0.87)',
        '2. CLAP zero-shot projection: "' + clap_guess + '"',
        '3. T3 escalation with embedding_id (not audio)',
        '4. Bedrock Supervisor: log_new_sound_cluster tool called',
        '5. User classification prompt queued for next Alexa interaction',
      ],
      sound_clusters_in_home: clusters,
      supervisor_result: t3Result,
    });
  } catch (err: any) {
    return res.status(500).json({
      scenario: 'ZERO_SHOT_SOUND_DISCOVERY',
      error: err.message,
      note: 'Ensure AWS credentials are set in .env and Bedrock is enabled in your region.',
    });
  }
}
