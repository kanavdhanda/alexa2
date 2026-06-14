# Alexa+ India Context Layer — API Integration Docs v2

## Quick Start

```bash
cd backend
cp .env.example .env      # edit with your AWS creds, or keep MOCK_LLM=true
npm install
npm run start:ts           # starts on :3001

# Seed a demo home (15 devices, 5 rooms, 10 T0 rules)
curl -X POST http://localhost:3001/api/homes/demo_home_001/seed

# Run the geyser demo (T0, instant, $0)
curl -X POST http://localhost:3001/api/simulate/geyser \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","outdoor_temp":18}'
```

WebSocket: `ws://localhost:3001/ws?home_id=demo_home_001`

---

## Architecture

```
Browser (dumb terminal — ZERO computation)
    │  HTTP REST + WebSocket
    ▼
┌──────────────────────────────────────────────────┐
│  Backend API v2                                   │
│                                                   │
│  1. T0 Rule Engine   < 10ms  $0  (device rules)  │
│  2. T1 Local NLU     <100ms  $0  (voice/sound)   │
│  3. Semantic Cache       0ms  $0  (repeat T3)     │
│  4. Rate Limiter     15/min  —   (safety)         │
│  5. T3 Bedrock Agent 0.5-3s  $$  (nova-micro)     │
│       ↓ tools                                     │
│  order_amazon_now / actuate_device /              │
│  log_sound_cluster / send_notification            │
│                                                   │
│  Amazon Polly TTS  →  audio/mpeg base64          │
│  WebSocket         →  real-time event push        │
│  Dynamic Device Registry  →  any device type      │
│  MCP Module App Store → brand/model adapters      │
│  Regime Engine     →  festival/guest/sleep/away   │
│  Rule Miner        →  T3→T0 promotion pipeline    │
└──────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `AWS_REGION` | `us-east-1` | AWS region for all services |
| `AWS_ACCESS_KEY_ID` | — | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | — | IAM secret key |
| `BEDROCK_MODEL_ID` | `amazon.nova-micro-v1:0` | Bedrock model |
| `MOCK_LLM` | `true` | **`true`=dev (no AWS), `false`=live** |
| `POLLY_DEFAULT_VOICE` | `kajal` | Indian English voice |
| `S3_BUCKET` | — | Optional, for Transcribe STT |

---

## Core Flow — POST /api/events

Every event enters here. The backend routes it through the cascade automatically.

**Request:**
```json
{
  "home_id": "demo_home_001",
  "event_type": "sensor_trigger | voice_command | inventory_drop | unknown_sound",
  "data": { "...event-specific payload..." },
  "room_id": "kitchen",
  "speaker_id": "owner_1",
  "voice_response": false
}
```

**Routing table:**

| Event | Data | Route |
|---|---|---|
| `sensor_trigger` + `sensor=<device_id>` + `duration>45` | `{sensor, duration}` | **T0** — dead-man shutoff |
| `sensor_trigger` + `sensor=<device_id>` + `leak_detected=true` | `{sensor, leak_detected}` | **T0** — safety cutoff |
| `sensor_trigger` + `sensor=sound_event` + known label | `{sensor, label, whistle_count}` | **T0** — local announce |
| `voice_command` + simple intent | `{utterance, speaker_id}` | **T1** — local NLU |
| `presence_update` | `{room_id, occupied, confidence}` | **T1** — occupancy update |
| `voice_command` + complex intent | `{utterance}` | **T3** — Bedrock NLU |
| `inventory_drop` | `{item, quantity, unit, threshold}` | **T3** — commerce agent |
| `unknown_sound` | `{embedding_id, frequency, clap_guess}` | **T3** — zero-shot discovery |

**T0 Response:**
```json
{
  "tier": "T0", "cost": "$0.00",
  "result": {
    "action": "SHUT_OFF", "device_id": "demo_home_001_utility_water_motor",
    "property": "power", "new_value": false,
    "latency": "0.17ms", "rule_id": "..._deadman_power_off",
    "explanation": "...", "cost": "$0.00 (local reflex)"
  },
  "home_state": { "...full device twin..." },
  "regime": "normal"
}
```

**T1 Response:**
```json
{
  "tier": "T1", "cost": "$0.00",
  "result": {
    "intent": "turn_off_fan", "device_id": "demo_home_001_living_ceiling_fan",
    "property": "power", "value": false,
    "confidence": 0.92, "latency": "0.8ms",
    "explanation": "...", "cost": "$0.00 (local NLU)"
  }
}
```

**T3 Response:**
```json
{
  "tier": "T3", "latency": "1250ms",
  "cost": "~$0.000042 USD (est. 650 tokens, Nova Micro)",
  "result": {
    "model_id": "amazon.nova-micro-v1:0",
    "reasoning": "...",
    "tool_calls": [
      {
        "tool_name": "order_amazon_now",
        "tool_input": { "items": [...], "max_budget": 120, "priority": "EXPRESS_10MIN" },
        "tool_output": { "order_id": "AMZ-NOW-...", "eta_minutes": 10, "status": "ORDER_CONFIRMED" }
      }
    ],
    "final_plan": "Executed 1 action(s): order_amazon_now",
    "is_mock": false
  },
  "rate_limit": { "calls_this_minute": 1, "max": 15 }
}
```

---

## All Endpoints

### System
```bash
GET  /api/health                  # service status, mock mode, WS connections
```

### Homes
```bash
GET  /api/homes                   # list all active homes
GET  /api/homes/:id               # full home state
GET  /api/homes/:id/stats         # tier breakdown, cost, rule counts
GET  /api/homes/:id/twin          # digital twin snapshot (mode, rooms, devices, tier stats)
GET  /api/homes/:id/anticipations # time-aware anticipated actions list
POST /api/homes/:id/seed          # seed with 15-device Indian home (instant demo)
POST /api/homes/:id/reset         # wipe state
GET  /api/homes/:id/events        # event history (?limit=20&tier=T0)
PATCH /api/homes/:id/inventory    # {"item":"milk","quantity":2}
PATCH /api/homes/:id/sounds/:cluster_id/identify  # {"label":"inverter beep"}
POST /api/homes/:id/seed-learning-history  # seed 7 days of events for rule mining demo
```

### Devices (Dynamic Registry)
```bash
GET  /api/device-types                    # all 15 supported device types
GET  /api/homes/:id/devices               # list (?room_id=kitchen&type=fan)
POST /api/homes/:id/devices               # register new device
GET  /api/homes/:id/devices/:device_id    # single device state
PATCH /api/homes/:id/devices/:device_id  # {"property":"power","value":true}
DELETE /api/homes/:id/devices/:device_id # remove + auto-delete T0 rules
PATCH /api/homes/:id/devices/:device_id/online  # {"online":true}
```

**Register any device:**
```bash
curl -X POST http://localhost:3001/api/homes/demo_home_001/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "my_inverter",
    "type": "inverter",
    "room_id": "demo_home_001_utility_room",
    "friendly_name": "Main UPS"
  }'
