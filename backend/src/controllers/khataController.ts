import { Request, Response } from 'express';
import { parseKhataUtteranceMock, khataStore, KhataEntry } from '../khata';
import { financialSafety } from '../financialSafety';
import { buildTrace } from '../trace';
import { wsServer } from '../websocket';
import { bedrockClient } from '../bedrockClient';
import { ConverseCommand, ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

async function parseKhataUtteranceWithBedrock(utterance: string): Promise<KhataEntry> {
  const prompt = `Parse this Hinglish household ledger utterance into JSON. Return ONLY valid JSON (no extra text).
Vendors: doodhwala (दूधवाला), dhobi (धोबी), maid (नौकरानी), newspaper (अखबार वाला)
Kinds: delivery, missed, items, payment
Units: liter, items, days, etc.

Utterance: "${utterance}"

Return exactly this JSON format:
{"vendor":"doodhwala|dhobi|maid|newspaper","vendor_hi":"Hindi name","kind":"delivery|missed|items|payment","quantity":1,"unit":"liter","amount_inr":100}`;

  const params: ConverseCommandInput = {
    modelId: MODEL_ID,
    system: [{ text: 'You are a JSON parser for household ledger entries. Return ONLY valid JSON.' }],
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 150, temperature: 0.1 },
  };

  const response = await financialSafety.withTimeout(
    bedrockClient.send(new ConverseCommand(params)),
    4000,
    'KhataParser'
  );

  let jsonText = '';
  for (const block of response.output?.message?.content || []) {
    if ('text' in block) {
      jsonText = block.text || '';
      break;
    }
  }

  // Extract JSON from response
  const jsonMatch = jsonText.match(/\{[^{}]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    id: `khata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vendor: parsed.vendor,
    vendor_hi: parsed.vendor_hi,
    kind: parsed.kind,
    quantity: parsed.quantity || 1,
    unit: parsed.unit || 'item',
    amount_inr: parsed.amount_inr || 0,
    date: new Date().toISOString().split('T')[0],
    raw: utterance,
  };
}

export async function logKhata(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { utterance } = req.body as { utterance: string };

  if (!utterance) {
    return res.status(400).json({ error: 'utterance required' });
  }

  const startMs = Date.now();

  try {
    let entry: KhataEntry;
    const isMock = financialSafety.isMockMode();

    if (isMock) {
      entry = parseKhataUtteranceMock(utterance);
    } else {
      entry = await parseKhataUtteranceWithBedrock(utterance);
    }

    khataStore.add(home_id, entry);
    const latencyMs = Date.now() - startMs;

    // Generate speech response
    const speech = `Likh liya — ${entry.vendor_hi}, ${entry.quantity} ${entry.unit}, ₹${entry.amount_inr}.`;

    const trace = buildTrace(isMock ? 't1' : 't3', latencyMs, isMock ? 0 : 0.000035);

    // Broadcast via websocket
    if (wsServer) {
      wsServer.broadcast(home_id, {
        type: 'khata_entry' as any,
        home_id,
        payload: { entry, trace },
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ entry, speech, trace });
  } catch (error) {
    console.error('[Khata] logKhata error:', error);
    // Fallback to mock parser on error or timeout
    const entry = parseKhataUtteranceMock(utterance);
    khataStore.add(home_id, entry);
    const latencyMs = Date.now() - startMs;
    const speech = `Likh liya — ${entry.vendor_hi}, ${entry.quantity} ${entry.unit}, ₹${entry.amount_inr}.`;
    const trace = buildTrace('t1', latencyMs, 0);

    if (wsServer) {
      wsServer.broadcast(home_id, {
        type: 'khata_entry' as any,
        home_id,
        payload: { entry, trace },
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ entry, speech, trace });
  }
}

export function getKhataLedger(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const ledger = khataStore.ledger(home_id);
  return res.json(ledger);
}

export function settleKhata(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { lines, total_inr, upi_link } = khataStore.settle(home_id);
  const speech = `Is mahine ka hisab: total ₹${total_inr}. Payment link aapke phone par bhej diya.`;
  return res.json({ lines, total_inr, upi_link, speech });
}
