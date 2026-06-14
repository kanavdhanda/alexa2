/**
 * T1 Engine — Local NLU + sound classification layer.
 * Runs in <100ms, zero cloud cost. Handles ~12% of all events.
 */

import { stateStore, DeviceInstance, HomeState } from './stateStore';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface T1Result {
  handled: boolean;
  tier: 'T1';
  intent: string;
  device_id?: string;
  property?: string;
  value?: any;
  latency: string;
  confidence: number;
  explanation: string;
  cost: '$0.00 (local NLU)';
  action_taken?: { device_id: string; property: string; new_value: any };
}

// ─── Intent patterns ──────────────────────────────────────────────────────────

interface IntentPattern {
  patterns: RegExp[];
  intent: string;
  device_type?: string;
  property: string;
  value_fn: (match: RegExpMatchArray, utterance: string) => any;
}

export const SIMPLE_INTENT_PATTERNS: IntentPattern[] = [
  // turn on/off [device]
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?(?:ceiling\s+)?fan\b/i,
      /\bfan\s+on\b/i,
    ],
    intent: 'turn_on_fan',
    device_type: 'fan',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?(?:ceiling\s+)?fan\b/i,
      /\bfan\s+off\b/i,
    ],
    intent: 'turn_off_fan',
    device_type: 'fan',
    property: 'power',
    value_fn: () => false,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?(?:ceiling\s+)?light(?:s)?\b/i,
      /\blights?\s+on\b/i,
    ],
    intent: 'turn_on_light',
    device_type: 'light',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?(?:ceiling\s+)?light(?:s)?\b/i,
      /\blights?\s+off\b/i,
    ],
    intent: 'turn_off_light',
    device_type: 'light',
    property: 'power',
    value_fn: () => false,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?geyser\b/i,
      /\bgeyser\s+on\b/i,
    ],
    intent: 'turn_on_geyser',
    device_type: 'geyser',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?geyser\b/i,
      /\bgeyser\s+off\b/i,
      /\bgeyser\s+band\s+kar\b/i,
    ],
    intent: 'turn_off_geyser',
    device_type: 'geyser',
    property: 'power',
    value_fn: () => false,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?ac\b/i,
      /\bac\s+on\b/i,
      /\bair\s+conditioner\s+on\b/i,
    ],
    intent: 'turn_on_ac',
    device_type: 'ac',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?ac\b/i,
      /\bac\s+off\b/i,
      /\bair\s+conditioner\s+off\b/i,
    ],
    intent: 'turn_off_ac',
    device_type: 'ac',
    property: 'power',
    value_fn: () => false,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?tv\b/i,
      /\btv\s+on\b/i,
      /\btelevision\s+on\b/i,
    ],
    intent: 'turn_on_tv',
    device_type: 'tv',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?tv\b/i,
      /\btv\s+off\b/i,
      /\btelevision\s+off\b/i,
    ],
    intent: 'turn_off_tv',
    device_type: 'tv',
    property: 'power',
    value_fn: () => false,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+on\s+(?:the\s+)?(?:water\s+)?pump\b/i,
      /\bpump\s+on\b/i,
      /\bmotor\s+on\b/i,
    ],
    intent: 'turn_on_pump',
    device_type: 'pump',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [
      /\b(?:turn|switch)\s+off\s+(?:the\s+)?(?:water\s+)?pump\b/i,
      /\bpump\s+off\b/i,
      /\bmotor\s+off\b/i,
      /\bmotor\s+band\s+kar\b/i,
    ],
    intent: 'turn_off_pump',
    device_type: 'pump',
    property: 'power',
    value_fn: () => false,
  },

  // set fan to [speed]
  {
    patterns: [/\bset\s+(?:the\s+)?fan\s+(?:speed\s+)?to\s+(\d)\b/i],
    intent: 'set_fan_speed',
    device_type: 'fan',
    property: 'speed',
    value_fn: (match) => {
      const speed = parseInt(match[1], 10);
      return Math.min(5, Math.max(1, speed));
    },
  },

  // increase / decrease fan speed
  {
    patterns: [/\bincrease\s+(?:the\s+)?fan\s+(?:speed)?\b/i, /\bfan\s+speed\s+up\b/i],
    intent: 'increase_fan_speed',
    device_type: 'fan',
    property: 'speed',
    value_fn: (_match, _utterance) => '__INCREMENT__',
  },
  {
    patterns: [/\bdecrease\s+(?:the\s+)?fan\s+(?:speed)?\b/i, /\bfan\s+speed\s+down\b/i],
    intent: 'decrease_fan_speed',
    device_type: 'fan',
    property: 'speed',
    value_fn: (_match, _utterance) => '__DECREMENT__',
  },

  // set temperature to [N]
  {
    patterns: [/\bset\s+(?:the\s+)?(?:ac\s+)?temperature\s+to\s+(\d{2})\b/i, /\btemperature\s+(\d{2})\s+(?:degrees?)?\b/i],
    intent: 'set_temperature',
    property: 'target_temp',
    value_fn: (match) => parseInt(match[1], 10),
  },
  {
    patterns: [/\bset\s+(?:the\s+)?geyser\s+(?:temperature\s+)?to\s+(\d{2})\b/i],
    intent: 'set_geyser_temperature',
    device_type: 'geyser',
    property: 'target_temp',
    value_fn: (match) => parseInt(match[1], 10),
  },

  // volume controls
  {
    patterns: [/\bvolume\s+up\b/i, /\bincrease\s+(?:the\s+)?volume\b/i, /\blouder\b/i],
    intent: 'volume_up',
    device_type: 'tv',
    property: 'volume',
    value_fn: () => '__INCREMENT__',
  },
  {
    patterns: [/\bvolume\s+down\b/i, /\bdecrease\s+(?:the\s+)?volume\b/i, /\bquieter\b/i, /\blower\s+(?:the\s+)?volume\b/i],
    intent: 'volume_down',
    device_type: 'tv',
    property: 'volume',
    value_fn: () => '__DECREMENT__',
  },
  {
    patterns: [/\bset\s+(?:the\s+)?volume\s+to\s+(\d+)\b/i, /\bvolume\s+(\d+)\b/i],
    intent: 'set_volume',
    device_type: 'tv',
    property: 'volume',
    value_fn: (match) => parseInt(match[1], 10),
  },

  // Hinglish — geyser
  {
    patterns: [/\bgeyser\s+chalu\s+kar\b/i, /\bgeyser\s+on\s+kar\b/i],
    intent: 'turn_on_geyser_hinglish',
    device_type: 'geyser',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [/\bgeyser\s+band\s+kar\b/i, /\bgeyser\s+off\s+kar\b/i],
    intent: 'turn_off_geyser_hinglish',
    device_type: 'geyser',
    property: 'power',
    value_fn: () => false,
  },

  // Hinglish — motor / pump
  {
    patterns: [/\bmotor\s+chalu\s+kar\b/i, /\bmotor\s+on\s+kar\b/i],
    intent: 'turn_on_motor_hinglish',
    device_type: 'pump',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [/\bmotor\s+band\s+kar\b/i, /\bmotor\s+off\s+kar\b/i],
    intent: 'turn_off_motor_hinglish',
    device_type: 'pump',
    property: 'power',
    value_fn: () => false,
  },

  // Hinglish — pankha (fan)
  {
    patterns: [/\bpankha\s+chalu\s+kar\b/i, /\bpankha\s+on\s+kar\b/i, /\bpankha\s+on\b/i],
    intent: 'turn_on_fan_hinglish',
    device_type: 'fan',
    property: 'power',
    value_fn: () => true,
  },
  {
    patterns: [/\bpankha\s+band\s+kar\b/i, /\bpankha\s+off\s+kar\b/i, /\bpankha\s+off\b/i],
    intent: 'turn_off_fan_hinglish',
    device_type: 'fan',
    property: 'power',
    value_fn: () => false,
  },

  // "what time is it" — explicitly not handled, forces T3
  // (no entry — absence means return null)
];

