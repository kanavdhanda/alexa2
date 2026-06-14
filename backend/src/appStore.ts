/**
 * App Store — MCP Module Registry
 *
 * Each module is a device-specific adapter that extends the generic device type with:
 * - Brand/model-specific property schemas
 * - Pre-tuned T0 safety rules
 * - T1 NLU intent patterns (Hinglish included)
 * - Knowledge pack fragment (India-specific Bedrock context)
 * - Demo event samples for instant testing
 *
 * Architecture reference §2.2: "Capability interpretation for a novel device is a
 * pairing-time, cached, one-shot job (ontology map, or one Bedrock call generating an adapter)."
 * This store is that cache.
 */

import { DevicePropertySchema, SafetyClass, McpCapability, T0Rule } from './stateStore';

// ─── Module schema ────────────────────────────────────────────────────────────

export type ModuleCategory =
  | 'climate'
  | 'water'
  | 'energy'
  | 'security'
  | 'entertainment'
  | 'kitchen'
  | 'lighting'
  | 'sensor'
  | 'india_specific';

export interface DemoEventSample {
  name: string;
  description: string;
  event: { event_type: string; data: Record<string, any> };
  expected_tier: 'T0' | 'T1' | 'T3';
  expected_action?: string;
}

export interface AutoT0RuleSpec {
  rule_id_suffix: string;
  description: string;
  condition_fn_key: string;
  condition_params_fn: (device_id: string) => Record<string, any>;
  action_property: string;
  action_value: any;
  confidence: number;
}

export interface AppStoreModule {
  module_id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: ModuleCategory;

  // Matching
  device_type: string;          // maps to deviceRegistry base type
  brand: string;
  model_pattern?: string;       // regex string to match model numbers
  tags: string[];

  // Store metadata
  downloads: number;
  rating: number;               // 1-5
  verified: boolean;
  published_at: string;

  // MCP definition — the actual adapter
  mcp_definition: {
    capabilities: McpCapability[];
    safety_class: SafetyClass;
    property_schemas: Record<string, DevicePropertySchema>;
    dead_man_timer_minutes?: number;
    auto_t0_rules: AutoT0RuleSpec[];
    knowledge_pack_fragment: string;   // injected into Bedrock system prompt
    t1_intents: string[];              // regex patterns for local NLU
    default_property_values: Record<string, any>;
  };

  demo_event_samples: DemoEventSample[];
}

// ─── Sample modules ───────────────────────────────────────────────────────────

