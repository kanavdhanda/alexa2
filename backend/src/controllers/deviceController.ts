import { Request, Response } from 'express';
import { stateStore } from '../stateStore';
import { createDeviceFromTemplate, generateAutoT0Rules, validatePropertyUpdate, DEVICE_TYPE_CATALOG } from '../deviceRegistry';
import { wsServer } from '../websocket';
import { appStore } from '../appStore';

export function listDeviceTypes(_req: Request, res: Response) {
  return res.json({
    device_types: Object.keys(DEVICE_TYPE_CATALOG),
    catalog: DEVICE_TYPE_CATALOG,
  });
}

export function registerDevice(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { device_id, type, room_id, friendly_name, overrides } = req.body;

  if (!device_id || !type || !room_id) {
    return res.status(400).json({ error: 'device_id, type, and room_id are required' });
  }

  const home = stateStore.get(home_id);
  if (!home.rooms[room_id]) {
    return res.status(400).json({ error: `Room ${room_id} does not exist. Create it first via POST /api/homes/:id/rooms` });
  }
  if (!DEVICE_TYPE_CATALOG[type]) {
    return res.status(400).json({ error: `Unknown device type: ${type}`, available_types: Object.keys(DEVICE_TYPE_CATALOG) });
  }

  const { brand, model } = req.body;

  const device = createDeviceFromTemplate(device_id, type, room_id, { friendly_name, ...overrides });
  stateStore.registerDevice(home_id, device);

  // Auto-generate T0 rules from device registry
  const autoRules = generateAutoT0Rules(device);
  for (const rule of autoRules) {
    stateStore.addT0Rule(home_id, rule);
  }

  // Auto-attach app store module if a match exists
  let module_attached: { module_id: string; name: string; extra_rules: number } | null = null;
  const matchedModule = appStore.findMatch(type, brand, model);
  if (matchedModule) {
    appStore.install(home_id, matchedModule.module_id);
    let extra_rules = 0;
    for (const ruleSpec of matchedModule.mcp_definition.auto_t0_rules) {
      const rule_id = `${device_id}_module_${ruleSpec.rule_id_suffix}`;
      if (!autoRules.find(r => r.rule_id === rule_id)) {
        stateStore.addT0Rule(home_id, {
          rule_id,
          description: `[${matchedModule.name}] ${ruleSpec.description}`,
          condition_fn_key: ruleSpec.condition_fn_key,
          condition_params: ruleSpec.condition_params_fn(device_id),
          action: { device_id, property: ruleSpec.action_property, value: ruleSpec.action_value },
          confidence: ruleSpec.confidence,
          promoted_from_t3: false,
          created_at: new Date().toISOString(),
          trigger_count: 0,
        });
        extra_rules++;
      }
    }
    module_attached = { module_id: matchedModule.module_id, name: matchedModule.name, extra_rules };
  }

  wsServer?.broadcastDeviceUpdate(home_id, device_id, 'registered', device);

  return res.status(201).json({
    message: `Device ${device_id} registered`,
    device,
    auto_t0_rules_generated: autoRules.length,
    rules: autoRules,
    module_attached,
  });
}

export function getDevice(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const device_id = req.params['device_id'] as string;
  const home = stateStore.get(home_id);
  const device = home.devices[device_id];
  if (!device) return res.status(404).json({ error: `Device ${device_id} not found` });
  return res.json(device);
}

export function listDevices(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const { room_id, safety_class, type } = req.query;
  let devices = Object.values(home.devices);
  if (room_id) devices = devices.filter(d => d.room_id === room_id);
  if (safety_class) devices = devices.filter(d => d.safety_class === safety_class);
  if (type) devices = devices.filter(d => d.type === type);
  return res.json({ home_id, count: devices.length, devices });
}

export function updateDeviceProperty(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const device_id = req.params['device_id'] as string;
  const { property, value } = req.body;

  if (!property || value === undefined) {
    return res.status(400).json({ error: 'property and value are required' });
  }

  const home = stateStore.get(home_id);
  const device = home.devices[device_id];
  if (!device) return res.status(404).json({ error: `Device ${device_id} not found` });

  const validation = validatePropertyUpdate(device, property, value);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  stateStore.setDeviceProperty(home_id, device_id, property, value);
  wsServer?.broadcastDeviceUpdate(home_id, device_id, property, value);

  return res.json({ home_id, device_id, property, new_value: value, device: stateStore.get(home_id).devices[device_id] });
}

export function removeDevice(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const device_id = req.params['device_id'] as string;
  const home = stateStore.get(home_id);
  if (!home.devices[device_id]) return res.status(404).json({ error: `Device ${device_id} not found` });
  stateStore.removeDevice(home_id, device_id);
  return res.json({ message: `Device ${device_id} removed`, t0_rules_also_removed: true });
}

export function setDeviceOnline(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const device_id = req.params['device_id'] as string;
  const { online } = req.body;
  stateStore.setDeviceOnline(home_id, device_id, !!online);
  wsServer?.broadcastDeviceUpdate(home_id, device_id, 'online', !!online);
  return res.json({ device_id, online: !!online });
}
