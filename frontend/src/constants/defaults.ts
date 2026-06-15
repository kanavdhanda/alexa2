import type { PlacedObject, AssetType, AlexaDeviceState } from '../types';
import { ASSET_MAP } from './assets';

function obj(
  id: string,
  type: AssetType,
  x: number,
  z: number,
  rotY: number,
  roomId: string,
  stateOverrides: Partial<AlexaDeviceState> = {},
  desc?: string
): PlacedObject {
  const def = ASSET_MAP.get(type)!;
  return {
    id,
    type,
    position:         { x, y: 0, z },
    rotation:         { x: 0, y: rotY, z: 0 },
    description:      desc ?? def.defaultDescription,
    deviceName:       def.label,
    parentRoomId:     roomId,
    isAlexaDevice:    def.isAlexaDevice,
    alexaDeviceState: { ...def.defaultState, ...stateOverrides },
    color:            def.color,
  };
}

const PI  = Math.PI;
const HPI = Math.PI / 2;

// ── Room bounds ───────────────────────────────────────────────────────────────
//   living-room:    x[-12, 4]  z[-8, 0]   centre (-4, -4)
//   kitchen:        x[4,  12]  z[-8, 0]   centre ( 8, -4)
//   master-bedroom: x[-12, -4] z[0,   8]  centre (-8,  4)
//   bathroom:       x[-4,   0] z[0,   8]  centre (-2,  4)  ← compact
//   office:         x[4,  12]  z[0,   8]  centre ( 8,  4)

