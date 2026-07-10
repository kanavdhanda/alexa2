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
import { getGroqApiKey } from './voiceModule';

dotenv.config();

// T2: fast triage/routing — Nova Micro ($0.000035/1K tok, <200ms)
// T3: agentic specialist execution — Claude Haiku ($0.00025/1K tok input, better tool use)
const T2_MODEL_ID = process.env.T2_MODEL_ID || 'amazon.nova-micro-v1:0';
const T3_MODEL_ID = process.env.T3_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001';
// Legacy fallback for other controllers that still read BEDROCK_MODEL_ID
const MODEL_ID = process.env.BEDROCK_MODEL_ID || T2_MODEL_ID;

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

// ─── Groq API Fallback Helper ────────────────────────────────────────────────
function mapBedrockMessagesToGroq(params: ConverseCommandInput): any[] {
  const groqMessages: any[] = [];

  if (params.system) {
    for (const sys of params.system) {
      if (sys.text) {
        groqMessages.push({ role: 'system', content: sys.text });
      }
    }
  }

  if (params.messages) {
    for (const msg of params.messages) {
      const role = msg.role;
      const contentBlocks = msg.content || [];
      
      let textContent = '';
      const toolCalls: any[] = [];
      const toolResults: any[] = [];
      
      for (const block of contentBlocks) {
        if ('text' in block && block.text) {
          textContent += block.text;
        } else if ('toolUse' in block && block.toolUse) {
          const tu = block.toolUse;
          toolCalls.push({
            id: tu.toolUseId,
            type: 'function',
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          });
        } else if ('toolResult' in block && block.toolResult) {
          const tr = block.toolResult;
          const jsonVal = tr.content?.[0]?.json;
          toolResults.push({
            role: 'tool',
            tool_call_id: tr.toolUseId,
            content: JSON.stringify(jsonVal || {}),
          });
        }
      }
      
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          groqMessages.push(tr);
        }
      } else if (toolCalls.length > 0) {
        groqMessages.push({
          role: 'assistant',
          content: textContent || null,
          tool_calls: toolCalls,
        });
      } else {
        groqMessages.push({
          role: role,
          content: textContent,
        });
      }
    }
  }

  return groqMessages;
}

function mapBedrockToolsToGroq(params: ConverseCommandInput): any[] | undefined {
  if (!params.toolConfig?.tools) return undefined;
  
  return params.toolConfig.tools.map((tool: any) => {
    return {
      type: 'function',
      function: {
        name: tool.toolSpec.name,
        description: tool.toolSpec.description,
        parameters: tool.toolSpec.inputSchema?.json,
      },
    };
  });
}

function mapGroqResponseToBedrock(groqResJson: any): any {
  const choice = groqResJson.choices?.[0];
  const msg = choice?.message;
  const contentBlocks: any[] = [];

  if (msg?.content) {
    contentBlocks.push({ text: msg.content });
  }

  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(tc.function.arguments || '{}');
      } catch (e) {
        console.error('[GroqFallback] Failed to parse tool call arguments:', tc.function.arguments);
      }
      contentBlocks.push({
        toolUse: {
          toolUseId: tc.id,
          name: tc.function.name,
          input: parsedInput,
        },
      });
    }
  }

  const stopReasonMap: Record<string, string> = {
    stop: 'end_turn',
    tool_calls: 'tool_use',
    length: 'max_tokens',
  };

  return {
    output: {
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    },
    stopReason: stopReasonMap[choice?.finish_reason || ''] || 'end_turn',
    usage: {
      inputTokens: groqResJson.usage?.prompt_tokens || 0,
      outputTokens: groqResJson.usage?.completion_tokens || 0,
      totalTokens: groqResJson.usage?.total_tokens || 0,
    },
    _fallbackModel: groqResJson.model,
    $metadata: {
      httpStatusCode: 200,
    },
  };
}