```
Response includes `auto_t0_rules_generated: 2` — battery < 10% rule auto-created.

**All device types:**
`fan, light, geyser, water_heater, water_pump, motor, lpg_sensor, ac, air_conditioner, smart_plug, inverter, ups, ro_purifier, water_purifier, door_lock, tv, smart_tv, motion_sensor, presence_sensor, smoke_detector, curtain, blind, pressure_cooker_monitor`

### Rooms
```bash
GET  /api/homes/:id/rooms                  # room topology
POST /api/homes/:id/rooms                  # {"room_id":"..","name":"..","type":"kitchen"}
GET  /api/homes/:id/rooms/:room_id         # room + devices
PATCH /api/homes/:id/rooms/:room_id/occupancy  # {"occupied":true,"confidence":0.9}
```

### Regime Engine
```bash
GET  /api/homes/:id/regime          # detected regime + history
POST /api/homes/:id/regime          # {"regime":"festival","reason":"Diwali"}
POST /api/homes/:id/regime/refresh  # re-detect from current state
```

**Regimes:** `normal | festival | guest | sleep | away`
- `festival` and `guest` → learning suppressed (T3 patterns won't promote to T0)

### Rule Miner (T3→T0 Promotion Pipeline)
```bash
GET  /api/homes/:id/rules                    # T0 rules + narrative
POST /api/homes/:id/rules/mine               # analyze history → propose rules
GET  /api/homes/:id/rules/proposed           # pending proposals
POST /api/homes/:id/rules/proposed/:id/confirm  # promote to T0
POST /api/homes/:id/rules/proposed/:id/reject   # discard
```

**Demo flow for judges:**
1. Run 5+ T3 events to build history
2. `POST /api/homes/demo_home_001/rules/mine` → see proposals
3. `POST /api/homes/demo_home_001/rules/proposed/prop_xxx/confirm` → promote
4. Same event now routes to T0 (instant, $0)
5. Show `GET /api/homes/demo_home_001/stats` → T0% is rising

### MCP Module App Store
```bash
GET  /api/app-store/stats                  # total modules, installs, categories
GET  /api/app-store/categories             # category → count
GET  /api/app-store/modules                # list modules (?category=&brand=&device_type=&verified=)
GET  /api/app-store/modules?q=kirloskar    # search modules
GET  /api/app-store/modules/:module_id     # full module definition
POST /api/app-store/modules                # publish an unverified module
GET  /api/app-store/modules/template       # module creation template
POST /api/app-store/generate-module        # Bedrock/mock module generator
POST /api/app-store/modules/:module_id/install/:home_id  # install into home
GET  /api/homes/:home_id/modules           # installed modules for home
```

**What modules add:**
- brand/model-specific MCP-like device adapters
- richer property schemas
- safety class and dead-man timer metadata
- extra T0 rule templates
- room/device-specific Bedrock knowledge fragments
- T1 intent pattern metadata, including Hinglish
- demo event samples

**Browse/search modules:**
```bash
curl "$BASE/app-store/modules?device_type=water_pump&verified=true"
curl "$BASE/app-store/modules?q=daikin"
curl "$BASE/app-store/categories"
curl "$BASE/app-store/stats"
```

**Install a module manually:**
```bash
curl -X POST $BASE/app-store/modules/kirloskar-star1-pump-v1/install/$HOME
curl $BASE/homes/$HOME/modules
```

**Auto-attach during device registration:**
When `brand` and `model` are supplied, the backend searches the App Store for a matching module and installs it automatically.

```bash
curl -X POST $BASE/homes/$HOME/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "'$HOME'_kirloskar_pump",
    "type": "water_pump",
    "room_id": "'$HOME'_utility_room",
    "friendly_name": "Kirloskar Terrace Water Pump",
    "brand": "Kirloskar",
    "model": "STAR-1"
  }'
