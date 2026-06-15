import { apiClient } from './client';
import { endpoints } from './endpoints';
import { env } from '../config/env';

// ── Response types ────────────────────────────────────────────────────────────

export interface Anticipation {
  action: string;
  reason: string;
  tier: 'T0' | 'T1' | 'T3' | string;
  confidence: number;
  trigger_window?: string;
}

export interface AnticipationsResponse {
  home_id: string;
  generated_at: string;
  anticipations: Anticipation[];
}

export interface TwinModeInfo {
  label: string;
  color: string;
  description: string;
}

export interface TwinMode {
  mode: string;
  label: string;
  description: string;
  color: string;
}

export interface TwinRoom {
  id: string;
  name: string;
  device_count: number;
  on_count: number;
  devices: Array<{
    id: string;
    type: string;
    name: string;
    primary_state: string;
    architecture_tier: string;
  }>;
}

export interface DigitalTwinResponse {
  home_id: string;
  current_mode: string;
  mode_info: TwinModeInfo;
  available_modes: TwinMode[];
  rooms: TwinRoom[];
  snapshot_at: string;
}

export interface HomeDevice {
  id: string;
  name: string;
  type: string;
  room_id: string | null;
  state: Record<string, unknown>;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const homeApi = {
  getAnticipations: (homeId = env.HOME_ID) =>
    apiClient.get<AnticipationsResponse>(endpoints.anticipations(homeId)),

  getDigitalTwin: (homeId = env.HOME_ID) =>
    apiClient.get<DigitalTwinResponse>(endpoints.digitalTwin(homeId)),

  getDevices: (homeId = env.HOME_ID) =>
    apiClient.get<{ devices: HomeDevice[] }>(endpoints.homeDevices(homeId)),

  seedHome: (homeId = env.HOME_ID) =>
    apiClient.post<{ success: boolean; message: string }>(endpoints.seedHome(homeId)),

  seedLearningHistory: (homeId = env.HOME_ID) =>
    apiClient.post<{ success: boolean; days_seeded: number }>(endpoints.seedHistory(homeId)),

  sendEvent: (
    homeId = env.HOME_ID,
    payload: { device_id: string; intent: string; params?: Record<string, unknown> }
  ) => apiClient.post(endpoints.event(homeId), payload),
};
