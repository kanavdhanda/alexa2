import {
  PropertyType,
  SafetyClass,
  McpCapability,
  DevicePropertySchema,
  DevicePropertyInstance,
  DeviceInstance,
  T0Rule,
} from './stateStore';

// ─── AutoT0RuleTemplate ───────────────────────────────────────────────────────

export interface AutoT0RuleTemplate {
  rule_id_suffix: string;
  description: string;
  condition_fn_key: string;
  condition_params_fn: (device_id: string) => Record<string, any>;
  action_property: string;
  action_value: any;
  confidence: number;
}

// ─── DeviceTypeTemplate ───────────────────────────────────────────────────────

export interface DeviceTypeTemplate {
  type: string;
  default_friendly_name: string;
  typical_safety_class: SafetyClass;
  mcp_capabilities: McpCapability[];
  property_schemas: Record<string, DevicePropertySchema>;
  dead_man_timer_minutes?: number;
  auto_t0_rules: AutoT0RuleTemplate[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function boolProp(actuatable: boolean, observable: boolean, defaultVal: boolean): DevicePropertySchema {
  return { type: 'boolean', actuatable, observable, default_value: defaultVal };
}

function numberProp(
  min: number,
  max: number,
  unit: string | undefined,
  actuatable: boolean,
  observable: boolean,
  defaultVal: number,
): DevicePropertySchema {
  return { type: 'number', min, max, unit, actuatable, observable, default_value: defaultVal };
}

function enumProp(values: string[], actuatable: boolean, observable: boolean, defaultVal: string): DevicePropertySchema {
  return { type: 'enum', enum_values: values, actuatable, observable, default_value: defaultVal };
}

function stringProp(actuatable: boolean, observable: boolean, defaultVal: string): DevicePropertySchema {
  return { type: 'string', actuatable, observable, default_value: defaultVal };
}

// ─── Device Type Catalog ──────────────────────────────────────────────────────

export const DEVICE_TYPE_CATALOG: Record<string, DeviceTypeTemplate> = {
  fan: {
    type: 'fan',
    default_friendly_name: 'Ceiling Fan',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      speed: numberProp(0, 5, undefined, true, true, 0),
      swing: boolProp(true, true, false),
    },
    auto_t0_rules: [],
  },

  light: {
    type: 'light',
    default_friendly_name: 'Smart Light',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      brightness: numberProp(0, 100, '%', true, true, 100),
      color_temp: numberProp(2700, 6500, 'K', true, true, 4000),
    },
    auto_t0_rules: [],
  },

