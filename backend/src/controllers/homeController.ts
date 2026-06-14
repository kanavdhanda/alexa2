import { Request, Response } from 'express';
import { stateStore } from '../stateStore';

export function getHomeState(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  return res.json(stateStore.get(home_id));
}

export function listHomes(req: Request, res: Response) {
  return res.json({ homes: stateStore.listHomes() });
}

export function resetHomeState(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const homeState = stateStore.get(home_id);
  homeState.devices = {
    water_motor: { device_id: 'water_motor', type: 'pump', state: 'OFF', last_updated: new Date().toISOString() },
    geyser: { device_id: 'geyser', type: 'heater', state: 'OFF', last_updated: new Date().toISOString() },
    lpg_valve: { device_id: 'lpg_valve', type: 'valve', state: 'CLOSED', last_updated: new Date().toISOString() },
    living_room_fan: { device_id: 'living_room_fan', type: 'fan', state: 'OFF', last_updated: new Date().toISOString() },
    main_lights: { device_id: 'main_lights', type: 'light', state: 'OFF', last_updated: new Date().toISOString() },
  };
  homeState.inventory = {
    milk: { quantity: 2, unit: 'liters', threshold: 1 },
    lpg: { quantity: 80, unit: 'percent', threshold: 20 },
    rice: { quantity: 5, unit: 'kg', threshold: 2 },
    oil: { quantity: 1, unit: 'liters', threshold: 0.5 },
  };
  homeState.event_history = [];
  homeState.sound_clusters = [];
  stateStore.set(home_id, homeState);
  return res.json({ message: `Home ${home_id} state reset`, state: stateStore.get(home_id) });
}

export function updateDevice(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const device_id = req.params['device_id'] as string;
  const { state, metadata } = req.body;
  const updated = stateStore.updateDevice(home_id, device_id, { state, metadata });
  return res.json({ home_id, device_id, updated });
}

export function getEventHistory(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const limit = parseInt(req.query.limit as string) || 20;
  return res.json({
    home_id,
    total: home.event_history.length,
    events: home.event_history.slice(0, limit),
  });
}

export function getT0Rules(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  return res.json({
    home_id,
    t0_rules: home.t0_rules,
    cost_savings_estimate: `${home.t0_rules.length} active T0 rules → ~${(home.t0_rules.length * 30 * 0.002).toFixed(2)} USD/month saved vs cloud-only`,
  });
}

export function healthCheck(_req: Request, res: Response) {
  return res.json({
    status: 'ok',
    service: 'Alexa+ India Context Layer — Backend API',
    version: '1.0.0',
    architecture: 'T0→T1→T2→T3 Compute Cascade',
    active_homes: stateStore.listHomes().length,
    timestamp: new Date().toISOString(),
  });
}