const SAMPLE_MODULES: AppStoreModule[] = [

  // ── 1. Daikin Inverter AC ──────────────────────────────────────────────────
  {
    module_id: 'daikin-inverter-ac-v2',
    name: 'Daikin Inverter AC',
    description: 'Full adapter for Daikin split/window inverter ACs. Includes self-cleaning mode, humidity sensing, sleep curve, and energy star tracking. India-tuned: handles 40°C+ ambient, 150V–285V voltage fluctuation protection, and monsoon humidity spikes.',
    version: '2.1.0',
    author: 'Alexa+ India Community',
    category: 'climate',
    device_type: 'ac',
    brand: 'Daikin',
    model_pattern: 'FTKG|FTKM|FTKG|ATKL|ATL',
    tags: ['ac', 'inverter', 'daikin', 'climate', 'energy-star'],
    downloads: 4821,
    rating: 4.8,
    verified: true,
    published_at: '2025-11-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'act', 'state'],
      safety_class: 'STANDARD',
      property_schemas: {
        power:              { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        mode:               { type: 'enum',    actuatable: true,  observable: true,  enum_values: ['cool','heat','fan','dry','auto'], default_value: 'cool' },
        target_temp:        { type: 'number',  actuatable: true,  observable: true,  min: 16, max: 30, unit: '°C', default_value: 24 },
        fan_speed:          { type: 'enum',    actuatable: true,  observable: true,  enum_values: ['auto','quiet','low','medium','high'], default_value: 'auto' },
        current_temp:       { type: 'number',  actuatable: false, observable: true,  unit: '°C', default_value: 32 },
        humidity_percent:   { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 60 },
        self_clean_active:  { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        sleep_mode:         { type: 'boolean', actuatable: true,  observable: false, default_value: false },
        energy_kwh_today:   { type: 'number',  actuatable: false, observable: true,  unit: 'kWh', default_value: 0 },
        voltage_input:      { type: 'number',  actuatable: false, observable: true,  unit: 'V', default_value: 220 },
        error_code:         { type: 'string',  actuatable: false, observable: true,  default_value: 'NONE' },
      },
      dead_man_timer_minutes: undefined,
      auto_t0_rules: [
        {
          rule_id_suffix: 'voltage_protection',
          description: 'Auto power-off on low voltage to prevent compressor damage (India voltage fluctuation)',
          condition_fn_key: 'property_lt',
          condition_params_fn: (device_id) => ({ device_id, property: 'voltage_input', threshold: 150 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'sleep_mode_night',
          description: 'Enable sleep mode after 11 PM to gradually raise temp and save power',
          condition_fn_key: 'time_of_day',
          condition_params_fn: (_device_id) => ({ hour_start: 23, hour_end: 6 }),
          action_property: 'sleep_mode',
          action_value: true,
          confidence: 0.8,
        },
      ],
      knowledge_pack_fragment: 'Daikin inverter AC in Indian climate: typical use is 22-26°C target. In summer (Mar-Jun) ambient can reach 45°C — compressor works harder, energy_kwh_today can reach 8-12 kWh. Monsoon: humidity spikes to 85-95%, use "dry" mode. Power cuts are common — track voltage_input, auto-off below 150V prevents compressor damage. Self-clean mode should run monthly. In north India winter (Nov-Feb), "heat" mode may be needed.',
      t1_intents: [
        'turn (on|off) (the )?(AC|air condition|daikin)',
        'set (AC|temperature|temp) to (\\d+)',
        '(AC|daikin) (thanda kar|garam kar|band kar|chalu kar)',
        'sleep mode (on|off)',
        'start self clean',
      ],
      default_property_values: { power: false, mode: 'cool', target_temp: 24, fan_speed: 'auto', current_temp: 32 },
    },
    demo_event_samples: [
      { name: 'Low voltage shutdown', description: 'Voltage drops below 150V — T0 auto-off protects compressor', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', voltage_input: 140 } }, expected_tier: 'T0', expected_action: 'SHUT_OFF' },
      { name: 'Voice: set temp', description: 'T1 local NLU handles temp change', event: { event_type: 'voice_command', data: { utterance: 'set AC to 22 degrees' } }, expected_tier: 'T1' },
      { name: 'High humidity', description: 'Monsoon humidity spike → suggest dry mode via T3', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', humidity_percent: 92 } }, expected_tier: 'T3' },
    ],
  },

  // ── 2. Havells Swing Ceiling Fan ──────────────────────────────────────────
  {
    module_id: 'havells-ceiling-fan-v1',
    name: 'Havells Ceiling Fan (Smart)',
    description: 'Adapter for Havells smart ceiling fans with BLE/WiFi. Controls speed (6 levels), sleep timer, boost mode, and energy tracking. India-specific: handles 40V–270V input, monsoon-season speed override.',
    version: '1.3.0',
    author: 'Havells Official',
    category: 'climate',
    device_type: 'fan',
    brand: 'Havells',
    model_pattern: 'LEGANZA|FLORENCE|SPRINT|FETCH',
    tags: ['fan', 'havells', 'ceiling-fan', 'smart', 'bldc'],
    downloads: 7204,
    rating: 4.6,
    verified: true,
    published_at: '2025-09-15T00:00:00Z',
    mcp_definition: {
      capabilities: ['act', 'state'],
      safety_class: 'CONVENIENCE',
      property_schemas: {
        power:         { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        speed:         { type: 'number',  actuatable: true,  observable: true,  min: 0, max: 6, unit: 'level', default_value: 0 },
        direction:     { type: 'enum',    actuatable: true,  observable: false, enum_values: ['forward','reverse'], default_value: 'forward' },
        timer_minutes: { type: 'number',  actuatable: true,  observable: false, min: 0, max: 480, unit: 'min', default_value: 0 },
        boost_mode:    { type: 'boolean', actuatable: true,  observable: false, default_value: false },
        wattage:       { type: 'number',  actuatable: false, observable: true,  unit: 'W', default_value: 0 },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'presence_auto_off',
          description: 'Auto-off when no presence detected in room (saves power)',
          condition_fn_key: 'room_unoccupied',
          condition_params_fn: (device_id) => ({ device_id }),
          action_property: 'power',
          action_value: false,
          confidence: 0.88,
        },
      ],
      knowledge_pack_fragment: 'Havells BLDC fans are 5x more efficient than regular induction fans (28W vs 75W at full speed). In Indian summers, fan+cooler combination is preferred over AC for cost. Reverse direction (winter mode) circulates warm air from ceiling. Boost mode (speed 6) used during power cuts when battery backup is on.',
      t1_intents: [
        'turn (on|off) (the )?(fan|pankha)',
        'fan (speed )?(1|2|3|4|5|6|low|medium|high)',
        'pankha (band kar|chalu kar|tez kar|slow kar)',
        'increase|decrease fan speed',
        'fan (timer|sleep) (\\d+) (min|minutes|hour)',
        'boost mode (on|off)',
      ],
      default_property_values: { power: false, speed: 0, direction: 'forward' },
    },
    demo_event_samples: [
      { name: 'Presence auto-off', description: 'No one in room → fan auto-off T0 rule', event: { event_type: 'sensor_trigger', data: { sensor: 'presence', room: 'living_room', occupied: false } }, expected_tier: 'T0', expected_action: 'SHUT_OFF' },
      { name: 'Voice speed change', description: 'T1: set fan to speed 4', event: { event_type: 'voice_command', data: { utterance: 'set fan to speed 4' } }, expected_tier: 'T1' },
    ],
  },

  // ── 3. Venus Magnum Geyser ────────────────────────────────────────────────
  {
    module_id: 'venus-magnum-geyser-v1',
    name: 'Venus Magnum Water Heater',
    description: 'Full adapter for Venus Magnum storage geysers (6L–25L). Anti-scale ceramic coating status, anode rod health, temperature safety valve monitoring. India-critical: hard water scaling (common in Delhi NCR, Rajasthan) reduces life by 40% — tracks limescale accumulation.',
    version: '1.5.0',
    author: 'Venus Home Appliances',
    category: 'water',
    device_type: 'geyser',
    brand: 'Venus',
    model_pattern: 'Magnum|DG|Premia|Handy',
    tags: ['geyser', 'venus', 'water-heater', 'hard-water', 'safety'],
    downloads: 3109,
    rating: 4.5,
    verified: true,
    published_at: '2025-10-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'act', 'state'],
      safety_class: 'CRITICAL',
      property_schemas: {
        power:              { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        target_temp:        { type: 'number',  actuatable: true,  observable: true,  min: 35, max: 75, unit: '°C', default_value: 55 },
        current_temp:       { type: 'number',  actuatable: false, observable: true,  unit: '°C', default_value: 25 },
        duration_minutes:   { type: 'number',  actuatable: false, observable: true,  min: 0, max: 120, unit: 'min', default_value: 0 },
        thermostat_tripped: { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        scale_level:        { type: 'enum',    actuatable: false, observable: true,  enum_values: ['none','low','medium','high','critical'], default_value: 'none' },
        anode_health:       { type: 'enum',    actuatable: false, observable: true,  enum_values: ['good','replace_soon','critical'], default_value: 'good' },
        capacity_liters:    { type: 'number',  actuatable: false, observable: false, unit: 'L', default_value: 15 },
      },
      dead_man_timer_minutes: 45,
      auto_t0_rules: [
        {
          rule_id_suffix: 'deadman_45min',
          description: 'Auto power-off after 45 minutes — safety critical, prevents dry heating',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'thermostat_trip',
          description: 'Auto-off on thermostat safety trip — prevents boiling',
          condition_fn_key: 'property_eq',
          condition_params_fn: (device_id) => ({ device_id, property: 'thermostat_tripped', value: true }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'scale_critical_alert',
          description: 'Critical limescale detected — escalate for descaling recommendation',
          condition_fn_key: 'property_eq',
          condition_params_fn: (device_id) => ({ device_id, property: 'scale_level', value: 'critical' }),
          action_property: 'power',
          action_value: false,
          confidence: 0.95,
        },
      ],
      knowledge_pack_fragment: 'Venus Magnum geyser in Indian hard water context: Delhi/NCR water has TDS 300-800ppm causing heavy scaling. Scale_level "high" reduces efficiency by 30%, "critical" can cause tank explosion (rare but documented). Anode rod must be replaced every 2-3 years in hard water areas. Typical morning heating: 15L takes 20-25 min to reach 55°C. Auto-off at 45 min is safety-critical — dry heating destroys element. Morning routine: on at 6AM, ready by 6:25AM for shower.',
      t1_intents: [
        'turn (on|off) (the )?(geyser|water heater|boiler)',
        'geyser (chalu kar|band kar|on kar|off kar)',
        '(set |)geyser (temperature|temp) to (\\d+)',
        'geyser kitna garam hai',
      ],
      default_property_values: { power: false, target_temp: 55, current_temp: 25, duration_minutes: 0 },
    },
    demo_event_samples: [
      { name: '45-min safety shutoff', description: 'Dead-man timer fires at 45 min — prevents dry heating', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', duration: 50 } }, expected_tier: 'T0', expected_action: 'SHUT_OFF' },
      { name: 'Scale level critical', description: 'Hard water damage — T3 escalates for descaling advice', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', scale_level: 'critical' } }, expected_tier: 'T0' },
    ],
  },

  // ── 4. Kirloskar Star-1 Water Pump ───────────────────────────────────────
  {
    module_id: 'kirloskar-star1-pump-v1',
    name: 'Kirloskar Star-1 Water Pump',
    description: 'Adapter for Kirloskar monoblock pumps — most common in Indian apartments. Monitors dry-run protection, tank level, pressure, and motor temperature. Integrates with float valve sensor for auto-stop on tank full. The #1 cause of water damage in Indian apartments — critical dead-man at 45 min.',
    version: '2.0.0',
    author: 'Kirloskar Brothers',
    category: 'water',
    device_type: 'water_pump',
    brand: 'Kirloskar',
    model_pattern: 'STAR|STAR-1|STAR-2|NOVA|CHOS',
    tags: ['pump', 'kirloskar', 'water-motor', 'tank', 'critical'],
    downloads: 9432,
    rating: 4.9,
    verified: true,
    published_at: '2025-08-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'act', 'state'],
      safety_class: 'CRITICAL',
      property_schemas: {
        power:              { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        duration_minutes:   { type: 'number',  actuatable: false, observable: true,  min: 0, max: 90, unit: 'min', default_value: 0 },
        tank_level_percent: { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 30 },
        pressure_psi:       { type: 'number',  actuatable: false, observable: true,  unit: 'PSI', default_value: 0 },
        motor_temp_c:       { type: 'number',  actuatable: false, observable: true,  unit: '°C', default_value: 25 },
        dry_run_detected:   { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        current_amps:       { type: 'number',  actuatable: false, observable: true,  unit: 'A', default_value: 0 },
      },
      dead_man_timer_minutes: 45,
      auto_t0_rules: [
        {
          rule_id_suffix: 'deadman_45min',
          description: 'Auto-off after 45 min — tank cannot overflow, prevents motor burnout',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'tank_full_auto_stop',
          description: 'Tank level 95%+ — stop pump before overflow',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'tank_level_percent', threshold: 95 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'dry_run_protection',
          description: 'Dry run detected — immediate shutoff to prevent motor burnout',
          condition_fn_key: 'property_eq',
          condition_params_fn: (device_id) => ({ device_id, property: 'dry_run_detected', value: true }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'motor_overheat',
          description: 'Motor temperature above 70°C — auto-off to prevent winding damage',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'motor_temp_c', threshold: 70 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
      ],
      knowledge_pack_fragment: 'Kirloskar Star pump in Indian apartment context: municipal water supply is typically 1-3 hours daily (morning 6-8AM, evening 5-7PM). Tank filling takes 20-40 min for 500L tank. Overflow is a common problem causing damage to lower-floor flats — society rules often mandate motor timers. Dry run (no water in supply) is common during peak hours — burns motor windings. Monsoon: building tanks fill faster, often 15-20 min enough. Tanker booking (water scarcity areas) needs manual timing.',
      t1_intents: [
        'turn (on|off) (the )?(motor|pump|water motor|pani motor)',
        'motor (chalu kar|band kar|on kar|off kar)',
        'tank kitna bhara hai',
        'start|stop (the )?(pump|motor)',
      ],
      default_property_values: { power: false, duration_minutes: 0, tank_level_percent: 30 },
    },
    demo_event_samples: [
      { name: 'Tank full auto-stop', description: 'Tank hits 95% — T0 stops pump immediately', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', tank_level_percent: 97 } }, expected_tier: 'T0', expected_action: 'SHUT_OFF' },
      { name: '45-min deadman', description: 'Safety shutoff at 45 min', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', duration: 50 } }, expected_tier: 'T0' },
      { name: 'Dry run', description: 'No water in supply — immediate motor protection', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', dry_run_detected: true } }, expected_tier: 'T0' },
    ],
  },

  // ── 5. Eureka Forbes Aquaguard RO ─────────────────────────────────────────
  {
    module_id: 'eureka-forbes-aquaguard-v1',
    name: 'Eureka Forbes Aquaguard RO',
    description: 'Complete adapter for Aquaguard/Dr. Aquaguard series. Real-time TDS monitoring, UV lamp life, RO membrane health, sediment filter status. India-critical: avg Indian tap water TDS 200-800ppm vs WHO guideline of 300ppm.',
    version: '1.2.0',
    author: 'Eureka Forbes',
    category: 'water',
    device_type: 'ro_purifier',
    brand: 'Eureka Forbes',
    model_pattern: 'Aquaguard|Dr.Aquaguard|Superb|Enhance|Marvel',
    tags: ['ro', 'purifier', 'eureka-forbes', 'tds', 'water-quality'],
    downloads: 5670,
    rating: 4.4,
    verified: true,
    published_at: '2025-07-15T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'state'],
      safety_class: 'STANDARD',
      property_schemas: {
        power:               { type: 'boolean', actuatable: true,  observable: true,  default_value: true },
        input_tds_ppm:       { type: 'number',  actuatable: false, observable: true,  unit: 'ppm', default_value: 350 },
        output_tds_ppm:      { type: 'number',  actuatable: false, observable: true,  unit: 'ppm', default_value: 38 },
        uv_lamp_hours:       { type: 'number',  actuatable: false, observable: true,  unit: 'hr', default_value: 0 },
        ro_membrane_life:    { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 85 },
        sediment_filter_life: { type: 'number', actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 72 },
        carbon_filter_life:  { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 68 },
        dispensing:          { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        tank_full:           { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        alerts:              { type: 'string',  actuatable: false, observable: true,  default_value: 'NONE' },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'uv_lamp_expired',
          description: 'UV lamp exceeded 8000 hours — water not safe without UV protection',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'uv_lamp_hours', threshold: 8000 }),
          action_property: 'power',
          action_value: false,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'output_tds_high',
          description: 'Output TDS above 150ppm — membrane failure, water may not be safe',
          condition_fn_key: 'property_gt',
          condition_params_fn: (device_id) => ({ device_id, property: 'output_tds_ppm', threshold: 150 }),
          action_property: 'alerts',
          action_value: 'MEMBRANE_FAILURE',
          confidence: 0.95,
        },
      ],
      knowledge_pack_fragment: 'Eureka Forbes Aquaguard in Indian water context: Municipal TDS varies wildly (Delhi: 400-700ppm, Bangalore: 100-250ppm, Chennai: 500-900ppm). RO rejection ratio is 3:1 — 3L wasted per 1L purified, important in water-scarce areas. UV lamp must be replaced at 8000 hours (~18 months). Sediment filter: every 6 months in high-TDS areas. AMC (Annual Maintenance Contract) is common — users often forget filter replacement dates.',
      t1_intents: [
        'pani ka TDS kitna hai',
        'water (quality|TDS) check',
        'filter (life|status)',
        'RO (on|off)',
      ],
      default_property_values: { power: true, input_tds_ppm: 350, output_tds_ppm: 38 },
    },
    demo_event_samples: [
      { name: 'High output TDS', description: 'Membrane failing — output TDS above 150ppm triggers alert', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', output_tds_ppm: 180 } }, expected_tier: 'T0' },
      { name: 'UV lamp expired', description: 'Safety shutoff at 8000+ hours', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', uv_lamp_hours: 8500 } }, expected_tier: 'T0' },
    ],
  },

  // ── 6. Luminous Zelio WiFi Inverter ──────────────────────────────────────
  {
    module_id: 'luminous-zelio-inverter-v2',
    name: 'Luminous Zelio WiFi Inverter',
    description: 'Full adapter for Luminous Zelio series (850VA-2KVA) with WiFi module. Battery health tracking, solar MPPT input, load prioritization, and India-specific power cut prediction using local DISCOM schedule data. Critical for apartments with 2-8 hr daily cuts.',
    version: '2.3.0',
    author: 'Luminous Power Technologies',
    category: 'energy',
    device_type: 'inverter',
    brand: 'Luminous',
    model_pattern: 'Zelio|Eco Volt|Rapid Charge|iCruze',
    tags: ['inverter', 'luminous', 'ups', 'solar', 'power-cut'],
    downloads: 11203,
    rating: 4.7,
    verified: true,
    published_at: '2025-06-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'act', 'state'],
      safety_class: 'STANDARD',
      property_schemas: {
        on_battery:          { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        battery_percent:     { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 78 },
        battery_voltage:     { type: 'number',  actuatable: false, observable: true,  unit: 'V', default_value: 12.8 },
        battery_health:      { type: 'enum',    actuatable: false, observable: true,  enum_values: ['excellent','good','fair','poor','replace'], default_value: 'good' },
        load_watts:          { type: 'number',  actuatable: false, observable: true,  unit: 'W', default_value: 0 },
        input_voltage:       { type: 'number',  actuatable: false, observable: true,  unit: 'V', default_value: 230 },
        solar_watts:         { type: 'number',  actuatable: false, observable: true,  unit: 'W', default_value: 0 },
        estimated_backup_hr: { type: 'number',  actuatable: false, observable: true,  unit: 'hr', default_value: 4.5 },
        charge_mode:         { type: 'enum',    actuatable: true,  observable: true,  enum_values: ['normal','fast','float','solar_priority'], default_value: 'normal' },
        load_shedding_mode:  { type: 'boolean', actuatable: true,  observable: false, default_value: false },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'battery_critical',
          description: 'Battery below 10% — enable load shedding to extend backup time',
          condition_fn_key: 'property_lt',
          condition_params_fn: (device_id) => ({ device_id, property: 'battery_percent', threshold: 10 }),
          action_property: 'load_shedding_mode',
          action_value: true,
          confidence: 0.95,
        },
      ],
      knowledge_pack_fragment: 'Luminous inverter in Indian power context: most UP/Bihar/Odisha households face 4-8 hr daily cuts; metro areas 1-2 hr. Battery backup at 78% charge and 800W load = ~4.5 hr. Common connected loads: 3 fans (180W) + lights (100W) + WiFi (20W) + phone charging (30W) = 330W minimum. Solar input in summer: 10AM-4PM typically 300-600W (reduces grid dependence). Battery health degrades faster in hot climates (Chennai/Hyderabad) — needs more frequent water topping in tubular batteries.',
      t1_intents: [
        'inverter battery (kitni hai|percent|status)',
        'kitna backup hai|how much backup',
        'solar (input|charging) kitna hai',
        'load shedding (on|off)',
      ],
      default_property_values: { on_battery: false, battery_percent: 78, battery_health: 'good', load_watts: 0 },
    },
    demo_event_samples: [
      { name: 'Power cut begins', description: 'Grid fails — inverter switches to battery', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', on_battery: true, input_voltage: 0 } }, expected_tier: 'T1' },
      { name: 'Battery critical', description: 'Below 10% — T0 enables load shedding', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', battery_percent: 8 } }, expected_tier: 'T0' },
      { name: 'Battery health poor', description: 'T3 suggests replacement + nearest battery shop', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', battery_health: 'replace' } }, expected_tier: 'T3' },
    ],
  },

  // ── 7. Prestige IRIS IoT Pressure Cooker ─────────────────────────────────
  {
    module_id: 'prestige-iris-cooker-v1',
    name: 'Prestige IRIS IoT Pressure Cooker',
    description: 'India-first: IoT monitor for Prestige IRIS smart pressure cooker. Counts whistles acoustically, tracks cooking temperature, estimates food readiness by recipe. The most iconic India-specific smart home device — pressure cooker whistles are a universal cooking signal.',
    version: '1.0.0',
    author: 'TTK Prestige',
    category: 'kitchen',
    device_type: 'pressure_cooker_monitor',
    brand: 'Prestige',
    model_pattern: 'IRIS|CLIP-ON|TPC',
    tags: ['pressure-cooker', 'prestige', 'cooking', 'whistle', 'india-specific'],
    downloads: 6891,
    rating: 4.9,
    verified: true,
    published_at: '2025-12-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense'],
      safety_class: 'STANDARD',
      property_schemas: {
        whistle_count:    { type: 'number',  actuatable: false, observable: true,  min: 0, max: 30, default_value: 0 },
        on_stove:         { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        internal_temp_c:  { type: 'number',  actuatable: false, observable: true,  unit: '°C', default_value: 25 },
        pressure_bar:     { type: 'number',  actuatable: false, observable: true,  unit: 'bar', default_value: 0 },
        cooking_complete: { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        recipe_name:      { type: 'string',  actuatable: true,  observable: false, default_value: '' },
        expected_whistles: { type: 'number', actuatable: true,  observable: false, min: 1, max: 20, default_value: 3 },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'dal_3_whistles',
          description: '3 whistles — dal/chana is done, announce to kitchen',
          condition_fn_key: 'sound_event',
          condition_params_fn: (_device_id) => ({ label: 'pressure_cooker_whistle', min_count: 3 }),
          action_property: 'cooking_complete',
          action_value: true,
          confidence: 0.92,
        },
        {
          rule_id_suffix: 'biryani_7_whistles',
          description: '7 whistles — biryani/mutton done, announce',
          condition_fn_key: 'sound_event',
          condition_params_fn: (_device_id) => ({ label: 'pressure_cooker_whistle', min_count: 7 }),
          action_property: 'cooking_complete',
          action_value: true,
          confidence: 0.88,
        },
      ],
      knowledge_pack_fragment: 'Prestige IRIS cooker in Indian kitchen: pressure cooker is used in 95% of Indian households daily. Whistle-based cooking is universal — dal=3 whistles, rice=2 whistles, rajma/chole=8 whistles, biryani=7 whistles (varies by recipe/region). After 3 whistles, announce "dal ready" and suggest turning off gas or lowering to sim. South India: idli/sambar prep also uses cooker with different whistle patterns. Important: never open cooker before pressure drops — announce "wait 10 minutes before opening".',
      t1_intents: [
        'cooker mein dal ready hai kya',
        'kitni seeti baj gayi',
        'pressure cooker (check|status)',
        'recipe (set|start|stop)',
      ],
      default_property_values: { whistle_count: 0, on_stove: false, internal_temp_c: 25 },
    },
    demo_event_samples: [
      { name: 'Dal done (3 whistles)', description: 'T0 announces cooking complete at 3 whistles', event: { event_type: 'sensor_trigger', data: { sensor: 'sound_event', label: 'pressure_cooker_whistle', whistle_count: 3 } }, expected_tier: 'T0', expected_action: 'ANNOUNCE' },
      { name: 'Ask what to cook', description: 'T3: voice query about recipe whistle count', event: { event_type: 'voice_command', data: { utterance: 'how many whistles for rajma' } }, expected_tier: 'T3' },
    ],
  },

  // ── 8. Crompton SenseHub Smart LED ───────────────────────────────────────
  {
    module_id: 'crompton-sensehub-bulb-v1',
    name: 'Crompton SenseHub Smart LED',
    description: 'Adapter for Crompton SenseHub WiFi smart bulbs. Full RGB + CCT (warm to cool white), scene management, circadian rhythm scheduling, and energy tracking. India-specific: Diwali mode, festival color presets.',
    version: '1.1.0',
    author: 'Crompton Greaves',
    category: 'lighting',
    device_type: 'light',
    brand: 'Crompton',
    model_pattern: 'SenseHub|LDECRP|LDECPR',
    tags: ['light', 'crompton', 'rgb', 'smart-bulb', 'festival'],
    downloads: 3445,
    rating: 4.3,
    verified: true,
    published_at: '2025-09-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['act', 'state'],
      safety_class: 'CONVENIENCE',
      property_schemas: {
        power:       { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        brightness:  { type: 'number',  actuatable: true,  observable: true,  min: 1, max: 100, unit: '%', default_value: 80 },
        color_temp:  { type: 'number',  actuatable: true,  observable: true,  min: 2700, max: 6500, unit: 'K', default_value: 4000 },
        red:         { type: 'number',  actuatable: true,  observable: false, min: 0, max: 255, default_value: 255 },
        green:       { type: 'number',  actuatable: true,  observable: false, min: 0, max: 255, default_value: 255 },
        blue:        { type: 'number',  actuatable: true,  observable: false, min: 0, max: 255, default_value: 255 },
        scene:       { type: 'enum',    actuatable: true,  observable: false, enum_values: ['normal','movie','reading','sleep','diwali','meditation','party','sunrise'], default_value: 'normal' },
        wattage:     { type: 'number',  actuatable: false, observable: true,  unit: 'W', default_value: 0 },
      },
      auto_t0_rules: [],
      knowledge_pack_fragment: 'Crompton SenseHub in Indian home: Diwali season (October-November) = festival lighting mode with warm amber/gold. Pooja room: warm white 2700K is traditional. Study: 6500K cool white for alertness. Sleep mode: dim to 10% warm white, helps melatonin. In summer (45°C), avoid running at 100% brightness for extended periods — generates heat. Power cuts: smart bulb loses state — configure default-on at 50% after power restoration.',
      t1_intents: [
        'lights (on|off|dim|bright)',
        'batti (on kar|off kar|band kar)',
        'set (lights|brightness) to (\\d+)( percent)?',
        'diwali mode',
        'movie mode|reading mode|sleep mode',
        'light ka colour (red|blue|green|white|warm) kar',
      ],
      default_property_values: { power: false, brightness: 80, color_temp: 4000, scene: 'normal' },
    },
    demo_event_samples: [
      { name: 'Diwali mode', description: 'Festival regime → T3 sets Diwali lighting', event: { event_type: 'voice_command', data: { utterance: 'diwali mode on' } }, expected_tier: 'T1' },
    ],
  },

  // ── 9. Generic LPG Cylinder Sensor ───────────────────────────────────────
  {
    module_id: 'generic-lpg-sensor-v3',
    name: 'Smart LPG Cylinder Sensor',
    description: 'Generic weight-based LPG sensor — attaches to the cylinder base. Tracks remaining gas by weight, estimates days left based on household consumption pattern, and auto-books refill via India Gas / HP Gas / Bharat Gas API. Critical safety: detects leaks via gas sensor element.',
    version: '3.0.0',
    author: 'SafeHome India',
    category: 'india_specific',
    device_type: 'lpg_sensor',
    brand: 'Generic',
    model_pattern: 'SHI|GasGuard|CylSafe',
    tags: ['lpg', 'gas', 'safety', 'cylinder', 'india-specific', 'critical'],
    downloads: 14332,
    rating: 4.9,
    verified: true,
    published_at: '2025-05-01T00:00:00Z',
    mcp_definition: {
      capabilities: ['sense', 'state'],
      safety_class: 'CRITICAL',
      property_schemas: {
        leak_detected:        { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        gas_level_percent:    { type: 'number',  actuatable: false, observable: true,  min: 0, max: 100, unit: '%', default_value: 65 },
        cylinder_weight_kg:   { type: 'number',  actuatable: false, observable: true,  unit: 'kg', default_value: 10.8 },
        days_remaining:       { type: 'number',  actuatable: false, observable: true,  unit: 'days', default_value: 22 },
        alarm_active:         { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        refill_booked:        { type: 'boolean', actuatable: false, observable: true,  default_value: false },
        gas_company:          { type: 'enum',    actuatable: true,  observable: false, enum_values: ['indane','hp','bharat'], default_value: 'indane' },
        consumer_number:      { type: 'string',  actuatable: true,  observable: false, default_value: '' },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'leak_emergency',
          description: 'LPG leak detected — CRITICAL: alarm on, notify immediately',
          condition_fn_key: 'property_eq',
          condition_params_fn: (device_id) => ({ device_id, property: 'leak_detected', value: true }),
          action_property: 'alarm_active',
          action_value: true,
          confidence: 1.0,
        },
        {
          rule_id_suffix: 'low_gas_alert',
          description: 'Gas below 20% — escalate to T3 for refill booking via Amazon Now / Gas company API',
          condition_fn_key: 'property_lt',
          condition_params_fn: (device_id) => ({ device_id, property: 'gas_level_percent', threshold: 20 }),
          action_property: 'alarm_active',
          action_value: false,
          confidence: 0.9,
        },
      ],
      knowledge_pack_fragment: 'LPG cylinder in Indian household: standard cylinder = 14.2 kg. Average family (4 members, 2 meals/day) = 30-45 days per cylinder. North India winter: usage increases 30-40% (more hot water, longer cooking). Book refill 7-10 days before empty (delivery takes 3-7 days in most cities). Leak protocol: open all windows, DO NOT switch on/off any electrical appliance, evacuate, call 1800-233-3555. Composite cylinders (5kg) gaining popularity in apartments — different weight thresholds apply.',
      t1_intents: [
        'gas kitna bacha hai',
        'LPG (level|status|check)',
        'gas cylinder (book|refill|order)',
        'gas (leak|smell)',
      ],
      default_property_values: { leak_detected: false, gas_level_percent: 65, alarm_active: false },
    },
    demo_event_samples: [
      { name: 'Gas leak CRITICAL', description: 'Leak detected — T0 activates alarm immediately', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', leak_detected: true } }, expected_tier: 'T0', expected_action: 'EMERGENCY_SHUTOFF' },
      { name: 'Low gas refill', description: 'Gas below 20% — T3 books refill via Amazon Now', event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', gas_level_percent: 15 } }, expected_tier: 'T3' },
    ],
  },

  // ── 10. Samsung Frame TV ─────────────────────────────────────────────────
  {
    module_id: 'samsung-frame-tv-v1',
    name: 'Samsung The Frame TV',
    description: 'Adapter for Samsung The Frame and QLED SmartTV series. Art mode, ambient mode, presence auto-off, content-aware volume. India-specific: DD Free Dish channel list, IPL/cricket match detection for auto-mute ads.',
    version: '1.0.0',
    author: 'Samsung India',
    category: 'entertainment',
    device_type: 'tv',
    brand: 'Samsung',
    model_pattern: 'QA|UA|LS03|LS01',
    tags: ['tv', 'samsung', 'smart-tv', 'qled', 'frame'],
    downloads: 2890,
    rating: 4.5,
    verified: false,
    published_at: '2026-01-15T00:00:00Z',
    mcp_definition: {
      capabilities: ['act', 'state'],
      safety_class: 'CONVENIENCE',
      property_schemas: {
        power:         { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        volume:        { type: 'number',  actuatable: true,  observable: true,  min: 0, max: 100, default_value: 30 },
        muted:         { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        input:         { type: 'enum',    actuatable: true,  observable: true,  enum_values: ['hdmi1','hdmi2','hdmi3','cast','tv','usb'], default_value: 'tv' },
        art_mode:      { type: 'boolean', actuatable: true,  observable: true,  default_value: false },
        ambient_mode:  { type: 'boolean', actuatable: true,  observable: false, default_value: false },
        current_app:   { type: 'string',  actuatable: false, observable: true,  default_value: 'tv' },
        channel:       { type: 'string',  actuatable: true,  observable: true,  default_value: '' },
      },
      auto_t0_rules: [
        {
          rule_id_suffix: 'no_presence_off',
          description: 'No one in room — turn off TV after 15 min to save power',
          condition_fn_key: 'room_unoccupied',
          condition_params_fn: (device_id) => ({ device_id }),
          action_property: 'power',
          action_value: false,
          confidence: 0.82,
        },
      ],
      knowledge_pack_fragment: 'Samsung Smart TV in Indian household: DD Free Dish has 150+ free channels (most common in rural/tier-2 cities). JioCinema, SonyLIV, ZEE5 are top OTT in India. Cricket (especially IPL) is primetime — volume spikes during boundaries. Night mode: dim to 30 brightness after 10PM. Power consumption at 55" 4K: ~120W, with art mode: ~30W (significant savings vs screen-saver).',
      t1_intents: [
        'TV (on|off|band kar|chalu kar)',
        'volume (up|down|mute|set to \\d+)',
        'channel (change|badlo|\\d+)',
        'Netflix|YouTube|JioCinema (chalu kar|open)',
        'art mode (on|off)',
      ],
      default_property_values: { power: false, volume: 30, muted: false, input: 'tv' },
    },
    demo_event_samples: [
      { name: 'No presence auto-off', description: 'Room empty 15 min — TV off saves ~120W', event: { event_type: 'sensor_trigger', data: { sensor: 'presence', room: 'living_room', occupied: false } }, expected_tier: 'T0' },
    ],
  },
];

// ─── In-memory registry ───────────────────────────────────────────────────────

class AppStoreRegistry {
  private modules = new Map<string, AppStoreModule>();
  private installedModules = new Map<string, Set<string>>(); // home_id → module_ids

  constructor() {
    for (const m of SAMPLE_MODULES) {
      this.modules.set(m.module_id, { ...m });
    }
  }

  list(filters?: { category?: string; brand?: string; device_type?: string; verified?: boolean }): AppStoreModule[] {
    let mods = Array.from(this.modules.values());
    if (filters?.category) mods = mods.filter(m => m.category === filters.category);
    if (filters?.brand) mods = mods.filter(m => m.brand.toLowerCase() === filters.brand!.toLowerCase());
    if (filters?.device_type) mods = mods.filter(m => m.device_type === filters.device_type);
    if (filters?.verified !== undefined) mods = mods.filter(m => m.verified === filters.verified);
    return mods.sort((a, b) => b.downloads - a.downloads);
  }

  search(query: string): AppStoreModule[] {
    const q = query.toLowerCase();
    return Array.from(this.modules.values()).filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.brand.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some(t => t.includes(q)) ||
      m.device_type.includes(q)
    ).sort((a, b) => b.downloads - a.downloads);
  }

  get(module_id: string): AppStoreModule | undefined {
    return this.modules.get(module_id);
  }

  publish(module: AppStoreModule): AppStoreModule {
    const withMeta = {
      ...module,
      downloads: 0,
      rating: 0,
      verified: false,
      published_at: new Date().toISOString(),
    };
    this.modules.set(module.module_id, withMeta);
    return withMeta;
  }

  /** Find best matching module for a device registration */
  findMatch(device_type: string, brand?: string, model?: string): AppStoreModule | null {
    const candidates = Array.from(this.modules.values()).filter(m => m.device_type === device_type);
    if (candidates.length === 0) return null;

    if (brand) {
      const brandMatch = candidates.filter(m => m.brand.toLowerCase() === brand.toLowerCase());
      if (brandMatch.length > 0) {
        if (model) {
          const modelMatch = brandMatch.find(m => m.model_pattern && new RegExp(m.model_pattern, 'i').test(model));
          if (modelMatch) return modelMatch;
        }
        return brandMatch.sort((a, b) => b.downloads - a.downloads)[0];
      }
    }

    // Return verified module with most downloads
    return candidates.filter(m => m.verified).sort((a, b) => b.downloads - a.downloads)[0] || null;
  }

  install(home_id: string, module_id: string): void {
    if (!this.installedModules.has(home_id)) this.installedModules.set(home_id, new Set());
    this.installedModules.get(home_id)!.add(module_id);
    const mod = this.modules.get(module_id);
    if (mod) mod.downloads++;
  }

  getInstalled(home_id: string): AppStoreModule[] {
    const ids = this.installedModules.get(home_id) || new Set();
    return Array.from(ids).map(id => this.modules.get(id)).filter(Boolean) as AppStoreModule[];
  }

  getCategories(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.modules.forEach(m => { counts[m.category] = (counts[m.category] || 0) + 1; });
    return counts;
  }

  getStats() {
    const mods = Array.from(this.modules.values());
    return {
      total_modules: mods.length,
      verified_modules: mods.filter(m => m.verified).length,
      total_installs: mods.reduce((s, m) => s + m.downloads, 0),
      categories: this.getCategories(),
      top_module: mods.sort((a, b) => b.downloads - a.downloads)[0]?.name,
    };
  }
}

export const appStore = new AppStoreRegistry();
