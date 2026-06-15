# Alexa App Sim — Non-3D Features

All features live in `frontend/src/components/panels/AlexaAppSimView.tsx`.

---

## Status Bar
- Displays current time in 24-hour `HH:MM` format
- Signal strength and battery icons in the top-right corner

---

## App Bar
- Amazon Alexa logo with the blue ring icon
- Notification bell button (top-right)
- Profile/account button (top-right)

---

## Home Tab

### Alexa Ring (Voice Input)
- Animated conic-gradient ring button; spins/pulses while listening
- **Local mode** — uses the browser Web Speech API (Chrome/Edge built-in STT, no backend)
  - Continuous recognition with interim results shown in real time
  - Strips "Alexa" / "Hey Alexa" wake word prefix automatically
  - Restarts silently on `no-speech` errors
- **Backend mode** — records audio via `MediaRecorder` → sends `audio/webm` blob to `POST /api/voice/transcribe`
- Local/Backend toggle pill below the ring
- Waveform animation (8 animated bars) while recording
- Live interim transcript display while speaking
- Wake word hint: "Say 'Alexa, turn on the lights'"
- Text input fallback shown when browser doesn't support Web Speech API
- TTS playback of responses via `window.speechSynthesis` (prefers `en-IN` voice, rate 0.88, pitch 1.1)
- Response bubble displayed below the ring after each command
- Mic error messages shown inline (permission denied, network error, etc.)

### Scene Shortcuts
- Horizontally scrollable row of scene buttons
- Each scene shows an emoji + name
- Tapping triggers the scene immediately

### Energy Summary Card
- Live total power consumption in Watts (sum of all active devices)
- Device count: `X on / Y total`

### Room Navigation Grid
- 2-column grid of all rooms
- Tapping a room sets it as active (highlights it and filters the Devices tab)
- Tapping the active room deselects it

### Notification Feed ("Recent Activity")
- Shows up to 4 most recent notifications
- Each notification shows: colored dot, message, relative timestamp (just now / Xm ago / Xh ago), dismiss button
- Color coding: info = blue, success = green, warning = orange, alert = red
- "Clear all" button appears when there are 2+ notifications

---

## Devices Tab

### Room Filter Breadcrumb
- "All rooms" button + one button per room
- Filters device list to the selected room only

### Device Type Filter Pills
- Scrollable pill row: All / Lights / Speakers / Security / Climate / Other
- Lights: smart-bulb, smart-plug
- Speakers: echo-dot, echo-show, smart-tv
- Security: camera, smart-lock, motion-sensor, smoke-detector, doorbell
- Climate: thermostat, ceiling-fan, air-purifier

### Device Cards (grouped by room, collapsible sections)
- Room section header: icon, name, `X/Y on` count, collapse toggle
- Each device card shows:
  - Emoji icon (tapping selects the object in the 3D view)
  - Device name
  - State subtext: temperature (°C), humidity (%), brightness (%), volume, motion alert, lock state, battery (%), AQI, fan speed, power consumption (W)
  - On/Off toggle switch
  - Inline brightness slider (when device is on and has brightness)
  - Inline volume slider (when device is on and has volume)
- Empty state message when no devices match the current filter/room

### Supported Device Types
| Device | Category |
|---|---|
| smart-bulb | Lights |
| smart-plug | Lights |
| echo-dot | Speakers |
| echo-show | Speakers |
| smart-tv | Speakers |
| camera | Security |
| smart-lock | Security |
| motion-sensor | Security |
| smoke-detector | Security |
| doorbell | Security |
| thermostat | Climate |
| ceiling-fan | Climate |
| air-purifier | Climate |

### Device State Properties Tracked
`isOn`, `brightness`, `colorTemp`, `temperature`, `humidity`, `motionDetected`, `powerConsumption`, `batteryLevel`, `isLocked`, `volume`, `speed`, `airQuality`, `channel`

---

## Routines Tab

### Run a Scene (2-column grid)
- All configured scenes shown as quick-run buttons
- Each shows emoji, name, and description

### Your Routines List
- Lists all routines with: emoji, name, trigger label (e.g. "At 7:00 AM"), last-run time
- Active routine count shown in header
- Per-routine enable/disable toggle switch

### Create a Routine Placeholder
- Static card with a "+" icon prompting the user to create a new routine (not yet wired up)

---

## Bottom Tab Bar
- Three tabs: **Home** / **Devices** / **Routines**
- Active tab highlighted in Alexa blue with an underline indicator
- Icons switch between outline (inactive) and filled (active) style