  geyser: {
    type: 'geyser',
    default_friendly_name: 'Water Heater',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'act', 'state'],
    dead_man_timer_minutes: 45,
    property_schemas: {
      power: boolProp(true, true, false),
      target_temp: numberProp(35, 70, '°C', true, true, 55),
      current_temp: numberProp(0, 100, '°C', false, true, 25),
      duration_minutes: numberProp(0, 120, 'min', false, true, 0),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'deadman_power_off',
        description: 'Turn off geyser if running for more than 45 minutes',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
    ],
  },

  water_heater: {
    type: 'water_heater',
    default_friendly_name: 'Water Heater',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'act', 'state'],
    dead_man_timer_minutes: 45,
    property_schemas: {
      power: boolProp(true, true, false),
      target_temp: numberProp(35, 70, '°C', true, true, 55),
      current_temp: numberProp(0, 100, '°C', false, true, 25),
      duration_minutes: numberProp(0, 120, 'min', false, true, 0),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'deadman_power_off',
        description: 'Turn off water heater if running for more than 45 minutes',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
    ],
  },

  water_pump: {
    type: 'water_pump',
    default_friendly_name: 'Water Motor',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'act', 'state'],
    dead_man_timer_minutes: 45,
    property_schemas: {
      power: boolProp(true, true, false),
      duration_minutes: numberProp(0, 90, 'min', false, true, 0),
      tank_level_percent: numberProp(0, 100, '%', false, true, 50),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'deadman_power_off',
        description: 'Turn off water pump if running for more than 45 minutes',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
      {
        rule_id_suffix: 'tank_full_power_off',
        description: 'Turn off water pump when tank is more than 95% full',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'tank_level_percent', threshold: 95 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
    ],
  },

  motor: {
    type: 'motor',
    default_friendly_name: 'Water Motor',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'act', 'state'],
    dead_man_timer_minutes: 45,
    property_schemas: {
      power: boolProp(true, true, false),
      duration_minutes: numberProp(0, 90, 'min', false, true, 0),
      tank_level_percent: numberProp(0, 100, '%', false, true, 50),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'deadman_power_off',
        description: 'Turn off motor if running for more than 45 minutes',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'duration_minutes', threshold: 45 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
      {
        rule_id_suffix: 'tank_full_power_off',
        description: 'Turn off motor when tank is more than 95% full',
        condition_fn_key: 'property_gt',
        condition_params_fn: (device_id) => ({ device_id, property: 'tank_level_percent', threshold: 95 }),
        action_property: 'power',
        action_value: false,
        confidence: 1.0,
      },
    ],
  },

  lpg_sensor: {
    type: 'lpg_sensor',
    default_friendly_name: 'LPG Gas Sensor',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      leak_detected: boolProp(false, true, false),
      gas_level_percent: numberProp(0, 100, '%', false, true, 0),
      alert: boolProp(false, true, false),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'leak_alert',
        description: 'Raise alert when LPG leak is detected',
        condition_fn_key: 'property_eq',
        condition_params_fn: (device_id) => ({ device_id, property: 'leak_detected', value: true }),
        action_property: 'alert',
        action_value: true,
        confidence: 1.0,
      },
    ],
  },

  air_conditioner: {
    type: 'air_conditioner',
    default_friendly_name: 'Air Conditioner',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      mode: enumProp(['cool', 'heat', 'fan', 'dry', 'auto'], true, true, 'cool'),
      target_temp: numberProp(16, 30, '°C', true, true, 24),
      fan_speed: enumProp(['auto', 'low', 'medium', 'high'], true, true, 'auto'),
      current_temp: numberProp(-10, 60, '°C', false, true, 30),
    },
    auto_t0_rules: [],
  },

  ac: {
    type: 'ac',
    default_friendly_name: 'Air Conditioner',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      mode: enumProp(['cool', 'heat', 'fan', 'dry', 'auto'], true, true, 'cool'),
      target_temp: numberProp(16, 30, '°C', true, true, 24),
      fan_speed: enumProp(['auto', 'low', 'medium', 'high'], true, true, 'auto'),
      current_temp: numberProp(-10, 60, '°C', false, true, 30),
    },
    auto_t0_rules: [],
  },

  smart_plug: {
    type: 'smart_plug',
    default_friendly_name: 'Smart Plug',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      watts: numberProp(0, 3500, 'W', false, true, 0),
      energy_kwh: numberProp(0, 99999, 'kWh', false, true, 0),
    },
    auto_t0_rules: [],
  },

  inverter: {
    type: 'inverter',
    default_friendly_name: 'Inverter / UPS',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      on_battery: boolProp(false, true, false),
      battery_percent: numberProp(0, 100, '%', false, true, 100),
      load_watts: numberProp(0, 5000, 'W', false, true, 0),
      input_voltage: numberProp(0, 260, 'V', false, true, 230),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'battery_low_alert',
        description: 'Send alert when inverter battery is below 10%',
        condition_fn_key: 'property_lt',
        condition_params_fn: (device_id) => ({ device_id, property: 'battery_percent', threshold: 10 }),
        action_property: 'alert',
        action_value: 'BATTERY_CRITICAL',
        confidence: 1.0,
      },
    ],
  },

  ups: {
    type: 'ups',
    default_friendly_name: 'UPS',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      on_battery: boolProp(false, true, false),
      battery_percent: numberProp(0, 100, '%', false, true, 100),
      load_watts: numberProp(0, 5000, 'W', false, true, 0),
      input_voltage: numberProp(0, 260, 'V', false, true, 230),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'battery_low_alert',
        description: 'Send alert when UPS battery is below 10%',
        condition_fn_key: 'property_lt',
        condition_params_fn: (device_id) => ({ device_id, property: 'battery_percent', threshold: 10 }),
        action_property: 'alert',
        action_value: 'BATTERY_CRITICAL',
        confidence: 1.0,
      },
    ],
  },

  ro_purifier: {
    type: 'ro_purifier',
    default_friendly_name: 'RO Water Purifier',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      tds_ppm: numberProp(0, 2000, 'ppm', false, true, 50),
      filter_life_percent: numberProp(0, 100, '%', false, true, 100),
      dispensing: boolProp(false, true, false),
    },
    auto_t0_rules: [],
  },

  water_purifier: {
    type: 'water_purifier',
    default_friendly_name: 'Water Purifier',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      tds_ppm: numberProp(0, 2000, 'ppm', false, true, 50),
      filter_life_percent: numberProp(0, 100, '%', false, true, 100),
      dispensing: boolProp(false, true, false),
    },
    auto_t0_rules: [],
  },

  door_lock: {
    type: 'door_lock',
    default_friendly_name: 'Smart Door Lock',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      locked: boolProp(true, true, true),
      tamper_detected: boolProp(false, true, false),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'tamper_lock',
        description: 'Lock door immediately when tamper is detected',
        condition_fn_key: 'property_eq',
        condition_params_fn: (device_id) => ({ device_id, property: 'tamper_detected', value: true }),
        action_property: 'locked',
        action_value: true,
        confidence: 1.0,
      },
    ],
  },

  tv: {
    type: 'tv',
    default_friendly_name: 'Smart TV',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      volume: numberProp(0, 100, undefined, true, true, 20),
      input: enumProp(['hdmi1', 'hdmi2', 'hdmi3', 'cast'], true, true, 'hdmi1'),
      channel: stringProp(true, true, ''),
    },
    auto_t0_rules: [],
  },

  smart_tv: {
    type: 'smart_tv',
    default_friendly_name: 'Smart TV',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      power: boolProp(true, true, false),
      volume: numberProp(0, 100, undefined, true, true, 20),
      input: enumProp(['hdmi1', 'hdmi2', 'hdmi3', 'cast'], true, true, 'hdmi1'),
      channel: stringProp(true, true, ''),
    },
    auto_t0_rules: [],
  },

  motion_sensor: {
    type: 'motion_sensor',
    default_friendly_name: 'Motion Sensor',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      motion_detected: boolProp(false, true, false),
      person_count: numberProp(0, 10, undefined, false, true, 0),
      last_motion: stringProp(false, true, ''),
    },
    auto_t0_rules: [],
  },

  presence_sensor: {
    type: 'presence_sensor',
    default_friendly_name: 'Presence Sensor',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      motion_detected: boolProp(false, true, false),
      person_count: numberProp(0, 10, undefined, false, true, 0),
      last_motion: stringProp(false, true, ''),
    },
    auto_t0_rules: [],
  },

  smoke_detector: {
    type: 'smoke_detector',
    default_friendly_name: 'Smoke Detector',
    typical_safety_class: 'CRITICAL',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      smoke_detected: boolProp(false, true, false),
      co_detected: boolProp(false, true, false),
      alarm_active: boolProp(true, true, false),
    },
    auto_t0_rules: [
      {
        rule_id_suffix: 'smoke_alarm',
        description: 'Activate alarm when smoke is detected',
        condition_fn_key: 'property_eq',
        condition_params_fn: (device_id) => ({ device_id, property: 'smoke_detected', value: true }),
        action_property: 'alarm_active',
        action_value: true,
        confidence: 1.0,
      },
    ],
  },

  curtain: {
    type: 'curtain',
    default_friendly_name: 'Smart Curtain',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      position_percent: numberProp(0, 100, '%', true, true, 100),
      moving: boolProp(false, true, false),
    },
    auto_t0_rules: [],
  },

  blind: {
    type: 'blind',
    default_friendly_name: 'Smart Blind',
    typical_safety_class: 'CONVENIENCE',
    mcp_capabilities: ['sense', 'act', 'state'],
    property_schemas: {
      position_percent: numberProp(0, 100, '%', true, true, 100),
      moving: boolProp(false, true, false),
    },
    auto_t0_rules: [],
  },

  pressure_cooker_monitor: {
    type: 'pressure_cooker_monitor',
    default_friendly_name: 'Pressure Cooker Monitor',
    typical_safety_class: 'STANDARD',
    mcp_capabilities: ['sense', 'state'],
    property_schemas: {
      whistle_count: numberProp(0, 20, undefined, false, true, 0),
      on_stove: boolProp(false, true, false),
    },
    auto_t0_rules: [],
  },
};

