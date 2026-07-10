import { Request, Response } from 'express';
import { appStore, AppStoreModule } from '../appStore';
import { stateStore } from '../stateStore';
import { generateAutoT0Rules } from '../deviceRegistry';
import { financialSafety } from '../financialSafety';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../bedrockClient';

// ─── Browse & Search ──────────────────────────────────────────────────────────

export function listModules(req: Request, res: Response) {
  const { category, brand, device_type, verified, q } = req.query as Record<string, string>;

  let modules;
  if (q) {
    modules = appStore.search(q);
  } else {
    modules = appStore.list({
      category: category as any,
      brand,
      device_type,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    });
  }

  res.json({
    modules: modules.map(m => ({
      module_id: m.module_id,
      name: m.name,
      description: m.description,
      version: m.version,
      author: m.author,
      category: m.category,
      device_type: m.device_type,
      brand: m.brand,
      tags: m.tags,
      downloads: m.downloads,
      rating: m.rating,
      verified: m.verified,
      published_at: m.published_at,
      t0_rule_count: m.mcp_definition.auto_t0_rules.length,
      demo_events: m.demo_event_samples.length,
    })),
    total: modules.length,
    store_stats: appStore.getStats(),
  });
}

export function getModule(req: Request, res: Response) {
  const module_id = req.params['module_id'] as string;
  const mod = appStore.get(module_id);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  return res.json({ module: mod });
}

export function listCategories(_req: Request, res: Response) {
  res.json({ categories: appStore.getCategories() });
}

export function getStoreStats(_req: Request, res: Response) {
  res.json(appStore.getStats());
}

// ─── Install ──────────────────────────────────────────────────────────────────

export function installModule(req: Request, res: Response) {
  const module_id = req.params['module_id'] as string;
  const home_id = req.params['home_id'] as string;

  const mod = appStore.get(module_id);
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  stateStore.get(home_id); // ensure home exists (throws if not)
  appStore.install(home_id, module_id);

  // Apply the module's T0 rules to the home (for any matching devices already registered)
  const home = stateStore.get(home_id);
  const matchingDevices = Object.values(home.devices).filter(d => d.type === mod.device_type);
  let rules_applied = 0;

  for (const device of matchingDevices) {
    for (const ruleSpec of mod.mcp_definition.auto_t0_rules) {
      const rule_id = `${device.device_id}_module_${ruleSpec.rule_id_suffix}`;
      const existing = home.t0_rules.find(r => r.rule_id === rule_id);
      if (!existing) {
        stateStore.addT0Rule(home_id, {
          rule_id,
          description: `[${mod.name}] ${ruleSpec.description}`,
          condition_fn_key: ruleSpec.condition_fn_key,
          condition_params: ruleSpec.condition_params_fn(device.device_id),
          action: { device_id: device.device_id, property: ruleSpec.action_property, value: ruleSpec.action_value },
          confidence: ruleSpec.confidence,
          promoted_from_t3: false,
          created_at: new Date().toISOString(),
          trigger_count: 0,
        });
        rules_applied++;
      }
    }
  }

  return res.json({
    success: true,
    module_id,
    home_id,
    devices_matched: matchingDevices.length,
    rules_applied,
    message: `Module "${mod.name}" installed. ${rules_applied} T0 rules added across ${matchingDevices.length} matching devices.`,
  });
}

export function getInstalledModules(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const mods = appStore.getInstalled(home_id);
  res.json({
    home_id,
    installed_modules: mods.map(m => ({
      module_id: m.module_id,
      name: m.name,
      brand: m.brand,
      device_type: m.device_type,
      version: m.version,
    })),
    total: mods.length,
  });
}

// ─── Publish (Module Creation Flow) ──────────────────────────────────────────

export function publishModule(req: Request, res: Response) {
  const body = req.body as Partial<AppStoreModule>;

  // Validation
  const required = ['module_id', 'name', 'device_type', 'brand', 'author', 'category', 'mcp_definition'];
  const missing = required.filter(k => !body[k as keyof AppStoreModule]);
  if (missing.length > 0) {
    return res.status(400).json({ error: 'Missing required fields', missing });
  }

  if (!body.module_id!.match(/^[a-z0-9-]+$/)) {
    return res.status(400).json({ error: 'module_id must be lowercase alphanumeric with hyphens only' });
  }

  if (appStore.get(body.module_id!)) {
    return res.status(409).json({ error: 'Module ID already exists. Use a different module_id or update the existing module.' });
  }

  const mod = appStore.publish({
    module_id: body.module_id!,
    name: body.name!,
    description: body.description || `MCP adapter for ${body.brand} ${body.device_type}`,
    version: body.version || '1.0.0',
    author: body.author!,
    category: body.category!,
    device_type: body.device_type!,
    brand: body.brand!,
    model_pattern: body.model_pattern,
    tags: body.tags || [body.device_type!, body.brand!.toLowerCase()],
    downloads: 0,
    rating: 0,
    verified: false,
    published_at: new Date().toISOString(),
    mcp_definition: body.mcp_definition!,
    demo_event_samples: body.demo_event_samples || [],
  });

  // Preview: what T0 rules would this generate for a hypothetical device?
  const preview_device_id = `preview_${body.device_type}_001`;
  const preview_rules = mod.mcp_definition.auto_t0_rules.map(spec => ({
    rule_id: `${preview_device_id}_${spec.rule_id_suffix}`,
    description: spec.description,
    condition: `${spec.condition_fn_key}(${JSON.stringify(spec.condition_params_fn(preview_device_id))})`,
    action: `${spec.action_property} = ${JSON.stringify(spec.action_value)}`,
    confidence: spec.confidence,
  }));

  return res.status(201).json({
    success: true,
    module: mod,
    preview: {
      t0_rules_that_would_be_generated: preview_rules,
      properties: Object.keys(mod.mcp_definition.property_schemas),
      t1_patterns: mod.mcp_definition.t1_intents,
    },
  });
}

