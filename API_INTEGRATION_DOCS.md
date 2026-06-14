# Alexa+ India Context Layer — Backend API Integration Docs

## Architecture Overview

```
Browser Frontend (dumb terminal)
        │
        ▼ HTTP / REST
┌─────────────────────────────────────┐
│  Backend API  (Express + TypeScript) │
│                                     │
│  T0 Rule Engine ──▶ instant, free   │
│       │ (if no T0 match)            │
│       ▼                             │
│  T3 Bedrock Supervisor Agent        │
│    ├── order_amazon_now             │
│    ├── actuate_home_device          │
│    ├── log_new_sound_cluster        │
│    └── send_user_notification       │
│                                     │
│  In-memory State Store (per home_id)│
│  (mocks AWS IoT Device Shadow +     │
│   DynamoDB, supports N homes)       │
└─────────────────────────────────────┘
```

---

## Starting the Backend

### Prerequisites
- Node.js >= 18
- AWS account with Bedrock enabled (us-east-1 recommended)
- AWS credentials with `bedrock:InvokeModel` permission

### Install & Run

```bash
cd backend
npm install

# Copy and fill in your AWS credentials
cp .env.example .env
# Edit .env with real values

# Development (hot reload)
npm run dev

# OR production-like
npm run build && npm start

# OR direct TypeScript
npm run start:ts
```

Server starts on **http://localhost:3001**

---

## Required `.env` Variables

| Variable | Description | Example |
|---|---|---|
| `AWS_REGION` | Bedrock region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | IAM key with Bedrock access | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret | `...` |
| `PORT` | Server port (default 3001) | `3001` |
| `BEDROCK_MODEL_ID` | Model for T3 agent | `amazon.nova-micro-v1:0` |

> **Note:** T0 rules work with zero AWS credentials. Only T3 Bedrock calls require valid credentials.

---

## API Reference

### Health Check
```bash
curl http://localhost:3001/api/health
```

---

### POST /api/events — Main Event Ingestion

The core endpoint. The backend decides T0 vs T3 routing automatically.

**Request:**
```json
{
  "home_id": "string (required)",
  "event_type": "string (required)",
  "data": { "...": "event-specific payload" }
}
```

**Supported event_types and their T0/T3 routing:**

| event_type | data fields | Routed to |
|---|---|---|
| `sensor_trigger` + `sensor: water_motor` + `duration > 45` | `duration` (minutes) | **T0** — instant shutoff |
| `sensor_trigger` + `sensor: geyser` + `sub_type: morning_timer` | `outdoor_temp` | **T0** — if temp < 28°C |
| `sensor_trigger` + `sensor: lpg` + `leak_detected: true` | — | **T0** — emergency shutoff |
| `sensor_trigger` + `sensor: sound_event` + `label: pressure_cooker_whistle` | `whistle_count` | **T0** — if count >= 3 |
| `voice_command` | `utterance`, `speaker_id` | **T3** — Bedrock NLU |
| `inventory_drop` | `item`, `quantity`, `unit`, `threshold` | **T3** — Commerce agent |
| `unknown_sound` | `embedding_id`, `frequency` | **T3** — Zero-shot discovery |

**T0 Response (instant, $0):**
```json
{
  "home_id": "demo_home_001",
  "received_at": "...",
  "resolved_at": "...",
  "tier": "T0",
  "cost": "$0.00",
  "result": {
    "handled": true,
    "tier": "T0",
    "action": "SHUT_OFF",
    "device_id": "water_motor",
    "new_state": "OFF",
    "latency": "0.01ms",
    "rule_id": "water_motor_safety",
    "explanation": "...",
    "cost": "$0.00 (local reflex)"
  },
  "home_state": { "...": "full updated home state" }
}
```