```

Response includes:
```json
{
  "auto_t0_rules_generated": 2,
  "module_attached": {
    "module_id": "kirloskar-star1-pump-v1",
    "name": "Kirloskar Star-1 Water Pump",
    "extra_rules": 4
  }
}
```

**Generate a draft module with AI/mock mode:**
```bash
curl -X POST $BASE/app-store/generate-module \
  -H "Content-Type: application/json" \
  -d '{
    "description": "A smart mosquito repellent plug used at night in Indian bedrooms. It has power, refill level, and child-safe lock.",
    "device_type": "smart_plug",
    "brand": "Good Knight",
    "model": "Gold Flash"
  }'
```

With `MOCK_LLM=true`, this returns a template. With `MOCK_LLM=false`, it calls Bedrock to produce a draft adapter.

**Publish a module:**
Use the structure from `GET /api/app-store/modules/template`, then:

```bash
curl -X POST $BASE/app-store/modules \
  -H "Content-Type: application/json" \
  -d @my-module.json
```

Published modules are `verified=false` by default. For the hackathon demo, this shows the marketplace flow; production would add DynamoDB, S3/CloudFront, OpenSearch, Redis cache, and a verification pipeline.

**Current demo limitation:** installing a module adds extra T0 rules, but module property schemas, T1 intent patterns, and module knowledge fragments are not fully merged into runtime device/T1/T3 behavior yet.

### Voice (Amazon Polly TTS + Transcribe STT)
```bash
GET  /api/voice/config            # voice module status, pricing
GET  /api/voice/speak?text=hello&voice=kajal   # returns raw MP3 audio
POST /api/voice/speak             # {"text":"..","voice":"kajal"} → audio_base64
POST /api/voice/respond           # {"tier":"T3","result":{...}} → spoken response
GET  /api/voice/demo-phrases      # list pre-built demo phrases
GET  /api/voice/demo-phrases?phrase=geyser_on  # returns MP3 for that phrase
POST /api/voice/transcribe        # LIVE AUDIO PATH: audio_base64 → transcript → event cascade
```

**Pre-built demo phrases (for offline demo):**
`geyser_on, motor_off, lpg_alert, milk_order, cooker_done, unknown_sound, cost_saving`

**Play TTS in browser:**
```javascript
const res = await fetch('/api/voice/speak', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Geyser turned on.', voice: 'kajal' })
});
const { audio_base64, content_type } = await res.json();
const audio = new Audio(`data:${content_type};base64,${audio_base64}`);
audio.play();
```

### Digital Twin + Anticipations

```bash
GET  /api/homes/:id/twin           # full digital twin snapshot: mode, rooms, devices, tier stats
GET  /api/homes/:id/anticipations  # anticipated actions list (time-aware)
```

**Digital Twin response:**
```json
{
  "home_id": "demo_home_001",
  "current_mode": "normal",
  "mode_info": { "label": "Normal", "color": "green", "description": "..." },
  "available_modes": { "normal": {...}, "festival": {...}, "guest": {...}, "sleep": {...}, "away": {...} },
  "rooms": [{ "room_id": "...", "devices": [...] }],
  "architecture_tier": { "T0": {...}, "T1": {...}, "T3": {...} }
}
```

**Anticipations response:**
```json
{
  "anticipations": [
    {
      "id": "ant_geyser_morning",
      "title": "Geyser before shower",
      "room": "bathroom",
      "reason": "Morning routine detected",
      "confidence": 0.91,
      "tier": "T0",
      "status": "pending",
      "explanation": "Learned from 28 days of pattern"
    }
  ]
}
```

### Live Audio Path (Mic Button → Event Pipeline)

```bash
POST /api/voice/transcribe
```

**Request:**
```json
{
  "home_id": "demo_home_001",
  "audio_base64": "<base64-encoded-audio>",
  "mock_text": "turn on the geyser",
  "language": "en-IN",
  "auto_route": true,
  "voice_response": false,
  "speaker_id": "owner_1"
}
```

- `mock_text` bypasses AWS Transcribe — use for demo (MOCK_LLM mode or testing)
- `auto_route: true` → transcript is immediately sent into the event pipeline as a `voice_command`
- `auto_route: false` → returns only `{transcript, stt_is_mock}`
- `audio_base64` → requires `S3_BUCKET` env var in live mode

**Response (auto_route=true):**
```json
{
  "audio_path": "live",
  "transcript": "turn on the geyser",
  "stt_is_mock": true,
  "language": "en-IN",
  "event_result": { "tier": "T1", "cost": "$0.00", "result": {...} }
}
```

**Frontend mic button flow:**
```javascript
// 1. Press button → start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
const chunks = [];
recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const base64 = await blobToBase64(blob);
  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ home_id, audio_base64: base64, auto_route: true, voice_response: true })
  });
  const { transcript, event_result } = await res.json();
  showTranscript(transcript);
  renderEventResult(event_result);
};
recorder.start();
// 2. Release button → stop
recorder.stop();
```

### Hackathon Demo Scenarios

```bash
POST /api/simulate/geyser              # T0 — outdoor_temp < 28°C fires morning rule
POST /api/simulate/inventory_drop      # T3 + Amazon Now commerce agent
POST /api/simulate/unknown_sound       # T3 + CLAP zero-shot + cluster logging
POST /api/simulate/motor_safety        # T0 — dead-man timer (duration > 45 min)
POST /api/simulate/voice_command       # voice utterance → full T0→T1→T3 cascade
POST /api/simulate/study_mode          # T0 — 6 PM tuition: light on, TV suppressed
POST /api/simulate/night_safety_check  # T0 — TV off, LPG check, motor off, sleep mode
POST /api/simulate/power_cut           # T0 — inverter battery mode, load shedding
POST /api/homes/:id/seed-learning-history  # seed 7 days of events for rule mining demo
```

All scenario endpoints accept `"voice_response": true` to get Polly TTS audio back.

---

## WebSocket — Real-time Event Push

Connect: `ws://localhost:3001/ws?home_id=demo_home_001`

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?home_id=demo_home_001');

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // msg.type: 'event_result' | 'device_update' | 'regime_change' | 'rule_proposed' | 'stats_update' | 'ping'

  if (msg.type === 'event_result') {
    const { tier, result, latency, cost } = msg.payload;
    renderRouterPanel({ tier, latency, cost });
    if (tier === 'T3') renderBedrockReasoning(result.reasoning, result.tool_calls);
  }
  if (msg.type === 'device_update') {
    const { device_id, property, new_value } = msg.payload;
    updateDeviceWidget(device_id, property, new_value);
  }
  if (msg.type === 'regime_change') {
    showRegimeBadge(msg.payload.new_regime);
  }
  if (msg.type === 'rule_proposed') {
    showRuleProposal(msg.payload);
  }
  if (msg.type === 'stats_update') {
    updateCostMeter(msg.payload.total_cost_usd);
    updateCascadeChart(msg.payload);
  }
};
```

---

## Frontend Integration Guide

### The Golden Rule
**Frontend does zero computation.** It only sends events and renders what comes back.

### Rendering the Tier Badge

```javascript
async function sendEvent(home_id, event_type, data) {
  const res = await fetch('http://localhost:3001/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ home_id, event_type, data, voice_response: true })
  });
  const result = await res.json();

  // 1. Update tier badge
  const badge = {
    T0: { label: 'LOCAL · REFLEX', color: 'green', emoji: '⚡', latency: result.result.latency },
    T1: { label: 'LOCAL · NLU', color: 'blue', emoji: '🧠', latency: result.result.latency },
    T3: { label: 'CLOUD · BEDROCK', color: 'orange', emoji: '☁️', latency: result.latency },
    CACHED: { label: 'CACHE HIT', color: 'purple', emoji: '💾', latency: '0ms' },
  }[result.tier];
  renderBadge(badge);

  // 2. Update device grid
  renderDeviceGrid(result.home_state.devices);

  // 3. If T3, show Bedrock reasoning panel
  if (result.tier === 'T3') {
    renderBedrockPanel(result.result.reasoning, result.result.tool_calls);
  }

  // 4. Play voice response if available
  if (result.voice?.audio_base64) {
    const audio = new Audio(`data:audio/mpeg;base64,${result.voice.audio_base64}`);
    audio.play();
  }
}
```

### Device State Schema

```typescript
interface DeviceInstance {
  device_id: string;
  friendly_name: string;
  type: string;
  room_id: string;
  safety_class: 'CRITICAL' | 'STANDARD' | 'CONVENIENCE';
  properties: {
    power?:            { current_value: boolean; ... };
    speed?:            { current_value: number; min: 0; max: 5; ... };
    target_temp?:      { current_value: number; unit: '°C'; ... };
    battery_percent?:  { current_value: number; ... };
    duration_minutes?: { current_value: number; ... };
    // ... any registered property
  };
  online: boolean;
  last_updated: string;
}
```

### Polling vs WebSocket

**Use WebSocket** (preferred) — pushed on every T0/T1/T3 completion.
**Use polling** as fallback — `GET /api/homes/:id` every 2 seconds.

---

## Judge Demo Script (5 minutes)

```
STEP 1 — Seed: POST /api/homes/demo_home_001/seed
  → "5 rooms, 15 devices, 10 T0 rules ready. This is an Indian home."

