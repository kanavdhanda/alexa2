import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  Message,
  Tool,
  ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';
import { financialSafety, SupervisorResult } from './financialSafety';
import { buildSystemPromptContext } from './knowledgePacks';
import { getRegimeContextNote } from './regimeEngine';
import { stateStore } from './stateStore';

dotenv.config();

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const SUPERVISOR_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'order_amazon_now',
      description: 'Place an order via Amazon Now for immediate delivery of household items. Use when inventory drops below threshold. Always confirm budget. Express = 10 min, Standard = 2 hr.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' } }, required: ['name', 'quantity', 'unit'] } },
            max_budget: { type: 'number', description: 'Maximum budget in INR' },
            priority: { type: 'string', enum: ['EXPRESS_10MIN', 'STANDARD_2HR'] },
          },
          required: ['items', 'max_budget'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'actuate_home_device',
      description: 'Control a smart home device property. Must respect safety_class — never actuate CRITICAL devices without strong justification.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            device_id: { type: 'string' },
            target_state: { type: 'string', description: 'New value for the primary property (power=ON/OFF, or specific value)' },
            property: { type: 'string', description: 'Which property to change (default: power)', default: 'power' },
            duration_minutes: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['device_id', 'target_state'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'log_new_sound_cluster',
      description: 'Register a new acoustic embedding cluster for an unknown recurring sound. Triggers user classification flow.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            embedding_id: { type: 'string' },
            time: { type: 'string' },
            cluster_size: { type: 'number' },
            frequency_pattern: { type: 'string' },
            clap_description: { type: 'string', description: 'Zero-shot CLAP model text description of the sound' },
          },
          required: ['embedding_id', 'time'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'send_user_notification',
      description: 'Send a notification or question to the home user via Alexa TTS or companion app.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            type: { type: 'string', enum: ['INFO', 'WARNING', 'QUESTION', 'ALERT'] },
            requires_response: { type: 'boolean' },
          },
          required: ['message', 'type'],
        },
      },
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(tool_name: string, tool_input: any, home_id: string): Promise<any> {
  if (tool_name === 'actuate_home_device') {
    const property = tool_input.property || 'power';
    const value = tool_input.target_state === 'ON' ? true : tool_input.target_state === 'OFF' ? false : tool_input.target_state;
    stateStore.setDeviceProperty(home_id, tool_input.device_id, property, value);
    return {
      success: true, device_id: tool_input.device_id, property, new_state: tool_input.target_state,
      executed_at: new Date().toISOString(), message: `${tool_input.device_id} ${property}=${tool_input.target_state}. ${tool_input.reason || ''}`,
    };
  }

  if (tool_name === 'order_amazon_now') {
    const order_id = `AMZ-NOW-${Date.now()}`;
    const eta = tool_input.priority === 'EXPRESS_10MIN' ? 10 : 120;
    // Update inventory optimistically
    if (tool_input.items?.[0]?.name) {
      const item = tool_input.items[0];
      const home = stateStore.get(home_id);
      if (home.inventory[item.name]) stateStore.setInventory(home_id, item.name, item.quantity);
    }
    return {
      success: true, order_id, items: tool_input.items,
      estimated_total_inr: Math.round(tool_input.max_budget * 0.85),
      max_budget_inr: tool_input.max_budget, eta_minutes: eta,
      eta_timestamp: new Date(Date.now() + eta * 60000).toISOString(), status: 'ORDER_CONFIRMED',
    };
  }

  if (tool_name === 'log_new_sound_cluster') {
    const cluster_id = `cluster_${tool_input.embedding_id.substring(0, 8)}_${Date.now()}`;
    stateStore.addSoundCluster(home_id, {
      cluster_id, embedding_id: tool_input.embedding_id,
      occurrence_count: tool_input.cluster_size || 1,
      first_seen: tool_input.time, last_seen: new Date().toISOString(),
      time_pattern: tool_input.frequency_pattern,
      clap_description: tool_input.clap_description,
      identified: false,
    });
    return { success: true, cluster_id, status: 'CLUSTER_LOGGED', user_prompt_queued: true };
  }

  if (tool_name === 'send_user_notification') {
    return { success: true, delivered_via: ['alexa_tts', 'companion_app_push'], message_sent: tool_input.message, timestamp: new Date().toISOString() };
  }

  return { success: false, error: `Unknown tool: ${tool_name}` };
}

