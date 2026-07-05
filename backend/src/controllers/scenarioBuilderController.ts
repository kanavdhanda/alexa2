import { Request, Response } from 'express';
import { bedrockClient } from '../bedrockClient';
import { ConverseCommand, ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { buildTrace, Trace } from '../trace';
import { stateStore } from '../stateStore';

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

// ─── Scenario planner (diagram-ready step plan) ──────────────────────────────

export interface PlanStep {
  n: number;
  actor: 'user' | 'alexa' | 'device' | 'cloud' | 'app';
  label: string;
  detail: string;
  device_id?: string;
  action?: { property: string; value: unknown };
}

const PLAN_SYSTEM_PROMPT = `You are an expert smart-home assistant explaining how a voice command plays out, step by step, for a non-technical audience.

Given a short scenario describing what a person says or wants, produce a clear, plain-language sequence of steps showing how the request would be handled by a voice assistant and the smart home.

Rules:
- Use everyday words. Never use jargon like "NLU", "tier", "inference", or "model".
- Each step needs: "actor" (one of "user", "alexa", "device", "cloud", "app"), "label" (a short title), "detail" (one plain sentence).
- If a step actually changes a real device, include "device_id" and "action": {"property":"...","value":...}.
- The first step must be actor "user".
- Produce at least 3 and at most 8 steps.

Respond with ONLY valid JSON, no markdown, no explanation:
{"title":"...","steps":[{"n":1,"actor":"user","label":"...","detail":"..."}]}`;

function buildMockPlan(home_id: string, scenario: string): { title: string; steps: PlanStep[] } {
  const text = scenario.toLowerCase();
  const home = stateStore.get(home_id);
  const devices = Object.values(home.devices);

  const keywordMap: Array<{ keywords: string[]; property: string; value: unknown; device_hint: string }> = [
    { keywords: ['light', 'bulb', 'lamp'], property: 'power', value: true, device_hint: 'bulb' },
    { keywords: ['fan'], property: 'power', value: true, device_hint: 'fan' },
    { keywords: ['ac', 'cool', 'air condition'], property: 'power', value: true, device_hint: 'ac' },
    { keywords: ['geyser', 'water heater', 'hot water'], property: 'power', value: true, device_hint: 'geyser' },
    { keywords: ['tv', 'television'], property: 'power', value: true, device_hint: 'tv' },
  ];

  for (const rule of keywordMap) {
    if (!rule.keywords.some((k) => text.includes(k))) continue;
    const match = devices.find((d) =>
      d.device_id.toLowerCase().includes(rule.device_hint) ||
      (d.friendly_name || '').toLowerCase().includes(rule.device_hint)
    );
    if (!match) continue;

    return {
      title: `Handling: "${scenario.trim()}"`,
      steps: [
        { n: 1, actor: 'user', label: 'You make a request', detail: `You say: "${scenario.trim()}"` },
        { n: 2, actor: 'alexa', label: 'Alexa figures out what you want', detail: `Alexa recognises this as a request to control ${match.friendly_name || match.device_id}.` },
        {
          n: 3,
          actor: 'device',
          label: `${match.friendly_name || match.device_id} responds`,
          detail: `The ${match.friendly_name || match.device_id} is switched on right away.`,
          device_id: match.device_id,
          action: { property: rule.property, value: rule.value },
        },
        { n: 4, actor: 'alexa', label: 'Alexa confirms', detail: 'Alexa lets you know the action is done.' },
      ],
    };
  }

  // Generic fallback plan for scenarios that don't match a known device
  return {
    title: `Handling: "${scenario.trim()}"`,
    steps: [
      { n: 1, actor: 'user', label: 'You make a request', detail: `You say: "${scenario.trim()}"` },
      { n: 2, actor: 'alexa', label: 'Alexa understands what you need', detail: 'Alexa listens and works out the best way to help with your request.' },
      { n: 3, actor: 'app', label: 'Alexa checks your installed apps', detail: 'Alexa looks at the apps and services you have set up to see which one can handle this.' },
      { n: 4, actor: 'alexa', label: 'Alexa takes action and responds', detail: 'Alexa either completes the request directly or passes it to the right app, then lets you know what happened.' },
    ],
  };
}

function extractJsonPlan(raw: string): { title: string; steps: PlanStep[] } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { title?: string; steps?: PlanStep[] };
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length < 1) return null;
    return { title: parsed.title || 'Scenario plan', steps: parsed.steps };
  } catch {
    return null;
  }
}

export async function buildScenarioPlan(req: Request, res: Response): Promise<void> {
  const { home_id, scenario } = req.body as { home_id?: string; scenario?: string };
  if (!home_id?.trim() || !scenario?.trim()) {
    res.status(400).json({ error: 'home_id and scenario are required' });
    return;
  }

  const start = Date.now();
  const isMock = process.env.MOCK_LLM === 'true';

  let plan: { title: string; steps: PlanStep[] };

  if (isMock) {
    plan = buildMockPlan(home_id, scenario);
  } else {
    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: PLAN_SYSTEM_PROMPT }],
        messages: [{ role: 'user', content: [{ text: scenario.trim() }] }],
        inferenceConfig: { maxTokens: 500, temperature: 0.3 },
      });

      const response = await Promise.race([
        bedrockClient.send(command),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
      ]) as ConverseCommandOutput;

      const raw = response.output?.message?.content?.[0]?.text ?? '';
      plan = extractJsonPlan(raw) ?? buildMockPlan(home_id, scenario);
    } catch {
      plan = buildMockPlan(home_id, scenario);
    }
  }

  const latency_ms = Date.now() - start;
  const trace: Trace = buildTrace('t3', latency_ms, 0);

  res.json({ title: plan.title, steps: plan.steps, trace });
}
