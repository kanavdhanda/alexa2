/**
 * Core in-memory state store — mocks AWS IoT Device Shadow + DynamoDB (per home_id shard)
 * Supports arbitrary devices with typed property schemas, room topology, regime, rule mining.
 */

// ─── Device model ─────────────────────────────────────────────────────────────

export type PropertyType = 'boolean' | 'number' | 'enum' | 'string';
export type SafetyClass = 'CRITICAL' | 'STANDARD' | 'CONVENIENCE';
export type McpCapability = 'sense' | 'act' | 'state';
export type Regime = 'normal' | 'festival' | 'guest' | 'sleep' | 'away';
export type RoomType = 'kitchen' | 'bedroom' | 'living_room' | 'bathroom' | 'balcony' | 'study' | 'utility' | 'other';

export interface DevicePropertySchema {
  type: PropertyType;
  unit?: string;
  min?: number;
  max?: number;
  enum_values?: string[];
  actuatable: boolean;   // can T0/T3 change this value?
  observable: boolean;   // does it emit sensor events when it changes?
  default_value: any;
}

export interface DevicePropertyInstance extends DevicePropertySchema {
  current_value: any;
  previous_value?: any;
  last_changed?: string;
}

export interface DeviceInstance {
  device_id: string;
  friendly_name: string;
  type: string;
  room_id: string;
  safety_class: SafetyClass;
  mcp_capabilities: McpCapability[];
  properties: Record<string, DevicePropertyInstance>;
  dead_man_timer_minutes?: number;
  registered_at: string;
  last_updated: string;
  online: boolean;
}

// ─── Room model ───────────────────────────────────────────────────────────────

export interface Occupancy {
  occupied: boolean;
  confidence: number;  // 0–1
  person_count?: number;
  last_updated: string;
}

export interface Room {
  room_id: string;
  name: string;
  type: RoomType;
  device_ids: string[];
  occupancy: Occupancy;
  knowledge_pack_id: string;
}

// ─── Speaker / identity ───────────────────────────────────────────────────────

export interface SpeakerProfile {
  speaker_id: string;
  name: string;
  role: 'owner' | 'family' | 'guest' | 'child';
  enrolled: boolean;
  last_seen?: string;
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export interface T0Rule {
  rule_id: string;
  description: string;
  condition_fn_key: string;  // key into evaluateT0Condition
  condition_params: Record<string, any>;
  action: {
    device_id: string;
    property: string;
    value: any;
  };
  confidence: number;
  promoted_from_t3: boolean;
  regime_guard?: Regime;   // only fires in this regime
  created_at: string;
  trigger_count: number;
}

export interface ProposedRule {
  proposal_id: string;
  description: string;
  pattern_support: number;   // how many times observed
  confidence: number;
  condition_summary: string;
  action_summary: string;
  rule_if_confirmed: Omit<T0Rule, 'trigger_count' | 'created_at'>;
  proposed_at: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

// ─── Events & learning ────────────────────────────────────────────────────────

export interface EventRecord {
  event_id: string;
  timestamp: string;
  event_type: string;
  tier: 'T0' | 'T1' | 'T3' | 'LOGGED' | 'CACHED';
  room_id?: string;
  speaker_id?: string;
  data: any;
  action_taken?: any;
  regime_at_time: Regime;
  latency_ms?: number;
  cost_usd?: number;
}

export interface SoundCluster {
  cluster_id: string;
  embedding_id: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  time_pattern?: string;
  clap_description?: string;
  identified: boolean;
  label?: string;
}

// ─── Home state ───────────────────────────────────────────────────────────────

export interface HomeState {
  home_id: string;
  display_name: string;

  // Spatial topology
  rooms: Record<string, Room>;

  // Device twin (replaces hardcoded device list)
  devices: Record<string, DeviceInstance>;

  // Inventory (consumables — separate from devices for commerce agent)
  inventory: Record<string, { quantity: number; unit: string; threshold: number; last_ordered?: string }>;

  // Identity
  known_speakers: Record<string, SpeakerProfile>;

  // Context
  current_regime: Regime;
  regime_history: Array<{ regime: Regime; started_at: string; reason: string }>;

  // Learning pipeline
  t0_rules: T0Rule[];
  proposed_rules: ProposedRule[];
  sound_clusters: SoundCluster[];

  // History (feeds rule miner)
  event_history: EventRecord[];

