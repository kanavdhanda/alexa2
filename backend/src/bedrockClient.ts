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
import { authorizeTool, AuthorizationContext } from './authorizer';

dotenv.config();

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // Local dev: use env var keys. Production (App Runner): omit so SDK uses the IAM role.
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
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

// ─── Multi-agent routing ──────────────────────────────────────────────────────

type Specialist = 'COMMERCE' | 'HOME_CONTROL' | 'KNOWLEDGE';

const ROUTE_TOOL: Tool = {
  toolSpec: {
    name: 'route_to_specialist',
    description: 'Select the specialist agent best suited to handle this request. Call ONCE.',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          specialist: {
            type: 'string',
            enum: ['COMMERCE', 'HOME_CONTROL', 'KNOWLEDGE'],
            description: 'COMMERCE=ordering/inventory, HOME_CONTROL=device actuation, KNOWLEDGE=sound/questions/alerts',
          },
          intent_summary: { type: 'string', description: 'One sentence summary of the request intent' },
          reason: { type: 'string', description: 'Why this specialist is the best fit' },
        },
        required: ['specialist', 'intent_summary', 'reason'],
      },
    },
  },
};

const SPECIALIST_TOOLS: Record<Specialist, Tool[]> = {
  COMMERCE:     [SUPERVISOR_TOOLS[0]],                    // order_amazon_now
  HOME_CONTROL: [SUPERVISOR_TOOLS[1]],                    // actuate_home_device
  KNOWLEDGE:    [SUPERVISOR_TOOLS[2], SUPERVISOR_TOOLS[3]], // log_new_sound_cluster + send_user_notification
};

const SPECIALIST_SYSTEM_PROMPTS: Record<Specialist, string> = {
  COMMERCE: `You are the Commerce Specialist Agent for Alexa+ India.
Your role: fulfil Amazon Now/Fresh orders and inventory replenishment.
Available tool: order_amazon_now only.
Rules: always honour max_budget in INR. EXPRESS delivery = 10 min, STANDARD = 2 hr.
After ordering, confirm what was ordered and ETA in one friendly sentence.`,

  HOME_CONTROL: `You are the Home-Control Specialist Agent for Alexa+ India.
Your role: safely actuate smart home devices.
Available tool: actuate_home_device only.
India context: Geyser duration ≤ 45 min. LPG leak → gas valve OFF immediately. Respect current home regime.
Safety: CRITICAL class devices need explicit justification. Minimum necessary actuations only.`,

  KNOWLEDGE: `You are the Knowledge & Notification Specialist Agent for Alexa+ India.
Your role: handle sound discovery, user questions, greetings, and safety alerts.
Available tools: log_new_sound_cluster, send_user_notification.
For unknown sounds: log the cluster, then ask the user to identify it.
For greetings/questions: send_user_notification with a warm, helpful response in Indian English.`,
};

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  tool_name: string,
  tool_input: any,
  home_id: string,
  authContext?: AuthorizationContext,
): Promise<any> {
  // Propose-authorize gate (§5.6) — all T3 tool calls pass through before execution
  const ctx: AuthorizationContext = authContext ?? {
    home_id,
    speaker_role: 'owner',
    identity_confidence: 0.85,
    current_regime: stateStore.get(home_id)?.current_regime ?? 'normal',
  };
  const home = stateStore.get(home_id);
  const device = tool_name === 'actuate_home_device' ? (home?.devices[tool_input?.device_id] ?? null) : null;
  const authorization = authorizeTool(tool_name, tool_input, device, ctx);

  if (!authorization.approved) {
    return {
      success: false,
      blocked_by_authorizer: true,
      reason: authorization.reason,
      risk_class: authorization.risk_class,
    };
  }

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

// ─── Triage: supervisor classifies and routes ─────────────────────────────────

async function callSupervisorTriage(
  input: SupervisorInput,
  homeContext: string,
): Promise<{ specialist: Specialist; intent_summary: string; reason: string }> {
  const triagePrompt = `You are the Supervisor Agent for a multi-agent smart home AI.
Your ONLY job: classify this request and call route_to_specialist ONCE.

Specialists:
• COMMERCE — Amazon ordering, grocery, inventory replenishment
• HOME_CONTROL — device actuation (lights, fans, AC, geyser, locks, TV, motor)
• KNOWLEDGE — sound discovery, greetings, capability questions, alerts, notifications

${homeContext}`;

  const userMsg = `Request: ${input.anomaly_description}\nEvent: ${JSON.stringify(input.event_data).substring(0, 300)}`;

  const params: ConverseCommandInput = {
    modelId: MODEL_ID,
    system: [{ text: triagePrompt }],
    messages: [{ role: 'user', content: [{ text: userMsg }] }],
    toolConfig: {
      tools: [ROUTE_TOOL],
      toolChoice: { any: {} } as any,
    },
  };

  const response = await financialSafety.withTimeout(
    bedrockClient.send(new ConverseCommand(params)),
    8000,
    'SupervisorTriage'
  );

  for (const block of response.output?.message?.content || []) {
    if ('toolUse' in block && block.toolUse?.name === 'route_to_specialist') {
      const inp = block.toolUse.input as any;
      return {
        specialist: inp.specialist as Specialist,
        intent_summary: inp.intent_summary ?? '',
        reason: inp.reason ?? '',
      };
    }
  }

  // Fallback if model doesn't call the tool
  return { specialist: 'HOME_CONTROL', intent_summary: input.anomaly_description.substring(0, 60), reason: 'triage fallback' };
}

// ─── Specialist agent runner ───────────────────────────────────────────────────

async function runSpecialistAgent(
  specialist: Specialist,
  input: SupervisorInput,
  authContext?: AuthorizationContext,
): Promise<{ tool_calls: any[]; reasoning: string }> {
  const systemPrompt = SPECIALIST_SYSTEM_PROMPTS[specialist];
  const tools = SPECIALIST_TOOLS[specialist];

  const userMessage = `T3 ESCALATION — home_id: ${input.home_id}

Anomaly: ${input.anomaly_description}

Event Data:
${JSON.stringify(input.event_data, null, 2)}

Home State Snapshot:
${JSON.stringify(input.home_state_snapshot, null, 2)}

Take appropriate actions using your available tools.`;

  const messages: Message[] = [{ role: 'user', content: [{ text: userMessage }] }];
  const tool_calls_executed: any[] = [];
  let final_reasoning = '';
  let iterations = 0;

  while (iterations < 3) {
    iterations++;
    const params: ConverseCommandInput = {
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: { tools },
    };

    const response = await financialSafety.withTimeout(
      bedrockClient.send(new ConverseCommand(params)),
      10000,
      `${specialist}Agent iter=${iterations}`
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
          const result = await executeTool(name!, toolInput as any, input.home_id, authContext);
          tool_calls_executed.push({
            tool_name: name!, tool_input: toolInput, tool_output: result,
            authorization: result.blocked_by_authorizer ? { approved: false, reason: result.reason } : { approved: true },
          });
          toolResults.push({ toolUseId: toolUseId!, content: [{ json: result }] });
        }
        if ('text' in block && block.text) final_reasoning += block.text;
      }
      messages.push({ role: 'user', content: toolResults.map(r => ({ toolResult: r })) });
    } else {
      break;
    }
  }

  return { tool_calls: tool_calls_executed, reasoning: final_reasoning || `${specialist} specialist completed.` };
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

