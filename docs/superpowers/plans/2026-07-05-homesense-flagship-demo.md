# Alexa HomeSense Flagship Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the hackathon demo into a single-screen flagship experience: self-running 30-second attract loop, 3D twin centerpiece, real-time tier-cascade "Brain strip", Khata Vault ledger, scenario diagram box, robust WebSocket with long-poll fallback.

**Architecture:** Backend (Express/TS, `backend/`) gains trace metadata on every event, khata endpoints, a demo-script endpoint, and an HTTP long-poll fallback beside the existing WS. Frontend (React+Vite+Tailwind+react-three-fiber, `frontend/`, SEPARATE REPO — never push frontend into backend repo) gets a new single-screen shell: center twin, bottom BrainStrip, right rail (HomeSense / Khata / App Store), top scenario box, attract-mode engine.

**Tech Stack:** Express + ws + Bedrock (mock fallback via `financialSafety.isMockMode()`), Jest (backend, `npm test` in `backend/`), React 18, zustand, Tailwind, react-three-fiber, Vitest (frontend).

## Global Constraints

- Frontend and backend are separate git repos. Commit frontend changes in `frontend/`, backend changes in repo root. NEVER add `frontend/` files to the root repo.
- Every LLM-backed path must work with `MOCK_LLM=true` (backend) and `?mock=1` / ⌘M (frontend).
- No jargon in user-visible copy. Tier labels are exactly: T0 → "Instant reflex", T1 → "Thinks locally", Cache → "Remembered answer", T3 → "Asks the cloud".
- Trace shape everywhere: `{ path: string[], latency_ms: number, cost_usd: number, tier_label: string }` where path items ∈ `"device" | "t0" | "t1" | "cache" | "t3"`.
- Commit messages < 15 words.
- Backend tests: `cd backend && npx jest <file> --silent`. Frontend tests: `cd frontend && npx vitest run <file>`.

---

### Task 1: Backend trace metadata

**Files:**
- Create: `backend/src/trace.ts`
- Modify: `backend/src/controllers/eventsController.ts`, `backend/src/controllers/simulateController.ts` (each response), `backend/src/websocket.ts` (broadcast payloads pass trace through untouched — verify only)
- Test: `backend/__tests__/trace.test.ts`