async function callGroqFallback(params: ConverseCommandInput): Promise<any> {
  const groqMessages = mapBedrockMessagesToGroq(params);
  const groqTools = mapBedrockToolsToGroq(params);
  const model = process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
  
  const body: any = {
    model: model,
    messages: groqMessages,
    temperature: params.inferenceConfig?.temperature ?? 0.2,
    max_tokens: params.inferenceConfig?.maxTokens ?? 1000,
  };
  
  if (groqTools && groqTools.length > 0) {
    body.tools = groqTools;
    if (params.toolConfig?.toolChoice) {
      if ('any' in params.toolConfig.toolChoice) {
        body.tool_choice = 'required';
      } else if ('auto' in params.toolConfig.toolChoice) {
        body.tool_choice = 'auto';
      } else if ('tool' in params.toolConfig.toolChoice) {
        body.tool_choice = {
          type: 'function',
          function: { name: params.toolConfig.toolChoice.tool.name }
        };
      }
    }
  }

  console.log(`[GroqFallback] Requesting Groq completions: ${model}, messages: ${groqMessages.length}, tools: ${groqTools?.length || 0}`);
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getGroqApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const resultJson = await response.json() as any;
  console.log(`[GroqFallback] Groq response successful. Finish reason: ${resultJson.choices?.[0]?.finish_reason}`);
  return mapGroqResponseToBedrock(resultJson);
}

// Override bedrockClient.send
const originalSend = bedrockClient.send.bind(bedrockClient);
bedrockClient.send = async function (command: any, options?: any) {
  try {
    return await originalSend(command, options);
  } catch (err: any) {
    console.warn(`[BedrockClient] Bedrock command failed: ${err.message || err}`);
    if (command && command.input && typeof command.input === 'object') {
      const groqApiKey = getGroqApiKey();
      if (!groqApiKey) {
        console.error(`[BedrockClient] Groq API Key (GROQ_API_KEY) not found. Cannot fallback.`);
        throw err;
      }
      console.log(`[BedrockClient] Falling back to Groq Chat Completions...`);
      try {
        return await callGroqFallback(command.input);
      } catch (groqErr: any) {
        console.error(`[BedrockClient] Groq fallback also failed: ${groqErr.message || groqErr}`);
        throw err;
      }
    }
    throw err;
  }
};

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

const REQUEST_WEB_SEARCH_TOOL: Tool = {
  toolSpec: {
    name: 'request_web_search',
    description: 'Signal that this question needs a live web search for accurate/current data. Use for weather, news, live prices, sports scores, or anything that requires up-to-date information. The system will ask the user for permission before searching.',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The exact search query to use' },
          reason: { type: 'string', description: 'Why live data is needed for this question' },
        },
        required: ['query', 'reason'],
      },
    },
  },
};

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
  KNOWLEDGE:    [SUPERVISOR_TOOLS[2], SUPERVISOR_TOOLS[3], REQUEST_WEB_SEARCH_TOOL], // log_new_sound_cluster + send_user_notification + request_web_search
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
Safety: CRITICAL class devices need explicit justification. Minimum necessary actuations only.
Conditions: If the command includes a mathematical/logical condition (e.g. "if 4+5 is odd then..."), evaluate it. Only perform the action if the condition evaluates to true. If the condition is false, do not actuate, and reply that the condition is false.
Smartness: Check the current device state in the Home State Snapshot. If you evaluate the condition to be true (or if there is no condition) and need to turn off a device (like lights) but it is already off, do NOT call actuate_home_device. Instead, reply precisely "lights already off". Similarly, if a device is already on and you are asked to turn it on, reply "lights already on" (or equivalent state text).`,

  KNOWLEDGE: `You are the Knowledge & Notification Specialist Agent for Alexa+ India.
Your role: handle sound discovery, user questions, greetings, and safety alerts. Be brief — 1-2 sentences max.
Available tools: log_new_sound_cluster, send_user_notification, request_web_search.
For unknown sounds: log the cluster, then ask the user to identify it.
For greetings/math/general knowledge: call send_user_notification immediately with a short, warm answer in Indian English. No preamble.
For questions needing live/current data (weather, news, stock prices, sports scores, "right now"): use request_web_search — the user will be asked for permission before searching.`,
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
): Promise<{ specialist: Specialist; intent_summary: string; reason: string; _fallbackModel?: string }> {
  const triagePrompt = `You are the Supervisor Agent for a multi-agent smart home AI.
Your ONLY job: classify this request and call route_to_specialist ONCE.

Specialists:
• COMMERCE — Amazon ordering, grocery, inventory replenishment
• HOME_CONTROL — device actuation (lights, fans, AC, geyser, locks, TV, motor), including conditional actuation requests (e.g., "if 4+5 is odd then turn off light in living room")
• KNOWLEDGE — sound discovery, greetings, capability questions, alerts, notifications

