/**
 * In-memory state store simulating AWS IoT Device Shadows + DynamoDB
 * Keyed by home_id; supports concurrent home instances
 */

export interface DeviceState {
  device_id: string;
  type: string;
  state: string;
  last_updated: string;
  metadata?: Record<string, any>;
}

export interface HomeState {
  home_id: string;
  devices: Record<string, DeviceState>;
  inventory: Record<string, { quantity: number; unit: string; threshold: number }>;
  sound_clusters: SoundCluster[];
  event_history: EventRecord[];
  t0_rules: T0Rule[];
  last_updated: string;
}

export interface SoundCluster {
  cluster_id: string;
  embedding_id: string;
  count: number;
  first_seen: string;
  last_seen: string;
  identified: boolean;
  label?: string;
}

export interface EventRecord {
  timestamp: string;
  event_type: string;
  tier: string;
  data: any;
  action_taken?: any;
}

export interface T0Rule {
  rule_id: string;
  condition: string;
  action: string;
  confidence: number;
  promoted_from_t3: boolean;
  created_at: string;
}

const DEFAULT_HOME_STATE = (): HomeState => ({
  home_id: '',
  devices: {
    water_motor: { device_id: 'water_motor', type: 'pump', state: 'OFF', last_updated: new Date().toISOString() },
    geyser: { device_id: 'geyser', type: 'heater', state: 'OFF', last_updated: new Date().toISOString() },
    lpg_valve: { device_id: 'lpg_valve', type: 'valve', state: 'CLOSED', last_updated: new Date().toISOString() },
    living_room_fan: { device_id: 'living_room_fan', type: 'fan', state: 'OFF', last_updated: new Date().toISOString() },
    main_lights: { device_id: 'main_lights', type: 'light', state: 'OFF', last_updated: new Date().toISOString() },
  },
  inventory: {
    milk: { quantity: 2, unit: 'liters', threshold: 1 },
    lpg: { quantity: 80, unit: 'percent', threshold: 20 },
    rice: { quantity: 5, unit: 'kg', threshold: 2 },
    oil: { quantity: 1, unit: 'liters', threshold: 0.5 },
  },
  sound_clusters: [],
  event_history: [],
  t0_rules: [
    {
      rule_id: 'geyser_morning',
      condition: 'hour >= 5 AND hour <= 7 AND outdoor_temp < 28 AND regime = normal',
      action: 'geyser_on(duration=20min)',
      confidence: 0.92,
      promoted_from_t3: true,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      rule_id: 'water_motor_safety',
      condition: 'motor_on AND duration > 45',
      action: 'SHUT_OFF_water_motor',
      confidence: 1.0,
      promoted_from_t3: false,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  last_updated: new Date().toISOString(),
});

class StateStore {
  private store: Map<string, HomeState> = new Map();

  get(home_id: string): HomeState {
    if (!this.store.has(home_id)) {
      const state = DEFAULT_HOME_STATE();
      state.home_id = home_id;
      this.store.set(home_id, state);
    }
    return this.store.get(home_id)!;
  }

  set(home_id: string, state: HomeState): void {
    state.last_updated = new Date().toISOString();
    this.store.set(home_id, state);
  }

  updateDevice(home_id: string, device_id: string, newState: Partial<DeviceState>): DeviceState {
    const home = this.get(home_id);
    const existing = home.devices[device_id] || { device_id, type: 'unknown', state: 'OFF', last_updated: '' };
    home.devices[device_id] = { ...existing, ...newState, last_updated: new Date().toISOString() };
    this.set(home_id, home);
    return home.devices[device_id];
  }

  updateInventory(home_id: string, item: string, quantity: number): void {
    const home = this.get(home_id);
    if (home.inventory[item]) {
      home.inventory[item].quantity = quantity;
    }
    this.set(home_id, home);
  }

  addSoundCluster(home_id: string, cluster: SoundCluster): void {
    const home = this.get(home_id);
    const existing = home.sound_clusters.find(c => c.cluster_id === cluster.cluster_id);
    if (existing) {
      existing.count++;
      existing.last_seen = new Date().toISOString();
    } else {
      home.sound_clusters.push(cluster);
    }
    this.set(home_id, home);
  }

  addEventRecord(home_id: string, record: EventRecord): void {
    const home = this.get(home_id);
    home.event_history.unshift(record);
    if (home.event_history.length > 100) home.event_history = home.event_history.slice(0, 100);
    this.set(home_id, home);
  }

  listHomes(): string[] {
    return Array.from(this.store.keys());
  }
}

export const stateStore = new StateStore();