// ─── Sound events ─────────────────────────────────────────────────────────────

type SoundHandler = (
  data: Record<string, any>,
  homeState: HomeState,
  startNs: bigint
) => T1Result | null;

export const KNOWN_SOUND_EVENTS: Record<string, SoundHandler> = {
  pressure_cooker_whistle: (data, _homeState, startNs) => {
    const whistleCount: number = data.whistle_count ?? 1;
    if (whistleCount >= 3) {
      const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
      console.log('[T1] pressure_cooker_whistle: dal ready announcement');
      return {
        handled: true,
        tier: 'T1',
        intent: 'announce_dal_ready',
        latency,
        confidence: 0.95,
        explanation: `Detected ${whistleCount} pressure cooker whistles — dal/food is likely ready.`,
        cost: '$0.00 (local NLU)',
        action_taken: { device_id: 'alexa_speaker', property: 'announcement', new_value: 'dal ready' },
      };
    }
    // fewer than 3 whistles — log but don't act
    console.log(`[T1] pressure_cooker_whistle: only ${whistleCount} whistles, waiting`);
    return {
      handled: true,
      tier: 'T1',
      intent: 'pressure_cooker_whistle_noted',
      latency: `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`,
      confidence: 0.9,
      explanation: `Only ${whistleCount} whistle(s) detected; no action until 3 reached.`,
      cost: '$0.00 (local NLU)',
    };
  },

  doorbell: (_data, _homeState, startNs) => {
    const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
    console.log('[T1] doorbell: someone at the door');
    return {
      handled: true,
      tier: 'T1',
      intent: 'announce_doorbell',
      latency,
      confidence: 0.98,
      explanation: 'Doorbell detected — announcing visitor.',
      cost: '$0.00 (local NLU)',
      action_taken: { device_id: 'alexa_speaker', property: 'announcement', new_value: 'someone at the door' },
    };
  },

  dog_bark: (_data, _homeState, startNs) => {
    const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
    console.log('[T1] dog_bark: logged, no action');
    return {
      handled: true,
      tier: 'T1',
      intent: 'log_dog_bark',
      latency,
      confidence: 0.9,
      explanation: 'Dog bark detected — logged, no escalation needed.',
      cost: '$0.00 (local NLU)',
    };
  },

  baby_cry: (_data, _homeState, startNs) => {
    const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
    console.log('[T1] baby_cry: sending notification to parent');
    return {
      handled: true,
      tier: 'T1',
      intent: 'notify_parent_baby_cry',
      latency,
      confidence: 0.93,
      explanation: 'Baby crying detected — notifying parent.',
      cost: '$0.00 (local NLU)',
      action_taken: { device_id: 'parent_phone', property: 'notification', new_value: 'Baby is crying' },
    };
  },

  // Safety-critical sounds — must escalate to T3
  smoke_alarm: () => null,
  lpg_leak_alarm: () => null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function resolveDeviceByTypeInRoom(
  deviceType: string,
  homeState: HomeState,
  preferredRoomId?: string
): DeviceInstance | null {
  const allDevices = Object.values(homeState.devices);

  // First, try preferred room
  if (preferredRoomId) {
    const inRoom = allDevices.find(
      (d) => d.type === deviceType && d.room_id === preferredRoomId && d.online
    );
    if (inRoom) return inRoom;
  }

  // Fallback: any room
  return allDevices.find((d) => d.type === deviceType && d.online) ?? null;
}

/** Resolve the room_id that a speaker is associated with (best-effort via occupancy). */
function resolvePreferredRoom(homeState: HomeState, speakerRoomHint?: string): string | undefined {
  if (speakerRoomHint) return speakerRoomHint;
  // Return first occupied room as heuristic
  return Object.values(homeState.rooms).find((r) => r.occupancy.occupied)?.room_id;
}

/** Apply increment/decrement sentinel to a property's current numeric value. */
function applyDelta(device: DeviceInstance, property: string, sentinel: string): number {
  const current: number = device.properties[property]?.current_value ?? 0;
  const schema = device.properties[property];
  const step = 1;
  let next = sentinel === '__INCREMENT__' ? current + step : current - step;
  if (schema?.min !== undefined) next = Math.max(schema.min, next);
  if (schema?.max !== undefined) next = Math.min(schema.max, next);
  return next;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runT1Engine(
  event: { home_id: string; event_type: string; data: Record<string, any> },
  homeState: HomeState
): T1Result | null {
  const startNs = process.hrtime.bigint();

  // ── Voice command ─────────────────────────────────────────────────
  if (event.event_type === 'voice_command') {
    const utterance: string = (event.data.utterance ?? '').trim();
    const speakerRoom: string | undefined = event.data.room_id;

    // Explicit no-match for clock queries
    if (/\bwhat\s+(?:is\s+the\s+)?time\b/i.test(utterance)) {
      return null; // let T3 handle
    }

    for (const pattern of SIMPLE_INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = utterance.match(regex);
        if (!match) continue;

        const confidence = 0.88; // local rule match is high-confidence
        if (confidence < 0.8) continue;

        const preferredRoom = resolvePreferredRoom(homeState, speakerRoom);
        let device: DeviceInstance | null = null;

        if (pattern.device_type) {
          device = resolveDeviceByTypeInRoom(pattern.device_type, homeState, preferredRoom);
          if (!device) {
            // Device type required but not found — can't handle
            continue;
          }
        } else {
          // property-only pattern (e.g. set_temperature) — find by property existence
          device =
            Object.values(homeState.devices).find(
              (d) =>
                d.online &&
                d.properties[pattern.property] !== undefined &&
                (preferredRoom ? d.room_id === preferredRoom : true)
            ) ??
            Object.values(homeState.devices).find(
              (d) => d.online && d.properties[pattern.property] !== undefined
            ) ??
            null;
          if (!device) continue;
        }

        let targetValue = pattern.value_fn(match, utterance);

        // Resolve increment/decrement sentinels
        if (targetValue === '__INCREMENT__' || targetValue === '__DECREMENT__') {
          targetValue = applyDelta(device, pattern.property, targetValue);
        }

        // Apply to state
        stateStore.setDeviceProperty(event.home_id, device.device_id, pattern.property, targetValue);

        const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
        return {
          handled: true,
          tier: 'T1',
          intent: pattern.intent,
          device_id: device.device_id,
          property: pattern.property,
          value: targetValue,
          latency,
          confidence,
          explanation: `Matched utterance "${utterance}" with pattern ${pattern.intent} on device ${device.device_id}.`,
          cost: '$0.00 (local NLU)',
          action_taken: { device_id: device.device_id, property: pattern.property, new_value: targetValue },
        };
      }
    }

    return null; // no pattern matched — escalate to T3
  }

  // ── Sound event ───────────────────────────────────────────────────
  if (event.event_type === 'sensor_trigger' && event.data.sensor === 'sound_event') {
    const label: string = event.data.label ?? '';
    const handler = KNOWN_SOUND_EVENTS[label];
    if (!handler) return null; // unknown sound — let T3 classify
    return handler(event.data, homeState, startNs);
  }

  // ── Presence update ───────────────────────────────────────────────
  if (event.event_type === 'presence_update') {
    const { room_id, occupied, confidence, person_count } = event.data as {
      room_id: string;
      occupied: boolean;
      confidence: number;
      person_count?: number;
    };

    if (room_id && homeState.rooms[room_id] !== undefined) {
      stateStore.setOccupancy(event.home_id, room_id, {
        occupied,
        confidence: confidence ?? 1,
        person_count: person_count ?? (occupied ? 1 : 0),
      });
    }

    const latency = `${(Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(2)}ms`;
    return {
      handled: true,
      tier: 'T1',
      intent: 'update_room_occupancy',
      latency,
      confidence: confidence ?? 1,
      explanation: `Room ${room_id} occupancy updated to ${occupied ? 'occupied' : 'unoccupied'}.`,
      cost: '$0.00 (local NLU)',
    };
  }

  // All other event types — escalate
  return null;
}
