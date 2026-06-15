// Barrel export — import from '@/api' (or '../../api') to access all API modules.
// Never import directly from sub-modules in components or hooks.

export { apiClient, ApiError } from './client';
export { endpoints } from './endpoints';
export { homeApi } from './homeApi';
export { voiceApi } from './voiceApi';
export { simulateApi } from './simulateApi';
export { appStoreApi } from './appStoreApi';
export { backendApi } from './backendApi';

export type { Anticipation, AnticipationsResponse, DigitalTwinResponse, TwinModeInfo, TwinRoom, HomeDevice } from './homeApi';
export type { TranscribeResponse, TtsResponse } from './voiceApi';
export type { SimulateResult, SimulateEndpoint } from './simulateApi';
export type { AppStoreModule, AppStoreStats, GeneratedModule, InstallResult } from './appStoreApi';
export type { RegimeState, T0Rule, ProposedRule, VoiceConfig, HomeStats, ApiResult } from './backendApi';
