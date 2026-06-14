# Pre-Publish Test Checklist

## AWS / Backend Context

`MOCK_LLM=true` in `backend/.env` means Bedrock never fires — all voice uses the local T1 keyword matcher. To unlock full AI:
1. Add real AWS credentials to `backend/.env`
2. Set `MOCK_LLM=false`
3. Run `POST /api/homes/home_001/seed` once to populate device state

---

## 1. Core 3D / Digital Twin

- [ ] House loads with correct room layout — no objects floating outside walls
- [ ] Click room → camera zooms in smoothly
- [ ] Double-click floor **outside** building → resets to house view
- [ ] Scroll zoom stays where you left it (does not spring back after room exit)
- [ ] All 5 rooms have windows visible on exterior walls
- [ ] Bathroom is visibly smaller than the other rooms (compact left-half layout)
- [ ] Office chair faces the desk (not away from it)
- [ ] Living room has U-shaped sofa arrangement (3 sofas, no arm chairs)
- [ ] Ceiling fans spin in living room + office (`isOn: true` defaults)
- [ ] Smart bulbs glow in 3D scene when turned on; glow stops when off

---

## 2. Voice — Local Mode (no AWS needed)

- [ ] Tap mic ring → browser prompts for microphone permission on first use
- [ ] Live interim transcript appears while speaking (`"turn on the li..."`)
- [ ] Say **"Alexa, turn on the lights"** → "Alexa," is stripped → command executes
- [ ] Say **"good morning"** → triggers Morning scene (all lights on, fans on)
- [ ] Say **"turn off all lights"** → all smart bulbs turn off
- [ ] Say **"set brightness to 50"** → active room bulb dims to 50%
- [ ] No-speech timeout does not show error — keeps listening silently
- [ ] Tap ring while listening → stops recording

---

## 3. Voice — Backend Mode (requires AWS credentials + `MOCK_LLM=false`)

- [ ] Toggle "Backend" pill in Alexa panel → ring border turns green
- [ ] Speak command → audio blob POSTs to `POST /api/voice/transcribe`
- [ ] Polly audio response plays back in Indian English (Kajal voice)
- [ ] Bedrock handles open-ended commands: "make it cozy in here" (multi-device, no T1 pattern)
- [ ] T3 tier badge appears in Anticipations panel for complex intents

---

## 4. Alexa App Panel

- [ ] All 5 rooms show correct devices in the Devices tab
- [ ] Device toggle turns on/off AND the 3D scene updates live (same frame)
- [ ] Brightness slider works on smart bulbs
- [ ] Volume slider works on Echo Dot / Echo Show / Smart TV
- [ ] Scenes tab: Good Morning, Movie Night, Sleep, etc. all trigger correctly
- [ ] Routines tab: active routines listed; toggle enables/disables
- [ ] Notifications appear for device changes and can be dismissed individually
- [ ] "Clear all" removes all notifications

---

## 5. Anticipations Panel (requires backend)

- [ ] `POST /api/homes/home_001/seed` called on first load (check Network tab)
- [ ] T0 (green), T1 (blue), T3 (amber) anticipations appear with correct tier badges
- [ ] Confidence dots render proportionally
- [ ] Simulate → **Study Mode** button returns a result without 500 error
- [ ] Simulate → **Night Safety Check** returns a result
- [ ] Simulate → **Power Cut** returns a result
- [ ] Twin mode pill shows current mode (Normal / Festival / Sleep / Guest / Away)

---

## 6. Digital Twin Modes

- [ ] Scene trigger changes twin mode label in Anticipations panel
- [ ] Festival mode: anticipations panel shows "LEARNING PAUSED"
- [ ] Sleep mode: lights dim, fans slow in 3D scene

---

## 7. Placement / Asset Library

- [ ] Open Library tab → asset tiles render with emoji + label
- [ ] Click asset → enters placement mode (crosshair cursor, dashed border)
- [ ] Ghost preview follows mouse inside room → **green**
- [ ] Ghost preview outside room bounds → **red**
- [ ] Ghost snaps to 0.25-unit grid
- [ ] Click floor → object placed at snapped position
- [ ] Drag asset from Library panel and drop onto 3D canvas → places at drop point
- [ ] ESC cancels placement mode
- [ ] ESC (no placement) deselects object; ESC again returns to house view

---

## 8. MiniMap

- [ ] "Show Map" button appears bottom-left when minimap is hidden
- [ ] MiniMap renders all 5 rooms with correct relative positions
- [ ] Active room highlighted on minimap
- [ ] Clicking minimap room zooms camera to that room

---

## 9. Known Gaps (not blocking publish, but document)

- [ ] **Auto-automation from voice** — `ruleMiner.ts` mines patterns but does not push mined rules back to frontend Routines yet
- [ ] **Polly TTS playback** — backend returns audio but frontend does not play it in backend mode
- [ ] **Router/Privacy panel** — architecture §10 specifies a local vs cloud latency indicator; not yet implemented
- [ ] **Seed on first load** — anticipations panel is empty until seed endpoint is called manually

---

## 10. Cross-Browser / Environment

- [ ] Chrome (primary — Web Speech API required for local voice mode)
- [ ] Safari / Firefox — fallback text input shown when SpeechRecognition unavailable
- [ ] Mobile browser — panels scroll correctly; 3D canvas touch-orbit works
- [ ] Backend server running on port 3001 before testing backend mode features
