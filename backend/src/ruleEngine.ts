/**
 * T0 Reflex Rule Engine — deterministic, <10ms, zero cloud cost
 * Simulates AWS IoT Events rules that have been promoted from T3 learning
 */

export interface T0Result {
  handled: boolean;
  tier: 'T0';
  action?: string;
  device_id?: string;
  new_state?: string;
  latency?: string;
  rule_id?: string;
  explanation?: string;
  cost?: string;
}

export interface EventPayload {
  home_id: string;
  event_type: string;
  data: Record<string, any>;
}

const startTime = () => process.hrtime.bigint();
const elapsed = (start: bigint) => `${Number(process.hrtime.bigint() - start) / 1_000_000}ms`;

export function runT0RuleEngine(event: EventPayload): T0Result | null {
  const t0 = startTime();
  const { event_type, data } = event;

  // RULE 1: Water motor safety cutoff (actuator-level fail-safe simulation)
  // Architecture ref: "pump's smart-plug firmware shuts off after 45 min"
  if (event_type === 'sensor_trigger' && data.sensor === 'water_motor' && data.duration > 45) {
    return {
      handled: true,
      tier: 'T0',
      action: 'SHUT_OFF',
      device_id: 'water_motor',
      new_state: 'OFF',
      latency: elapsed(t0),
      rule_id: 'water_motor_safety',
      explanation:
        'Water motor has been running for >45 minutes. Actuator-local fail-safe triggered. No cloud required.',
      cost: '$0.00 (local reflex)',
    };
  }

  // RULE 2: Geyser morning automation (regime-gated, promoted T0 rule)
  if (event_type === 'sensor_trigger' && data.sensor === 'geyser' && data.sub_type === 'morning_timer') {
    const hour = new Date().getHours();
    const outdoor_temp = data.outdoor_temp || 25;
    if (hour >= 5 && hour <= 7 && outdoor_temp < 28) {
      return {
        handled: true,
        tier: 'T0',
        action: 'TURN_ON',
        device_id: 'geyser',
        new_state: 'ON',
        latency: elapsed(t0),
        rule_id: 'geyser_morning',
        explanation: `Weekday morning detected (${hour}:00), outdoor temp ${outdoor_temp}°C < 28°C. Activating geyser per learned routine.`,
        cost: '$0.00 (local reflex — promoted from T3 after 7 days of pattern mining)',
      };
    }
  }

  // RULE 3: LPG safety shutoff
  if (event_type === 'sensor_trigger' && data.sensor === 'lpg' && data.leak_detected === true) {
    return {
      handled: true,
      tier: 'T0',
      action: 'EMERGENCY_SHUTOFF',
      device_id: 'lpg_valve',
      new_state: 'CLOSED',
      latency: elapsed(t0),
      rule_id: 'lpg_emergency_shutoff',
      explanation: 'LPG leak detected. Emergency shutoff triggered immediately. No cloud latency tolerated for safety.',
      cost: '$0.00 (local reflex — safety critical)',
    };
  }

  // RULE 4: Pressure cooker whistle count (India-specific: 3 whistles = dal done)
  if (event_type === 'sensor_trigger' && data.sensor === 'sound_event' && data.label === 'pressure_cooker_whistle') {
    const count = data.whistle_count || 1;
    if (count >= 3) {
      return {
        handled: true,
        tier: 'T0',
        action: 'ANNOUNCE',
        device_id: 'alexa_speaker',
        new_state: 'ANNOUNCEMENT',
        latency: elapsed(t0),
        rule_id: 'pressure_cooker_3_whistles',
        explanation: `${count} pressure cooker whistles detected. Dal/rice is likely done. Local announcement triggered.`,
        cost: '$0.00 (local reflex)',
      };
    }
  }

  // RULE 5: Fan auto-off when no presence
  if (
    event_type === 'sensor_trigger' &&
    data.sensor === 'presence' &&
    data.room === 'living_room' &&
    data.occupied === false
  ) {
    return {
      handled: true,
      tier: 'T0',
      action: 'TURN_OFF',
      device_id: 'living_room_fan',
      new_state: 'OFF',
      latency: elapsed(t0),
      rule_id: 'fan_presence_auto_off',
      explanation: 'No presence detected in living room. Fan auto-off rule triggered.',
      cost: '$0.00 (local reflex)',
    };
  }

  return null; // escalate to T3
}

// Determine if an event needs T3 cloud reasoning
export function needsT3Escalation(event: EventPayload): boolean {
  const { event_type, data } = event;

  // Complex voice commands always go to T3
  if (event_type === 'voice_command') return true;

  // Inventory anomalies need commerce agent
  if (event_type === 'inventory_drop') return true;

  // Unknown sounds need clustering + zero-shot discovery
  if (event_type === 'unknown_sound') return true;

  // Multi-device coordination
  if (event_type === 'routine_conflict') return true;

  // Anomaly score above threshold
  if (data?.anomaly_score && data.anomaly_score > 0.7) return true;

  return false;
}