// ─── Supervisor agent ─────────────────────────────────────────────────────────

export interface SupervisorInput {
  home_id: string;
  anomaly_description: string;
  home_state_snapshot: any;
  event_data: any;
  room_type?: string;
}

export { SupervisorResult };

export async function runSupervisorAgent(input: SupervisorInput): Promise<SupervisorResult> {
  // 1. Mock mode check
  if (financialSafety.isMockMode()) {
    return financialSafety.getMockResult(input.anomaly_description);
  }

  // 2. Rate limit check
  const rateCheck = financialSafety.checkRateLimit(input.home_id);
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded for ${input.home_id}: ${rateCheck.calls_this_minute}/min (max ${15}). Retry in ${rateCheck.retry_after_seconds}s.`);
  }

  // 3. Build context-aware system prompt
  const home = stateStore.get(input.home_id);
  const regime = home.current_regime;
  const roomType = (input.room_type || 'other') as any;
  const roomContext = buildSystemPromptContext(roomType, regime);
  const regimeNote = getRegimeContextNote(regime);

  const systemPrompt = `You are the Supervisor Agent for Alexa+ India Context Layer — a multi-agent smart home system.

${roomContext}

CURRENT REGIME: ${regime.toUpperCase()} — ${regimeNote}

Your responsibilities:
1. Analyze the anomaly using the home state context below
2. Make minimum necessary tool calls to resolve the situation
3. Respect safety classes: CRITICAL devices need strong justification; CONVENIENCE = auto-approve
4. For commerce actions (order_amazon_now): always stay within max_budget
5. After tools execute, summarize what was done in plain conversational English

Active T0 rules: ${home.t0_rules.length} (escalation rate already optimized)
Regime: ${regime} (${regime === 'festival' || regime === 'guest' ? 'LEARNING PAUSED — do not suggest new automations' : 'learning active'})`;

  const userMessage = `T3 ESCALATION — home_id: ${input.home_id}

Anomaly: ${input.anomaly_description}

Event Data:
${JSON.stringify(input.event_data, null, 2)}

Home State Snapshot:
${JSON.stringify(input.home_state_snapshot, null, 2)}

Take appropriate actions using the available tools.`;

  const messages: Message[] = [{ role: 'user', content: [{ text: userMessage }] }];
  const tool_calls_executed: any[] = [];
  let final_reasoning = '';
  let iterations = 0;

  while (iterations < 5) {
    iterations++;
    const params: ConverseCommandInput = {
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: { tools: SUPERVISOR_TOOLS },
    };

    const response = await financialSafety.withTimeout(
      bedrockClient.send(new ConverseCommand(params)),
      10000,
      `SupervisorAgent iter=${iterations}`
    );

    const output = response.output?.message;
    if (!output) break;
    messages.push(output);

    if (response.stopReason === 'end_turn') {
      for (const block of output.content || []) {
        if ('text' in block && block.text) final_reasoning += block.text;
      }
      break;
    }

    if (response.stopReason === 'tool_use') {
      const toolResults: ToolResultBlock[] = [];
      for (const block of output.content || []) {
        if ('toolUse' in block && block.toolUse) {
          const { toolUseId, name, input: toolInput } = block.toolUse;
          const result = await executeTool(name!, toolInput as any, input.home_id);
          tool_calls_executed.push({ tool_name: name!, tool_input: toolInput, tool_output: result });
          toolResults.push({ toolUseId: toolUseId!, content: [{ json: result }] });
        }
        if ('text' in block && block.text) final_reasoning += block.text;
      }
      messages.push({ role: 'user', content: toolResults.map(r => ({ toolResult: r })) });
    } else {
      break;
    }
  }

  const estTokens = 500 + iterations * 250 + tool_calls_executed.length * 120;
  const estCost = ((estTokens * 0.000035) / 1000).toFixed(6);

  return {
    model_id: MODEL_ID,
    reasoning: final_reasoning || 'Agent completed tool execution.',
    tool_calls: tool_calls_executed,
    final_plan: `Executed ${tool_calls_executed.length} action(s): ${tool_calls_executed.map(t => t.tool_name).join(', ') || 'none'}`,
    escalation_cost_estimate: `~$${estCost} USD (est. ${estTokens} tokens, Nova Micro)`,
    is_mock: false,
  };
}