// ─── createDeviceFromTemplate ─────────────────────────────────────────────────

export function createDeviceFromTemplate(
  device_id: string,
  type: string,
  room_id: string,
  overrides?: Partial<Pick<DeviceInstance, 'friendly_name' | 'safety_class' | 'dead_man_timer_minutes'>>,
): DeviceInstance {
  const template = DEVICE_TYPE_CATALOG[type];
  if (!template) {
    throw new Error(`Unknown device type: "${type}". Not found in DEVICE_TYPE_CATALOG.`);
  }

  const now = new Date().toISOString();

  const properties: Record<string, DevicePropertyInstance> = {};
  for (const [key, schema] of Object.entries(template.property_schemas)) {
    properties[key] = {
      ...schema,
      current_value: schema.default_value,
      previous_value: undefined,
      last_changed: now,
    };
  }

  return {
    device_id,
    friendly_name: overrides?.friendly_name ?? template.default_friendly_name,
    type,
    room_id,
    safety_class: overrides?.safety_class ?? template.typical_safety_class,
    mcp_capabilities: template.mcp_capabilities,
    properties,
    dead_man_timer_minutes: overrides?.dead_man_timer_minutes ?? template.dead_man_timer_minutes,
    registered_at: now,
    last_updated: now,
    online: true,
  };
}

