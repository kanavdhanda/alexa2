// React hooks that wrap the API modules with loading/error state.
// Components import from here — never call apiClient directly in UI code.

import { useState, useEffect, useCallback } from 'react';
import { homeApi, voiceApi, simulateApi, appStoreApi, backendApi } from '../api';
import type { Anticipation, DigitalTwinResponse, SimulateEndpoint, AppStoreStats, AppStoreModule } from '../api';
import { ApiError } from '../api';
import { env } from '../config/env';
import { useAppStore } from '../store/store';

// Re-export types so existing consumers don't need to change imports
export type { Anticipation, DigitalTwinResponse as DigitalTwinData };

// ── Anticipations ─────────────────────────────────────────────────────────────

export function useAnticipations() {
  const [anticipations, setAnticipations] = useState<Anticipation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await homeApi.getAnticipations();
      setAnticipations(data.anticipations ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load anticipations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, env.POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch_]);

  return { anticipations, loading, error, refetch: fetch_ };
}

// ── Digital Twin State ────────────────────────────────────────────────────────

export function useDigitalTwin() {
  const [twinData, setTwinData] = useState<DigitalTwinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTwin = async () => {
      try {
        const data = await homeApi.getDigitalTwin();
        setTwinData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Backend offline');
      }
    };

    fetchTwin();
    const id = setInterval(fetchTwin, env.POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return { twinData, error };
}

// ── Backend Voice ─────────────────────────────────────────────────────────────

export function useBackendVoice() {
  const [isProcessing, setIsProcessing] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);
  const executeVoiceCommand = useAppStore((s) => s.executeVoiceCommand);

  const sendMockText = useCallback(
    async (text: string): Promise<{ transcript: string; response: string } | null> => {
      setIsProcessing(true);
      try {
        const data = await voiceApi.transcribeMockText(text, true);
        // Mirror the backend action in local state so the 3D scene updates immediately
        const localResponse = executeVoiceCommand(data.transcript ?? text);
        addNotification(`🎤 "${data.transcript ?? text}" → routed via backend`, 'success');
        return { transcript: data.transcript ?? text, response: localResponse };
      } catch {
        // Backend offline — degrade gracefully to local NLU
        const response = executeVoiceCommand(text);
        addNotification(`🎤 "${text}" → local NLU (backend offline)`, 'info');
        return { transcript: text, response };
      } finally {
        setIsProcessing(false);
      }
    },
    [executeVoiceCommand, addNotification]
  );

  const sendAudio = useCallback(
    async (audioBlob: Blob): Promise<{ transcript: string; response: string } | null> => {
      setIsProcessing(true);
      try {
        const data = await voiceApi.transcribeAudio(audioBlob, true);
        if (!data.transcript) return null;
        const localResponse = executeVoiceCommand(data.transcript);
        addNotification(`🎤 "${data.transcript}"`, 'success');
        return { transcript: data.transcript, response: localResponse };
      } catch (err) {
        addNotification(
          `Audio transcription failed: ${err instanceof ApiError ? err.message : 'Unknown error'}`,
          'alert'
        );
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [executeVoiceCommand, addNotification]
  );

  return { sendMockText, sendAudio, isProcessing };
}

// ── Simulate Events ───────────────────────────────────────────────────────────

export function useSimulateMode() {
  const addNotification = useAppStore((s) => s.addNotification);

  const simulate = useCallback(
    async (endpoint: SimulateEndpoint) => {
      try {
        const data = await simulateApi[endpoint]();
        const labels: Record<SimulateEndpoint, string> = {
          studyMode: 'Study Mode',
          nightSafetyCheck: 'Night Safety Check',
          powerCut: 'Power Cut Simulation',
        };
        addNotification(`⚡ ${labels[endpoint]} — ${data.message ?? 'done'}`, 'info');
        return data;
      } catch (err) {
        addNotification(
          err instanceof ApiError ? `Simulate failed: ${err.message}` : 'Backend offline — simulation skipped',
          'warning'
        );
        return null;
      }
    },
    [addNotification]
  );

  return simulate;
}

// ── App Store ─────────────────────────────────────────────────────────────────

export function useAppStore_() {
  const [storeStats, setStoreStats] = useState<AppStoreStats | null>(null);
  const [modules, setModules] = useState<AppStoreModule[]>([]);
  const [loading, setLoading] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const searchModules = useCallback(async (q?: string, category?: string) => {
    setLoading(true);
    try {
      const data = await appStoreApi.getModules({ q, category });
      setModules(data.modules ?? []);
    } catch {
      // backend offline — leave modules as empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    appStoreApi.getStats().then(setStoreStats).catch(() => {});
    searchModules();
  }, [searchModules]);

  const installModule = useCallback(
    async (moduleId: string, moduleName: string) => {
      try {
        const result = await appStoreApi.installModule(moduleId);
        addNotification(`📦 ${moduleName} installed! +${result.extra_rules ?? 0} T0 rules`, 'success');
        return result;
      } catch (err) {
        addNotification(
          err instanceof ApiError ? `Install failed: ${err.message}` : 'Backend offline',
          'alert'
        );
        return null;
      }
    },
    [addNotification]
  );

  const generateModule = useCallback(
    async (desc: string, deviceType: string, brand?: string) => {
      try {
        const result = await appStoreApi.generateModule(desc, deviceType, brand);
        addNotification(`🤖 Module "${result.draft?.name ?? 'draft'}" generated!`, 'success');
        return result;
      } catch (err) {
        addNotification(
          err instanceof ApiError ? `Generate failed: ${err.message}` : 'Backend offline',
          'alert'
        );
        return null;
      }
    },
    [addNotification]
  );

  const publishModule = useCallback(
    async (payload: Partial<AppStoreModule>) => {
      try {
        const { apiClient, endpoints } = await import('../api');
        const result = await apiClient.post(endpoints.appStoreModules, payload);
        addNotification(`🚀 Module published to App Store!`, 'success');
        return result;
      } catch (err) {
        addNotification(
          err instanceof ApiError ? `Publish failed: ${err.message}` : 'Backend offline',
          'alert'
        );
        return null;
      }
    },
    [addNotification]
  );

  return { storeStats, modules, loading, searchModules, installModule, generateModule, publishModule };
}

export function useInstalledModules() {
  const [modules, setModules] = useState<Array<{
    module_id: string; name: string; brand?: string; extra_rules?: number;
  }>>([]);

  useEffect(() => {
    backendApi
      .getInstalledModules()
      .then((data) => {
        const raw = (data as { modules?: unknown[] }).modules ?? [];
        setModules(raw as typeof modules);
      })
      .catch(() => {});
  }, []);

  return { modules };
}
