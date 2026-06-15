import { apiClient } from './client';
import { endpoints } from './endpoints';

// ── Response types ────────────────────────────────────────────────────────────

export interface TranscribeResponse {
  transcript: string;
  stt_is_mock: boolean;
  language: string;
  audio_path?: string;
  event_result?: {
    tier: string;
    message: string;
    actions_taken?: unknown[];
  };
}

export interface TtsResponse {
  audio_url?: string;
  audio_base64?: string;
  voice: string;
  text: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const voiceApi = {
  // Send typed text to the backend STT pipeline (mock mode — no real audio upload)
  transcribeMockText: (text: string, autoRoute = true) =>
    apiClient.post<TranscribeResponse>(endpoints.transcribe, {
      mock_text: text,
      auto_route: autoRoute,
      language: 'en-IN',
    }),

  // Upload a real audio Blob recorded from the browser mic
  transcribeAudio: (audioBlob: Blob, autoRoute = true) => {
    const form = new FormData();
    form.append('audio', audioBlob, 'voice.webm');
    form.append('auto_route', String(autoRoute));
    form.append('language', 'en-IN');
    return apiClient.postForm<TranscribeResponse>(endpoints.transcribe, form);
  },

  // Text-to-speech — returns audio URL or base64
  synthesise: (text: string, voice?: string) =>
    apiClient.post<TtsResponse>(endpoints.tts, { text, voice }),
};
