/**
 * Voice Module — Amazon Polly (TTS) + Groq Whisper (STT)
 *
 * TTS flow:  text → Polly → MP3 base64 → frontend plays it
 * STT flow:  browser mic audio → POST /api/voice/transcribe → Groq Whisper → text → event pipeline
 */

import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
} from '@aws-sdk/client-polly';
import FormData from 'form-data';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const IS_MOCK  = process.env.MOCK_LLM === 'true';
const REGION   = process.env.AWS_REGION || 'us-east-1';

let cachedGroqApiKey: string | undefined = undefined;
export function getGroqApiKey(): string {
  if (cachedGroqApiKey !== undefined) return cachedGroqApiKey;
  if (process.env.GROQ_API_KEY) {
    cachedGroqApiKey = process.env.GROQ_API_KEY;
  } else {
    const secretPath = '/run/secrets/groq_api_key';
    if (fs.existsSync(secretPath)) {
      try {
        cachedGroqApiKey = fs.readFileSync(secretPath, 'utf8').trim();
      } catch (e) {
        console.error(`Failed to read Groq API key from docker secrets:`, e);
      }
    }
  }
  return cachedGroqApiKey || '';
}

// ─── AWS Polly Client ─────────────────────────────────────────────────────────

const pollyClient = new PollyClient({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'YOUR_KEY_HERE'
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } }
    : {}),
});

// stub — S3 no longer used, kept so TypeScript doesn't complain on any lingering references
const s3Client = { send: async () => {} } as any;

// ─── Voice IDs ────────────────────────────────────────────────────────────────

export const INDIA_VOICES: Record<string, VoiceId> = {
  aditi:   'Aditi',
  raveena: 'Raveena',
  kajal:   'Kajal',
  aria:    'Aria',
};

export type VoiceOption = keyof typeof INDIA_VOICES;

// ─── TTS Result ───────────────────────────────────────────────────────────────

export interface TtsResult {
  audio_base64: string;
  content_type: string;
  voice_used: string;
  character_count: number;
  is_mock: boolean;
  duration_estimate_ms: number;
  debug?: string;
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockTtsResult(characterCount: number): TtsResult {
  return {
    // Minimal valid ID3 header — browsers won't play it but won't throw either
    audio_base64: 'SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8vIFNvdW5kQ2xpcC5jb20AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    content_type: 'audio/mpeg',
    voice_used: 'MOCK',
    character_count: characterCount,
    is_mock: true,
    duration_estimate_ms: Math.ceil((characterCount / 15) * 1000),
  };
}

// ─── Sarvam AI TTS (Hinglish, bulbul:v2) ─────────────────────────────────────

async function synthesizeSarvam(text: string): Promise<TtsResult> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY not set');

  const safeText = text.substring(0, 500);

  const resp = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': key,
    },
    body: JSON.stringify({
      inputs: [safeText],
      target_language_code: 'hi-IN',
      speaker: process.env.SARVAM_SPEAKER || 'anushka',
      pitch: 0,
      pace: 1.05,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: 'bulbul:v2',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Sarvam ${resp.status}: ${errText}`);
  }

  const data = await resp.json() as { audios?: string[] };
  if (!data.audios?.[0]) throw new Error('Sarvam returned no audio');

  return {
    audio_base64: data.audios[0],
    content_type: 'audio/wav',
    voice_used: `sarvam-${process.env.SARVAM_SPEAKER || 'anushka'}`,
    character_count: text.length,
    is_mock: false,
    duration_estimate_ms: Math.ceil((text.length / 15) * 1000),
  };
}

// ─── Amazon Polly TTS (fallback if AWS creds present) ────────────────────────

async function synthesizePolly(text: string, voice: VoiceOption): Promise<TtsResult> {
  const characterCount = text.length;
  const voiceId = INDIA_VOICES[voice] || INDIA_VOICES.kajal;
  let engine: Engine = 'neural';
  if (voice === 'aditi' || voice === 'raveena') engine = 'standard';

  const ssmlText = wrapInSsml(text);
  const command = new SynthesizeSpeechCommand({
    Text: ssmlText,
    TextType: 'ssml',
    OutputFormat: OutputFormat.MP3,
    VoiceId: voiceId,
    Engine: engine,
    LanguageCode: 'en-IN',
    SampleRate: '22050',
  });

  const response = await pollyClient.send(command);
  if (!response.AudioStream) throw new Error('Polly returned no audio stream');

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.AudioStream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  return {
    audio_base64: audioBuffer.toString('base64'),
    content_type: 'audio/mpeg',
    voice_used: voiceId,
    character_count: characterCount,
    is_mock: false,
    duration_estimate_ms: Math.ceil((characterCount / 15) * 1000),
  };
}

/** Wrap plain text in SSML for better Indian English pronunciation */
function wrapInSsml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const withPauses = escaped.replace(/\. /g, '. <break time="300ms"/> ');
  return `<speak><prosody rate="95%">${withPauses}</prosody></speak>`;
}

// ─── Main TTS entry point ─────────────────────────────────────────────────────

/**
 * Convert text → audio via the best available engine:
 *   1. Sarvam AI (if SARVAM_API_KEY set) — Hinglish, optional upgrade
 *   2. Amazon Polly (EC2 IAM role, no env vars needed) — Indian English, free tier 5M chars/month
 *   3. Mock stub — frontend falls back to browser speechSynthesis
 */
export async function synthesizeSpeech(
  text: string,
  voice: VoiceOption = 'kajal',
): Promise<TtsResult> {
  const characterCount = text.length;

  if (IS_MOCK) {
    console.log('[TTS] MOCK_LLM=true — returning mock audio');
    return mockTtsResult(characterCount);
  }

  console.log('[TTS] AWS_REGION:', process.env.AWS_REGION ?? '(not set)');
  console.log('[TTS] AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 4)}...` : '(not set)');
  console.log('[TTS] SARVAM_API_KEY:', process.env.SARVAM_API_KEY ? 'set' : '(not set)');

  const ttsEngine = process.env.TTS_ENGINE || 'sarvam';
  if (process.env.SARVAM_API_KEY && ttsEngine === 'sarvam') {
    try {
      return await synthesizeSarvam(text);
    } catch (err) {
      console.warn('[TTS] Sarvam failed, trying Polly:', (err as Error).message);
    }
  }

  // 2. Amazon Polly
  try {
    console.log('[TTS] Attempting Polly with voice:', voice);
    const result = await synthesizePolly(text, voice);
    console.log('[TTS] Polly succeeded, voice_used:', result.voice_used);
    return result;
  } catch (err) {
    const e = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
    const errorCode = e.Code ?? 'n/a';
    const httpStatus = e.$metadata?.httpStatusCode ?? 'n/a';
    const debugMsg = `Polly failed — ${e.message} (code: ${errorCode}, http: ${httpStatus}) | AWS_REGION: ${process.env.AWS_REGION ?? 'not set'} | key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.slice(0, 4) + '...' : 'not set'}`;
    console.error('[TTS]', debugMsg);
    const mock = mockTtsResult(characterCount);
    mock.debug = debugMsg;
    return mock;
  }
}

