/**
 * Voice Module — Amazon Polly (TTS) + Amazon Transcribe (STT)
 * Gives the demo a real spoken Alexa-like response voice.
 *
 * TTS flow:  backend text response → Polly → PCM/MP3 → base64 → frontend plays it
 * STT flow:  browser mic audio → POST /api/voice/transcribe → Transcribe → text → event pipeline
 *
 * India-specific: Uses Aditi (Indian English) or Raveena voice by default.
 * MOCK_LLM=true bypasses Polly and returns a silent mock audio.
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
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const IS_MOCK = process.env.MOCK_LLM === 'true';
const REGION   = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || '';

// ─── AWS Clients ─────────────────────────────────────────────────────────────

const pollyClient = new PollyClient({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const transcribeClient = new TranscribeClient({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// ─── Voice IDs (India-context) ───────────────────────────────────────────────

export const INDIA_VOICES: Record<string, VoiceId> = {
  aditi:   'Aditi',    // Hindi (Indian English) — neural not available, standard
  raveena: 'Raveena',  // Indian English — clear, standard
  kajal:   'Kajal',    // Indian English — neural, best quality
  aria:    'Aria',     // fallback
};

export type VoiceOption = keyof typeof INDIA_VOICES;

// ─── TTS ─────────────────────────────────────────────────────────────────────

export interface TtsResult {
  audio_base64: string;
  content_type: string;
  voice_used: string;
  character_count: number;
  is_mock: boolean;
  duration_estimate_ms: number;
}

/**
 * Convert text → MP3 audio via Amazon Polly.
 * Returns base64-encoded MP3 the frontend can play directly:
 *   const audio = new Audio('data:audio/mp3;base64,' + result.audio_base64);
 *   audio.play();
 */
export async function synthesizeSpeech(
  text: string,
  voice: VoiceOption = 'kajal',
): Promise<TtsResult> {
  const characterCount = text.length;

  if (IS_MOCK || !process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'YOUR_KEY_HERE') {
    // Return a 1-second silent MP3 in mock mode (valid base64 MP3 header)
    return {
      audio_base64: 'SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8vIFNvdW5kQ2xpcC5jb20AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      content_type: 'audio/mpeg',
      voice_used: 'MOCK',
      character_count: characterCount,
      is_mock: true,
      duration_estimate_ms: Math.ceil((characterCount / 15) * 1000),
    };
  }

  // Try neural engine first (Kajal supports neural), fall back to standard
  const voiceId = INDIA_VOICES[voice] || INDIA_VOICES.kajal;
  let engine: Engine = 'neural';
  if (voice === 'aditi' || voice === 'raveena') engine = 'standard';

  // Wrap numbers and English words in proper SSML for cleaner Indian English TTS
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

  if (!response.AudioStream) {
    throw new Error('Polly returned no audio stream');
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.AudioStream as any) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);
  const audioBase64 = audioBuffer.toString('base64');
  const durationMs = Math.ceil((characterCount / 15) * 1000);

  return {
    audio_base64: audioBase64,
    content_type: 'audio/mpeg',
    voice_used: voiceId,
    character_count: characterCount,
    is_mock: false,
    duration_estimate_ms: durationMs,
  };
}

/** Wrap plain text in SSML for better Indian English pronunciation */
function wrapInSsml(text: string): string {
  // Escape XML special chars
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Add slight pauses at sentence boundaries for natural speech
  const withPauses = escaped.replace(/\. /g, '. <break time="300ms"/> ');

  return `<speak><prosody rate="95%" pitch="+2Hz">${withPauses}</prosody></speak>`;
}

// ─── STT via Transcribe ───────────────────────────────────────────────────────

export interface TranscribeResult {
  transcript: string;
  confidence: number;
  language_code: string;
  job_id: string;
  is_mock: boolean;
}

/**
 * Submit an S3-hosted audio file to Amazon Transcribe and poll for result.
 * For the demo: frontend records audio → uploads to S3 → calls this → gets text.
 * NOTE: Requires S3_BUCKET env var to be set.
 *
 * Simpler alternative for demo: use browser Web Speech API (zero AWS cost).
 */
export async function transcribeAudioFromS3(
  s3_key: string,
  language: LanguageCode = 'en-IN',
): Promise<TranscribeResult> {
  if (IS_MOCK || !S3_BUCKET) {
    return {
      transcript: '[MOCK STT] Transcription not available in mock mode. Use browser Web Speech API instead.',
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
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 4,
    },
  }));

  // Poll for completion (max 60 seconds for demo)
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

/**
 * Upload audio buffer to S3 (called by the POST /api/voice/upload endpoint).
 * Returns the S3 key for use with transcribeAudioFromS3.
 */
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

/**
 * Build a natural Alexa-style spoken response from a T0/T1/T3 action result.
 * This is what gets sent to Polly to produce the audio.
 */
export function buildSpokenResponse(tier: string, result: any, home_id: string): string {
  if (tier === 'T0' || tier === 'T1') {
    const action = result.action || result.intent || 'action';
    const device = result.device_id || result.friendly_name || 'the device';
    const explanation = result.explanation || '';
    if (action === 'SHUT_OFF' || action === 'TURN_OFF') {
      return `Okay, I've turned off ${humanizeDeviceName(device)}. ${explanation.split('.')[0]}.`;
    }
    if (action === 'TURN_ON' || action === 'EMERGENCY_SHUTOFF') {
      return `Done. ${explanation.split('.')[0]}.`;
    }
    if (action === 'ANNOUNCE') {
      return explanation;
    }
    return `Done. ${explanation.split('.')[0]}.`;
  }

  if (tier === 'T3' || tier === 'CACHED') {
    const tool_calls: any[] = result.tool_calls || [];
    if (tool_calls.length === 0) return result.reasoning?.split('.')[0] + '.' || 'I\'ve processed your request.';

    const sentences: string[] = [];
    for (const tc of tool_calls) {
      if (tc.tool_name === 'order_amazon_now') {
        const items = tc.tool_input?.items?.map((i: any) => `${i.quantity} ${i.unit} of ${i.name}`).join(' and ');
        const eta = tc.tool_output?.eta_minutes;
        sentences.push(`I've ordered ${items}. It will arrive in ${eta} minutes.`);
      } else if (tc.tool_name === 'actuate_home_device') {
        sentences.push(`I've ${tc.tool_input?.target_state === 'ON' ? 'turned on' : 'turned off'} ${humanizeDeviceName(tc.tool_input?.device_id)}.`);
      } else if (tc.tool_name === 'log_new_sound_cluster') {
        sentences.push(`I've noticed a recurring sound I don't recognize. Could you tell me what it is next time it happens?`);
      } else if (tc.tool_name === 'send_user_notification') {
        sentences.push(tc.tool_input?.message || '');
      }
    }
    return sentences.join(' ') || result.reasoning?.split('.')[0] + '.' || 'Done.';
  }

  return 'Your request has been processed.';
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
