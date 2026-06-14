import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  Message,
  Tool,
  ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

dotenv.config();

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Tool definitions for Bedrock multi-agent supervisor
export const SUPERVISOR_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'order_amazon_now',
      description:
        'Place an order via Amazon Now for immediate delivery of household items. Use this when inventory drops below threshold.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string' },
                },
                required: ['name', 'quantity', 'unit'],
              },
              description: 'List of items to order',
            },
            max_budget: {
              type: 'number',
              description: 'Maximum budget in INR for this order',
            },
            priority: {
              type: 'string',
              enum: ['EXPRESS_10MIN', 'STANDARD_2HR'],
              description: 'Delivery priority',
            },
          },
          required: ['items', 'max_budget'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'actuate_home_device',
      description:
        'Control a smart home device. Use this to turn on/off devices, adjust settings, or change device states.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            device_id: {
              type: 'string',
              description: 'The device identifier (e.g. geyser, water_motor, living_room_fan)',
            },
            target_state: {
              type: 'string',
              description: 'The desired state (e.g. ON, OFF, OPEN, CLOSED, or numeric value)',
            },
            duration_minutes: {
              type: 'number',
              description: 'Optional: auto-shutoff after N minutes',
            },
            reason: {
              type: 'string',
              description: 'Human-readable reason for this actuation',
            },
          },
          required: ['device_id', 'target_state'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'log_new_sound_cluster',
      description:
        'Register a new acoustic embedding cluster representing an unknown recurring sound. This triggers user classification flow.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            embedding_id: {
              type: 'string',
              description: 'Unique ID of the acoustic embedding vector',
            },
            time: {
              type: 'string',
              description: 'ISO timestamp when sound was first detected',
            },
            cluster_size: {
              type: 'number',
              description: 'Number of occurrences that formed this cluster',
            },
            frequency_pattern: {
              type: 'string',
              description: 'When this sound typically occurs (e.g. morning_6am, random)',
            },
            clap_description: {
              type: 'string',
              description: 'Zero-shot CLAP model description of the sound',
            },
          },
          required: ['embedding_id', 'time'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'send_user_notification',
      description: 'Send a notification or question to the home user via Alexa or the companion app.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The notification message or question for the user',
            },
            type: {
              type: 'string',
              enum: ['INFO', 'WARNING', 'QUESTION', 'ALERT'],
            },
            requires_response: {
              type: 'boolean',
              description: 'Whether the user needs to confirm or classify something',
            },
          },
          required: ['message', 'type'],
        },
      },
    },
  },
];

export interface SupervisorInput {
  home_id: string;
  anomaly_description: string;
  home_state_snapshot: any;
  event_data: any;
}

export interface ToolCallResult {
  tool_name: string;
  tool_input: any;
  tool_output: any;
}

export interface SupervisorResult {
  model_id: string;
  reasoning: string;
  tool_calls: ToolCallResult[];
  final_plan: string;
  escalation_cost_estimate: string;
}

