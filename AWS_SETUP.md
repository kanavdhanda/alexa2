# AWS Setup Guide — Alexa+ India Context Layer

## Services Required

| Service | Used for | Monthly cost estimate (demo) |
|---|---|---|
| **Amazon Bedrock** (Nova Micro) | T3 supervisor agent | ~$0.001 (10 demo calls) |
| **Amazon Polly** (Kajal neural) | Indian English TTS | ~$0.02 (50 responses × 100 chars) |
| **Amazon Transcribe** (optional) | STT if not using browser Web Speech API | ~$0.024/min |
| **Amazon S3** (optional) | Audio file staging for Transcribe | ~$0 (demo size) |

**Total demo cost: < $0.05 USD.** All safety controls are in place to prevent runaway costs.

---

## Step 1: AWS Account & Region

1. Sign in to [AWS Console](https://console.aws.amazon.com)
2. **Set region to `us-east-1`** (us-east-1 has the broadest Bedrock model availability)

---

## Step 2: Enable Bedrock Model Access

Bedrock models must be explicitly enabled before use.

1. Go to **Amazon Bedrock** → **Model access** (left sidebar)
2. Click **Enable specific models**
3. Enable these models:
   - ✅ **Amazon Nova Micro** (`amazon.nova-micro-v1:0`) — cheapest, fastest, used for T3
   - ✅ **Amazon Nova Lite** (`amazon.nova-lite-v1:0`) — optional backup
4. Click **Save changes**
5. Wait ~2 minutes for activation (status becomes "Access granted")

---

## Step 3: Create IAM User with Minimal Permissions

**Never use root credentials. Create a scoped IAM user.**

1. Go to **IAM** → **Users** → **Create user**
2. Username: `alexa-india-demo`
3. Select **"Attach policies directly"**
4. Attach these managed policies:
   - `AmazonBedrockFullAccess` (or create inline policy below)
   - `AmazonPollyFullAccess`
   - `AmazonTranscribeFullAccess` (optional, only if using STT)
   - `AmazonS3FullAccess` (optional, only if using Transcribe)

**Or use this minimal inline policy (recommended for demo):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    }
  ]
}
```

5. Create user → Go to the user → **Security credentials** tab
6. **Create access key** → Application running outside AWS
7. **Copy both values immediately** (secret is shown only once):
   - Access Key ID: `AKIA...`
   - Secret Access Key: `...`

---

## Step 4: Configure `.env`

```bash
cd /path/to/alexa2/backend
cp .env.example .env
```

Edit `.env`:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your_key_here...
AWS_SECRET_ACCESS_KEY=...your_secret_here...
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
MOCK_LLM=false          # Switch from true to false to enable real Bedrock
POLLY_DEFAULT_VOICE=kajal
PORT=3001
```

---

## Step 5: Verify AWS Connection

```bash
cd backend
npm run start:ts
```

Server should show:
```
║   T3 Bedrock Agent  :  [LIVE — Bedrock enabled]
║   Amazon Polly TTS  : ACTIVE (Indian English voice)
```

Test Bedrock:
```bash
curl -X POST http://localhost:3001/api/simulate/inventory_drop \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","item":"milk","quantity":0.3}'
```

Response should have `"is_mock": false` and a real `reasoning` from Nova Micro.

Test Polly TTS:
```bash
curl "http://localhost:3001/api/voice/speak?text=Geyser+turned+on&voice=kajal" --output test_audio.mp3
open test_audio.mp3
```

---

## Step 6: Voice Pipeline Setup

### Option A: Browser Web Speech API (Recommended for Demo — Zero Cost)

The frontend uses the browser's built-in speech recognition:
```javascript
const recognition = new webkitSpeechRecognition();
recognition.lang = 'en-IN';  // Indian English
recognition.onresult = (e) => {
  const transcript = e.results[0][0].transcript;
  // POST to /api/events with event_type: 'voice_command', data: { utterance: transcript }
};
recognition.start();
```

Then backend Polly TTS speaks the response:
```javascript
const res = await fetch('/api/events', { method: 'POST', body: JSON.stringify({ voice_response: true, ... }) });
const { voice } = await res.json();
const audio = new Audio('data:audio/mpeg;base64,' + voice.audio_base64);
audio.play();
```

### Option B: Amazon Transcribe (Requires S3)

```bash
# Create S3 bucket for audio uploads
aws s3 mb s3://alexa-india-demo-audio --region us-east-1
```

Add to `.env`:
```env
S3_BUCKET=alexa-india-demo-audio
```

Then POST audio files to `/api/voice/transcribe`.

---

## Financial Safety Controls (Goal 6)

The backend has three layers of AWS cost protection:

### 1. MOCK_LLM Mode
```env
MOCK_LLM=true   # Development: zero Bedrock cost
MOCK_LLM=false  # Production/Demo: real Bedrock calls
```
Switch from true to false ONLY when doing live end-to-end testing.

### 2. Rate Limiter
- Max **15 Bedrock calls/minute** per `home_id`
- Returns HTTP 429 with `retry_after_seconds` when exceeded
- Prevents infinite loops or accidental batch calls

### 3. Timeout
- Every Bedrock call has a **10-second hard timeout**
- Prevents hanging requests from accumulating costs

### Cost Monitor During Demo
```bash
# Check real-time cost accumulation
curl http://localhost:3001/api/homes/demo_home_001/stats
```

Response includes `total_cost_usd` accumulated across all T3 calls.

---

## AWS Architecture Diagram for Judges

```
Browser (dumb terminal)
    │ HTTP/WebSocket
    ▼
Backend API (Node.js, your laptop/EC2)
    ├── T0 Rule Engine ────────────────── LOCAL ($0)
    ├── T1 Local NLU ──────────────────── LOCAL ($0)
    └── T3 Bedrock Supervisor ─────────► AWS Bedrock (Nova Micro)
              │                              ~$0.000035/1K tokens
              ├── order_amazon_now ──────► [Mocked Amazon Now API]
              ├── actuate_home_device ───► In-memory device twin
              ├── log_new_sound_cluster ─► Sound cluster store
              └── send_user_notification ► Amazon Polly TTS ──► Browser audio
```

**AWS services actually called in live mode:**
- `bedrock:InvokeModel` — T3 escalations only (~3% of events)
- `polly:SynthesizeSpeech` — every response that requests voice_response=true

**Everything else is local** — device state, rule engine, T1 NLU, WebSocket, regime detection, rule miner.