// ─── Bedrock-powered Module Generator ─────────────────────────────────────────

/**
 * AI-powered module generator: describe a device in plain English → get a full
 * MCP module definition back. Uses Bedrock Nova Micro.
 * This is the "pairing-time, one-shot Bedrock call" from §2.2 of the architecture.
 */
export async function generateModuleWithAI(req: Request, res: Response) {
  const { description, device_type, brand, model } = req.body as {
    description: string;
    device_type?: string;
    brand?: string;
    model?: string;
  };

  if (!description) return res.status(400).json({ error: 'description is required' });

  const isMock = process.env.MOCK_LLM === 'true';

  if (isMock) {
    // Return a template the user can customize
    const mockModule = buildMockGeneratedModule(description, device_type || 'smart_plug', brand || 'Generic', model);
    return res.json({
      generated: true,
      is_mock: true,
      module: mockModule,
      note: 'Set MOCK_LLM=false and configure AWS to generate real AI-powered module definitions',
    });
  }

  try {

    const prompt = `You are an expert in smart home device adapters and the Model Context Protocol (MCP).

Generate a complete MCP module definition for the following device:
Description: ${description}
${device_type ? `Device Type: ${device_type}` : ''}
${brand ? `Brand: ${brand}` : ''}
${model ? `Model: ${model}` : ''}

Return a JSON object with these exact fields:
{
  "module_id": "string (lowercase-kebab-case, e.g., brand-device-type-v1)",
  "name": "string",
  "description": "string (2-3 sentences, include India-specific context)",
  "device_type": "string (one of: fan, light, geyser, water_pump, lpg_sensor, ac, smart_plug, inverter, ro_purifier, door_lock, tv, motion_sensor, smoke_detector, curtain, pressure_cooker_monitor)",
  "brand": "string",
  "category": "string (one of: climate, water, energy, security, entertainment, kitchen, lighting, sensor, india_specific)",
  "tags": ["array", "of", "strings"],
  "mcp_definition": {
    "capabilities": ["sense", "act", "state"] (include applicable ones),
    "safety_class": "CRITICAL|STANDARD|CONVENIENCE",
    "property_schemas": {
      "property_name": {
        "type": "boolean|number|string|enum",
        "actuatable": true|false,
        "observable": true|false,
        "default_value": <value>,
        "unit": "optional unit string",
        "min": optional_number,
        "max": optional_number,
        "enum_values": ["optional", "array"]
      }
    },
    "dead_man_timer_minutes": null or number,
    "auto_t0_rules": [
      {
        "rule_id_suffix": "string",
        "description": "string",
        "condition_fn_key": "property_gt|property_lt|property_eq|time_of_day|room_unoccupied|sound_event",
        "condition_params_fn_template": { the params but with "DEVICE_ID" as placeholder for device_id },
        "action_property": "string",
        "action_value": <value>,
        "confidence": 0.0-1.0
      }
    ],
    "knowledge_pack_fragment": "string (2-3 sentences of India-specific context for the AI supervisor)",
    "t1_intents": ["array of regex strings for local NLU"],
    "default_property_values": {}
  },
  "demo_event_samples": [
    {
      "name": "string",
      "description": "string",
      "event": { "event_type": "string", "data": {} },
      "expected_tier": "T0|T1|T3"
    }
  ]
}

Be specific to India context (power cuts, hard water, Indian cooking, festivals, Indian brands/power grid).
Return ONLY valid JSON, no markdown.`;

    const response = await financialSafety.withTimeout(
      bedrockClient.send(new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0',
        system: [{ text: 'You are an expert in smart home device adapters and the Model Context Protocol (MCP).' }],
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
      })),
      15000,
      'AI module generation'
    );

    const text = response.output?.message?.content?.[0]?.text || '';

    // Strip markdown if present
    const jsonText = text.replace(/```json\n?|\n?```/g, '').trim();
    const generated = JSON.parse(jsonText);

    // Transform condition_params_fn_template → condition_params_fn
    if (generated.mcp_definition?.auto_t0_rules) {
      generated.mcp_definition.auto_t0_rules = generated.mcp_definition.auto_t0_rules.map((rule: any) => ({
        ...rule,
        condition_params_fn: (device_id: string) => {
          const params = { ...(rule.condition_params_fn_template || {}) };
          // Replace DEVICE_ID placeholder
          for (const key of Object.keys(params)) {
            if (params[key] === 'DEVICE_ID') params[key] = device_id;
          }
          return params;
        },
      }));
    }

    res.json({ generated: true, is_mock: false, module: generated });
  } catch (err: any) {
    res.status(500).json({ error: 'AI generation failed', detail: err.message });
  }
}

