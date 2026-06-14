# Context-Aware Smart Home — Reference Architecture (v2)

*HackOn with Amazon S6 · PS1 · Alexa+ India context layer*

**What changed from v1 (review-driven):** open-world perception via acoustic embedding projections (zero-shot sound discovery); actuator-local fail-safe for safety-critical loads; regime-aware mining to stop festival/guest drift; BLE identity fusion; and a refined edge resource-management stance (tier-based residency, not reactive paging).

---

## 0. The one principle everything hangs off

The home is the **always-on substrate**; the cloud is **event-triggered and stateless**; learning runs as **batch and compiles into free local rules**. Nothing runs continuously per home on a server. Cloud cost scales with *escalations* (a few percent of events), not with time or number of homes.

A second principle removes per-context training: **specialization is a context problem, not a weights problem.** One general brain, parameterized per room/home by data (packs + memory), never fine-tuned per deployment. One brain, many worlds.

---

## 1. The compute cascade

Every event enters at the cheapest tier that can handle it and only escalates if that tier can't resolve it.

| Tier | Where | Latency | Cost | Handles | Share |
|---|---|---|---|---|---|
| **T0 Reflex** | On-device, deterministic rules | <10 ms | free | learned auto-scenes, safety cut-offs, guarded automations | ~80% |
| **T1 Edge ML** | On-device small models | <100 ms | free | wake word, sound events, speaker ID, presence, simple intent | ~12% |
| **T2 Edge SLM** | On-device / home hub (capable tiers only) | ~100–500 ms | ≈free | local NLU, simple conversation, routine prediction | ~5% |
| **T3 Cloud LLM** | Bedrock | 0.5–3 s | $$ | novel reasoning, agentic commerce, tutoring, planning | <3% |

The nightly learner keeps converting recurring T3 reasoning into T0 rules, so the escalation rate falls over time. The system gets cheaper as it learns.

---

## 2. Plane-by-plane architecture

### 2.1 Perception plane (edge, always-on, private)
The only continuously-running thing, and it runs on the device. Models run on AWS IoT Greengrass, compiled with SageMaker Neo.

- **Always-on (low-power NPU/DSP):** wake word, VAD (Silero), sound event detector (YAMNet / AST / PANNs), speaker encoder (ECAPA-TDNN), presence (radar/ultrasound on capable devices).
- **Output = semantic events *plus* acoustic embedding projections.** Alongside each labeled event, the penultimate-layer embedding is emitted. This enables **open-world / zero-shot sound discovery**: an unknown sound (an old inverter beep, a specific water-purifier chirp) has no label, but its embedding is still meaningful. An on-device novelty/OOD detector flags genuinely-unclassified sounds and forwards only the *embedding* (never raw audio) to the Zone D learner, which clusters them over time. A CLAP-style audio-text model can additionally name some novel sounds zero-shot by projecting against text descriptions. Raw audio/video never leaves the device.
- **Identity fusion:** ECAPA-TDNN voiceprints fused with BLE RSSI from the user's phone/watch and with presence/usual-device/time priors. BLE is a strong prior for the silent case, noisy rooms, and multi-speaker disambiguation — but a phone in the room is not proof of who is speaking, so fused confidence still passes a gate before any personal/privileged action. BLE device-tracking is PII: on-device and consented.

### 2.2 Device / capability plane (MCP + actuator-local safety)
Each device advertises capabilities as an MCP server (`sense` / `act` / `state`); a **home hub** aggregates them into one MCP endpoint. Capability interpretation for a novel device is a **pairing-time, cached, one-shot** job (ontology map, or one Bedrock call generating an adapter).

**Actuator-local fail-safe.** Safety-critical loads (water pump, geyser, heavy appliances) carry their own firmware-level dead-man timer on the smart plug / ESP32 — e.g., "on for 45 min with no hub heartbeat → shut off." The hub orchestrates, but the safety cutoff lives in the actuator and survives a hub crash, reboot, or power cut. Safety control fails safe locally; it never depends on the hub or the network being alive.

### 2.3 Local brain (edge / hub)
A lightweight **router** triages each event to T0–T3. A deterministic **rule engine** (T0, via AWS IoT Events) runs learned and default automations. A **short-term memory** buffer holds the current session in volatile RAM.

