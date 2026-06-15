export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  z: number;
}

export interface WallSegment {
  id: string;
  fromId: string;
  toId: string;
  height: number;
  sharedBy: string[]; // room IDs — length 1 = exterior, 2 = interior divider
}

export type AlexaDeviceType =
  | 'smart-bulb'
  | 'echo-dot'
  | 'echo-show'
  | 'smart-plug'
  | 'motion-sensor'
  | 'thermostat'
  | 'smart-lock'
  | 'camera'
  | 'smoke-detector'
  | 'smart-tv'
  | 'ceiling-fan'
  | 'doorbell'
  | 'air-purifier';

export type FurnitureType =
  | 'sofa'
  | 'bed'
  | 'table'
  | 'chair'
  | 'tv-stand'
  | 'bookshelf'
  | 'bathtub'
  | 'desk'
  | 'plant'
  | 'wardrobe';

export type AssetType = AlexaDeviceType | FurnitureType;

export interface AlexaDeviceState {
  isOn: boolean;
  brightness?: number;       // 0-100
  colorTemp?: number;        // 2700-6500K
  temperature?: number;      // °C
  humidity?: number;         // %
  motionDetected?: boolean;
  powerConsumption?: number; // Watts
  batteryLevel?: number;     // %
  isLocked?: boolean;
  volume?: number;           // 0-100
  speed?: number;            // fan speed 1-5
  airQuality?: number;       // 0-500 AQI
  channel?: number;
}

export interface PlacedObject {
  id: string;
  type: AssetType;
  position: Vec3;
  rotation: Vec3;
  description: string;
  deviceName: string;
  parentRoomId: string | null;
  isAlexaDevice: boolean;
  alexaDeviceState: AlexaDeviceState;
  color?: string;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  width: number;
  depth: number;
  height: number;
  position: Vec3;
  color: string;
  floorColor: string;
  wallColor: string;
}

export type ActivePanel = 'alexa' | 'inspector' | 'library' | 'anticipations' | 'backend' | 'store';
export type AlexaTab = 'home' | 'devices' | 'routines';

export interface UIState {
  activeRoomId: string | null;
  selectedObjectId: string | null;
  hoveredObjectId: string | null;        // for DOM tooltip rendered outside Canvas
  activePanel: ActivePanel;
  placementAssetType: AssetType | null;
  isPlacementMode: boolean;
  hoveredRoomId: string | null;
  alexaTab: AlexaTab;
  showMiniMap: boolean;
  isListeningVoice: boolean;
  draggedAssetType: AssetType | null;    // live drag from library panel
  isLayoutEditMode: boolean;             // drag-to-reposition objects on the 3D canvas
  layoutLocked: boolean;                 // once true, all positions are permanently frozen
}

export interface AlexaNotification {
  id: string;
  message: string;
  type: 'info' | 'alert' | 'success' | 'warning';
  timestamp: number;
  deviceId?: string;
}

export interface Routine {
  id: string;
  name: string;
  emoji: string;
  triggerLabel: string;
  isEnabled: boolean;
  lastRun?: number;
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}