  // Stats
  stats: {
    t0_hits: number;
    t1_hits: number;
    t3_hits: number;
    cache_hits: number;
    total_cost_usd: number;
  };

  last_updated: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const DEFAULT_INVENTORY = () => ({
  milk:  { quantity: 2,  unit: 'liters',  threshold: 1   },
  lpg:   { quantity: 80, unit: 'percent', threshold: 20  },
  rice:  { quantity: 5,  unit: 'kg',      threshold: 2   },
  oil:   { quantity: 1,  unit: 'liters',  threshold: 0.5 },
});

const DEFAULT_SPEAKERS = (): Record<string, SpeakerProfile> => ({
  owner_1: { speaker_id: 'owner_1', name: 'Homeowner', role: 'owner', enrolled: true },
});

function freshHomeState(home_id: string): HomeState {
  return {
    home_id,
    display_name: `Home ${home_id}`,
    rooms: {},
    devices: {},
    inventory: DEFAULT_INVENTORY(),
    known_speakers: DEFAULT_SPEAKERS(),
    current_regime: 'normal',
    regime_history: [{ regime: 'normal', started_at: new Date().toISOString(), reason: 'initial' }],
    t0_rules: [],
    proposed_rules: [],
    sound_clusters: [],
    event_history: [],
    stats: { t0_hits: 0, t1_hits: 0, t3_hits: 0, cache_hits: 0, total_cost_usd: 0 },
    last_updated: new Date().toISOString(),
  };
}

class StateStore {
  private store = new Map<string, HomeState>();

  get(home_id: string): HomeState {
    if (!this.store.has(home_id)) {
      this.store.set(home_id, freshHomeState(home_id));
    }
    return this.store.get(home_id)!;
  }

  set(home_id: string, state: HomeState): void {
    state.last_updated = new Date().toISOString();
    this.store.set(home_id, state);
  }

  // ── Device ops ──────────────────────────────────────────────────

  registerDevice(home_id: string, device: DeviceInstance): void {
    const home = this.get(home_id);
    home.devices[device.device_id] = device;
    // Ensure room references device
    if (home.rooms[device.room_id]) {
      if (!home.rooms[device.room_id].device_ids.includes(device.device_id)) {
        home.rooms[device.room_id].device_ids.push(device.device_id);
      }
    }
    this.set(home_id, home);
  }

  setDeviceProperty(home_id: string, device_id: string, property: string, value: any): boolean {
    const home = this.get(home_id);
    const device = home.devices[device_id];
    if (!device || !device.properties[property]) return false;
    const prop = device.properties[property];
    prop.previous_value = prop.current_value;
    prop.current_value = value;
    prop.last_changed = new Date().toISOString();
    device.last_updated = new Date().toISOString();
    this.set(home_id, home);
    return true;
  }

  setDeviceOnline(home_id: string, device_id: string, online: boolean): void {
    const home = this.get(home_id);
    if (home.devices[device_id]) {
      home.devices[device_id].online = online;
      home.devices[device_id].last_updated = new Date().toISOString();
    }
    this.set(home_id, home);
  }

  removeDevice(home_id: string, device_id: string): void {
    const home = this.get(home_id);
    const device = home.devices[device_id];
    if (device && home.rooms[device.room_id]) {
      home.rooms[device.room_id].device_ids = home.rooms[device.room_id].device_ids.filter(id => id !== device_id);
    }
    delete home.devices[device_id];
    home.t0_rules = home.t0_rules.filter(r => r.action.device_id !== device_id);
    this.set(home_id, home);
  }

  // ── Room ops ────────────────────────────────────────────────────

  addRoom(home_id: string, room: Room): void {
    const home = this.get(home_id);
    home.rooms[room.room_id] = room;
    this.set(home_id, home);
  }

  setOccupancy(home_id: string, room_id: string, occupancy: Partial<Occupancy>): void {
    const home = this.get(home_id);
    if (home.rooms[room_id]) {
      home.rooms[room_id].occupancy = { ...home.rooms[room_id].occupancy, ...occupancy, last_updated: new Date().toISOString() };
    }
    this.set(home_id, home);
  }

  // ── Rule ops ────────────────────────────────────────────────────

  addT0Rule(home_id: string, rule: T0Rule): void {
    const home = this.get(home_id);
    const exists = home.t0_rules.findIndex(r => r.rule_id === rule.rule_id);
    if (exists >= 0) home.t0_rules[exists] = rule;
    else home.t0_rules.push(rule);
    this.set(home_id, home);
  }

