# Deployment Guide — Starting from Step 10
### Status: ECR image pushed ✓ | bedrockClient.ts credential chain already fixed ✓

---

## Step 10 — Deploy to AWS App Runner (Console)

> The IAM role must exist first. If you followed the revised Step 7 from the chat,
> `AlexaIndiaAppRunnerRole` is already created with the correct trust policy.

1. Go to **AWS App Runner → Create service**
2. **Source**:
   - Source type: `Container registry`
   - Provider: `Amazon ECR`
   - Container image URI: paste the image URI printed at the end of Step 9
     (format: `123456789012.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest`)
   - Deployment trigger: `Automatic`
   - ECR access role: `AlexaIndiaAppRunnerRole`
3. Click **Next**
4. **Service settings**:
   - Service name: `alexa-india-backend`
   - vCPU: `1 vCPU`
   - Memory: `2 GB`
   - Port: `3001`
5. **Environment variables** — click "Add environment variable" for each row:

   | Key | Value |
   |---|---|
   | `PORT` | `3001` |
   | `AWS_REGION` | `us-east-1` |
   | `BEDROCK_MODEL_ID` | `amazon.nova-micro-v1:0` |
   | `MOCK_LLM` | `false` |
   | `POLLY_DEFAULT_VOICE` | `kajal` |
   | `NODE_ENV` | `production` |

   > **Do NOT add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`** here.
   > App Runner uses `AlexaIndiaAppRunnerRole` automatically.

6. **Security → Instance role**: select `AlexaIndiaAppRunnerRole`
7. **Health check**:
   - Protocol: `HTTP`
   - Path: `/api/health`
   - Interval: `10` seconds
8. Click **Create & deploy** — takes 3–5 minutes.

---

## Step 11 — Get Your Backend URL and Test

While it deploys, the console shows a progress bar. When status changes to **Running**:

1. Copy the service URL shown at the top of the App Runner service page.
   It looks like: `https://abc123xyz.us-east-1.awsapprunner.com`

Test in PowerShell (replace the URL with yours):

```powershell
$BACKEND_URL = "https://abc123xyz.us-east-1.awsapprunner.com"

# Health check
Invoke-RestMethod "$BACKEND_URL/api/health"

# Seed the demo home
Invoke-RestMethod -Method Post "$BACKEND_URL/api/homes/demo_home_001/seed"

# T0 test (instant rule engine, $0)
Invoke-RestMethod -Method Post "$BACKEND_URL/api/simulate/geyser" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","outdoor_temp":18}'

# T3 test (real Bedrock call, ~$0.00004)
Invoke-RestMethod -Method Post "$BACKEND_URL/api/simulate/inventory_drop" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","item":"milk","quantity":0.3}'
```

Expected for T0: `"tier": "T0"`, latency < 10ms
Expected for T3: `"tier": "T3"`, `"model_id": "amazon.nova-micro-v1:0"`, `"is_mock": false`

---

## Step 12 — Update Backend CORS for Production

The current `backend/src/index.ts` uses `origin: '*'`. Update it for production:

**Edit `backend/src/index.ts` line 14 — replace:**
```typescript
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
```

**With:**
```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.amplifyapp.com')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
```

---

## Step 13 — Create Frontend Production Environment File

In `C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin\`, create `.env.production`:

```env
VITE_API_BASE_URL=https://abc123xyz.us-east-1.awsapprunner.com
VITE_WS_URL=wss://abc123xyz.us-east-1.awsapprunner.com
```

Replace `abc123xyz.us-east-1.awsapprunner.com` with your actual App Runner URL from Step 11.

> **Note:** `wss://` (not `ws://`) — App Runner uses HTTPS/WSS in production.

---

## Step 14 — Push Both Repos to GitHub

```powershell
# Backend repo
cd C:\Users\arman\Desktop\alexa2
git add backend/src/index.ts
git commit -m "Fix CORS for production + Amplify domains"
git push origin master

# Frontend repo
cd C:\Users\arman\Desktop\Alexa2Frontend
git add .
git commit -m "Add production env config for App Runner backend"
git push origin master
```

---

## Step 15 — Deploy Frontend via AWS Amplify

