# Alexa HomeSense Flagship Demo — Design Spec

Date: 2026-07-05 · Status: Approved by Kanav

## Goal

Turn the current confusing two-half demo (3D twin + disconnected dashboard) into a
flagship, judge-ready showcase for the Amazon HackOn hackathon. A judge exploring
alone for ~30 seconds must see multiple complete "wow" loops with zero clicks;
anyone with more time can free-explore everything.

## Core concept: the 30-second showcase loop

The app boots into a **self-running attract mode**:

- The 3D house is visibly alive (light shifts, sensor pulses, cinematic camera drift).
- Every ~8s a scenario auto-fires from a curated script. A caption shows the
  spoken command (e.g., "Alexa, doodhwala aaj nahi aaya"), and the event
  animates through the engineering x-ray strip while the house reacts in 3D.
- Any click/keypress pauses the loop and hands control to the user. Idle ~60s
  resumes the loop.

## Layout (single screen, no navigation maze)

1. **Center — 3D digital twin** (existing react-three-fiber house, decluttered).
   Every backend event visibly animates in the house: device glows, toggles,
   particle pings from sensors.
2. **Bottom strip — "The Brain" (tier-cascade x-ray).** Every event animates
   left→right: `Device → T0 Reflex → T1 Edge → Cache → T3 Cloud`. The taken
   path lights up; untaken tiers stay dim. Plain-language tier labels
   ("Instant reflex — free", "Thinks locally", "Asks the cloud"). Live counters:
   total events, % handled free, latency of last event, ₹ saved this month.
   Driven by real `trace` metadata on every backend response/WS event.
3. **Right rail — three tabs:**
   - **HomeSense**: human-language live event feed ("3:12 PM — Dog barked in
     living room → clip saved"), a "What happened while I was gone?" summary
     button, device-health cards ("Geyser drawing 12% more power → handyman
     recommended").
   - **Khata Vault** (flagship): skeuomorphic digital ledger notebook. Hinglish
     input by voice or text ("dhobi ko 10 kapde diye") → parsed into a clean
     ledger row with rupee math and vendor avatar. "Hisab karo" → animated
     month tally + mock UPI payment card slides in. Zero jargon.
   - **App Store**: module cards (Swiggy etc.). Installing a module visibly
     adds a capability chip into the Brain strip.
4. **Scenario box (top, always visible):** type any scenario ("I'm tired,
   order food") → backend plans it → an animated step diagram draws itself,
   then the house executes each step.
5. **Drag & drop devices:** existing asset library kept. Dropping a device
   plays a "registering → rules compiled into T0" animation in the Brain strip.

## The "Learned!" moment

When the rule miner promotes a repeated behavior to a T0 rule, a particle flows
from T3 down into T0 with a card: "This now runs locally — free, <10ms."
Triggerable on demand in demo mode (repeat a command 3×).

## Backend work

- **WebSocket robustness:** wss/ws auto-scheme from page protocol, heartbeat +
  exponential reconnect, and HTTP long-poll fallback for browsers/networks that
  block WS. Single client hook wraps both.
- **Trace metadata:** every simulate/voice/scenario response and WS event
  carries `trace: { path: ["t0"|"t1"|"cache"|"t3"...], latency_ms, cost_usd,
  tier_label }` to drive the Brain strip with real data.
- **Khata endpoints:** `POST /khata/log` (Hinglish parse via Bedrock, mock
  fallback), `GET /khata/ledger`, `POST /khata/settle` ("hisab karo" tally +
  mock UPI link payload).
- **Scenario planner:** extend `scenarioBuilderController` to return an ordered
  step plan (diagram-ready JSON) plus executable device actions.
- **Auto-loop script:** `GET /demo/script` returns the curated attract-mode
  scenario sequence so frontend and backend stay in sync.
- **Mock toggle:** ⌘M (and `?mock=1`) switches all LLM-backed paths to
  deterministic scripted responses for stage safety. Live Bedrock is default.

## Error handling

- Backend unreachable → frontend runs fully from bundled mock script (attract
  mode still works offline).
- LLM failure/timeout → automatic fallback to mock response for that request,
  with a subtle "offline reflex" note rather than an error.

## Testing

- Backend: unit tests for khata parser (mock mode), trace metadata presence,
  scenario plan shape. Existing jest setup.
- Frontend: vitest for command processor + store changes; manual cross-browser
  pass (Chrome/Safari/Firefox + one phone) for WS fallback.

## Docs deliverables

- `change.md` — all changes vs `Context_Aware_Smart_Home_Architecture_v2.md`.
- `generation.md` — prompts + placeholders for hero images/video assets.

## Out of scope

- Real UPI integration, real vendor apps, per-home auth, production hardening.