export async function runSupervisorAgent(
  input: SupervisorInput,
  authContext?: AuthorizationContext,
): Promise<SupervisorResult> {
  // 1. Mock mode check
  if (financialSafety.isMockMode()) {
    return financialSafety.getMockResult(input.anomaly_description);
  }

  // 2. Rate limit check
  const rateCheck = financialSafety.checkRateLimit(input.home_id);
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded for ${input.home_id}: ${rateCheck.calls_this_minute}/min (max 15). Retry in ${rateCheck.retry_after_seconds}s.`);
  }

  // 3. Build home context summary for triage
  const home = stateStore.get(input.home_id);
  const regime = home.current_regime;
  const roomType = (input.room_type || 'other') as any;
  const roomContext = buildSystemPromptContext(roomType, regime);
  const regimeNote = getRegimeContextNote(regime);
  const homeContext = `Regime: ${regime.toUpperCase()} (${regimeNote}) | T0 rules: ${home.t0_rules.length} | Room: ${input.room_type ?? 'unknown'}\n${roomContext}`;

  // 4. STEP 1 — Supervisor triage: fast classification call, forced single tool use
  const routing = await callSupervisorTriage(input, homeContext);

  const triageTokens = 220;
  const triageCost = ((triageTokens * 0.000035) / 1000).toFixed(6);

  // 5. STEP 2 — Specialist agent: focused call with only the specialist's tools
  const { tool_calls, reasoning } = await runSpecialistAgent(routing.specialist, input, authContext);

  const specialistTokens = 400 + tool_calls.length * 120;
  const specialistCost = ((specialistTokens * 0.000035) / 1000).toFixed(6);
  const totalCost = (parseFloat(triageCost) + parseFloat(specialistCost)).toFixed(6);
  const totalTokens = triageTokens + specialistTokens;

  return {
    model_id: MODEL_ID,
    reasoning,
    tool_calls,
    final_plan: `${routing.specialist} specialist executed ${tool_calls.length} action(s): ${tool_calls.map(t => t.tool_name).join(', ') || 'none'}`,
    escalation_cost_estimate: `~$${totalCost} USD (est. ${totalTokens} tokens, 2× Nova Micro — triage + specialist)`,
    is_mock: false,
    routing: {
      specialist: routing.specialist,
      intent_summary: routing.intent_summary,
      reason: routing.reason,
      triage_cost_estimate: `~$${triageCost} USD`,
    },
  };
}
