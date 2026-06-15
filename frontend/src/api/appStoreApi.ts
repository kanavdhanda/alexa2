import { apiClient } from './client';
import { endpoints } from './endpoints';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppStoreStats {
  total_modules: number;
  total_installs: number;
  verified_modules: number;
  categories: Record<string, number>;
}

export interface AppStoreModule {
  module_id: string;
  name: string;
  version: string;
  author: string;
  brand?: string;
  model_pattern?: string;
  category: string;
  tags: string[];
  device_type: string;
  downloads: number;
  rating?: number;
  verified: boolean;
  published_at: string;
  description?: string;
  safety_class?: 'CRITICAL' | 'STANDARD' | 'CONVENIENCE';
  auto_t0_rules?: Array<{ description: string }>;
  knowledge_pack_frag?: string;
  t1_intents?: string[];
}

export interface GeneratedModule {
  module_id: string;
  name: string;
  draft: AppStoreModule;
  is_mock: boolean;
  message: string;
}

export interface InstallResult {
  success: boolean;
  module_id: string;
  module_name?: string;
  extra_rules?: number;
  message?: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const appStoreApi = {
  getStats: () =>
    apiClient.get<AppStoreStats>(endpoints.appStoreStats),

  getCategories: () =>
    apiClient.get<{ categories: Record<string, number> }>(endpoints.appStoreCategories),

  getModules: (params?: { category?: string; brand?: string; device_type?: string; verified?: boolean; q?: string }) => {
    const qs = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return apiClient.get<{ modules: AppStoreModule[] }>(`${endpoints.appStoreModules}${qs}`);
  },

  getModule: (moduleId: string) =>
    apiClient.get<AppStoreModule>(endpoints.appStoreModule(moduleId)),

  generateModule: (description: string, device_type: string, brand?: string, model?: string) =>
    apiClient.post<GeneratedModule>(endpoints.appStoreGenerate, { description, device_type, brand, model }),

  installModule: (moduleId: string, homeId?: string) =>
    apiClient.post<InstallResult>(endpoints.appStoreInstall(moduleId, homeId)),

  publishModule: (payload: Partial<AppStoreModule>) =>
    apiClient.post<AppStoreModule>(endpoints.appStoreModules, payload),

  getTemplate: () =>
    apiClient.get<AppStoreModule>(endpoints.appStoreTemplate),
};
