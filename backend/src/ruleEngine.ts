/**
 * T0 Reflex Rule Engine — dynamic, schema-driven, <10ms, $0
 * Rules come from home.t0_rules (populated by device registration + rule miner + user confirmations)
 * NOT hardcoded — any device type auto-generates its own safety rules on registration.
 */

import { stateStore, HomeState, T0Rule } from './stateStore';

export interface T0Result {
  handled: true;
  tier: 'T0';
  action: string;
  device_id: string;
  property: string;
  new_value: any;
  latency: string;
  rule_id: string;
  explanation: string;
  cost: '$0.00 (local reflex)';
}

export interface EventPayload {
  home_id: string;
  event_type: string;
  data: Record<string, any>;
  room_id?: string;
  speaker_id?: string;
}

// ─── Condition evaluators ─────────────────────────────────────────────────────

type ConditionEvaluator = (params: Record<string, any>, event: EventPayload, home: HomeState) => boolean;

const CONDITION_EVALUATORS: Record<string, ConditionEvaluator> = {

  // "sensor value exceeds threshold" — e.g., duration > 45, battery < 10
  sensor_threshold: (params, event) => {
    const { sensor, property, operator, threshold } = params;
    if (event.event_type !== 'sensor_trigger') return false;
    if (event.data.sensor !== sensor) return false;
    const value = event.data[property];
    if (value === undefined) return false;
    if (operator === 'gt') return value > threshold;
    if (operator === 'lt') return value < threshold;
    if (operator === 'gte') return value >= threshold;
    if (operator === 'lte') return value <= threshold;
    if (operator === 'eq') return value === threshold;
    return false;
  },

  // "device property equals value" — e.g., leak_detected === true
  device_property_eq: (params, event) => {
    if (event.event_type !== 'sensor_trigger') return false;
    if (event.data.sensor !== params.sensor) return false;
    return event.data[params.property] === params.value;
  },

  // "sound event label matches and count threshold"
  sound_event: (params, event) => {
    if (event.event_type !== 'sensor_trigger') return false;
    if (event.data.sensor !== 'sound_event') return false;
    if (event.data.label !== params.label) return false;
    if (params.min_count !== undefined) return (event.data.whistle_count || event.data.count || 1) >= params.min_count;
    return true;
  },

  // "time of day window" — for scheduled automations promoted from T3
  time_of_day: (params, event) => {
    if (event.event_type !== 'sensor_trigger' && event.event_type !== 'scheduled') return false;
    const hour = new Date().getHours();
    const temp = event.data.outdoor_temp ?? 25;
    const inHourWindow = hour >= (params.hour_start ?? 0) && hour <= (params.hour_end ?? 23);
    const tempOk = params.max_temp === undefined || temp < params.max_temp;
    return inHourWindow && tempOk;
  },

  // "room unoccupied for duration" — for fan/light auto-off
  room_unoccupied: (params, event, home) => {
    if (event.event_type !== 'sensor_trigger') return false;
    if (event.data.sensor !== 'presence') return false;
    if (event.data.occupied !== false) return false;
    const room = home.rooms[params.room_id];
    if (!room) return false;
    return room.occupancy.occupied === false;
  },

  // "always" — for fail-safe rules that always fire on a specific event
  always: (params, event) => {
    return event.event_type === params.event_type && event.data.sensor === params.sensor;
  },
};

// ─── T0 engine ────────────────────────────────────────────────────────────────

export function runT0RuleEngine(event: EventPayload): T0Result | null {
  const t0 = process.hrtime.bigint();
  const home = stateStore.get(event.home_id);

  for (const rule of home.t0_rules) {
    // Regime guard: if rule has a regime constraint, only fire in that regime
    if (rule.regime_guard && home.current_regime !== rule.regime_guard) continue;

    const evaluator = CONDITION_EVALUATORS[rule.condition_fn_key];
    if (!evaluator) continue;

    if (evaluator(rule.condition_params, event, home)) {
      // Apply the action
      const { device_id, property, value } = rule.action;
      stateStore.setDeviceProperty(event.home_id, device_id, property, value);

      // Increment trigger count
      rule.trigger_count++;
      stateStore.set(event.home_id, home);

      const latency = `${Number(process.hrtime.bigint() - t0) / 1_000_000}ms`;

      return {
        handled: true,
        tier: 'T0',
        action: value === false || value === 'OFF' ? 'SHUT_OFF' : value === true || value === 'ON' ? 'TURN_ON' : 'SET',
        device_id,
        property,
        new_value: value,
        latency,
        rule_id: rule.rule_id,
        explanation: rule.description,
        cost: '$0.00 (local reflex)',
      };
    }
  }

  return null;
}

// ─── T3 escalation check ─────────────────────────────────────────────────────

export function needsT3Escalation(event: EventPayload): boolean {
  const { event_type, data } = event;
  if (event_type === 'voice_command') return true;
  if (event_type === 'inventory_drop') return true;
  if (event_type === 'unknown_sound') return true;
  if (event_type === 'routine_conflict') return true;
  if (data?.anomaly_score && data.anomaly_score > 0.7) return true;
  return false;
}

// ─── Seed built-in fallback rules (used when no schema rules exist) ───────────

export function ensureBuiltInSafetyRules(home_id: string): void {
  const home = stateStore.get(home_id);
  const existingIds = new Set(home.t0_rules.map(r => r.rule_id));

  const builtIn: T0Rule[] = [
    {
      rule_id: 'builtin_lpg_emergency',
      description: 'LPG leak detected — emergency alert. No actuation (no valve device registered), notify immediately.',
      condition_fn_key: 'device_property_eq',
      condition_params: { sensor: 'lpg', property: 'leak_detected', value: true },
      action: { device_id: 'lpg_sensor', property: 'alarm_active', value: true },
      confidence: 1.0, promoted_from_t3: false, created_at: new Date().toISOString(), trigger_count: 0,
    },
    {
      rule_id: 'builtin_pressure_cooker_3',
      description: 'Pressure cooker 3+ whistles — dal/rice is done, announce to kitchen.',
      condition_fn_key: 'sound_event',
      condition_params: { label: 'pressure_cooker_whistle', min_count: 3 },
      action: { device_id: 'kitchen_exhaust_fan', property: 'power', value: false },
      confidence: 0.95, promoted_from_t3: false, created_at: new Date().toISOString(), trigger_count: 0,
    },
  ];

  let added = false;
  for (const rule of builtIn) {
    if (!existingIds.has(rule.rule_id)) {
      home.t0_rules.push(rule);
      added = true;
    }
  }
  if (added) stateStore.set(home_id, home);
}