// ─── generateAutoT0Rules ──────────────────────────────────────────────────────

export function generateAutoT0Rules(device: DeviceInstance): T0Rule[] {
  const template = DEVICE_TYPE_CATALOG[device.type];
  if (!template) return [];

  const now = new Date().toISOString();

  return template.auto_t0_rules.map((ruleTemplate) => {
    const rule: T0Rule = {
      rule_id: `${device.device_id}_${ruleTemplate.rule_id_suffix}`,
      description: ruleTemplate.description,
      condition_fn_key: ruleTemplate.condition_fn_key,
      condition_params: ruleTemplate.condition_params_fn(device.device_id),
      action: {
        device_id: device.device_id,
        property: ruleTemplate.action_property,
        value: ruleTemplate.action_value,
      },
      confidence: ruleTemplate.confidence,
      promoted_from_t3: false,
      created_at: now,
      trigger_count: 0,
    };
    return rule;
  });
}

// ─── validatePropertyUpdate ───────────────────────────────────────────────────

export function validatePropertyUpdate(
  device: DeviceInstance,
  property: string,
  value: unknown,
): { valid: boolean; error?: string } {
  const prop = device.properties[property];

  if (!prop) {
    return { valid: false, error: `Property "${property}" does not exist on device "${device.device_id}".` };
  }

  if (!prop.actuatable) {
    return { valid: false, error: `Property "${property}" is read-only (not actuatable).` };
  }

  switch (prop.type as PropertyType) {
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Property "${property}" expects a boolean, got ${typeof value}.` };
      }
      break;
    }

    case 'number': {
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: `Property "${property}" expects a number, got ${typeof value}.` };
      }
      if (prop.min !== undefined && value < prop.min) {
        return { valid: false, error: `Property "${property}" value ${value} is below minimum ${prop.min}.` };
      }
      if (prop.max !== undefined && value > prop.max) {
        return { valid: false, error: `Property "${property}" value ${value} exceeds maximum ${prop.max}.` };
      }
      break;
    }

    case 'enum': {
      if (typeof value !== 'string') {
        return { valid: false, error: `Property "${property}" expects a string enum value, got ${typeof value}.` };
      }
      if (!prop.enum_values || !prop.enum_values.includes(value)) {
        return {
          valid: false,
          error: `Property "${property}" value "${value}" is not one of: ${prop.enum_values?.join(', ')}.`,
        };
      }
      break;
    }

    case 'string': {
      if (typeof value !== 'string') {
        return { valid: false, error: `Property "${property}" expects a string, got ${typeof value}.` };
      }
      break;
    }

    default: {
      return { valid: false, error: `Unknown property type for "${property}".` };
    }
  }

  return { valid: true };
}
