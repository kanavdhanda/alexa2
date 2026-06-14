import { DeviceInstance, T0Rule, Room, Occupancy, RoomType } from './stateStore';
import { createDeviceFromTemplate, generateAutoT0Rules } from './deviceRegistry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoom(
  room_id: string,
  name: string,
  type: RoomType,
  device_ids: string[],
  knowledge_pack_id: string,
): Room {
  const occupancy: Occupancy = {
    occupied: false,
    confidence: 0,
    person_count: 0,
    last_updated: new Date().toISOString(),
  };
  return { room_id, name, type, device_ids, occupancy, knowledge_pack_id };
}

function setProp(device: DeviceInstance, property: string, value: unknown): void {
  if (device.properties[property] !== undefined) {
    device.properties[property].current_value = value;
  }
}

// ─── seedDemoHome ─────────────────────────────────────────────────────────────

export function seedDemoHome(home_id: string): {
  rooms: Room[];
  devices: DeviceInstance[];
  t0_rules: T0Rule[];
} {
  const now = new Date().toISOString();

  // ── Devices ──────────────────────────────────────────────────────────────────

  // Kitchen
  const kitchen_lpg_sensor = createDeviceFromTemplate(
    `${home_id}_kitchen_lpg_sensor`,
    'lpg_sensor',
    `${home_id}_kitchen`,
    { friendly_name: 'Kitchen LPG Gas Sensor' },
  );

  const kitchen_exhaust_fan = createDeviceFromTemplate(
    `${home_id}_kitchen_exhaust_fan`,
    'fan',
    `${home_id}_kitchen`,
    { friendly_name: 'Kitchen Exhaust Fan' },
  );

  const kitchen_smart_plug_mixer = createDeviceFromTemplate(
    `${home_id}_kitchen_smart_plug_mixer`,
    'smart_plug',
    `${home_id}_kitchen`,
    { friendly_name: 'Kitchen Mixer Grinder Plug' },
  );

  const kitchen_ro_purifier = createDeviceFromTemplate(
    `${home_id}_kitchen_ro_purifier`,
    'ro_purifier',
    `${home_id}_kitchen`,
    { friendly_name: 'Kitchen RO Purifier' },
  );
  setProp(kitchen_ro_purifier, 'power', true);
  setProp(kitchen_ro_purifier, 'tds_ppm', 38);
  setProp(kitchen_ro_purifier, 'filter_life_percent', 72);

  // Master Bedroom
  const master_geyser = createDeviceFromTemplate(
    `${home_id}_master_geyser`,
    'geyser',
    `${home_id}_master_bedroom`,
    { friendly_name: 'Master Bathroom Geyser', dead_man_timer_minutes: 45 },
  );
  setProp(master_geyser, 'target_temp', 60);
  setProp(master_geyser, 'current_temp', 28);

  const master_ac = createDeviceFromTemplate(
    `${home_id}_master_ac`,
    'air_conditioner',
    `${home_id}_master_bedroom`,
    { friendly_name: 'Master Bedroom AC' },
  );
  setProp(master_ac, 'current_temp', 32);
  setProp(master_ac, 'target_temp', 24);
  setProp(master_ac, 'mode', 'cool');
  setProp(master_ac, 'fan_speed', 'auto');

  const master_ceiling_fan = createDeviceFromTemplate(
    `${home_id}_master_ceiling_fan`,
    'fan',
    `${home_id}_master_bedroom`,
    { friendly_name: 'Master Bedroom Ceiling Fan' },
  );
  setProp(master_ceiling_fan, 'power', false);
  setProp(master_ceiling_fan, 'speed', 0);

  const master_smart_bulb = createDeviceFromTemplate(
    `${home_id}_master_smart_bulb`,
    'light',
    `${home_id}_master_bedroom`,
    { friendly_name: 'Master Bedroom Smart Bulb' },
  );
  setProp(master_smart_bulb, 'power', false);
  setProp(master_smart_bulb, 'brightness', 80);
  setProp(master_smart_bulb, 'color_temp', 3000);

  // Living Room
  const living_tv = createDeviceFromTemplate(
    `${home_id}_living_tv`,
    'tv',
    `${home_id}_living_room`,
    { friendly_name: 'Living Room TV' },
  );
  setProp(living_tv, 'power', false);
  setProp(living_tv, 'volume', 25);
  setProp(living_tv, 'input', 'hdmi1');

  const living_ceiling_fan = createDeviceFromTemplate(
    `${home_id}_living_ceiling_fan`,
    'fan',
    `${home_id}_living_room`,
    { friendly_name: 'Living Room Ceiling Fan' },
  );
  setProp(living_ceiling_fan, 'power', false);
  setProp(living_ceiling_fan, 'speed', 0);

  const living_presence_sensor = createDeviceFromTemplate(
    `${home_id}_living_presence_sensor`,
    'presence_sensor',
    `${home_id}_living_room`,
    { friendly_name: 'Living Room Presence Sensor' },
  );
  setProp(living_presence_sensor, 'motion_detected', false);
  setProp(living_presence_sensor, 'person_count', 0);

  const living_smart_bulb = createDeviceFromTemplate(
    `${home_id}_living_smart_bulb`,
    'light',
    `${home_id}_living_room`,
    { friendly_name: 'Living Room Smart Bulb' },
  );
  setProp(living_smart_bulb, 'power', false);
  setProp(living_smart_bulb, 'brightness', 100);
  setProp(living_smart_bulb, 'color_temp', 4000);

  // Utility Room
  const utility_water_motor = createDeviceFromTemplate(
    `${home_id}_utility_water_motor`,
    'water_pump',
    `${home_id}_utility_room`,
    { friendly_name: 'Overhead Tank Water Motor', dead_man_timer_minutes: 45 },
  );
  setProp(utility_water_motor, 'power', false);
  setProp(utility_water_motor, 'duration_minutes', 0);
  setProp(utility_water_motor, 'tank_level_percent', 65);

  const utility_inverter = createDeviceFromTemplate(
    `${home_id}_utility_inverter`,
    'inverter',
    `${home_id}_utility_room`,
    { friendly_name: 'Home Inverter / UPS' },
  );
  setProp(utility_inverter, 'on_battery', false);
  setProp(utility_inverter, 'battery_percent', 78);
  setProp(utility_inverter, 'load_watts', 320);
  setProp(utility_inverter, 'input_voltage', 228);

  // Bathroom (bathroom_1)
  const bathroom_geyser = createDeviceFromTemplate(
    `${home_id}_bathroom_geyser`,
    'geyser',
    `${home_id}_bathroom_1`,
    { friendly_name: 'Bathroom Geyser', dead_man_timer_minutes: 45 },
  );
  setProp(bathroom_geyser, 'target_temp', 55);
  setProp(bathroom_geyser, 'current_temp', 26);

  const devices: DeviceInstance[] = [
    kitchen_lpg_sensor,
    kitchen_exhaust_fan,
    kitchen_smart_plug_mixer,
    kitchen_ro_purifier,
    master_geyser,
    master_ac,
    master_ceiling_fan,
    master_smart_bulb,
    living_tv,
    living_ceiling_fan,
    living_presence_sensor,
    living_smart_bulb,
    utility_water_motor,
    utility_inverter,
    bathroom_geyser,
  ];

  // ── Rooms ─────────────────────────────────────────────────────────────────────

  const rooms: Room[] = [
    makeRoom(
      `${home_id}_kitchen`,
      'Kitchen',
      'kitchen',
      [
        kitchen_lpg_sensor.device_id,
        kitchen_exhaust_fan.device_id,
        kitchen_smart_plug_mixer.device_id,
        kitchen_ro_purifier.device_id,
      ],
      'kitchen_pack',
    ),
    makeRoom(
      `${home_id}_master_bedroom`,
      'Master Bedroom',
      'bedroom',
      [
        master_geyser.device_id,
        master_ac.device_id,
        master_ceiling_fan.device_id,
        master_smart_bulb.device_id,
      ],
      'bedroom_pack',
    ),
    makeRoom(
      `${home_id}_living_room`,
      'Living Room',
      'living_room',
      [
        living_tv.device_id,
        living_ceiling_fan.device_id,
        living_presence_sensor.device_id,
        living_smart_bulb.device_id,
      ],
      'living_room_pack',
    ),
    makeRoom(
      `${home_id}_bathroom_1`,
      'Bathroom',
      'bathroom',
      [bathroom_geyser.device_id],
      'bathroom_pack',
    ),
    makeRoom(
      `${home_id}_utility_room`,
      'Utility Room',
      'utility',
      [utility_water_motor.device_id, utility_inverter.device_id],
      'utility_pack',
    ),
  ];

  // ── Auto-generated T0 rules ───────────────────────────────────────────────────

  const t0_rules: T0Rule[] = devices.flatMap((device) => generateAutoT0Rules(device));

  // ── Promoted (learned) T0 rules ───────────────────────────────────────────────

  const learned_geyser_morning: T0Rule = {
    rule_id: `${home_id}_learned_geyser_morning`,
    description: 'Turn on master geyser in the morning when outdoor temp is below 28°C (learned pattern)',
    condition_fn_key: 'time_and_outdoor_temp_lt',
    condition_params: {
      time_of_day: 'morning',
      outdoor_temp_threshold: 28,
    },
    action: {
      device_id: master_geyser.device_id,
      property: 'power',
      value: true,
    },
    confidence: 0.91,
    promoted_from_t3: true,
    created_at: now,
    trigger_count: 0,
  };

  const learned_fan_presence_off: T0Rule = {
    rule_id: `${home_id}_learned_fan_presence_off`,
    description: 'Turn off living room ceiling fan when room has been unoccupied for more than 5 minutes (learned pattern)',
    condition_fn_key: 'room_unoccupied_duration_gt',
    condition_params: {
      room_id: `${home_id}_living_room`,
      duration_minutes: 5,
      occupancy_device_id: living_presence_sensor.device_id,
    },
    action: {
      device_id: living_ceiling_fan.device_id,
      property: 'power',
      value: false,
    },
    confidence: 0.85,
    promoted_from_t3: true,
    created_at: now,
    trigger_count: 0,
  };

  t0_rules.push(learned_geyser_morning, learned_fan_presence_off);

  return { rooms, devices, t0_rules };
}