STEP 2 — Geyser (T0): POST /api/simulate/geyser {"outdoor_temp":18}
  → Show: 0.17ms latency, $0.00 cost, "promoted from T3 after 7-day pattern mining"
  → Say: "This used to cost $0.002 per morning. Now it's free. At 1M homes × 365 days = $730K/year saved."

STEP 3 — Voice (T1): POST /api/events {"event_type":"voice_command","data":{"utterance":"turn off the fan"}}
  → Show: T1 badge, local NLU matched intent, $0.00
  → Say: "Simple commands never reach the cloud."

STEP 4 — Inventory (T3): POST /api/simulate/inventory_drop {"item":"milk","quantity":0.3}
  → Show: Bedrock reasoning, order_amazon_now tool called, Amazon Now order confirmed
  → Say: "This is the 3% that actually needs intelligence."

STEP 5 — Sound Discovery: POST /api/simulate/unknown_sound
  → Show: CLAP zero-shot description, cluster logged, user prompt queued
  → Say: "Raw audio never left the device. Only a 512-dim vector came up."

STEP 6 — MCP Module App Store: GET /api/app-store/modules?q=kirloskar
  → Register a Kirloskar pump with brand/model
  → Show module_attached and extra safety rules
  → Say: "New device support comes from a marketplace data adapter, not hub code changes."

