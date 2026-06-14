/**
 * Knowledge Packs — static parameterization data for the Bedrock T3 supervisor prompt.
 * Zero AWS cost: pure static data, no network calls.
 */

import type { RoomType, Regime } from './stateStore';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface KnowledgePack {
  pack_id: string;
  room_type: RoomType;
  display_name: string;
  system_prompt_fragment: string;   // injected into Bedrock system prompt
  salient_sounds: string[];         // sound labels this room type should know
  domain_rules: string[];           // text rules for the LLM to respect
  exposed_tools: string[];          // which Bedrock tools are relevant here
  india_context: string[];          // India-specific notes
}

// ─── Pack definitions ─────────────────────────────────────────────────────────

export const KNOWLEDGE_PACKS: Record<string, KnowledgePack> = {

  kitchen_pack: {
    pack_id: 'kitchen_pack',
    room_type: 'kitchen',
    display_name: 'Kitchen',
    system_prompt_fragment:
      'You are managing a kitchen in an Indian household. Be aware of: LPG cylinder usage (typical household uses 1 cylinder per 40-60 days), pressure cooker whistles as cooking signals (3 whistles = dal done, 5-7 = biryani), mixer grinder high-wattage usage, water purifier TDS monitoring, and monsoon-season humidity effects on appliances.',
    salient_sounds: [
      'pressure_cooker_whistle',
      'mixer_grinder',
      'water_boiling',
      'gas_ignition',
      'exhaust_fan',
      'lpg_leak_alarm',
    ],
    domain_rules: [
      'If an LPG leak alarm fires, immediately notify all household members and do not actuate any electrical switches.',
      'Turn on the exhaust fan automatically when the mixer grinder or gas burner has been running for more than 5 minutes.',
      'Alert the user when the estimated LPG level drops below 20% so they can book a refill cylinder in advance (2-day lead time is common).',
      'Do not run the water purifier pump while another high-wattage appliance (mixer grinder, microwave) is active on the same circuit.',
      'Log pressure cooker whistle counts to infer cooking stage; do not interrupt the user while cooking is in progress unless there is a safety alert.',
    ],
    exposed_tools: ['actuate_home_device', 'order_amazon_now', 'send_user_notification'],
    india_context: [
      'LPG cylinder booking: Indane/HP/Bharat Gas — book via app or 1906 IVR 3-5 days before empty.',
      'Water purifier filter life: RO membranes typically last 6-12 months; alert at 80% filter life consumed.',
      'Pressure cooker whistle counting: 3 whistles → dal/lentils done; 5-7 → biryani or meat; 1-2 → vegetables.',
    ],
  },

  bedroom_pack: {
    pack_id: 'bedroom_pack',
    room_type: 'bedroom',
    display_name: 'Bedroom',
    system_prompt_fragment:
      'Managing a bedroom/sleeping area in an Indian household. Context: Geyser pre-heating before morning bath is critical in winter months. AC usage varies dramatically by season (March-June: peak cooling; Nov-Feb: not needed in north India). Power cuts and inverter switchover are common. Mosquito repellent devices are standard.',
    salient_sounds: [
      'alarm',
      'snoring',
      'baby_cry',
      'mosquito_device_beep',
      'ac_drip',
    ],
    domain_rules: [
      'Geyser must never run unattended for more than 45 minutes; fire a dead-man timer and alert the user.',
      'AC target temperature should be set no lower than 24°C during peak summer to balance health and electricity cost (average Indian electricity bill impact is significant below 24°C).',
      'Inverter switchover noise (relay click + brief flicker) is normal; do not raise a fault alert for outages shorter than 5 seconds.',
      'If a baby_cry event is detected between 22:00-06:00, send a gentle notification to the parent speaker profile only.',
      'During sleep regime, suppress all non-critical notifications and dim or turn off smart displays.',
    ],
    exposed_tools: ['actuate_home_device', 'send_user_notification'],
    india_context: [
      'Geyser (water heater) pre-heating: schedule 20-30 min before typical morning wake time in Oct-Feb.',
      'AC seasonal usage: north India — avoid running AC in Nov-Feb; south India — year-round usage is common.',
      'Mosquito repellent devices (All Out / Good Knight) should be powered during dusk-to-dawn hours.',
    ],
  },

  living_room_pack: {
    pack_id: 'living_room_pack',
    room_type: 'living_room',
    display_name: 'Living Room',
    system_prompt_fragment:
      'Managing a living/drawing room in an Indian apartment. Context: This is the social hub. Ceiling fans are used 8-10 months a year. TV and set-top box are primary entertainment. Festival periods mean higher occupancy. Guest presence changes automation preferences significantly.',
    salient_sounds: [
      'doorbell',
      'tv_audio',
      'conversation',
      'vehicle_horn_outside',
      'dog_bark',
    ],
    domain_rules: [
      'Prefer ceiling fan over AC as the default comfort solution — fans consume 70-80W vs 1500W+ for AC and are preferred by most Indian households for cost reasons.',
      'When occupancy is detected, turn on the ceiling fan automatically; turn it off 10 minutes after the room becomes unoccupied.',
      'During festival regime, disable auto-off for lights and entertainment devices — extended social gatherings make automation-induced shutoffs disruptive.',
      'If a guest speaker is detected (unknown voice), switch to guest-friendly defaults: higher ambient light, lower fan speed, no personal notifications on shared devices.',
      'Doorbell events should be routed to all household member notifications immediately, regardless of regime.',
    ],
    exposed_tools: ['actuate_home_device', 'send_user_notification'],
    india_context: [
      'Set-top box (DTH: Tata Play, Airtel DTH, Dish TV) must be powered before TV for the input to sync correctly.',
      'Festival periods (Diwali, Holi, Eid, Christmas) see 30-50% higher occupancy; do not aggressively auto-off during these windows.',
      'Ceiling fans in India typically have 5 speed settings; default to speed 3 for normal occupancy, speed 4 in summer.',
    ],
  },

  bathroom_pack: {
    pack_id: 'bathroom_pack',
    room_type: 'bathroom',
    display_name: 'Bathroom',
    system_prompt_fragment:
      'Managing a bathroom in an Indian household. Geyser/water heater is critical. Water scarcity context: average urban Indian uses 135L/day; bathroom usage is a significant portion. Morning rush hours are 6-8 AM.',
    salient_sounds: [
      'shower_running',
      'exhaust_fan',
      'water_dripping',
    ],
    domain_rules: [
      'Geyser dead-man timer: fire an alert and offer to shut off if the geyser has been on for more than 45 minutes without a shower_running event.',
      'Auto-enable the exhaust fan when humidity in the bathroom exceeds 70% or when shower_running is detected; auto-disable 15 minutes after the shower stops.',
      'During morning rush hours (06:00-08:00), pre-heat the geyser 20 minutes before the first detected wakeup event.',
      'Alert the user if water_dripping is detected for more than 10 continuous minutes without any occupancy — likely a tap left open.',
      'Do not send bathroom-related notifications to guest speaker profiles; route them only to family/owner roles.',
    ],
    exposed_tools: ['actuate_home_device', 'send_user_notification'],
    india_context: [
      'Geyser (storage water heater, 10-25L) is the standard; tankless geysers exist but are less common.',
      'Average Indian shower uses 60-80L; promote water conservation nudges if shower_running exceeds 15 minutes.',
      'Morning peak window is 6-8 AM for most urban households; schedule geyser accordingly.',
    ],
  },

  utility_pack: {
    pack_id: 'utility_pack',
    room_type: 'utility',
    display_name: 'Utility / Service Area',
    system_prompt_fragment:
      'Managing utility/service area in an Indian home. Water motor/pump is critical — overflow causes major damage and wastes scarce water. Inverter/UPS is the first line of defense against power cuts (common 2-8 hours/day in many Indian cities). Monitor battery level proactively.',
    salient_sounds: [
      'motor_running',
      'water_overflow_alarm',
      'inverter_beep',
      'circuit_breaker_trip',
    ],
    domain_rules: [
      'Water motor must never run for more than 45 minutes in a single cycle without a tank level check; auto-shutoff and alert if timer exceeded.',
      'If inverter battery drops below 20%, send an alert immediately so the user can reduce load or arrange for grid power.',
      'Water overflow alarm must trigger an instant critical notification and attempt to shut off the motor via actuate_home_device.',
      'A circuit_breaker_trip event is high-priority; notify the owner immediately and do not attempt to auto-reset.',
      'Inverter beep patterns: 1 beep = low battery warning, continuous beep = overload or fault — log pattern and escalate accordingly.',
    ],
    exposed_tools: ['actuate_home_device', 'order_amazon_now', 'send_user_notification'],
    india_context: [
      'Power cuts (load shedding) are common in many Indian cities: 2-8 hours/day in tier-2/3 cities; inverter is essential.',
      'Water motor runtime: typical 1000L overhead tank fills in 20-30 minutes with a 0.5HP motor.',
      'Inverter battery maintenance: most Indian homes use tubular lead-acid batteries; distilled water refill is needed every 3-6 months.',
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_TYPE_TO_PACK_ID: Record<RoomType, string> = {
  kitchen:     'kitchen_pack',
  bedroom:     'bedroom_pack',
  living_room: 'living_room_pack',
  bathroom:    'bathroom_pack',
  utility:     'utility_pack',
  // Fallbacks for unmapped types
  balcony:     'living_room_pack',
  study:       'bedroom_pack',
  other:       'living_room_pack',
};

/**
 * Returns the KnowledgePack for a given room type.
 * Falls back to the living_room_pack for unmapped types.
 */
export function getPackForRoom(room_type: RoomType): KnowledgePack {
  const pack_id = ROOM_TYPE_TO_PACK_ID[room_type] ?? 'living_room_pack';
  return KNOWLEDGE_PACKS[pack_id];
}

/**
 * Assembles a concise (300-word max) context string from the knowledge pack
 * and current regime to inject into the Bedrock T3 system prompt.
 */
export function buildSystemPromptContext(room_type: RoomType, regime: string): string {
  const pack = getPackForRoom(room_type);

  const regime_notes: Record<string, string> = {
    festival: 'REGIME NOTE: Festival period active. Learning is paused; do not promote new automations.',
    guest:    'REGIME NOTE: Guest present. Require explicit confirmation for personal or sensitive actions.',
    sleep:    'REGIME NOTE: Sleeping mode. Minimize notifications and keep all actuations quiet.',
    away:     'REGIME NOTE: Home is empty. Security is the top priority; flag any unexpected activity.',
    normal:   'REGIME NOTE: Normal operation.',
  };

  const regime_note = regime_notes[regime] ?? regime_notes['normal'];

  const rules_text = pack.domain_rules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n');

  const india_text = pack.india_context.join(' | ');

  const context = [
    `=== ${pack.display_name.toUpperCase()} CONTEXT ===`,
    pack.system_prompt_fragment,
    '',
    'DOMAIN RULES:',
    rules_text,
    '',
    'INDIA CONTEXT:',
    india_text,
    '',
    regime_note,
  ].join('\n');

  // Truncate to approximately 300 words (safety guard)
  const words = context.split(/\s+/);
  if (words.length > 300) {
    return words.slice(0, 300).join(' ') + '...';
  }
  return context;
}
