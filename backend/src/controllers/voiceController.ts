import { Request, Response } from 'express';
import { synthesizeSpeech, buildSpokenResponse, voiceModule, INDIA_VOICES, VoiceOption } from '../voiceModule';
import { financialSafety } from '../financialSafety';
import { semanticCache } from '../semanticCache';
import { stateStore } from '../stateStore';

/** POST /api/voice/speak — convert text to speech via Amazon Polly */
export async function textToSpeech(req: Request, res: Response) {
  const { text, voice = 'kajal', home_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 1500) return res.status(400).json({ error: 'text too long (max 1500 chars)' });

  try {
    const result = await synthesizeSpeech(text, voice as VoiceOption);
    return res.json({
      home_id,
      input_text: text,
      voice_used: result.voice_used,
      is_mock: result.is_mock,
      duration_estimate_ms: result.duration_estimate_ms,
      audio_base64: result.audio_base64,
      content_type: result.content_type,
      usage_note: 'Play in browser: const a = new Audio("data:audio/mpeg;base64," + audio_base64); a.play()',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Polly TTS failed', detail: err.message, hint: 'Ensure AWS_REGION and credentials are set. Or enable MOCK_LLM=true for demo.' });
  }
}

/** GET /api/voice/speak?text=hello&voice=kajal — quick TTS for testing */
export async function textToSpeechGet(req: Request, res: Response) {
  const text = req.query.text as string;
  const voice = (req.query.voice as VoiceOption) || 'kajal';
  if (!text) return res.status(400).json({ error: 'text query param required' });

  try {
    const result = await synthesizeSpeech(text.substring(0, 500), voice);
    // Return raw audio for GET requests (can be used directly in <audio src="...">)
    const audioBuffer = Buffer.from(result.audio_base64, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.send(audioBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /api/voice/respond — build + speak a response from a T0/T1/T3 result */
export async function speakEventResult(req: Request, res: Response) {
  const { home_id, tier, result, voice = 'kajal' } = req.body;
  if (!tier || !result) return res.status(400).json({ error: 'tier and result are required' });

  const spokenText = buildSpokenResponse(tier, result, home_id || 'unknown');
  try {
    const audio = await synthesizeSpeech(spokenText, voice as VoiceOption);
    return res.json({ spoken_text: spokenText, ...audio });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, spoken_text: spokenText });
  }
}

/** GET /api/voice/config — voice module status */
export function voiceConfig(_req: Request, res: Response) {
  return res.json({
    mock_mode: voiceModule.isMockMode(),
    available_voices: INDIA_VOICES,
    default_voice: 'kajal',
    tts_engine: 'Amazon Polly (neural)',
    stt_engine: 'Amazon Transcribe OR browser Web Speech API',
    recommended_for_demo: 'Use browser Web Speech API for STT (no AWS cost) + Polly for TTS (Indian English voice)',
    polly_pricing: '~$0.000004 per character (neural), ~$0.0000004 per character (standard)',
    transcribe_pricing: '~$0.024 per minute of audio',
    demo_cost_estimate: '50 TTS calls × 100 chars × $0.000004 = $0.02 total',
  });
}

/** GET /api/voice/demo-phrases — pre-built Indian home demo phrases */
export async function demoPhrasesAudio(req: Request, res: Response) {
  const phrases = [
    { id: 'geyser_on', text: 'Okay, I have turned on the geyser. It will automatically shut off in 45 minutes as a safety measure.' },
    { id: 'motor_off', text: 'The water motor has been running for 45 minutes. I have turned it off to prevent overflow and water wastage.' },
    { id: 'lpg_alert', text: 'Alert! L P G leak detected in the kitchen. I have closed the valve. Please ventilate the area immediately.' },
    { id: 'milk_order', text: 'Milk is running low. I have placed an order on Amazon Now for 2 liters. It will arrive in 10 minutes.' },
    { id: 'cooker_done', text: 'The pressure cooker has whistled 3 times. Your dal should be ready.' },
    { id: 'unknown_sound', text: "I have noticed a recurring sound that I don't recognize. I will ask you about it next time it happens." },
    { id: 'cost_saving', text: 'This action was handled locally by the T-zero rule engine. No cloud call was needed, saving approximately 0.002 US dollars.' },
  ];

  const voice = (req.query.voice as VoiceOption) || 'kajal';
  const phrase_id = req.query.phrase as string;

  if (phrase_id) {
    const phrase = phrases.find(p => p.id === phrase_id);
    if (!phrase) return res.status(404).json({ error: 'Phrase not found', available: phrases.map(p => p.id) });
    try {
      const audio = await synthesizeSpeech(phrase.text, voice);
      const buf = Buffer.from(audio.audio_base64, 'base64');
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(buf);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.json({ phrases, usage: 'GET /api/voice/demo-phrases?phrase=geyser_on to get audio, or omit phrase to list all' });
}