STEP 7 — Rule Miner: POST /api/homes/demo_home_001/rules/mine
  → Confirm a proposal → Show T0% rising in stats
  → Say: "The system just got cheaper. Permanently."
```

---

## cURL Reference — All Scenarios

```bash
BASE=http://localhost:3001/api
HOME=demo_home_001

# Setup
curl -X POST $BASE/homes/$HOME/seed
curl $BASE/homes/$HOME/stats

# Events
curl -X POST $BASE/events -H "Content-Type: application/json" \
  -d '{"home_id":"'$HOME'","event_type":"sensor_trigger","data":{"sensor":"'$HOME'_utility_water_motor","duration":55}}'

curl -X POST $BASE/events -H "Content-Type: application/json" \
  -d '{"home_id":"'$HOME'","event_type":"voice_command","data":{"utterance":"turn off the fan"}}'

curl -X POST $BASE/events -H "Content-Type: application/json" \
  -d '{"home_id":"'$HOME'","event_type":"inventory_drop","data":{"item":"milk","quantity":0.3,"unit":"liters","threshold":1}}'

# Scenarios
curl -X POST $BASE/simulate/geyser -H "Content-Type: application/json" -d '{"home_id":"'$HOME'","outdoor_temp":15}'
curl -X POST $BASE/simulate/inventory_drop -H "Content-Type: application/json" -d '{"home_id":"'$HOME'"}'
curl -X POST $BASE/simulate/unknown_sound -H "Content-Type: application/json" -d '{"home_id":"'$HOME'"}'
curl -X POST $BASE/simulate/motor_safety -H "Content-Type: application/json" -d '{"home_id":"'$HOME'","duration":55}'

