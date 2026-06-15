// All backend API route paths in one place.
// Import the `endpoints` object instead of constructing strings inline.

import { env } from '../config/env';

const h = env.HOME_ID; // shorthand

export const endpoints = {
  // ── Health ────────────────────────────────────────────────────────
  health: '/api/health',

  // ── Homes ─────────────────────────────────────────────────────────
  homes: '/api/homes',
  home: (homeId = h) => `/api/homes/${homeId}`,
  homeStats: (homeId = h) => `/api/homes/${homeId}/stats`,
  seedHome: (homeId = h) => `/api/homes/${homeId}/seed`,
  resetHome: (homeId = h) => `/api/homes/${homeId}/reset`,
  homeEvents: (homeId = h) => `/api/homes/${homeId}/events`,
  homeDevices: (homeId = h) => `/api/homes/${homeId}/devices`,
  homeDevice: (homeId = h, deviceId: string) => `/api/homes/${homeId}/devices/${deviceId}`,
  homeDeviceOnline: (homeId = h, deviceId: string) => `/api/homes/${homeId}/devices/${deviceId}/online`,
  homeInventory: (homeId = h) => `/api/homes/${homeId}/inventory`,
  homeSoundIdentify: (homeId = h, clusterId: string) => `/api/homes/${homeId}/sounds/${clusterId}/identify`,
  digitalTwin: (homeId = h) => `/api/homes/${homeId}/twin`,
  anticipations: (homeId = h) => `/api/homes/${homeId}/anticipations`,
  seedHistory: (homeId = h) => `/api/homes/${homeId}/seed-learning-history`,
  homeModules: (homeId = h) => `/api/homes/${homeId}/modules`,

  // ── Device Types ──────────────────────────────────────────────────
  deviceTypes: '/api/device-types',

  // ── Rooms ─────────────────────────────────────────────────────────
  homeRooms: (homeId = h) => `/api/homes/${homeId}/rooms`,
  homeRoom: (homeId = h, roomId: string) => `/api/homes/${homeId}/rooms/${roomId}`,
  homeRoomOccupancy: (homeId = h, roomId: string) => `/api/homes/${homeId}/rooms/${roomId}/occupancy`,

  // ── Regime ────────────────────────────────────────────────────────
  regime: (homeId = h) => `/api/homes/${homeId}/regime`,
  regimeRefresh: (homeId = h) => `/api/homes/${homeId}/regime/refresh`,

  // ── Rules ─────────────────────────────────────────────────────────
  rules: (homeId = h) => `/api/homes/${homeId}/rules`,
  rulesMine: (homeId = h) => `/api/homes/${homeId}/rules/mine`,
  rulesProposed: (homeId = h) => `/api/homes/${homeId}/rules/proposed`,
  ruleConfirm: (homeId = h, proposalId: string) => `/api/homes/${homeId}/rules/proposed/${proposalId}/confirm`,
  ruleReject: (homeId = h, proposalId: string) => `/api/homes/${homeId}/rules/proposed/${proposalId}/reject`,

  // ── Events ────────────────────────────────────────────────────────
  event: (homeId = h) => `/api/homes/${homeId}/event`,
  globalEvent: '/api/events',

  // ── Voice ─────────────────────────────────────────────────────────
  voiceConfig: '/api/voice/config',
  voiceSpeak: '/api/voice/speak',
  voiceRespond: '/api/voice/respond',
  voiceDemoPhrases: '/api/voice/demo-phrases',
  transcribe: '/api/voice/transcribe',
  tts: '/api/voice/tts',

  // ── Simulate ──────────────────────────────────────────────────────
  simulateGeyser: '/api/simulate/geyser',
  simulateInventoryDrop: '/api/simulate/inventory_drop',
  simulateUnknownSound: '/api/simulate/unknown_sound',
  simulateMotorSafety: '/api/simulate/motor_safety',
  simulateVoiceCommand: '/api/simulate/voice_command',
  simulateStudyMode: '/api/simulate/study_mode',
  simulateNightSafety: '/api/simulate/night_safety_check',
  simulatePowerCut: '/api/simulate/power_cut',

  // ── App Store (MCP Modules) ───────────────────────────────────────
  appStoreStats: '/api/app-store/stats',
  appStoreCategories: '/api/app-store/categories',
  appStoreModules: '/api/app-store/modules',
  appStoreModule: (moduleId: string) => `/api/app-store/modules/${moduleId}`,
  appStoreTemplate: '/api/app-store/modules/template',
  appStoreGenerate: '/api/app-store/generate-module',
  appStoreInstall: (moduleId: string, homeId = h) => `/api/app-store/modules/${moduleId}/install/${homeId}`,
} as const;