**Interfaces:**
- Produces: `buildTrace(tier: 't0'|'t1'|'cache'|'t3', latencyMs: number, costUsd?: number): Trace` and `export interface Trace { path: Array<'device'|'t0'|'t1'|'cache'|'t3'>; latency_ms: number; cost_usd: number; tier_label: string }`. Path always starts with `'device'` and includes every tier *attempted* up to and including the resolving tier (e.g. t3 resolve → `['device','t0','t1','cache','t3']`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/__tests__/trace.test.ts
import { buildTrace } from '../src/trace';

describe('buildTrace', () => {
  it('t0 trace has short path and friendly label', () => {
    const t = buildTrace('t0', 4);
    expect(t.path).toEqual(['device', 't0']);
    expect(t.tier_label).toBe('Instant reflex');
    expect(t.cost_usd).toBe(0);
    expect(t.latency_ms).toBe(4);
  });
  it('t3 trace walks the whole cascade', () => {
    const t = buildTrace('t3', 1800, 0.000035);
    expect(t.path).toEqual(['device', 't0', 't1', 'cache', 't3']);
    expect(t.tier_label).toBe('Asks the cloud');
    expect(t.cost_usd).toBeCloseTo(0.000035);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd backend && npx jest trace.test --silent` → FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// backend/src/trace.ts
export type TraceTier = 'device' | 't0' | 't1' | 'cache' | 't3';
export interface Trace {
  path: TraceTier[];
  latency_ms: number;
  cost_usd: number;
  tier_label: string;
}
const ORDER: TraceTier[] = ['device', 't0', 't1', 'cache', 't3'];
const LABELS: Record<string, string> = {
  t0: 'Instant reflex',
  t1: 'Thinks locally',
  cache: 'Remembered answer',
  t3: 'Asks the cloud',
};
export function buildTrace(tier: 't0' | 't1' | 'cache' | 't3', latencyMs: number, costUsd = 0): Trace {
  return {
    path: ORDER.slice(0, ORDER.indexOf(tier) + 1),
    latency_ms: latencyMs,
    cost_usd: costUsd,
    tier_label: LABELS[tier],
  };
}
```

- [ ] **Step 4: Test passes** — same command → PASS

- [ ] **Step 5: Wire into controllers.** Read `eventsController.ts` and `simulateController.ts`. Each already knows which tier resolved (look for fields like `tier`, `handled_by`, `t0_rule_id`, cache-hit flags, Bedrock call sites). For every JSON response and every `ws.broadcast(...)` event payload built there, add `trace: buildTrace(<tier>, <measured latency>, <cost if t3>)`. Measure latency with `Date.now()` at handler entry. Do NOT change existing fields. Add one integration assertion:

```ts
// append to backend/__tests__/trace.test.ts
import request from 'supertest';
import app from '../src/index';

it('simulate/geyser response carries a trace', async () => {
  await request(app).post('/api/homes/demo_home_001/seed');
  const res = await request(app)
    .post('/api/simulate/geyser')
    .send({ home_id: 'demo_home_001', outdoor_temp: 18 });
  expect(res.body.trace).toBeDefined();
  expect(res.body.trace.path[0]).toBe('device');
  expect(typeof res.body.trace.latency_ms).toBe('number');
});
```

- [ ] **Step 6: Run full backend suite** — `cd backend && npx jest --silent` → all PASS
- [ ] **Step 7: Commit** — `git add backend && git commit -m "feat: trace metadata on all event responses"`

---

### Task 2: Khata Vault backend

**Files:**
- Create: `backend/src/khata.ts`, `backend/src/controllers/khataController.ts`
- Modify: `backend/src/routes/index.ts` (add routes under `// ── Khata Vault ──`)
- Test: `backend/__tests__/khata.test.ts`

**Interfaces:**
- Consumes: `buildTrace` from Task 1; `financialSafety.isMockMode()`; `callBedrock`-style helper in `backend/src/bedrockClient.ts` (read it; reuse its existing exported invoke function for the live path).
- Produces REST API:
  - `POST /api/homes/:home_id/khata/log` body `{ utterance: string }` → `{ entry: KhataEntry, speech: string, trace: Trace }`
  - `GET  /api/homes/:home_id/khata/ledger` → `{ vendors: VendorLedger[], month: string }`
  - `POST /api/homes/:home_id/khata/settle` → `{ lines: SettleLine[], total_inr: number, upi_link: string, speech: string }`
  - Types: `KhataEntry { id, vendor: 'doodhwala'|'dhobi'|'maid'|'newspaper', vendor_hi: string, kind: 'delivery'|'missed'|'items'|'payment', quantity: number, unit: string, amount_inr: number, date: string, raw: string }`; `VendorLedger { vendor, vendor_hi, entries: KhataEntry[], subtotal_inr: number }`; `SettleLine { vendor, vendor_hi, detail: string, amount_inr: number }`.

- [ ] **Step 1: Failing tests (mock-mode parser is deterministic)**

```ts
// backend/__tests__/khata.test.ts
process.env.MOCK_LLM = 'true';
import { parseKhataUtterance, khataStore } from '../src/khata';

describe('khata mock parser', () => {
  beforeEach(() => khataStore.reset('h1'));
  it('parses missed milkman day', () => {
    const e = parseKhataUtteranceMock('doodhwala aaj nahi aaya');
    expect(e.vendor).toBe('doodhwala');
    expect(e.kind).toBe('missed');
    expect(e.quantity).toBe(1);
  });
  it('parses dhobi clothes count', () => {
    const e = parseKhataUtteranceMock('dhobi ko das kapde diye');
    expect(e.vendor).toBe('dhobi');
    expect(e.kind).toBe('items');
    expect(e.quantity).toBe(10); // "das" → 10
  });
  it('settle tallies per vendor', () => {
    khataStore.add('h1', parseKhataUtteranceMock('dhobi ko 10 kapde diye'));
    khataStore.add('h1', parseKhataUtteranceMock('doodhwala aaj nahi aaya'));
    const s = khataStore.settle('h1');
    expect(s.total_inr).toBeGreaterThan(0);
    expect(s.upi_link).toMatch(/^upi:\/\/pay/);
    expect(s.lines.length).toBe(2);
  });
});
import { parseKhataUtteranceMock } from '../src/khata';
```

- [ ] **Step 2: Run** — `npx jest khata.test --silent` → FAIL
- [ ] **Step 3: Implement `backend/src/khata.ts`**

```ts
import { randomUUID } from 'crypto';

export interface KhataEntry {
  id: string;
  vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper';
  vendor_hi: string;
  kind: 'delivery' | 'missed' | 'items' | 'payment';
  quantity: number;
  unit: string;
  amount_inr: number;
  date: string;
  raw: string;
}
export interface SettleLine { vendor: string; vendor_hi: string; detail: string; amount_inr: number }

const RATES = { doodhwala: 60, dhobi: 10, maid: 100, newspaper: 15 }; // ₹ per unit/day
const HI = { doodhwala: 'दूधवाला', dhobi: 'धोबी', maid: 'बाई', newspaper: 'अख़बारवाला' };
const HINDI_NUMS: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20 };

export function parseKhataUtteranceMock(utterance: string): KhataEntry {
  const u = utterance.toLowerCase();
  const vendor = (['doodhwala', 'dhobi', 'maid', 'newspaper'] as const).find(v => u.includes(v))
    ?? (u.includes('doodh') || u.includes('milk') ? 'doodhwala'
      : u.includes('kapd') || u.includes('press') || u.includes('iron') ? 'dhobi'
      : u.includes('paper') || u.includes('akhbar') ? 'newspaper' : 'maid');
  const numMatch = u.match(/\b(\d+)\b/);
  const hindiNum = Object.keys(HINDI_NUMS).find(w => new RegExp(`\\b${w}\\b`).test(u));
  const quantity = numMatch ? parseInt(numMatch[1], 10) : hindiNum ? HINDI_NUMS[hindiNum] : 1;
  const missed = /nahi (aa|ay)|didn'?t come|skip/.test(u);
  const kind: KhataEntry['kind'] = missed ? 'missed' : /kapde|clothes|diye/.test(u) ? 'items' : 'delivery';
  const amount = missed ? 0 : quantity * RATES[vendor];
  return {
    id: randomUUID(), vendor, vendor_hi: HI[vendor], kind, quantity,
    unit: vendor === 'dhobi' ? 'clothes' : vendor === 'doodhwala' ? 'litre' : 'day',
    amount_inr: amount, date: new Date().toISOString().slice(0, 10), raw: utterance,
  };
}

class KhataStore {
  private byHome = new Map<string, KhataEntry[]>();
  reset(homeId: string) { this.byHome.set(homeId, []); }
  add(homeId: string, e: KhataEntry) {
    if (!this.byHome.has(homeId)) this.byHome.set(homeId, []);
    this.byHome.get(homeId)!.push(e);
    return e;
  }
  ledger(homeId: string) {
    const entries = this.byHome.get(homeId) ?? [];
    const vendors = [...new Set(entries.map(e => e.vendor))].map(v => {
      const ve = entries.filter(e => e.vendor === v);
      return { vendor: v, vendor_hi: ve[0].vendor_hi, entries: ve, subtotal_inr: ve.reduce((s, e) => s + e.amount_inr, 0) };
    });
    return { vendors, month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  settle(homeId: string) {
    const { vendors } = this.ledger(homeId);
    const lines: SettleLine[] = vendors.map(v => ({
      vendor: v.vendor, vendor_hi: v.vendor_hi,
      detail: `${v.entries.length} entries`, amount_inr: v.subtotal_inr,
    }));
    const total = lines.reduce((s, l) => s + l.amount_inr, 0);
    return { lines, total_inr: total, upi_link: `upi://pay?pa=household@upi&am=${total}&tn=Monthly%20hisab` };
  }
}
export const khataStore = new KhataStore();
```

- [ ] **Step 4: Tests pass** — `npx jest khata.test --silent` → PASS
- [ ] **Step 5: Controller + routes.** `khataController.ts`: three handlers. `logKhata` measures latency, uses mock parser when `financialSafety.isMockMode()`, else calls Bedrock (reuse the invoke helper in `bedrockClient.ts` with a prompt: *"Parse this Hinglish household ledger utterance into JSON {vendor, kind, quantity, amount_inr}. Vendors: doodhwala/dhobi/maid/newspaper. Utterance: ..."*, falling back to the mock parser on any error/timeout ≥ 4s). Response: `{ entry, speech, trace: buildTrace(isMock ? 't1' : 't3', latency, isMock ? 0 : 0.000035) }` where `speech` is e.g. `"Likh liya — dhobi, 10 kapde, ₹100."` Settle speech: `"Is mahine ka hisab: total ₹X. Payment link aapke phone par bhej diya."` Broadcast a WS event `{ type: 'khata_entry', payload: { entry, trace } }` via the exported websocket broadcaster (read `websocket.ts` for the broadcast function signature). Routes in `routes/index.ts`:

```ts
import { logKhata, getKhataLedger, settleKhata } from '../controllers/khataController';
// ── Khata Vault ───────────────────────────────────────────────────────────────
router.post('/homes/:home_id/khata/log', logKhata);
router.get('/homes/:home_id/khata/ledger', getKhataLedger);
router.post('/homes/:home_id/khata/settle', settleKhata);
```

Add a supertest to `khata.test.ts` hitting all three routes (log → ledger shows entry → settle returns upi_link).
- [ ] **Step 6: Full suite** — `npx jest --silent` → PASS
- [ ] **Step 7: Commit** — `git add backend && git commit -m "feat: khata vault endpoints with mock fallback"`

---

### Task 3: Demo script + long-poll fallback endpoints

**Files:**
- Create: `backend/src/demoScript.ts`
- Modify: `backend/src/websocket.ts` (ring buffer of last 100 broadcasts with seq numbers), `backend/src/routes/index.ts`
- Test: `backend/__tests__/demoScript.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/demo/script` → `{ steps: DemoStep[] }` with `DemoStep { id: string, caption: string, caption_hi?: string, endpoint: string, method: 'POST', body: Record<string, unknown>, dwell_ms: number }` — the frontend attract loop replays these against the listed endpoints.
  - `GET /api/homes/:home_id/poll?since=<seq>` → `{ events: Array<{ seq: number, msg: WsMessageShape }>, latest_seq: number }` (immediate return, no hanging; frontend polls every 2.5s when WS is down).
  - In `websocket.ts`: every broadcast also `pushToBuffer(home_id, msg)`; export `getBufferedEvents(homeId: string, since: number)`.

- [ ] **Step 1: Failing test**

```ts
// backend/__tests__/demoScript.test.ts
import request from 'supertest';
import app from '../src/index';

it('demo script returns ordered steps with captions', async () => {
  const res = await request(app).get('/api/demo/script');
  expect(res.body.steps.length).toBeGreaterThanOrEqual(5);
  for (const s of res.body.steps) {
    expect(s.caption).toBeTruthy();
    expect(s.endpoint).toMatch(/^\/api\//);
    expect(s.dwell_ms).toBeGreaterThan(2000);
  }
});

it('poll endpoint returns buffered events after a simulate', async () => {
  await request(app).post('/api/homes/demo_home_001/seed');
  const before = await request(app).get('/api/homes/demo_home_001/poll?since=0');
  await request(app).post('/api/simulate/geyser').send({ home_id: 'demo_home_001', outdoor_temp: 18 });
  const after = await request(app).get(`/api/homes/demo_home_001/poll?since=${before.body.latest_seq}`);
  expect(after.body.events.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement.** `demoScript.ts` exports a hardcoded `DEMO_STEPS` array of 6 steps (captions in plain English/Hinglish, no jargon):
  1. `"Alexa, geyser chala do"` → `/api/simulate/geyser` (shows T0 reflex), dwell 7000
  2. `"What's that sound?"` → `/api/simulate/unknown_sound` (T1), dwell 8000
  3. `"Alexa, doodhwala aaj nahi aaya"` → `/api/homes/demo_home_001/khata/log` body `{utterance:...}`, dwell 8000
  4. `"Dhobi ko das kapde diye"` → khata log, dwell 7000
  5. `"Study mode for the kids"` → `/api/simulate/study_mode`, dwell 8000
  6. `"Hisab karo"` → `/api/homes/demo_home_001/khata/settle`, dwell 9000

  In `websocket.ts`: module-level `const buffers = new Map<string, {seq:number,msg:unknown}[]>` and `let seqCounter = 0`; inside the existing broadcast function push `{seq: ++seqCounter, msg}` and cap at 100. Export `getBufferedEvents(homeId, since)` returning entries with `seq > since`. Poll route handler in routes file (inline, like `/admin/run-batch`). Ensure broadcast is also invoked in test mode even with no WS clients (guard any `server`-dependent code).
- [ ] **Step 4: Tests pass**, full suite passes
- [ ] **Step 5: Commit** — `"feat: demo script and long-poll fallback"`

---

### Task 4: Scenario planner endpoint

**Files:**
- Modify: `backend/src/controllers/scenarioBuilderController.ts`, `backend/src/routes/index.ts`
- Test: `backend/__tests__/scenarioPlan.test.ts`

**Interfaces:**
- Produces: `POST /api/scenario-builder/plan` body `{ home_id: string, scenario: string }` → `{ title: string, steps: PlanStep[], trace: Trace }` with `PlanStep { n: number, actor: 'user'|'alexa'|'device'|'cloud'|'app', label: string, detail: string, device_id?: string, action?: { property: string, value: unknown } }`. Steps with `action` are executable; frontend executes them sequentially via existing `PATCH /api/homes/:home_id/devices/:device_id`.

- [ ] **Step 1: Failing test** (MOCK_LLM=true): POST `{home_id:'demo_home_001', scenario:'I am tired, order me dinner'}` → expect ≥3 steps, first actor `'user'`, every step has `label` and `detail`, `res.body.trace.path` includes `'t3'` (mock still reports t3-shaped trace with cost 0).
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement.** Read the existing `buildScenarioRule` for the Bedrock invocation pattern and reuse it. Mock mode: a deterministic planner that keyword-matches the scenario against seeded devices (read `seedData.ts` for device ids) and emits a sensible plan; for unmatched scenarios emit the generic plan: user says → Alexa understands intent → checks installed apps → executes/responds. Live mode: Bedrock prompt returning strict JSON (`steps` array as typed above), `JSON.parse` with try/catch → fall back to mock planner. Register route next to `/scenario-builder/rule`.
- [ ] **Step 4: Tests pass**, full suite green
- [ ] **Step 5: Commit** — `"feat: scenario planner returns diagram-ready step plan"`

---

### Task 5: Frontend — WS heartbeat + long-poll fallback (cross-browser fix)

**Files (all in `frontend/` repo):**
- Modify: `frontend/src/hooks/useWebSocket.ts`, `frontend/src/config/env.ts`, `frontend/src/api/endpoints.ts`
- Test: `frontend/src/test/wsFallback.test.ts`

**Interfaces:**
- Consumes: `GET /api/homes/:home_id/poll?since=` from Task 3.
- Produces: same `useWebSocket()` API (`{subscribe, send, isConnected}`) plus `transport: 'ws' | 'poll' | 'offline'` in the return. All existing subscribers keep working; polled events are dispatched through the same `_msgCallbacks`.

- [ ] **Step 1: Failing test** — export a pure helper `nextTransportState(current, {wsFailed, pollOk})` and test the transitions: ws→poll after circuit opens; poll→ws when a reconnect succeeds; poll delivers messages in seq order (unit-test a `dedupeBySeq` helper).
- [ ] **Step 2: Run** — `npx vitest run wsFallback` → FAIL
- [ ] **Step 3: Implement.**
  - Heartbeat: on open, `setInterval` 10s sending `{type:'ping'}`; if no message of any kind for 25s, `ws.close()` (Safari silently drops connections — this forces the reconnect path).
  - When circuit opens (existing `_circuitOpen = true` branch), instead of only waiting 30s, start polling: `setInterval` 2500ms fetch poll endpoint with `since=lastSeq`, dispatch each `msg` to `_msgCallbacks`, set `transport='poll'`, `notifyConnState(true)` (UI shows "connected — fallback"). Keep the 30s WS retry; on WS open, stop polling.
  - `env.ts`: WS URL derivation already maps https→wss via `replace(/^http/,'ws')` — keep; add `POLL_FALLBACK_MS: 2500`.
- [ ] **Step 4: Tests pass**; manual check: `npm run dev`, kill backend WS route (set `VITE_WS_ENABLED=false`) and confirm events still arrive via poll.
- [ ] **Step 5: Commit in `frontend/`** — `"fix: ws heartbeat + http long-poll fallback"`

---

### Task 6: Frontend — trace store + BrainStrip

**Files:**
- Create: `frontend/src/components/brain/BrainStrip.tsx`, `frontend/src/store/brainStore.ts`
- Test: `frontend/src/test/brainStore.test.ts`

**Interfaces:**
- Produces: `useBrainStore` (zustand): `{ events: BrainEvent[], counters: { total: number, freePct: number, lastLatencyMs: number, rupeesSaved: number }, pushTrace(trace: Trace, caption: string): void, capabilities: string[], addCapability(name: string): void }`. `BrainEvent { id, caption, trace, at: number }`. `rupeesSaved` = events NOT resolved at t3 × ₹0.30 (nominal per-cloud-call saving, keep constant `SAVING_PER_LOCAL_EVENT_INR = 0.3`).
- `<BrainStrip />`: fixed bottom strip, 5 tier nodes with the friendly labels from Global Constraints; on `pushTrace` the path lights node-by-node (120ms stagger, Tailwind transition + a moving dot), resolving node pulses; counters top-right; capability chips (from app store installs) render as small pills on the T3 node.

- [ ] **Step 1: Failing test** — `pushTrace` twice (one t0, one t3): `counters.total===2`, `freePct===50`, `rupeesSaved===0.3`; events capped at 30.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement store** (pure zustand, no React). **Step 4: PASS.**
- [ ] **Step 5: Build `BrainStrip.tsx`.** Subscribe to `useWebSocket().subscribe` — on any message whose payload contains `trace`, call `pushTrace(trace, captionFrom(msg))`. Visual spec: dark glass strip (`bg-slate-950/80 backdrop-blur border-t border-slate-800`), tier nodes as rounded cards with icon + label + sublabel (`<10ms · free`, `<100ms · free`, `0ms · free`, `0.5–3s · paid`), inactive nodes `opacity-40`, active path nodes get `ring-2 ring-cyan-400` in sequence via a `useEffect` timer over the latest event's path, animated dot = absolutely-positioned div translating between node centers. Counters as three stat chips: `Events`, `Handled free`, `₹ saved`. No jargon words like "NLU/Bedrock/tier" in visible copy.
- [ ] **Step 6: Verify in browser** (`npm run dev`, fire `curl` simulate, watch strip animate). **Step 7: Commit** — `"feat: brain strip tier-cascade visualization"`

---

### Task 7: Frontend — right rail: HomeSense tab

**Files:**
- Create: `frontend/src/components/rail/RightRail.tsx`, `frontend/src/components/rail/HomeSenseTab.tsx`
- Modify: reuse `frontend/src/components/demo/EventFeed.tsx` logic (read it first; lift its feed rendering, humanize copy)
- Test: `frontend/src/test/homesense.humanize.test.ts`

**Interfaces:**
- Produces: `<RightRail />` with tab state (`'homesense' | 'khata' | 'apps'`, zustand `ui` slice or local state + exported `setRailTab` via a small `railStore`). `HomeSenseTab` renders: (a) live feed of WS events in human language via exported `humanizeEvent(msg: WsMessage): string | null` (null = hide internal noise), (b) "What happened while I was gone?" button → calls `GET /api/homes/:id/events` + summarizes client-side in mock mode or via `/api/voice/respond` live, rendering 3 bullet cards, (c) device-health cards: `GET /api/homes/:id/anticipations` mapped to cards like "Geyser drawing 12% more power → consider a handyman visit" with severity color.

- [ ] **Step 1: Failing test** for `humanizeEvent`: `device_update {device_id:'geyser_01',property:'power',new_value:'on'}` → `"Geyser turned on"`; `rule_proposed {title:X}` → `"Alexa learned: X"`; `ping` → null.
- [ ] **Step 2–4:** implement, PASS.
- [ ] **Step 5: Build the components** (Tailwind cards, timestamps as "3:12 PM", vendor/device emojis for warmth). **Step 6: Commit** — `"feat: homesense tab with human-language feed"`

---

### Task 8: Frontend — Khata Vault tab

**Files:**
- Create: `frontend/src/components/rail/KhataTab.tsx`, `frontend/src/api/khataApi.ts`
- Test: `frontend/src/test/khataApi.test.ts`

**Interfaces:**
- Consumes: Task 2 endpoints; `useMic`/`useServerSTT` hooks (read them) for voice input; `useWebSocket` for `khata_entry` pushes.
- Produces: `khataApi = { log(utterance), ledger(), settle() }` (thin fetch wrappers over `env.BACKEND_URL`, HOME_ID from env).

- [ ] **Step 1: Failing test** — mock `fetch`, assert `khataApi.log('x')` POSTs to `/api/homes/${env.HOME_ID}/khata/log` with JSON body.
- [ ] **Step 2–4:** implement, PASS.
- [ ] **Step 5: Build `KhataTab.tsx`** — the flagship. Visual spec: cream paper-notebook card (`bg-amber-50 text-stone-800 rounded-xl shadow-inner`, ruled-line background via repeating-linear-gradient), header "🧾 Ghar ka Khata — <month>". Input row: text field with placeholder `"Bolo… 'dhobi ko 10 kapde diye'"` + mic button + 3 example chips that fill the field. On log: new ledger row animates in (slide+fade), showing vendor emoji (🥛👕🧹📰), Hindi name, detail, ₹ amount handwritten-style font (`font-serif italic`). "Hisab karo" button: rows flip to a tally, total counts up (rAF number animation ~800ms), then a UPI payment card slides up (green, "₹X — Pay via UPI", QR placeholder box, "Link sent to your phone ✓"). Every khata WS event also lands in BrainStrip via its trace.
- [ ] **Step 6: Browser verify. Step 7: Commit** — `"feat: khata vault ledger tab"`

---

### Task 9: Frontend — App Store tab + capability chips

**Files:**
- Create: `frontend/src/components/rail/AppsTab.tsx` (adapt from existing `frontend/src/components/panels/AppStorePanel.tsx` — read it, reuse its API calls from `frontend/src/api/appStoreApi.ts`)
- Test: existing suite must stay green

**Interfaces:**
- Consumes: `appStoreApi` (existing), `useBrainStore.addCapability` (Task 6).

- [ ] **Step 1:** Build tab: module cards (icon, name, one-line human benefit e.g. "Order food by just asking"), Install button → calls existing install endpoint → on success `addCapability(module.name)` + toast "Swiggy can now talk to Alexa". Installed modules get a ✓ badge.
- [ ] **Step 2:** `npx vitest run` all green; browser verify chip appears on BrainStrip T3 node.
- [ ] **Step 3: Commit** — `"feat: app store tab feeds capability chips to brain"`

---

### Task 10: Frontend — scenario box + animated flow diagram

**Files:**
- Create: `frontend/src/components/scenario/ScenarioBox.tsx`, `frontend/src/components/scenario/ScenarioFlow.tsx`, `frontend/src/api/scenarioApi.ts`
- Test: `frontend/src/test/scenarioFlow.test.ts`

**Interfaces:**
- Consumes: `POST /api/scenario-builder/plan` (Task 4); device PATCH endpoint for executing steps.
- Produces: `ScenarioBox` (top-center pill input "Type any scenario… 'I'm tired, order dinner'"); on submit → overlay panel with `ScenarioFlow steps={PlanStep[]}` — steps render as connected nodes left→right (actor icon: 🗣️ user, ⭕ alexa, 💡 device, ☁️ cloud, 📦 app), each node draws in sequentially (300ms stagger), connector lines animate width 0→100%. After the draw completes, executable steps run for real (PATCH device), each node getting a green check as its action lands; house reacts via normal WS `device_update` flow.

- [ ] **Step 1: Failing test** — pure helper `stepDelay(i)` and `actorIcon(actor)` unit tests (`actorIcon('device')==='💡'` etc.).
- [ ] **Step 2–4:** implement, PASS. **Step 5:** build components per spec. Escape/✕ closes overlay, attract loop stays paused (Task 11 wires idle). **Step 6: Commit** — `"feat: type-a-scenario animated flow diagram"`

---

### Task 11: Frontend — attract mode (30-second loop) + captions

**Files:**
- Create: `frontend/src/hooks/useAttractMode.ts`, `frontend/src/components/demo/CaptionOverlay.tsx`
- Test: `frontend/src/test/attractMode.test.ts`

**Interfaces:**
- Consumes: `GET /api/demo/script` (Task 3). Bundle the same 6 steps as `DEFAULT_SCRIPT` fallback constant so attract mode works with backend offline (captions + locally-scripted `pushTrace` calls with fabricated traces).
- Produces: `useAttractMode(): { active: boolean, currentCaption: string | null }`. Behavior: starts after 3s on load; iterates script steps — shows caption, POSTs the step's endpoint (or fabricates trace offline), waits `dwell_ms`, loops. ANY pointerdown/keydown pauses (`active=false`); resumes after 60s idle (reset timer on every interaction). Exposes pure `attractReducer(state, action)` for tests.

- [ ] **Step 1: Failing tests** on `attractReducer`: `INTERACT` → inactive + idleSince set; `TICK` with 60s elapsed → active again; `STEP_DONE` advances index modulo length.
- [ ] **Step 2–4:** implement, PASS.
- [ ] **Step 5: `CaptionOverlay`** — bottom-center above BrainStrip: large rounded caption bubble (`text-2xl font-medium bg-slate-900/90 text-white`), mic-wave icon, types in per-word (staggered opacity). Small "▶ watching demo — click anywhere to explore" hint chip while active.
- [ ] **Step 6:** wire cinematic camera drift: read `frontend/src/components/canvas/CameraController.tsx` and add a slow orbit when `attract.active` (lerp azimuth ~0.05 rad/s), returning control on interaction.
- [ ] **Step 7: Commit** — `"feat: self-running attract mode with captions"`

---

### Task 12: Frontend — new single-screen shell + mock toggle

**Files:**
- Create: `frontend/src/components/shell/DemoShell.tsx`
- Modify: `frontend/src/App.tsx` (render `DemoShell` as default page; keep `#/construct` route), `frontend/src/config/env.ts` (mock flag)
- Test: full `npx vitest run` green + manual cross-browser pass

**Interfaces:**
- Consumes: everything above. Layout grid: `grid-rows-[auto_1fr_auto]`; top bar = logo "Alexa HomeSense" + `ScenarioBox` + status dot (ws/poll/offline from Task 5 `transport`); middle = `DigitalTwinCanvas` (existing, full-bleed) + `RightRail` overlaid right (`w-[380px]`, glass panel, collapsible); bottom = `BrainStrip` + `CaptionOverlay`. Drag-drop device flow: keep existing `AssetLibraryPanel` behind a "＋ Add device" button; on device registration success, fire `pushTrace(buildLocalTrace('t0', 8), 'New device learned — rules compiled')`.
- Mock toggle: `⌘M`/`Ctrl+M` and `?mock=1` set `useBrainStore.mock=true`; when true, every API wrapper (`khataApi`, `scenarioApi`, attract mode) uses bundled deterministic responses instead of fetch. Small "rehearsal mode" badge when on.
- DECLUTTER: `DemoDashboard`, `ColA_*`, `ColB_*`, `ColC_*`, `ProjectIntro`, `GuidedTour` are no longer routed (leave files, remove imports from App). The judges see ONLY DemoShell.

- [ ] **Step 1:** Build shell, wire routes. **Step 2:** all vitest green; `npm run build` succeeds.
- [ ] **Step 3: Manual pass:** Chrome + Safari + Firefox + one phone browser: WS connects or falls back, attract loop runs, khata logs, scenario draws, ⌘M works.
- [ ] **Step 4: Commit** — `"feat: single-screen flagship shell"`

---

### Task 13: Docs — change.md + generation.md

**Files:**
- Create: `change.md`, `generation.md` (repo root, backend repo)

- [ ] **Step 1: `change.md`** — sections: What changed vs `Context_Aware_Smart_Home_Architecture_v2.md` (trace metadata, khata vault module, demo script, long-poll fallback, scenario planner; note the architecture itself is unchanged — these are demo/presentation layers on the same cascade), Frontend rebuild summary (old 3-column dashboard retired → single-screen shell), Why (mentor feedback: too confusing; 30-second judge constraint).
- [ ] **Step 2: `generation.md`** — image/video generation prompts with placeholder paths the frontend references:
  - Hero splash (`frontend/public/hero.png`): prompt for a warm Indian living room at dusk, glowing smart speaker, subtle cyan network threads through walls, cinematic, 16:9.
  - Khata notebook texture (`frontend/public/khata-paper.png`): aged cream ledger paper, faint red margin rule.
  - Vendor avatars (`frontend/public/vendors/*.png`): friendly flat illustrations — milkman with bicycle, dhobi with iron, maid, newspaper vendor; consistent style prompt.
  - Optional 20s intro video prompt.
- [ ] **Step 3: Commit** — `"docs: change log and asset generation prompts"`

---

## Self-review notes

- Spec coverage: attract loop (T11), twin centerpiece + camera drift (T11/12), BrainStrip + counters (T6), HomeSense tab incl. away-summary + health cards (T7), Khata (T2/T8), App Store chips (T9), scenario box (T4/T10), drag-drop registration beat (T12), Learned! moment — covered by existing `rule_proposed` WS event rendering as "Alexa learned:" (T7) plus trace push (T6); WS fix (T5), mock toggle (T12), docs (T13). Trace shape consistent across T1/T4/T6. Two-repo constraint stated globally.
