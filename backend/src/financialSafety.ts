import dotenv from 'dotenv';
dotenv.config();

/**
 * Financial Safety Wrapper — Goal 6
 * 1. MOCK_LLM=true  → bypass Bedrock entirely, return hardcoded response
 * 2. Rate limiter   → max 15 Bedrock calls/minute per home_id
 * 3. Timeout        → 10s hard timeout on every Bedrock call
 */

export interface AgentRouting {
  specialist: 'COMMERCE' | 'HOME_CONTROL' | 'KNOWLEDGE';
  intent_summary: string;
  reason: string;
  triage_cost_estimate: string;
}

export interface SupervisorResult {
  model_id: string;
  reasoning: string;
  tool_calls: any[];
  final_plan: string;
  escalation_cost_estimate: string;
  is_mock?: boolean;
  routing?: AgentRouting;
}

// ─── Mock responses (scenario-aware) ─────────────────────────────────────────

function buildMockResult(anomaly_description: string): SupervisorResult {
  const desc = anomaly_description.toLowerCase();
  const tool_calls: any[] = [];

  if (desc.includes('inventory') || desc.includes('order') || desc.includes('milk') || desc.includes('lpg')) {
    tool_calls.push({
      tool_name: 'order_amazon_now',
      tool_input: { items: [{ name: 'milk', quantity: 2, unit: 'liters' }], max_budget: 120, priority: 'EXPRESS_10MIN' },
      tool_output: {
        success: true, order_id: `AMZ-MOCK-${Date.now()}`,
        items: [{ name: 'milk', quantity: 2, unit: 'liters' }],
        estimated_total_inr: 102, max_budget_inr: 120, eta_minutes: 10,
        eta_timestamp: new Date(Date.now() + 10 * 60000).toISOString(), status: 'ORDER_CONFIRMED',
      },
    });
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: '[MOCK] Milk order placed via Amazon Now. Arriving in 10 minutes.', type: 'INFO', requires_response: false },
      tool_output: { success: true, delivered_via: ['mock_alexa_tts'], timestamp: new Date().toISOString() },
    });
  } else if (desc.includes('sound') || desc.includes('cluster') || desc.includes('embedding')) {
    tool_calls.push({
      tool_name: 'log_new_sound_cluster',
      tool_input: { embedding_id: `emb_mock_${Date.now()}`, time: new Date().toISOString(), cluster_size: 5, frequency_pattern: 'daily_6am', clap_description: 'metallic beep, electrical device' },
      tool_output: { success: true, cluster_id: `cluster_mock_${Date.now()}`, status: 'CLUSTER_LOGGED', user_prompt_queued: true },
    });
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: "[MOCK] I've noticed a recurring unrecognized sound. What is this sound?", type: 'QUESTION', requires_response: true },
      tool_output: { success: true, delivered_via: ['mock_alexa_tts'], timestamp: new Date().toISOString() },
    });
  } else if (desc.includes('voice command') && /\b(weather|temperature|forecast|news|stock|price|rate|score|result|cricket|match|today|right now|currently|live)\b/i.test(desc)) {
    // Live-data question — agent should ask for web search permission
    const utteranceMatch = desc.match(/Voice command: "([^"]+)"/);
    const query = utteranceMatch ? utteranceMatch[1] : 'that';
    tool_calls.push({
      tool_name: 'request_web_search',
      tool_input: { query, reason: 'Question requires live/current data not available in training knowledge' },
      tool_output: { status: 'pending_user_permission', query, timestamp: new Date().toISOString() },
    });
  } else if (desc.includes('voice command') && /\b(hello|hi |hey |how are you|what can you|thank)\b/.test(desc)) {
    // Conversational greeting — no device action, just respond
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: 'Hi! How may I help you with your home today?', type: 'INFO', requires_response: true },
      tool_output: { success: true, delivered_via: ['alexa_tts'], timestamp: new Date().toISOString() },
    });
  } else if (desc.includes('voice command') && /\b(what is|what's|how much|how many|calculate|tell me|explain|define|who is|when is|where is|\d+\s*[\+\-\*\/x]\s*\d+)\b/i.test(desc)) {
    // Direct knowledge question / math — extract utterance and give a meaningful mock answer
    const utteranceMatch = desc.match(/Voice command: "([^"]+)"/);
    const utterance = utteranceMatch ? utteranceMatch[1] : '';
    let answer = '[MOCK] In production, Bedrock Nova Micro would answer this question in real time.';
    const mathMatch = utterance.match(/(\d+(?:\.\d+)?)\s*[\+plus]\s*(\d+(?:\.\d+)?)/i);
    if (mathMatch) {
      const sum = parseFloat(mathMatch[1]) + parseFloat(mathMatch[2]);
      answer = `${mathMatch[1]} plus ${mathMatch[2]} is ${sum}.`;
    } else if (utterance) {
      answer = `[MOCK] Great question! "${utterance}" — in production, Alexa+ would use Bedrock to answer this accurately.`;
    }
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: answer, type: 'INFO', requires_response: false },
      tool_output: { success: true, delivered_via: ['alexa_tts'], timestamp: new Date().toISOString() },
    });
  } else if (desc.includes('geyser') || desc.includes('motor') || desc.includes('pump')) {
    tool_calls.push({
      tool_name: 'actuate_home_device',
      tool_input: { device_id: 'master_geyser', target_state: desc.includes('off') ? 'OFF' : 'ON', duration_minutes: 20, reason: 'Voice command via T3' },
      tool_output: { success: true, device_id: 'master_geyser', new_state: desc.includes('off') ? 'OFF' : 'ON', executed_at: new Date().toISOString() },
    });
  } else if (desc.includes('device') || desc.includes('actuate') || desc.includes('voice command')) {
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: 'I can help with lights, fans, TV, geyser, AC, and more. What would you like me to do?', type: 'INFO', requires_response: true },
      tool_output: { success: true, delivered_via: ['alexa_tts'], timestamp: new Date().toISOString() },
    });
  } else {
    tool_calls.push({
      tool_name: 'send_user_notification',
      tool_input: { message: 'Alexa+ analyzed your request. In production, real Bedrock tool calls would execute here.', type: 'INFO', requires_response: false },
      tool_output: { success: true, delivered_via: ['mock'], timestamp: new Date().toISOString() },
    });
  }

  const specialist: AgentRouting['specialist'] =
    (desc.includes('inventory') || desc.includes('order') || desc.includes('milk') || desc.includes('lpg'))
      ? 'COMMERCE'
      : (desc.includes('sound') || desc.includes('cluster') || desc.includes('embedding') ||
         /\b(what is|what's|how much|how many|calculate|tell me|explain|define|who is|when is|where is|weather|temperature|forecast|news|stock|price|rate|score|cricket|match|\d+\s*[\+\-\*\/x]\s*\d+)\b/i.test(desc))
        ? 'KNOWLEDGE'
        : 'HOME_CONTROL';

  return {
    model_id: 'MOCK (MOCK_LLM=true — no Bedrock call made)',
    reasoning: `MOCK MODE ACTIVE. Multi-agent cascade: Supervisor → ${specialist} specialist. In production with real AWS credentials, Bedrock Nova Micro would: (1) triage the request, (2) route to the ${specialist} specialist, (3) execute tools with the authorizer gate. Anomaly: "${anomaly_description.substring(0, 120)}..."`,
    tool_calls,
    final_plan: `MOCK: ${specialist} specialist simulated ${tool_calls.length} tool call(s): ${tool_calls.map(t => t.tool_name).join(', ')}`,
    escalation_cost_estimate: '$0.00 (MOCK MODE — real cost would be ~$0.00006 per call, 2 Nova Micro calls)',
    is_mock: true,
    routing: {
      specialist,
      intent_summary: `[MOCK] ${anomaly_description.substring(0, 80)}`,
      reason: '[MOCK] Keyword-matched routing in mock mode',
      triage_cost_estimate: '$0.00 (mock)',
    },
  };
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

interface RateWindow { count: number; window_start: number; }
const MAX_CALLS_PER_MINUTE = 15;

class FinancialSafetyWrapper {
  private callWindows = new Map<string, RateWindow>();
  private readonly isMock: boolean;

  constructor() {
    this.isMock = process.env.MOCK_LLM === 'true';
    if (this.isMock) {
      console.log('[FinancialSafety] MOCK_LLM=true — all Bedrock calls will return mock responses');
    }
  }

  // Always read live from env so it can be toggled without restart in tests
  isMockMode(): boolean { return process.env.MOCK_LLM === 'true'; }

  getMockResult(anomaly_description: string): SupervisorResult {
    return buildMockResult(anomaly_description);
  }

  checkRateLimit(home_id: string): { allowed: boolean; calls_this_minute: number; retry_after_seconds: number } {
    const now = Date.now();
    const window = this.callWindows.get(home_id);

    if (!window || now - window.window_start > 60000) {
      this.callWindows.set(home_id, { count: 1, window_start: now });
      return { allowed: true, calls_this_minute: 1, retry_after_seconds: 0 };
    }

    if (window.count >= MAX_CALLS_PER_MINUTE) {
      const retry = Math.ceil((60000 - (now - window.window_start)) / 1000);
      return { allowed: false, calls_this_minute: window.count, retry_after_seconds: retry };
    }

    window.count++;
    return { allowed: true, calls_this_minute: window.count, retry_after_seconds: 0 };
  }

  withTimeout<T>(promise: Promise<T>, timeout_ms = 10000, label = 'Bedrock'): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} call timed out after ${timeout_ms}ms`)), timeout_ms)
      ),
    ]);
  }

  getStats() {
    const windows: Record<string, any> = {};
    this.callWindows.forEach((v, k) => { windows[k] = { ...v, age_seconds: Math.floor((Date.now() - v.window_start) / 1000) }; });
    return {
      mock_mode: this.isMock,
      max_calls_per_minute: MAX_CALLS_PER_MINUTE,
      rate_windows: windows,
    };
  }
}

export const financialSafety = new FinancialSafetyWrapper();
