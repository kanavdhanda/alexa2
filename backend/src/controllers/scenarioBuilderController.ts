import { Request, Response } from 'express';
import { bedrockClient } from '../bedrockClient';
import { ConverseCommand, ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

const SYSTEM_PROMPT = `You are an expert smart-home automation engineer specialising in Indian households.

Given a natural-language description from a user, extract a single T0 automation rule.

Rules for extraction:
- trigger_event: a short specific condition that can be sensed or detected (e.g. "user arrives home after outdoor activity", "geyser reaches 45 degrees", "jeera burning detected")
- action: the concrete device action to take (e.g. "turn on AC and set to 24C", "turn on geyser for 15 minutes", "turn off stove burner and send alert")
- description: one clear sentence describing what the rule does
- confidence: 0.0 to 1.0 reflecting how clearly the user's intent was stated

Indian household context: LPG stove, geyser, pressure cooker, inverter, pooja room, water motor, ceiling fan, AC, mixer/grinder.

You must ALWAYS produce a complete rule. If the user's description is vague, infer the most sensible automation from context. Never say you need more information.

Respond with ONLY a single line of valid JSON, no markdown, no explanation:
{"description":"...","trigger_event":"...","action":"...","confidence":0.85}`;

export async function buildScenarioRule(req: Request, res: Response): Promise<void> {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: text.trim() }] }],
      inferenceConfig: { maxTokens: 200, temperature: 0.2 },
    });

    const response = await Promise.race([
      bedrockClient.send(command),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
    ]) as ConverseCommandOutput;

    const raw = response.output?.message?.content?.[0]?.text ?? '';

    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON in response');

    const rule = JSON.parse(match[0]) as {
      description: string;
      trigger_event: string;
      action: string;
      confidence: number;
    };

    if (!rule.trigger_event || !rule.action) throw new Error('Incomplete rule');

    res.json({ ok: true, rule });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}
