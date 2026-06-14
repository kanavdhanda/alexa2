import { Request, Response } from 'express';
import { stateStore } from '../stateStore';
import { seedDemoHome } from '../seedData';
import { ensureBuiltInSafetyRules } from '../ruleEngine';
import { financialSafety } from '../financialSafety';
import { semanticCache } from '../semanticCache';
import { wsServer } from '../websocket';

export function healthCheck(_req: Request, res: Response) {
  return res.json({
    status: 'ok',
    service: 'Alexa+ India Context Layer — Backend API v2',
    version: '2.0.0',
    architecture: 'T0 (reflex) → T1 (local NLU) → T2 (edge SLM, simulated) → T3 (Bedrock)',
    features: ['dynamic_device_registry', 'room_topology', 'regime_engine', 't1_local_nlu', 'semantic_cache', 'websocket_realtime', 'rule_miner', 'amazon_polly_tts', 'mock_llm_mode'],
    mock_llm_active: financialSafety.isMockMode(),
    active_homes: stateStore.listHomes().length,
    ws_connections: wsServer?.getStats().total_connections || 0,
    cache_stats: semanticCache.getStats(),
    financial_safety: financialSafety.getStats(),
    timestamp: new Date().toISOString(),
  });
}

export function listHomes(_req: Request, res: Response) {
  const homes = stateStore.listHomes().map(id => {
    const h = stateStore.get(id);
    return { home_id: id, display_name: h.display_name, regime: h.current_regime, device_count: Object.keys(h.devices).length, room_count: Object.keys(h.rooms).length, stats: stateStore.getStats(id) };
  });
  return res.json({ count: homes.length, homes });
}

export function getHomeState(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  return res.json(stateStore.get(home_id));
}

export function getHomeStats(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  return res.json({ home_id, ...stateStore.getStats(home_id) });
}

export function seedHome(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);

  // Seed rooms
  const { rooms, devices, t0_rules } = seedDemoHome(home_id);
  for (const room of rooms) stateStore.addRoom(home_id, room);
  for (const device of devices) stateStore.registerDevice(home_id, device);
  for (const rule of t0_rules) stateStore.addT0Rule(home_id, rule);

  // Add built-in safety rules
  ensureBuiltInSafetyRules(home_id);

  const seeded = stateStore.get(home_id);
  return res.json({
    message: `Home ${home_id} seeded with demo Indian home data`,
    rooms_created: Object.keys(seeded.rooms).length,
    devices_created: Object.keys(seeded.devices).length,
    t0_rules_created: seeded.t0_rules.length,
    home_state: seeded,
  });
}

export function resetHome(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  stateStore.resetHome(home_id);
  return res.json({ message: `Home ${home_id} reset to fresh state` });
}

export function getEventHistory(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const tier = req.query.tier as string;
  const home = stateStore.get(home_id);
  let events = home.event_history;
  if (tier) events = events.filter(e => e.tier === tier.toUpperCase());
  return res.json({ home_id, total: events.length, events: events.slice(0, limit) });
}

export function updateInventory(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { item, quantity } = req.body;
  if (!item || quantity === undefined) return res.status(400).json({ error: 'item and quantity are required' });
  stateStore.setInventory(home_id, item, quantity);
  return res.json({ home_id, item, new_quantity: quantity, inventory: stateStore.get(home_id).inventory });
}

export function identifySoundCluster(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const cluster_id = req.params['cluster_id'] as string;
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  stateStore.identifySoundCluster(home_id, cluster_id, label);
  return res.json({ home_id, cluster_id, label, message: 'Sound cluster identified. New local label minted.' });
}

/**
 * GET /api/homes/:home_id/twin
 * Digital Twin snapshot — the complete real-time representation of the home.
 * Includes mode, all rooms, all device states, regime, tier stats, and twin health.
 * Modes: normal | festival | guest | sleep | away
 */
export function getDigitalTwin(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const stats = stateStore.getStats(home_id);

  const DIGITAL_TWIN_MODES = {
    normal:   { label: 'Normal',   color: 'green',  description: 'Standard home operation — learning active, all automations running' },
    festival: { label: 'Festival', color: 'orange', description: 'Festival mode — decorative lighting on, learning paused, guest-friendly settings' },
    guest:    { label: 'Guest',    color: 'blue',   description: 'Guest present — personal notifications off, privacy mode, chai/coffee suggestions' },
    sleep:    { label: 'Sleep',    color: 'indigo', description: 'Night mode — noise suppressed, INFO notifications off, safety alerts still active' },
    away:     { label: 'Away',     color: 'gray',   description: 'Away mode — minimal automations, security watchdog active, no personal data processed' },
  };

  const rooms = Object.values(home.rooms || {}).map(room => ({
    ...room,
    devices: (room.device_ids || []).map(id => home.devices[id]).filter(Boolean).map(d => ({
      device_id: d.device_id,
      friendly_name: d.friendly_name,
      type: d.type,
      safety_class: d.safety_class,
      online: d.online,
      primary_state: d.properties['power']?.current_value ?? d.properties['open']?.current_value ?? null,
      properties: d.properties,
    })),
  }));

  return res.json({
    home_id,
    display_name: home.display_name,
    twin_health: 'LIVE',
    current_mode: home.current_regime,
    mode_info: DIGITAL_TWIN_MODES[home.current_regime] || DIGITAL_TWIN_MODES.normal,
    available_modes: DIGITAL_TWIN_MODES,
    rooms,
    inventory: home.inventory,
    sound_clusters: home.sound_clusters || [],
    t0_rules_count: home.t0_rules?.length || 0,
    stats,
    architecture_tier: {
      T0: { label: 'Reflex', latency: '<10ms', cost: '$0', share: '~80%' },
      T1: { label: 'Local NLU', latency: '<100ms', cost: '$0', share: '~12%' },
      T3: { label: 'Bedrock Cloud', latency: '0.5–3s', cost: '$$', share: '<3%' },
      CACHED: { label: 'Semantic Cache', latency: '0ms', cost: '$0', share: 'varies' },
    },
    snapshot_at: new Date().toISOString(),
  });
}