// Simulated tool executor — updates real in-memory state
async function executeTool(
  tool_name: string,
  tool_input: any,
  home_id: string,
  homeState: any
): Promise<any> {
  const { stateStore } = await import('./stateStore');

  if (tool_name === 'actuate_home_device') {
    stateStore.updateDevice(home_id, tool_input.device_id, { state: tool_input.target_state });
    return {
      success: true,
      device_id: tool_input.device_id,
      new_state: tool_input.target_state,
      executed_at: new Date().toISOString(),
      message: `Device ${tool_input.device_id} set to ${tool_input.target_state}. ${tool_input.reason || ''}`,
    };
  }

  if (tool_name === 'order_amazon_now') {
    const order_id = `AMZ-NOW-${Date.now()}`;
    const eta_minutes = tool_input.priority === 'EXPRESS_10MIN' ? 10 : 120;
    return {
      success: true,
      order_id,
      items: tool_input.items,
      estimated_total_inr: tool_input.max_budget * 0.85,
      max_budget_inr: tool_input.max_budget,
      eta_minutes,
      eta_timestamp: new Date(Date.now() + eta_minutes * 60000).toISOString(),
      status: 'ORDER_CONFIRMED',
    };
  }

  if (tool_name === 'log_new_sound_cluster') {
    const cluster_id = `cluster_${tool_input.embedding_id.substring(0, 8)}`;
    stateStore.addSoundCluster(home_id, {
      cluster_id,
      embedding_id: tool_input.embedding_id,
      count: tool_input.cluster_size || 1,
      first_seen: tool_input.time,
      last_seen: new Date().toISOString(),
      identified: false,
    });
    return {
      success: true,
      cluster_id,
      status: 'CLUSTER_LOGGED',
      user_prompt_queued: true,
      message: 'Sound cluster logged. User classification prompt queued for next Alexa interaction.',
    };
  }

  if (tool_name === 'send_user_notification') {
    return {
      success: true,
      delivered_via: ['alexa_tts', 'companion_app_push'],
      message_sent: tool_input.message,
      timestamp: new Date().toISOString(),
    };
  }

  return { success: false, error: `Unknown tool: ${tool_name}` };
}

export async function runSupervisorAgent(input: SupervisorInput): Promise<SupervisorResult> {
  const systemPrompt = `You are the Supervisor Agent for an Alexa+ India Context Layer smart home system.
You receive anomaly reports and home state from edge devices. Your job is to:
1. Analyze the situation using the provided home state context
2. Make intelligent decisions that respect Indian household patterns (water, LPG, cooking, etc.)
3. Execute the minimum necessary tool calls to resolve the situation
4. Provide a clear human-readable execution plan

Home Context: home_id=${input.home_id}
Current timestamp: ${new Date().toISOString()}
India-specific context: Consider water scarcity, LPG cylinder habits, monsoon seasons, festival regimes.

IMPORTANT: You must use tools to take real actions. Always explain your reasoning before each tool call.
After all tools are called, summarize what was done and why in plain English.`;

  const userMessage = `ANOMALY DETECTED - T3 Escalation Required

Anomaly: ${input.anomaly_description}

Event Data:
${JSON.stringify(input.event_data, null, 2)}

Current Home State Snapshot:
${JSON.stringify(input.home_state_snapshot, null, 2)}

Analyze this situation and take appropriate actions using the available tools.`;

  const messages: Message[] = [{ role: 'user', content: [{ text: userMessage }] }];

  const tool_calls_executed: ToolCallResult[] = [];
  let final_reasoning = '';
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const params: ConverseCommandInput = {
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: { tools: SUPERVISOR_TOOLS },
    };

    const response = await bedrockClient.send(new ConverseCommand(params));
    const output = response.output?.message;
    if (!output) break;

    messages.push(output);

    if (response.stopReason === 'end_turn') {
      // Extract final text
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
          const result = await executeTool(name!, toolInput as any, input.home_id, input.home_state_snapshot);

          tool_calls_executed.push({
            tool_name: name!,
            tool_input: toolInput,
            tool_output: result,
          });

          toolResults.push({
            toolUseId: toolUseId!,
            content: [{ json: result }],
          });
        }
        if ('text' in block && block.text) final_reasoning += block.text;
      }

      messages.push({ role: 'user', content: toolResults.map(r => ({ toolResult: r })) });
    } else {
      // unexpected stop reason
      break;
    }
  }

  const inputTokens = 500 + iterations * 200;
  const outputTokens = 200 + tool_calls_executed.length * 100;
  const cost = ((inputTokens * 0.000035 + outputTokens * 0.00014) / 1000).toFixed(6);

  return {
    model_id: MODEL_ID,
    reasoning: final_reasoning || 'Agent completed tool execution.',
    tool_calls: tool_calls_executed,
    final_plan: `Executed ${tool_calls_executed.length} action(s): ${tool_calls_executed.map(t => t.tool_name).join(', ')}`,
    escalation_cost_estimate: `~$${cost} USD (est. ${inputTokens + outputTokens} tokens)`,
  };
}