# With voice response
curl -X POST $BASE/simulate/geyser -H "Content-Type: application/json" \
  -d '{"home_id":"'$HOME'","outdoor_temp":15,"voice_response":true}'

# Device management
curl $BASE/device-types
curl -X POST $BASE/homes/$HOME/devices -H "Content-Type: application/json" \
  -d '{"device_id":"my_ac","type":"ac","room_id":"'$HOME'_master_bedroom","friendly_name":"My AC"}'
curl -X PATCH $BASE/homes/$HOME/devices/my_ac -H "Content-Type: application/json" \
  -d '{"property":"power","value":true}'

# MCP Module App Store
curl $BASE/app-store/stats
curl "$BASE/app-store/modules?q=kirloskar"
curl -X POST $BASE/app-store/modules/kirloskar-star1-pump-v1/install/$HOME
curl $BASE/homes/$HOME/modules
curl -X POST $BASE/homes/$HOME/devices -H "Content-Type: application/json" \
  -d '{"device_id":"'$HOME'_kirloskar_pump","type":"water_pump","room_id":"'$HOME'_utility_room","friendly_name":"Kirloskar Pump","brand":"Kirloskar","model":"STAR-1"}'
curl -X POST $BASE/app-store/generate-module -H "Content-Type: application/json" \
  -d '{"description":"Smart mosquito repellent plug with refill level and child lock","device_type":"smart_plug","brand":"Good Knight","model":"Gold Flash"}'

# Regime
curl $BASE/homes/$HOME/regime
curl -X POST $BASE/homes/$HOME/regime -H "Content-Type: application/json" -d '{"regime":"festival","reason":"Diwali"}'

# Rule miner
curl -X POST $BASE/homes/$HOME/rules/mine
curl $BASE/homes/$HOME/rules/proposed
# curl -X POST $BASE/homes/$HOME/rules/proposed/<proposal_id>/confirm

# Voice TTS
curl $BASE/voice/config
curl "$BASE/voice/speak?text=Geyser+on&voice=kajal" --output geyser.mp3
curl "$BASE/voice/demo-phrases?phrase=lpg_alert" --output lpg.mp3

# WebSocket test (requires wscat: npm install -g wscat)
# wscat -c "ws://localhost:3001/ws?home_id=demo_home_001"
```
