import { apiClient } from './client';
import { endpoints } from './endpoints';
import { env } from '../config/env';

const h = env.HOME_ID;

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ApiResult { success?: boolean; message?: string; [key: string]: unknown }

// ── Device types ──────────────────────────────────────────────────────────────

export interface DeviceTypeDef {
  type: string;
  label: string;
  category: string;
  capabilities: string[];
}

// ── Regime ────────────────────────────────────────────────────────────────────

export interface RegimeState {
  home_id: string;
  current_regime: string;
  label: string;
  description: string;
  color: string;
  since: string;
  override?: boolean;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export interface T0Rule {
  rule_id: string;
  description: string;
  trigger_event: string;
  action: string;
  conditions?: Record<string, unknown>;
  enabled: boolean;
  source?: string;
}

export interface ProposedRule {
  proposal_id: string;
  description: string;
  trigger_event?: string;
  action?: string;
  confidence?: number;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at?: string;
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export interface VoiceConfig {
  stt_provider: string;
  tts_provider: string;
  tts_voice: string;
  language: string;
  mock_mode: boolean;
}

// ── Home ──────────────────────────────────────────────────────────────────────

export interface HomeStats {
  home_id: string;
  total_devices: number;
  online_devices: number;
  total_rooms: number;
  occupied_rooms: number;
  active_rules: number;
  regime: string;
  [key: string]: unknown;
}

export interface HomeEventEntry {
  event_id: string;
  timestamp: string;
  device_id?: string;
  intent?: string;
  tier?: string;
  actions_taken?: unknown[];
  [key: string]: unknown;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const backendApi = {
  // Health
  health: () => apiClient.get<ApiResult>(endpoints.health),

  // Homes
  listHomes: () => apiClient.get<{ homes: unknown[] }>(endpoints.homes),
  getHomeState: (homeId = h) => apiClient.get<ApiResult>(endpoints.home(homeId)),
  getHomeStats: (homeId = h) => apiClient.get<HomeStats>(endpoints.homeStats(homeId)),
  resetHome: (homeId = h) => apiClient.post<ApiResult>(endpoints.resetHome(homeId)),
  getEventHistory: (homeId = h) => apiClient.get<{ events: HomeEventEntry[] }>(endpoints.homeEvents(homeId)),
  updateInventory: (homeId = h, items: Record<string, unknown>) =>
    apiClient.patch(endpoints.homeInventory(homeId), { items }),
  identifySound: (homeId = h, clusterId: string) =>
    apiClient.patch(endpoints.homeSoundIdentify(homeId, clusterId), {}),
  getInstalledModules: (homeId = h) =>
    apiClient.get<{ modules: unknown[] }>(endpoints.homeModules(homeId)),

  // Device types
  listDeviceTypes: () => apiClient.get<{ device_types: DeviceTypeDef[] }>(endpoints.deviceTypes),

  // Devices (per-home)
  listDevices: (homeId = h) =>
    apiClient.get<{ devices: unknown[] }>(endpoints.homeDevices(homeId)),
  registerDevice: (homeId = h, payload: { name: string; type: string; room_id?: string }) =>
    apiClient.post<ApiResult>(endpoints.homeDevices(homeId), payload),
  getDevice: (homeId = h, deviceId: string) =>
    apiClient.get<ApiResult>(endpoints.homeDevice(homeId, deviceId)),
  updateDevice: (homeId = h, deviceId: string, property: string, value: unknown) =>
    apiClient.patch(endpoints.homeDevice(homeId, deviceId), { property, value }),
  deleteDevice: (homeId = h, deviceId: string) =>
    apiClient.delete<ApiResult>(endpoints.homeDevice(homeId, deviceId)),
  setDeviceOnline: (homeId = h, deviceId: string, online: boolean) =>
    apiClient.patch(endpoints.homeDeviceOnline(homeId, deviceId), { online }),

  // Rooms
  listRooms: (homeId = h) => apiClient.get<{ rooms: unknown[] }>(endpoints.homeRooms(homeId)),
  createRoom: (homeId = h, payload: { name: string; width?: number; depth?: number }) =>
    apiClient.post<ApiResult>(endpoints.homeRooms(homeId), payload),
  getRoom: (homeId = h, roomId: string) =>
    apiClient.get<ApiResult>(endpoints.homeRoom(homeId, roomId)),
  updateOccupancy: (homeId = h, roomId: string, occupied: boolean) =>
    apiClient.patch(endpoints.homeRoomOccupancy(homeId, roomId), { occupied }),

  // Regime
  getRegime: (homeId = h) => apiClient.get<RegimeState>(endpoints.regime(homeId)),
  forceRegime: (homeId = h, regime: string) =>
    apiClient.post<ApiResult>(endpoints.regime(homeId), { regime }),
  refreshRegime: (homeId = h) => apiClient.post<ApiResult>(endpoints.regimeRefresh(homeId)),

  // Rules
  listT0Rules: (homeId = h) => apiClient.get<{ rules: T0Rule[] }>(endpoints.rules(homeId)),
  runRuleMiner: (homeId = h) => apiClient.post<ApiResult>(endpoints.rulesMine(homeId)),
  listProposedRules: (homeId = h) =>
    apiClient.get<{ proposed: ProposedRule[] }>(endpoints.rulesProposed(homeId)),
  confirmRule: (homeId = h, proposalId: string) =>
    apiClient.post<ApiResult>(endpoints.ruleConfirm(homeId, proposalId)),
  rejectRule: (homeId = h, proposalId: string) =>
    apiClient.post<ApiResult>(endpoints.ruleReject(homeId, proposalId)),

  // Voice
  getVoiceConfig: () => apiClient.get<VoiceConfig>(endpoints.voiceConfig),
  speak: (text: string, voice?: string) =>
    apiClient.post<{ audio_url?: string; text: string }>(endpoints.voiceSpeak, { text, voice }),
  getDemoPhrases: () => apiClient.get<unknown>(endpoints.voiceDemoPhrases),

  // Simulate
  simulateGeyser: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateGeyser, { home_id: homeId }),
  simulateInventoryDrop: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateInventoryDrop, { home_id: homeId }),
  simulateUnknownSound: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateUnknownSound, { home_id: homeId }),
  simulateMotorSafety: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateMotorSafety, { home_id: homeId }),
  simulateVoiceCommand: (homeId = h, text: string) =>
    apiClient.post<ApiResult>(endpoints.simulateVoiceCommand, { home_id: homeId, text }),
  simulateStudyMode: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateStudyMode, { home_id: homeId }),
  simulateNightSafety: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulateNightSafety, { home_id: homeId }),
  simulatePowerCut: (homeId = h) =>
    apiClient.post<ApiResult>(endpoints.simulatePowerCut, { home_id: homeId }),

  // App Store extras
  getModuleTemplate: () => apiClient.get<unknown>(endpoints.appStoreTemplate),
};