**Edge resource management (refined).** The T2 Edge SLM (quantized Llama 3.2 1–3B / Phi-3-mini / Nova Micro, INT4) is *optional and only on capable device tiers*, where it stays **resident** (memory-mapped weights) to avoid load latency. Thermals are managed by duty-cycling and by not running the SLM and heavy perception at full tilt simultaneously — not by reactive paging, which would reintroduce cold-start latency. On RAM-constrained mid-tier devices: either warm-load the SLM **predictively** (when a conversational turn is anticipated) or skip it and escalate to cloud. The elastic-tier design makes "can this device hold the SLM warm?" a deployment decision, not a per-request gamble. Resolves ~97% of events locally.

### 2.4 Cloud reasoning plane (stateless, multi-agent, on-demand)
Triggered only on a T3 escalation. A **supervisor agent** (Bedrock Agents + Step Functions) gets the request plus a one-shot injected context bundle, plans, and delegates to the minimum specialists needed: **Commerce** (Amazon Pay/Now/Fresh), **Home-control** (calls device MCP), **Safety/Policy** (deterministic authorization gate), **Knowledge/Tutor** (web-search tool + math/CAS tool). Discipline: agents spawn only at T3, depth stays supervisor → one or two specialists, never a swarm.

### 2.5 State and memory plane (managed, durable, sharded per home)

| Memory kind | Store | Why |
|---|---|---|
| Relationships + state | Graph serialized per home in DynamoDB (Neptune only if it grows) | traversal queries; per-home graph is tiny |
| Fuzzy / episodic recall, documents | OpenSearch Serverless / Bedrock Knowledge Bases | similarity retrieval |
| Learned rules (promoted automations) | DynamoDB with support/confidence/regime/temporal metadata | rules, not graph-shaped |
| Raw history + acoustic embedding clusters | Timestream (+ cluster store) | feeds the miner and sound discovery |
| Current session | Short-term memory in device RAM (volatile) | overwrites for privacy |

The personal subgraph stays on-device; only the minimal slice needed for an escalation is sent up.

### 2.6 Learning plane (batch, off-peak, regime-aware)
A nightly job reads Timestream and mines temporal/association patterns with classic algorithms (FP-growth / PrefixSpan / autocorrelation — not an LLM), produces candidate rules with support/confidence, uses **one cheap LLM call** per candidate to phrase + safety-check it, proposes to the user, and on confirmation **promotes to a T0 local rule**. Two guardrails:

- **Regime-aware mining (temporal guardrail).** Every pattern is tagged with its regime — normal / festival (calendar) / guest-present (occupancy spike + new BLE/network devices). Patterns mined under an anomalous regime do **not** promote into the baseline ruleset, so a Diwali-week or visiting-relative routine never permanently overwrites normal life. This is the learning-side twin of context-guarded rules.
- **Zero-shot sound discovery.** Acoustic embedding projections of unclassified sounds are clustered over time; when a cluster densifies, the system asks "I've noticed a recurring sound around 6 AM — what is this?" and, on the answer, mints a new local event label.

Decay still applies: repeated overrides lower a rule's confidence until it's removed.

---

## 3. The model zoo (pre-trained / base models)

| Model | Job | Where | Reference architecture | Training posture |
|---|---|---|---|---|
| Wake word | trigger | device | small keyword-spotter DNN | adopt |
| VAD | gate speech | device | Silero | adopt |
| Sound event detector | whistle, cry, sizzle, doorbell + **embeddings** | device | YAMNet / AST / PANNs; **CLAP** for open-vocab | **train once** on AudioSet + India corpus |
| Speaker encoder | who is speaking | device | ECAPA-TDNN / x-vector (Amazon Voice ID) | adopt + per-home enrollment |
| ASR | transcription | device (simple) + cloud (complex) | Whisper-class edge; Amazon Transcribe / Nova audio | adopt |
| Edge SLM | local NLU, simple replies | capable device / hub | Llama 3.2 1–3B / Phi-3-mini / Qwen2.5 / Nova Micro, INT4 | adopt (quantize) |
| Text embedder | memory / RAG | device + cloud | Titan Text Embeddings v2; bge-small / e5 on edge | adopt |
| Cloud LLM | hard reasoning, agents, tutor | Bedrock | Nova Micro/Lite/Pro; Claude Haiku/Sonnet, tiered | adopt |
| TTS | spoken responses | cloud + on-device | Amazon Polly; on-device TTS offline | adopt |
| Novelty/OOD detector | flag unknown sounds | device | lightweight density/distance estimator on embeddings | adopt |
| Pattern miner | discover automations | cloud batch | **not a model** — FP-growth / PrefixSpan | n/a |