// ─── STT via Groq Whisper ─────────────────────────────────────────────────────

export interface TranscribeResult {
  transcript: string;
  confidence: number;
  language_code: string;
  job_id: string;
  is_mock: boolean;
  debug?: string;
}

export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  mimeType: string = 'audio/webm',
): Promise<TranscribeResult> {
  const apiKey = getGroqApiKey();
  if (IS_MOCK || !apiKey) {
    const reason = IS_MOCK ? 'MOCK_LLM=true' : 'GROQ_API_KEY not set';
    return {
      transcript: `[MOCK STT] ${reason} — real transcription disabled.`,
      confidence: 1.0,
      language_code: 'en-IN',
      job_id: 'mock_job',
      is_mock: true,
      debug: reason,
    };
  }

  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'mp3';
  const form = new FormData();
  form.append('file', audioBuffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'en');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Whisper error ${res.status}: ${err}`);
  }

  const json = await res.json() as { text: string };
  return {
    transcript: json.text?.trim() || '',
    confidence: 0.95,
    language_code: 'en',
    job_id: `groq_${Date.now()}`,
    is_mock: false,
  };
}

// kept for backward-compat so voiceController imports don't need changing
export async function transcribeAudioFromS3(s3_key: string): Promise<TranscribeResult> {
  throw new Error('AWS Transcribe disabled — use transcribeAudioWithGroq instead');
}
export async function uploadAudioToS3(_buf: Buffer, _name: string): Promise<string> {
  throw new Error('S3 upload disabled');
}

// ─── Alexa response formatter ─────────────────────────────────────────────────

export function buildSpokenResponse(tier: string, result: any, home_id: string): string {
  if (tier === 'T0' || tier === 'T1') {
    const action = result.action || result.intent || 'action';
    const device = result.device_id || result.friendly_name || 'the device';
    const explanation = result.explanation || '';
    if (action === 'SHUT_OFF' || action === 'TURN_OFF') {
      return `Okay, I've turned off ${humanizeDeviceName(device)}.`;
    }
    if (action === 'TURN_ON' || action === 'EMERGENCY_SHUTOFF') {
      return `Done. ${explanation.split('.')[0]}.`;
    }
    if (action === 'ANNOUNCE') return explanation.split('.')[0] + '.';
    return `Done. ${explanation.split('.')[0]}.`;
  }

  if (tier === 'T3' || tier === 'CACHED') {
    const tool_calls: any[] = result.tool_calls || [];
    if (tool_calls.length === 0) {
      const full = (result.reasoning || '').trim();
      return full ? full.substring(0, 300).replace(/\s+\S*$/, '') + (full.length > 300 ? '…' : '') : 'Done.';
    }
    const sentences: string[] = [];
    for (const tc of tool_calls) {
      if (tc.tool_name === 'order_amazon_now') {
        const items = tc.tool_input?.items?.map((i: any) => `${i.quantity} ${i.unit} of ${i.name}`).join(' and ');
        sentences.push(`Ordered ${items}.`);
      } else if (tc.tool_name === 'actuate_home_device') {
        const state = tc.tool_input?.target_state === 'ON' ? 'on' : 'off';
        sentences.push(`Turned ${state} ${humanizeDeviceName(tc.tool_input?.device_id)}.`);
      } else if (tc.tool_name === 'send_user_notification') {
        sentences.push(tc.tool_input?.message || '');
      } else if (tc.tool_name === 'request_web_search') {
        const query = tc.tool_input?.query || 'that';
        sentences.push(`I'd need to look up "${query}" online. Should I search for it? [LOOKUP_PENDING:${query}]`);
      }
    }
    return sentences.slice(0, 2).join(' ') || 'Done.';
  }

  return 'Done.';
}

function humanizeDeviceName(device_id: string): string {
  return (device_id || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const voiceModule = {
  synthesizeSpeech,
  transcribeAudioFromS3,
  uploadAudioToS3,
  buildSpokenResponse,
  isMockMode: () => IS_MOCK,
};