**T3 Response (0.5-3s, Bedrock cost):**
```json
{
  "home_id": "demo_home_001",
  "received_at": "...",
  "resolved_at": "...",
  "tier": "T3",
  "latency": "1250ms",
  "cost": "~$0.000045 USD (est. 700 tokens)",
  "result": {
    "model_id": "amazon.nova-micro-v1:0",
    "reasoning": "The milk inventory has dropped below threshold...",
    "tool_calls": [
      {
        "tool_name": "order_amazon_now",
        "tool_input": { "items": [...], "max_budget": 200, "priority": "EXPRESS_10MIN" },
        "tool_output": { "order_id": "AMZ-NOW-...", "eta_minutes": 10, "status": "ORDER_CONFIRMED" }
      }
    ],
    "final_plan": "Executed 1 action(s): order_amazon_now",
    "escalation_cost_estimate": "~$0.000045 USD"
  },
  "home_state": { "...": "updated state with order logged" }
}
```

---

### cURL Examples — All Endpoints

#### Water Motor Safety (T0)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"sensor_trigger","data":{"sensor":"water_motor","duration":60}}'
```

#### LPG Leak Emergency (T0)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"sensor_trigger","data":{"sensor":"lpg","leak_detected":true}}'
```

#### Pressure Cooker 3 Whistles (T0)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"sensor_trigger","data":{"sensor":"sound_event","label":"pressure_cooker_whistle","whistle_count":3}}'
```

#### Voice Command (T3)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"voice_command","data":{"utterance":"Order more milk please","speaker_id":"user_kanav"}}'
```

#### Inventory Drop (T3)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"inventory_drop","data":{"item":"milk","quantity":0.5,"unit":"liters","threshold":1}}'
```

---

### Scenario Simulation Endpoints

#### SCENARIO 1: Daily Geyser (T0 demo)
```bash
curl -X POST http://localhost:3001/api/simulate/geyser \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","outdoor_temp":15,"simulated_hour":6}'
```

#### SCENARIO 2: Amazon Now Order (T3 + commerce tool)
```bash
curl -X POST http://localhost:3001/api/simulate/inventory_drop \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","item":"milk","quantity":0.3,"unit":"liters","threshold":1}'
```

#### SCENARIO 3: Unknown Sound Discovery (T3 + zero-shot)
```bash
curl -X POST http://localhost:3001/api/simulate/unknown_sound \
  -H "Content-Type: application/json" \
  -d '{
    "home_id": "demo_home_001",
    "embedding_id": "emb_abc123",
    "frequency": "daily_6am",
    "clap_guess": "metallic beep, low battery alert from electrical inverter"
  }'
```

---

### Home State APIs

#### Get Full Home State (mock IoT Device Shadow)
```bash
curl http://localhost:3001/api/homes/demo_home_001
```

#### List All Active Homes
```bash
curl http://localhost:3001/api/homes
```

#### Get Event History
```bash
curl "http://localhost:3001/api/homes/demo_home_001/events?limit=10"
```

#### Get T0 Rules (with savings estimate)
```bash
curl http://localhost:3001/api/homes/demo_home_001/rules
```

#### Update Device State
```bash
curl -X PATCH http://localhost:3001/api/homes/demo_home_001/devices/geyser \
  -H "Content-Type: application/json" \
  -d '{"state":"ON"}'
```

#### Reset Home State
```bash
curl -X POST http://localhost:3001/api/homes/demo_home_001/reset
```

---

## Frontend Integration Guide

### Connecting to the Backend

The frontend is a **dumb terminal**. It only:
1. Sends events to the backend
2. Renders what the backend returns

**Base URL:** `http://localhost:3001/api`

**All requests must include:** `Content-Type: application/json`

---

### How to Render T0 vs T3 Responses

Inspect the `tier` field in every `/api/events` response:

```javascript
const response = await fetch('http://localhost:3001/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ home_id, event_type, data })
});
const result = await response.json();

if (result.tier === 'T0') {
  // Show green badge: "LOCAL · FREE · <1ms"
  renderT0Panel({
    action: result.result.action,
    device: result.result.device_id,
    latency: result.result.latency,
    rule: result.result.rule_id,
    explanation: result.result.explanation
  });
} else if (result.tier === 'T3') {
  // Show amber badge: "CLOUD · Bedrock · ~1s"
  renderT3Panel({
    reasoning: result.result.reasoning,
    tool_calls: result.result.tool_calls,   // array
    latency: result.latency,
    cost: result.cost
  });
}

// Always update device widgets from home_state
renderDeviceGrid(result.home_state.devices);
renderInventoryPanel(result.home_state.inventory);
```