${homeContext}`;

  const userMsg = `Request: ${input.anomaly_description}\nEvent: ${JSON.stringify(input.event_data).substring(0, 300)}`;

  const params: ConverseCommandInput = {
    modelId: T2_MODEL_ID,
    system: [{ text: triagePrompt }],
    messages: [{ role: 'user', content: [{ text: userMsg }] }],
    inferenceConfig: { maxTokens: 80, temperature: 0.1 },
    toolConfig: {
      tools: [ROUTE_TOOL],
      toolChoice: { any: {} } as any,
    },
  };

  const response = await financialSafety.withTimeout(
    bedrockClient.send(new ConverseCommand(params)),
    25000,
    'SupervisorTriage'
  );

  for (const block of response.output?.message?.content || []) {
    if ('toolUse' in block && block.toolUse?.name === 'route_to_specialist') {
      const inp = block.toolUse.input as any;
      return {
        specialist: inp.specialist as Specialist,
        intent_summary: inp.intent_summary ?? '',
        reason: inp.reason ?? '',
        _fallbackModel: (response as any)._fallbackModel,
      };
    }
  }

  // Fallback if model doesn't call the tool
  return {
    specialist: 'HOME_CONTROL',
    intent_summary: input.anomaly_description.substring(0, 60),
    reason: 'triage fallback',
    _fallbackModel: (response as any)._fallbackModel,
  };
}

// ─── Specialist agent runner ───────────────────────────────────────────────────

async function runSpecialistAgent(
  specialist: Specialist,
  input: SupervisorInput,
  authContext?: AuthorizationContext,
): Promise<{ tool_calls: any[]; reasoning: string; _fallbackModel?: string }> {
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
  let lastFallbackModel: string | undefined = undefined;

  while (iterations < 3) {
    iterations++;
    const params: ConverseCommandInput = {
      modelId: T3_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      inferenceConfig: { maxTokens: 300, temperature: 0.2 },
      toolConfig: { tools },
    };

    const response = await financialSafety.withTimeout(
      bedrockClient.send(new ConverseCommand(params)),
      25000,
      `${specialist}Agent iter=${iterations}`
    );

    if ((response as any)._fallbackModel) {
      lastFallbackModel = (response as any)._fallbackModel;
    }

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

  return {
    tool_calls: tool_calls_executed,
    reasoning: final_reasoning || `${specialist} specialist completed.`,
    _fallbackModel: lastFallbackModel,
  };
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
    return financialSafety.getMockResult(input.anomaly_description, input.home_id);
  }

  // 2. Rate limit check
  const rateCheck = financialSafety.checkRateLimit(input.home_id);
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded for ${input.home_id}: ${rateCheck.calls_this_minute}/min (max 15). Retry in ${rateCheck.retry_after_seconds}s.`);
  }

  try {
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
    const { tool_calls, reasoning, _fallbackModel } = await runSpecialistAgent(routing.specialist, input, authContext);

    const specialistTokens = 400 + tool_calls.length * 120;
    const specialistCost = ((specialistTokens * 0.000035) / 1000).toFixed(6);
    const totalCost = (parseFloat(triageCost) + parseFloat(specialistCost)).toFixed(6);
    const totalTokens = triageTokens + specialistTokens;

    const fallbackModelUsed = _fallbackModel || routing._fallbackModel;
    const finalModelId = fallbackModelUsed ? `groq/${fallbackModelUsed}` : T3_MODEL_ID;

    return {
      model_id: finalModelId,
      reasoning,
      tool_calls,
      final_plan: `${routing.specialist} specialist executed ${tool_calls.length} action(s): ${tool_calls.map(t => t.tool_name).join(', ') || 'none'}`,
      escalation_cost_estimate: fallbackModelUsed
        ? `~$0.00 USD (Groq Fallback active)`
        : `~$${totalCost} USD (est. ${totalTokens} tokens, 2× Nova Micro — triage + specialist)`,
      is_mock: false,
      routing: {
        specialist: routing.specialist,
        intent_summary: routing.intent_summary,
        reason: routing.reason,
        triage_cost_estimate: fallbackModelUsed ? `~$0.00 USD` : `~$${triageCost} USD`,
      },
    };
  } catch (err: any) {
    console.warn(`[BedrockClient] Bedrock agent call failed: ${err.message}. Falling back to local mock LLM.`);
    return financialSafety.getMockResult(input.anomaly_description, input.home_id);
  }
}