1. Go to **AWS Amplify → New app → Host web app**
2. **Source**: GitHub → click **Authorize AWS Amplify** (one-time)
3. Select repository: your `Alexa2Frontend` repo → Branch: `master`
4. **Build settings** — Amplify auto-detects Vite. Confirm the build spec looks like:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd alexa-digital-twin
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: alexa-digital-twin/dist
    files:
      - '**/*'
  cache:
    paths:
      - alexa-digital-twin/node_modules/**/*
```

   If the `baseDirectory` or `cd` path is wrong, edit it to match your actual folder structure.

5. **Environment variables** (scroll down on same page):

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://abc123xyz.us-east-1.awsapprunner.com` |
   | `VITE_WS_URL` | `wss://abc123xyz.us-east-1.awsapprunner.com` |

6. Click **Save and deploy** — takes 2–3 minutes.
7. Your frontend URL appears at the top: `https://main.d1abc123.amplifyapp.com`

---

## Step 16 — Fix SPA Routing in Amplify (Required)

Without this, page refreshes return 404.

1. Amplify Console → your app → **Rewrites and redirects** → **Add rule**:

   | Source address | Target address | Type |
   |---|---|---|
   | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

2. Click **Save**.

---

## Step 17 — Add Amplify URL to Backend CORS

After you have your Amplify URL (e.g., `https://main.d1abc123.amplifyapp.com`):

```powershell
$SERVICE_ARN = "arn:aws:apprunner:us-east-1:YOUR_ACCOUNT_ID:service/alexa-india-backend/XXXX"
$AMPLIFY_URL = "https://main.d1abc123.amplifyapp.com"

aws apprunner update-service `
  --service-arn $SERVICE_ARN `
  --source-configuration "{`"ImageRepository`":{`"ImageConfiguration`":{`"RuntimeEnvironmentVariables`":{`"ALLOWED_ORIGINS`":`"$AMPLIFY_URL`"}}}}" `
  --region us-east-1
```

Or do it in the **App Runner Console** → your service → **Configuration** → **Environment variables** → add:
- Key: `ALLOWED_ORIGINS`
- Value: `https://main.d1abc123.amplifyapp.com`

Then click **Deploy**.

> The CORS code added in Step 12 already reads this env var automatically.

---

## Step 18 — Final Verification

```powershell
# Replace with your actual URLs
$BACKEND  = "https://abc123xyz.us-east-1.awsapprunner.com"
$FRONTEND = "https://main.d1abc123.amplifyapp.com"

# Backend health
Invoke-RestMethod "$BACKEND/api/health"

# Open frontend in browser
Start-Process $FRONTEND
```

In the browser:
- Voice commands should work (Polly TTS plays Indian English audio)
- 3D home responds to device toggles
- T3 escalations call real Bedrock Nova Micro

---

## Quick Reference — Fill In After Deployment

| Resource | Your URL |
|---|---|
| **Backend API** | `https://____________.us-east-1.awsapprunner.com` |
| **Backend Health** | `https://____________.us-east-1.awsapprunner.com/api/health` |
| **WebSocket** | `wss://_____________.us-east-1.awsapprunner.com/ws?home_id=demo_home_001` |
| **Frontend** | `https://main._______.amplifyapp.com` |

---

## Troubleshooting

### App Runner build fails
```powershell
# Test locally first
cd C:\Users\arman\Desktop\alexa2\backend
docker build -t test-build .
docker run -p 3001:3001 --env-file .env test-build
# Visit http://localhost:3001/api/health
```

### "AccessDeniedException" on Bedrock
- Confirm `AWS_REGION=us-east-1` in App Runner env vars
- Confirm `AlexaIndiaAppRunnerRole` is set as the Instance role
- Check the role has `bedrock:InvokeModel` for `amazon.nova-micro-v1:0` ARN

### CORS error in browser
- Confirm `ALLOWED_ORIGINS` env var is set in App Runner with your exact Amplify URL
- No trailing slash in the URL
- Redeploy App Runner after adding the env var

### WebSocket not connecting
- Use `wss://` not `ws://` in `.env.production`
- Check browser console for mixed-content or CORS errors

### Amplify build fails
- Run `cd alexa-digital-twin && npm run build` locally to catch TypeScript errors first
- Confirm `VITE_*` env vars are set in Amplify console (not just in the local file)
