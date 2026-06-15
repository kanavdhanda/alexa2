/**
 * Voice Module — Sarvam AI (TTS, Hinglish) + Amazon Transcribe (STT)
 * Priority: Sarvam AI → Amazon Polly → Mock (browser TTS fallback)
 *
 * TTS flow:  text → Sarvam/Polly → WAV/MP3 base64 → frontend plays it
 * STT flow:  browser mic audio → POST /api/voice/transcribe → text → event pipeline
 */

import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
} from '@aws-sdk/client-polly';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
  LanguageCode,
} from '@aws-sdk/client-transcribe';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const IS_MOCK  = process.env.MOCK_LLM === 'true';
const REGION   = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || '';

// ─── AWS Clients (only used when AWS_ACCESS_KEY_ID is set) ────────────────────

const pollyClient = new PollyClient({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'YOUR_KEY_HERE'
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } }
    : {}),
});

const transcribeClient = new TranscribeClient({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'YOUR_KEY_HERE'
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } }
    : {}),
});

const s3Client = new S3Client({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'YOUR_KEY_HERE'
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } }
    : {}),
});

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
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockTtsResult(characterCount: number): TtsResult {
  return {
    // Minimal valid ID3 header — browsers won't play it but won't throw either
    audio_base64: 'SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8vIFNvdW5kQ2xpcC5jb20AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    content_type: 'audio/mpeg',
    voice_used: 'MOCK',
    character_count,
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
      speaker: 'anushka',
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
    voice_used: 'sarvam-anushka',
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
  return `<speak><prosody rate="95%" pitch="+2Hz">${withPauses}</prosody></speak>`;
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

  if (IS_MOCK) return mockTtsResult(characterCount);

  if (process.env.SARVAM_API_KEY) {
    try {
      return await synthesizeSarvam(text);
    } catch (err) {
      console.warn('[TTS] Sarvam failed, trying Polly:', (err as Error).message);
    }
  }

  // 2. Amazon Polly — uses EC2 IAM role automatically; free tier 5M chars/month
  try {
    return await synthesizePolly(text, voice);
  } catch (err) {
    console.warn('[TTS] Polly failed:', (err as Error).message);
  }

  // 3. No audio — frontend falls back to browser speechSynthesis
  return mockTtsResult(characterCount);
}

// ─── STT via Transcribe ───────────────────────────────────────────────────────

export interface TranscribeResult {
  transcript: string;
  confidence: number;
  language_code: string;
  job_id: string;
  is_mock: boolean;
}

export async function transcribeAudioFromS3(
  s3_key: string,
  language: LanguageCode = 'en-IN',
): Promise<TranscribeResult> {
  if (IS_MOCK || !S3_BUCKET) {
    return {
      transcript: '[MOCK STT] Use browser Web Speech API instead.',
      confidence: 1.0,
      language_code: 'en-IN',
      job_id: 'mock_job',
      is_mock: true,
    };
  }

  const jobName = `alexa-demo-${Date.now()}`;
  const mediaUri = `s3://${S3_BUCKET}/${s3_key}`;

  await transcribeClient.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: mediaUri },
    MediaFormat: 'mp3',
    LanguageCode: language,
    Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 4 },
  }));

  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await transcribeClient.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    const job = status.TranscriptionJob;
    if (job?.TranscriptionJobStatus === TranscriptionJobStatus.COMPLETED) {
      const transcriptUri = job.Transcript?.TranscriptFileUri || '';
      const transcript = await fetchTranscriptText(transcriptUri);
      return { transcript, confidence: 0.92, language_code: 'en-IN', job_id: jobName, is_mock: false };
    }
    if (job?.TranscriptionJobStatus === TranscriptionJobStatus.FAILED) {
      throw new Error(`Transcription failed: ${job.FailureReason}`);
    }
  }
  throw new Error('Transcription timed out after 60 seconds');
}

async function fetchTranscriptText(uri: string): Promise<string> {
  const res = await fetch(uri);
  const json = await res.json() as any;
  return json?.results?.transcripts?.[0]?.transcript || '';
}

export async function uploadAudioToS3(audioBuffer: Buffer, filename: string): Promise<string> {
  if (!S3_BUCKET) throw new Error('S3_BUCKET env var not set');
  const key = `voice-uploads/${Date.now()}_${filename}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: audioBuffer,
    ContentType: 'audio/mpeg',
  }));
  return key;
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
      return (result.reasoning?.split('.')[0] + '.') || 'Done.';
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