  addProposedRule(home_id: string, proposal: ProposedRule): void {
    const home = this.get(home_id);
    home.proposed_rules.unshift(proposal);
    if (home.proposed_rules.length > 20) home.proposed_rules = home.proposed_rules.slice(0, 20);
    this.set(home_id, home);
  }

  confirmProposedRule(home_id: string, proposal_id: string): T0Rule | null {
    const home = this.get(home_id);
    const proposal = home.proposed_rules.find(p => p.proposal_id === proposal_id);
    if (!proposal || proposal.status !== 'pending') return null;
    proposal.status = 'confirmed';
    const rule: T0Rule = { ...proposal.rule_if_confirmed, created_at: new Date().toISOString(), trigger_count: 0 };
    this.addT0Rule(home_id, rule);
    return rule;
  }

  rejectProposedRule(home_id: string, proposal_id: string): boolean {
    const home = this.get(home_id);
    const proposal = home.proposed_rules.find(p => p.proposal_id === proposal_id);
    if (!proposal) return false;
    proposal.status = 'rejected';
    this.set(home_id, home);
    return true;
  }

  // ── Learning ops ────────────────────────────────────────────────

  addSoundCluster(home_id: string, cluster: SoundCluster): void {
    const home = this.get(home_id);
    const existing = home.sound_clusters.find(c => c.cluster_id === cluster.cluster_id);
    if (existing) {
      existing.occurrence_count++;
      existing.last_seen = new Date().toISOString();
    } else {
      home.sound_clusters.push(cluster);
    }
    this.set(home_id, home);
  }

  identifySoundCluster(home_id: string, cluster_id: string, label: string): void {
    const home = this.get(home_id);
    const cluster = home.sound_clusters.find(c => c.cluster_id === cluster_id);
    if (cluster) { cluster.identified = true; cluster.label = label; }
    this.set(home_id, home);
  }

  // ── Event history ────────────────────────────────────────────────

  addEvent(home_id: string, record: EventRecord): void {
    const home = this.get(home_id);
    home.event_history.unshift(record);
    if (home.event_history.length > 200) home.event_history = home.event_history.slice(0, 200);

    // Update stats
    if (record.tier === 'T0') home.stats.t0_hits++;
    else if (record.tier === 'T1') home.stats.t1_hits++;
    else if (record.tier === 'T3') home.stats.t3_hits++;
    else if (record.tier === 'CACHED') home.stats.cache_hits++;
    if (record.cost_usd) home.stats.total_cost_usd += record.cost_usd;

    this.set(home_id, home);
  }

  // ── Regime ──────────────────────────────────────────────────────

  setRegime(home_id: string, regime: Regime, reason: string): void {
    const home = this.get(home_id);
    if (home.current_regime !== regime) {
      home.current_regime = regime;
      home.regime_history.unshift({ regime, started_at: new Date().toISOString(), reason });
      if (home.regime_history.length > 30) home.regime_history = home.regime_history.slice(0, 30);
    }
    this.set(home_id, home);
  }

  // ── Inventory ────────────────────────────────────────────────────

  setInventory(home_id: string, item: string, quantity: number): void {
    const home = this.get(home_id);
    if (home.inventory[item]) home.inventory[item].quantity = quantity;
    this.set(home_id, home);
  }

  // ── Meta ─────────────────────────────────────────────────────────

  listHomes(): string[] { return Array.from(this.store.keys()); }

  resetHome(home_id: string): void {
    this.store.set(home_id, freshHomeState(home_id));
  }

  getStats(home_id: string) {
    const home = this.get(home_id);
    const total = home.stats.t0_hits + home.stats.t1_hits + home.stats.t3_hits + home.stats.cache_hits;
    return {
      ...home.stats,
      total_events: total,
      t0_percent: total ? ((home.stats.t0_hits / total) * 100).toFixed(1) + '%' : '0%',
      t1_percent: total ? ((home.stats.t1_hits / total) * 100).toFixed(1) + '%' : '0%',
      t3_percent: total ? ((home.stats.t3_hits / total) * 100).toFixed(1) + '%' : '0%',
      cache_percent: total ? ((home.stats.cache_hits / total) * 100).toFixed(1) + '%' : '0%',
      active_t0_rules: home.t0_rules.length,
      pending_proposals: home.proposed_rules.filter(p => p.status === 'pending').length,
    };
  }
}

export const stateStore = new StateStore();