---

### Response JSON Schemas

#### Home State Object
```typescript
interface HomeState {
  home_id: string;
  devices: {
    [device_id: string]: {
      device_id: string;
      type: string;
      state: string;          // "ON" | "OFF" | "OPEN" | "CLOSED"
      last_updated: string;   // ISO timestamp
    }
  };
  inventory: {
    [item: string]: {
      quantity: number;
      unit: string;
      threshold: number;
    }
  };
  sound_clusters: SoundCluster[];
  event_history: EventRecord[];
  t0_rules: T0Rule[];
  last_updated: string;
}
```

#### T0 Result Object
```typescript
interface T0Result {
  handled: true;
  tier: "T0";
  action: string;           // "SHUT_OFF" | "TURN_ON" | "EMERGENCY_SHUTOFF" | "ANNOUNCE"
  device_id: string;
  new_state: string;
  latency: string;          // e.g. "0.01ms"
  rule_id: string;
  explanation: string;
  cost: "$0.00 (local reflex)";
}
```

#### T3 Result Object
```typescript
interface T3Result {
  model_id: string;
  reasoning: string;
  tool_calls: Array<{
    tool_name: "order_amazon_now" | "actuate_home_device" | "log_new_sound_cluster" | "send_user_notification";
    tool_input: object;
    tool_output: object;
  }>;
  final_plan: string;
  escalation_cost_estimate: string;
}
```

#### Tool Output Schemas

**order_amazon_now output:**
```json
{
  "success": true,
  "order_id": "AMZ-NOW-1718362000000",
  "items": [{"name": "milk", "quantity": 2, "unit": "liters"}],
  "estimated_total_inr": 85,
  "max_budget_inr": 100,
  "eta_minutes": 10,
  "eta_timestamp": "...",
  "status": "ORDER_CONFIRMED"
}
```

**actuate_home_device output:**
```json
{
  "success": true,
  "device_id": "geyser",
  "new_state": "ON",
  "executed_at": "...",
  "message": "Device geyser set to ON."
}
```

**log_new_sound_cluster output:**
```json
{
  "success": true,
  "cluster_id": "cluster_emb_abc1",
  "status": "CLUSTER_LOGGED",
  "user_prompt_queued": true,
  "message": "Sound cluster logged. User classification prompt queued."
}
```

---

### Polling Home State

To keep the device grid live, poll every 2 seconds:

```javascript
setInterval(async () => {
  const state = await fetch(`http://localhost:3001/api/homes/${home_id}`).then(r => r.json());
  renderDeviceGrid(state.devices);
  renderInventoryPanel(state.inventory);
  renderSoundClusters(state.sound_clusters);
}, 2000);
```

---

### Recommended UI Panels for Demo

1. **Router Panel** — show "T0 LOCAL" vs "T3 CLOUD" badge per event with latency + cost
2. **Device Grid** — live device states from `home_state.devices`
3. **Inventory Dashboard** — quantities vs thresholds from `home_state.inventory`
4. **Bedrock Reasoning** — show `result.reasoning` and expand each `tool_calls` entry
5. **Cost Meter** — accumulate T3 costs vs T0 savings to show the cascade value
6. **Sound Discovery** — list `home_state.sound_clusters` with identified/unidentified status

---

### Hackathon Judge Demo Flow

1. Hit `/api/simulate/geyser` → show T0 badge, 0ms, $0 → **"The system learned this, it's free now"**
2. Hit `/api/simulate/inventory_drop` → T3 badge, Bedrock reasoning, Amazon Now order confirmed → **"Cloud brain, agentic commerce"**
3. Hit `/api/simulate/unknown_sound` → T3, CLAP zero-shot, cluster logged → **"Open-world sound discovery, privacy-safe"**
4. Show `/api/homes/demo_home_001/rules` → **"2 active T0 rules = $X/month saved at 1M homes scale"**
