# Changelog: Flagship Demo Redesign

## Why This Changed

Mentor feedback revealed the original demo was confusing: a disconnected 3D house on the left and a dashboard on the right, with no clear story. Hackathon judges explore for ~30 seconds and must see the magic immediately—no time for click-hunting.

## What Changed

### Backend
- **Trace metadata on all events** — Every API response and WebSocket event now carries real trace data: which tier handled it (T0 Reflex, T1 Edge, T2 Cache, T3 Cloud), latency, and cost. The frontend visualizes this as an x-ray strip.
- **Khata Vault endpoints** — Three new endpoints for the digital ledger:
  - `POST /khata/log` — Parses Hinglish voice input ("dhobi ko 10 kapde diye") via Bedrock, stores ledger rows with rupee math and vendor avatars.
  - `GET /khata/ledger` — Fetches full ledger history.
  - `POST /khata/settle` — Runs monthly tally ("hisab karo") and generates mock UPI payment link.
- **Demo script endpoint** — `GET /demo/script` returns a curated attract-mode scenario sequence so frontend and backend stay in sync.
- **Long-poll fallback** — HTTP polling as WebSocket fallback for browsers/networks that block WS. Ring buffer in websocket.ts.
- **Scenario planner** — Extended scenario builder returns ordered step plans (diagram-ready JSON) and executable device actions.

### Frontend
- **Single-screen DemoShell** replaces the 3-column dashboard:
  - Center: decluttered 3D twin with cinematic camera drift, device glows, and sensor particle pings.
  - Bottom: "The Brain" tier-cascade x-ray strip (animated left→right through T0/T1/Cache/T3) with live counters (total events, % handled free, latency, ₹ saved).
  - Right rail: three tabs:
    - **HomeSense** — Human-language event feed ("3:12 PM — Dog barked in living room"), "what happened away?" summary, device health cards.
    - **Khata Vault** — Skeuomorphic ledger notebook (Hinglish voice or text input, vendor avatars, rupee math, animated tally + UPI mock card).
    - **App Store** — Module cards; installing a module adds a capability chip into the Brain strip.
  - Top: Scenario box for typed commands ("I'm tired, order food") with animated step diagram.
  - Drag & drop device registration with "registering → rules compiled into T0" animation in Brain strip.
- **Attract mode** — 30-second self-running loop: scenarios auto-fire, captions show spoken commands, events animate through the Brain strip and house.
- **Rehearsal mode** (⌘M) — Mock responses for stage safety; live Bedrock is default.
- **WebSocket + long-poll robustness** — Heartbeat, exponential reconnect, cross-browser fallback.

### Removed
- Old 3-column DemoDashboard retired from routing.

## What Didn't Change

**The architecture is unchanged.** We did not redesign Context_Aware_Smart_Home_Architecture_v2. The backend tier cascade (Reflex → Edge → Cache → Cloud) and home-device model remain identical. These changes are **presentation and demo layers on top of the same architecture**—new endpoints, new visualizations, and a tighter UX for the hackathon stage. The engineering foundation stays solid.

---

**Commit reference:** `docs: change log and asset generation prompts`