// ─── Module Creation Wizard (structured form) ─────────────────────────────────

export function getModuleTemplate(_req: Request, res: Response) {
  res.json({
    description: 'POST this structure to /api/app-store/modules to publish a module',
    template: {
      module_id: 'my-brand-device-v1',
      name: 'My Brand Device',
      description: 'What this device does and why the module is useful',
      version: '1.0.0',
      author: 'Your Name / Company',
      category: 'climate|water|energy|security|entertainment|kitchen|lighting|sensor|india_specific',
      device_type: 'fan|light|geyser|water_pump|lpg_sensor|ac|smart_plug|inverter|ro_purifier|door_lock|tv|motion_sensor|smoke_detector|curtain|pressure_cooker_monitor',
      brand: 'Brand Name',
      model_pattern: 'optional regex for model matching',
      tags: ['tag1', 'tag2'],
      mcp_definition: {
        capabilities: ['sense', 'act', 'state'],
        safety_class: 'CRITICAL|STANDARD|CONVENIENCE',
        property_schemas: {
          power: {
            type: 'boolean',
            actuatable: true,
            observable: true,
            default_value: false,
          },
          'example_numeric_property': {
            type: 'number',
            actuatable: false,
            observable: true,
            min: 0,
            max: 100,
            unit: '%',
            default_value: 0,
          },
        },
        dead_man_timer_minutes: null,
        auto_t0_rules: [
          {
            rule_id_suffix: 'safety_shutoff',
            description: 'What this rule does',
            condition_fn_key: 'property_gt',
            condition_params_fn: '(device_id) => ({ device_id, property: "example_numeric_property", threshold: 90 })',
            action_property: 'power',
            action_value: false,
            confidence: 1.0,
          },
        ],
        knowledge_pack_fragment: 'India-specific context for the Bedrock supervisor when this device is involved.',
        t1_intents: ['regex pattern for voice commands related to this device'],
        default_property_values: { power: false },
      },
      demo_event_samples: [
        {
          name: 'Example event name',
          description: 'What this demo shows',
          event: { event_type: 'sensor_trigger', data: { sensor: '{{device_id}}', example_numeric_property: 95 } },
          expected_tier: 'T0|T1|T3',
        },
      ],
    },
    notes: [
      'condition_params_fn in real API accepts a function string. In template: describe params as string, server evaluates.',
      'demo_event_samples use {{device_id}} as placeholder, replaced when running demos.',
      'Modules are not verified by default. Verified flag is set by Alexa+ India team review.',
    ],
  });
}

// ─── Mock module generator (MOCK_LLM=true) ───────────────────────────────────

function buildMockGeneratedModule(description: string, device_type: string, brand: string, model?: string) {
  const slug = brand.toLowerCase().replace(/\s+/g, '-');
  const type_slug = device_type.replace(/_/g, '-');

  return {
    module_id: `${slug}-${type_slug}-v1`,
    name: `${brand} ${device_type.replace(/_/g, ' ')} (AI Generated)`,
    description: `Auto-generated adapter for ${brand} ${device_type}. ${description}`,
    version: '1.0.0',
    author: 'AI Generated — Review before publishing',
    category: 'india_specific',
    device_type,
    brand,
    model_pattern: model || undefined,
    tags: [device_type, slug, 'ai-generated'],
    mcp_definition: {
      capabilities: ['sense', 'act', 'state'],
      safety_class: 'STANDARD',
      property_schemas: {
        power: { type: 'boolean', actuatable: true, observable: true, default_value: false },
        status: { type: 'string', actuatable: false, observable: true, default_value: 'idle' },
      },
      dead_man_timer_minutes: null,
      auto_t0_rules: [],
      knowledge_pack_fragment: `${brand} ${device_type} in Indian home context. ${description}`,
      t1_intents: [`turn (on|off) (the )?${device_type.replace(/_/g, ' ')}`],
      default_property_values: { power: false },
    },
    demo_event_samples: [
      {
        name: 'Basic on/off',
        description: `Turn ${device_type} on via voice`,
        event: { event_type: 'voice_command', data: { utterance: `turn on the ${device_type.replace(/_/g, ' ')}` } },
        expected_tier: 'T1',
      },
    ],
    _note: 'This is a mock template. Set MOCK_LLM=false and configure AWS credentials to generate a full AI-powered module.',
  };
}