The whistle is sound-event detection, not speech: audio → log-mel → small classifier → multi-label probabilities + embedding. Distinctive enough that classical DSP (band-pass + envelope peak detection) is a cheap fallback; counting = a temporal counter. Runs on-device, emits `whistle_count=3`.

---

## 4. AWS services mapping


| Plane / function | AWS services |
|---|---|
| Edge runtime + on-device ML | AWS IoT Greengrass; SageMaker Neo / Edge Manager; AWS IoT Device SDK |
| Ingest + transport + digital twin | AWS IoT Core (MQTT, **Device Shadow = digital twin**, Rules Engine); AWS IoT Events; IoT Device Management |
| Actuator-local safety | firmware dead-man timers on smart plugs/ESP32; Greengrass on the hub for orchestration |
| Compute + orchestration | AWS Lambda; AWS Step Functions; Amazon EventBridge; Amazon SQS; Amazon SNS |
| Reasoning | Amazon Bedrock (Nova, Claude, Titan); Bedrock Agents; Knowledge Bases; Guardrails (PII, denied topics, injection); prompt caching |
| State + data | DynamoDB (profiles, routines/rules, module registry, per-home graph, sharded by `home_id`); Timestream (history + embedding clusters); OpenSearch Serverless (vectors); S3; ElastiCache (semantic cache, optional); Neptune (only if graphs outgrow DynamoDB) |
| Distribution | CloudFront (CDN for packs + model updates) + S3 |
| Identity + security | Cognito; IAM scoped roles; KMS + Secrets Manager; API Gateway (+ throttling); WAF; GuardDuty; IoT Device Defender; CloudTrail |
| Central one-time training | SageMaker (SED, speaker encoder, OOD); SageMaker Ground Truth (label India sound corpus) |
| Learning / batch mining | AWS Glue / SageMaker Processing / Lambda reading Timestream → rules to DynamoDB |
| Commerce | Amazon Pay APIs; Amazon Now / Fresh APIs (mocked in demo) |
| Observability | Amazon CloudWatch |

---

## 5. Cross-cutting mechanisms

### 5.1 Personalization without training
A **Room Profile** parameterizes a deployment, all as data: entity inventory (world-state schema), active **knowledge pack** (salient sound labels, domain rules, exposed tools, persona/system-prompt framing, ontology subset), and scoped memory. `context = Room Profile + retrieved memory + live state`, fed to the same model. New room type = author a pack; a million kitchens share one kitchen pack, CDN-distributed.

### 5.2 Identity — the two-plane model
- **Ambient plane:** runs on room-state, no identity (lights, fans, safety).
- **Personal plane:** runs on speaker identity, opt-in, privately scoped (reminders, preferences, who-gets-told-what).

Identity = on-device voiceprints + BLE RSSI + presence/device/time fusion. Confidence-gated: below threshold, act generically or ask — never guess on anything personal, and never treat a BLE prior as proof. Guests unprofiled; children's voiceprints need verifiable parental consent.

### 5.3 Automation lifecycle
Context-guarded, context-parameterized rules: `IF alarm−30min AND someone_home AND outdoor_temp < threshold AND regime=normal THEN geyser_on(duration = f(temp))`. Seasonality and festival/guest regimes are *learned and gated*, not hardcoded. Cold-start ships sensible per-pack defaults. "Propose, don't impose" — silent autonomy only for trivial reversible actions; money actions confirm every time.

### 5.4 Short-term memory + reasoning tasks
STM is the volatile session buffer (recent turns + task scratchpad). For trig homework: router → T3 with tutor pack, STM thread, and a math/CAS tool (LLMs are unreliable at exact algebra, so the agent computes/verifies each step, then narrates pedagogically). Session ends → STM dropped, at most a one-line LTM distillation.