export const DEFAULT_PLACED_OBJECTS: PlacedObject[] = [

  // ── Living Room ───────────────────────────────────────────────────────────────
  obj('lr-sofa',    'sofa',         -4.0, -2.5,  PI,   'living-room',
    {}, 'Living Room · Main sofa facing the TV — 3-seater against south side'),
  obj('lr-sofa2',   'sofa',         -7.5, -4.8,  HPI,  'living-room',
    {}, 'Living Room · Left side sofa — faces the coffee table'),
  obj('lr-sofa3',   'sofa',         -0.5, -4.8, -HPI,  'living-room',
    {}, 'Living Room · Right side sofa — faces the coffee table'),
  obj('lr-table',   'table',        -4.0, -4.8,   0,   'living-room',
    {}, 'Living Room · Coffee table — centre of seating area'),

  obj('lr-tvstand', 'tv-stand',     -4.0, -7.2,   0,   'living-room',
    {}, 'Living Room · TV unit — against north wall below the Smart TV'),
  obj('lr-tv',      'smart-tv',     -4.0, -7.0,   0,   'living-room',
    { isOn: false, volume: 30, channel: 3 },
    'Living Room · 55" Smart TV — north wall, voice-controlled via Alexa'),

  // Bookshelf pressed against west wall (x=-12). Depth=0.3, rotated HPI → x extent=0.3
  obj('lr-shelf',   'bookshelf',   -11.85, -7.2,  HPI,  'living-room',
    {}, 'Living Room · Bookshelf — pressed against west wall, corner'),

  obj('lr-echo',    'echo-dot',     -9.5, -7.2,   0,   'living-room',
    { isOn: true, volume: 55 },
    'Living Room · Echo Dot — side table near TV, primary Alexa speaker'),
  obj('lr-bulb',    'smart-bulb',   -4.0, -4.0,   0,   'living-room',
    { isOn: true, brightness: 80, colorTemp: 3000 },
    'Living Room · Ceiling light — centre pendant, warm 3000K, dimmable'),
  obj('lr-motion',  'motion-sensor',-11.5, -1.5,   0,   'living-room',
    { isOn: true, motionDetected: false },
    'Living Room · Motion sensor — high on west wall, covers entrance zone'),
  obj('lr-plant1',  'plant',         2.5, -7.2,   0,   'living-room',
    {}, 'Living Room · Decorative plant — north-east corner near entrance'),
  obj('lr-plant2',  'plant',       -11.5, -1.2,   0,   'living-room',
    {}, 'Living Room · Decorative plant — south-west corner near hallway'),

  // ── Kitchen ──────────────────────────────────────────────────────────────────
  obj('kt-table',   'table',         8.0, -4.5,   0,   'kitchen',
    {}, 'Kitchen · Dining table — centre of kitchen, seats 4'),
  obj('kt-chair1',  'chair',         6.5, -4.5,  HPI,  'kitchen',
    {}, 'Kitchen · Dining chair — west side of table, faces east'),
  obj('kt-chair2',  'chair',         9.5, -4.5, -HPI,  'kitchen',
    {}, 'Kitchen · Dining chair — east side of table, faces west'),

  obj('kt-thermo',  'thermostat',   11.5, -4.0,  HPI,  'kitchen',
    { isOn: true, temperature: 21.5, humidity: 44 },
    'Kitchen · Thermostat — east wall, monitors cooking zone temperature'),
  obj('kt-plug',    'smart-plug',   11.5, -7.5,   0,   'kitchen',
    { isOn: true, powerConsumption: 65 },
    'Kitchen · Smart Plug — north-east corner, powers the water heater'),
  obj('kt-bulb',    'smart-bulb',    8.0, -4.0,   0,   'kitchen',
    { isOn: true, brightness: 90, colorTemp: 5000 },
    'Kitchen · Ceiling light — centre pendant, bright 5000K for cooking'),
  obj('kt-echo',    'echo-dot',      5.2, -7.2,   0,   'kitchen',
    { isOn: true, volume: 45 },
    'Kitchen · Echo Dot — north counter, Alexa hands-free while cooking'),
  obj('kt-plant',   'plant',         5.2, -1.2,   0,   'kitchen',
    {}, 'Kitchen · Herb/plant — south-west windowsill area'),

  // ── Master Bedroom ────────────────────────────────────────────────────────────
  // Bed south wall — headboard at z=7.5, facing north (PI = south-facing back)
  obj('mb-bed',     'bed',          -8.0,  6.5,  PI,   'master-bedroom',
    {}, 'Master Bedroom · Queen bed — against south wall, headboard at z=8'),
  // Wardrobe against west wall (x=-12). Depth=0.56 rotated HPI → x extent=0.56
  obj('mb-wardrobe','wardrobe',    -11.72,  6.2, HPI,  'master-bedroom',
    {}, 'Master Bedroom · Almirah/wardrobe — flush against west wall'),
  obj('mb-show',    'echo-show',   -10.8,  0.6,   0,   'master-bedroom',
    { isOn: true, brightness: 60, volume: 30 },
    'Master Bedroom · Echo Show 10 — north-west corner, alarm & morning brief'),
  obj('mb-bulb',    'smart-bulb',   -8.0,  4.0,   0,   'master-bedroom',
    { isOn: false, brightness: 40, colorTemp: 2700 },
    'Master Bedroom · Ceiling light — centre pendant, soft 2700K for sleep'),
  obj('mb-lock',    'smart-lock',   -9.5,  0.3,   0,   'master-bedroom',
    { isOn: true, isLocked: true },
    'Master Bedroom · Smart Lock — north wall door to hallway'),
  obj('mb-plant',   'plant',        -5.2,  7.2,   0,   'master-bedroom',
    {}, 'Master Bedroom · Decorative plant — south-east corner'),

  // ── Bathroom ─────────────────────────────────────────────────────────────────
  obj('ba-tub',     'bathtub',      -2.0,  6.0,   0,   'bathroom',
    {}, 'Bathroom · Bathtub — south section against back wall'),
  obj('ba-bulb',    'smart-bulb',   -2.0,  4.0,   0,   'bathroom',
    { isOn: true, brightness: 100, colorTemp: 5500 },
    'Bathroom · Ceiling light — cool 5500K, full brightness for grooming'),
  obj('ba-smoke',   'smoke-detector',-2.0, 0.6,   0,   'bathroom',
    { isOn: true, batteryLevel: 95 },
    'Bathroom · Smoke & humidity detector — near entrance'),
  obj('ba-echo',    'echo-dot',     -3.2,  7.5,  PI,   'bathroom',
    { isOn: true, volume: 25 },
    'Bathroom · Echo Dot — south-west corner, shower music & timers'),

  // ── Office ───────────────────────────────────────────────────────────────────
  // Desk against north wall (z=0). Chair faces north toward desk (PI).
  obj('of-desk',    'desk',          8.0,  1.5,   0,   'office',
    {}, 'Office · Standing desk — north wall, built-in monitor'),
  obj('of-chair',   'chair',         8.0,  2.8,  PI,   'office',
    {}, 'Office · Ergonomic chair — faces north toward the desk'),
  obj('of-tv',      'smart-tv',      8.0,  0.6,   0,   'office',
    { isOn: false, volume: 20, channel: 1 },
    'Office · Smart TV / presentation screen — north wall above desk'),
  // Bookshelf against east wall (x=12). Depth=0.3 rotated HPI → x extent=0.3
  obj('of-shelf',   'bookshelf',    11.85,  4.5,  HPI,  'office',
    {}, 'Office · Bookshelf — flush against east wall'),
  obj('of-echo',    'echo-dot',      5.5,  0.6,   0,   'office',
    { isOn: true, volume: 35 },
    'Office · Echo Dot — west counter, voice commands while working'),
  obj('of-air',     'air-purifier',  5.5,  7.2,   0,   'office',
    { isOn: true, speed: 2, airQuality: 28 },
    'Office · Air purifier — south-west corner, reduces PM2.5 while working'),
  obj('of-plug',    'smart-plug',   11.5,  1.0,   0,   'office',
    { isOn: false },
    'Office · Smart Plug — east wall, powers secondary monitor / laptop'),
  obj('of-plant',   'plant',        11.5,  7.2,   0,   'office',
    {}, 'Office · Desk plant — south-east corner, air quality + calm'),
  obj('of-bulb',    'smart-bulb',    8.0,  4.0,   0,   'office',
    { isOn: true, brightness: 70, colorTemp: 4000 },
    'Office · Ceiling light — neutral 4000K for focus, dimmable'),

  // ── Ceiling fans (one per room, centre of each) ───────────────────────────────
  obj('lr-fan',  'ceiling-fan', -4.0, -4.0, 0, 'living-room',
    { isOn: true,  speed: 2 }, 'Living Room · Ceiling fan — runs at speed 2'),
  obj('kt-fan',  'ceiling-fan',  8.0, -4.0, 0, 'kitchen',
    { isOn: false, speed: 1 }, 'Kitchen · Ceiling fan — off by default'),
  obj('mb-fan',  'ceiling-fan', -8.0,  4.0, 0, 'master-bedroom',
    { isOn: false, speed: 1 }, 'Master Bedroom · Ceiling fan — sleep timer enabled'),
  obj('ba-fan',  'ceiling-fan', -2.0,  4.0, 0, 'bathroom',
    { isOn: false, speed: 1 }, 'Bathroom · Exhaust fan — auto-on with humidity sensor'),
  obj('of-fan',  'ceiling-fan',  8.0,  4.0, 0, 'office',
    { isOn: true,  speed: 3 }, 'Office · Ceiling fan — runs at speed 3 for cooling'),
];