### 5.5 Prompt assembly (instruction hierarchy)
Fixed trust order: immutable signed system instructions → room/task pack → memory scoped to the verified speaker → live world state → quarantined user/external input (utterance, documents, web results, delimited as data). Higher layers win; lower layers can't escalate.

### 5.6 Security / anti-exploitation
Authority lives outside the model. **Propose-authorize separation**: the LLM emits a structured action request; a deterministic policy engine authorizes against verified identity, role, risk class, and capability scope. Plus Guardrails on input/output; identity/role gating (guests + children sandboxed); per-home rate limiting + anomaly detection (API Gateway/WAF, IoT Device Defender, GuardDuty); short-lived scoped credentials per action; whitelisted tools; no raw model exposure.

### 5.7 Web search
A tool in the T3 agentic layer — needs connectivity, costs a call. Results return into the quarantined layer (delimited, scanned, cited, never obeyed). Common queries cached centrally.

---

## 6. End-to-end traces

**Pressure cooker (local).** Edge SED → `whistle_count=3` (T1) → local rule → lower fan, announce locally (T0). ~80 ms, no cloud, no audio leaves.

**Unknown sound (open-world).** A recurring inverter beep has no YAMNet label → OOD detector flags it → embedding (not audio) → Zone D clusters it nightly → after a week the system asks "what's this 6 AM sound?" → user says "inverter low battery" → new local label minted → future beeps trigger an alert.

**Geyser automation (regime-gated).** Miner finds geyser follows weekday alarm by ~30 min, conf 0.9, only when outdoor temp < 28°C **and regime = normal** → one cheap LLM call phrases it → user confirms → promoted to a free T0 rule. A Diwali-week pattern never promotes; decays if overridden in summer.

**Water motor (fail-safe).** Hub-level rule says stop at tank-full; independently, the pump's smart-plug firmware shuts off after 45 min with no hub heartbeat. Even if the hub is dead during a power flicker, the motor can't overflow.

---

## 7. Scale and cost

Per-home sharding is native; the edge absorbs event volume; the cloud is stateless. Cost model (plug current Bedrock rates):

```
monthly cloud cost / home ≈ events_per_day × 30 × escalation_rate × avg_tokens_per_call × price_per_token
```

The lever is `escalation_rate`: a naive cloud-everything design ~1.0; the cascade + rule-promotion drives it under ~0.03 and falling. The ~30× contrast, shown side-by-side, is the strongest scalability evidence.

---

## 8. Privacy and compliance (DPDP)

Architectural boundary (raw signals can't cross — only events + embeddings + explicit requests); two planes (ambient no-identity vs. personal opt-in); voiceprints, BLE traces, and personal memory on-device and encrypted (KMS); guests unprofiled; children's data needs verifiable parental consent; explicit action attribution.

---

## 9. India-diversity layer

Religion-agnostic **Ritual Calendar** abstraction (pooja, namaz, Gurbani, Jain fasting as instances); language as a per-home/person pack (not a global "Hinglish" assumption); climate as features (geyser/AC/heater/dehumidifier vary by region/season; monsoon flips motor + surge behavior; water scarcity makes tanker booking region-specific); nested world topology (flat ⊂ building ⊂ society for apartments); tier accessibility — the same brain runs phone-only → Echo Dot → Echo Show → AZ3 Pro+Omnisense, degrading gracefully.

---

## 10. 48-hour demo: build vs mock

- **Build real:** browser Digital Twin; Bedrock call with injected India context; a simple miner over synthetic history; Web Speech voice → Bedrock → spoken; a **visible router/privacy panel** ("local, free, 8 ms" vs. "cloud, 1.2 s, 1 credit"); 3 sensors (water motor, LPG, pressure cooker).
- **Mock:** synthetic sensor series; Amazon Now cart; presence animation; family personas. Optional flex: show one "unknown sound discovery" prompt and one actuator fail-safe.
- **Cut:** always-on emotion/de-escalation; family audio-chronicler; always-listening trivia; autopay-by-default.
- **Narrative that wins:** the system gets cheaper as it learns (T3→T0 promotion), it's one elastic architecture for every home, and it fails safe at the actuator.
