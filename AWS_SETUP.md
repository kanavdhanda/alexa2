# AWS Setup & Deployment Guide — Alexa+ India Context Layer
### v3 — Updated June 2026

> **What changed from v2:**
> - Model access page has been retired — Bedrock models auto-activate on first invocation
> - Anthropic models may still require a one-time use case submission
> - Added complete backend deployment via **AWS App Runner** + **Amazon ECR**
> - Added frontend deployment via **AWS Amplify**
> - Added **Secrets Manager** for production credentials (no `.env` in cloud)
> - Added **GitHub Actions** CI/CD pipeline
> - Fixed credential chain for IAM role auth (no static keys in production)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  AWS Cloud (us-east-1)                                              │
│                                                                      │
│  ┌─────────────────────┐     ┌────────────────────────────────────┐ │
│  │  AWS Amplify         │     │  AWS App Runner                    │ │
│  │  (React + R3F)       │────▶│  (Express API + WebSocket)         │ │
│  │  HTTPS auto-managed  │     │  HTTPS + WSS auto-managed          │ │
│  └─────────────────────┘     └─────────────┬──────────────────────┘ │
│                                             │                         │
│                              ┌──────────────▼──────────────────────┐ │
│                              │  AWS Services                        │ │
│                              │  • Amazon Bedrock (Nova Micro — T3)  │ │
│                              │  • Amazon Polly (Kajal TTS)          │ │
│                              │  • Amazon Transcribe (STT, optional) │ │
│                              │  • Amazon S3 (audio staging, opt.)   │ │
│                              └─────────────────────────────────────┘ │
│                                                                      │
│  Amazon ECR (Docker image)    AWS Secrets Manager (env vars)        │
│  AWS IAM (scoped roles)       Amazon CloudWatch (logs + metrics)    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Services & Cost Estimate

| Service | Purpose | Monthly cost (demo) |
|---|---|---|
| **Amazon Bedrock** — Nova Micro | T3 supervisor agent (~3% of events) | ~$0.001 (10 demo calls) |
| **Amazon Polly** — Kajal neural | Indian English TTS | ~$0.02 (50 responses) |
| **AWS App Runner** | Backend API hosting (auto-scaling) | ~$5–15/month (1 vCPU, 2 GB) |
| **AWS Amplify** | Frontend hosting + CI/CD | $0 (free tier) or ~$1/month |
| **Amazon ECR** | Docker image registry | ~$0.10/month |
| **AWS Secrets Manager** | Secure env var storage | ~$0.40/secret/month |
| **Amazon Transcribe** *(optional)* | STT from audio file | ~$0.024/min |
| **Amazon S3** *(optional)* | Audio staging for Transcribe | ~$0 (demo size) |

**Total demo cost: < $8/month.** AWS Free Tier covers most for new accounts.

---

## Prerequisites

Before starting, install:

```bash
# Windows (winget)
winget install Amazon.AWSCLI
winget install Docker.DockerDesktop

# macOS (Homebrew)
brew install awscli
brew install --cask docker

# Verify
aws --version       # aws-cli/2.x+
docker --version    # Docker 24+
node --version      # v20+
```

---

## PART 1 — AWS Account & Region

### Step 1: Sign In and Set Region

1. Sign in at [https://console.aws.amazon.com](https://console.aws.amazon.com)
2. **Top-right dropdown → Set region to `us-east-1`** (required — Nova Micro and Polly Kajal voice are only available here)
3. Confirm billing is enabled: **Billing & Cost Management** → overview should show $0

### Step 2: Configure AWS CLI

```bash
aws configure
# Prompts:
# AWS Access Key ID [None]: AKIA...  (see Step 3 below)
# AWS Secret Access Key [None]: ...
# Default region name [None]: us-east-1
# Default output format [None]: json

# Verify identity
aws sts get-caller-identity
# Returns your account ID, user ARN, and user ID
```

---

## PART 2 — IAM: Least-Privilege Roles
/exi
> **Never use root credentials.** Create scoped IAM users and roles.

### Step 3: Create IAM User for Local Development

1. **IAM → Users → Create user**
2. Username: `alexa-india-dev`
3. **Attach policies directly** → **Add inline policy** (JSON tab):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels",
        "bedrock:GetFoundationModel"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6"
      ]
    },
    {
      "Sid": "PollyTTS",
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TranscribeSTT",
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3AudioStaging",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::alexa-india-demo-audio/*"
    }
  ]
}
```

4. Name the policy `alexa-india-dev-policy` → **Create user**
5. User → **Security credentials** tab → **Create access key**
6. Choose **"Application running outside AWS"**
7. **Copy both values immediately** (secret is shown only once):
   - Access Key ID: `AKIA...`
   - Secret Access Key: `...`

### Step 4: Create App Runner Instance Role (for production)

This IAM role lets App Runner access Bedrock, Polly, and CloudWatch without static credentials.

```bash
# 1. Create trust policy
cat > /tmp/apprunner-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "build.apprunner.amazonaws.com",
          "tasks.apprunner.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# 2. Create the role
aws iam create-role \
  --role-name AlexaIndiaAppRunnerRole \
  --assume-role-policy-document file:///tmp/apprunner-trust.json \
  --description "App Runner instance role for Alexa India backend"

# 3. Attach ECR access (for pulling Docker image)
aws iam attach-role-policy \
  --role-name AlexaIndiaAppRunnerRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

# 4. Attach Bedrock + Polly + logging permissions
aws iam put-role-policy \
  --role-name AlexaIndiaAppRunnerRole \
  --policy-name AlexaIndiaProductionPermissions \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "BedrockAccess",
        "Effect": "Allow",
        "Action": ["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream"],
        "Resource": [
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
        ]
      },
      {
        "Sid": "PollyAccess",
        "Effect": "Allow",
        "Action": ["polly:SynthesizeSpeech","polly:DescribeVoices"],
        "Resource": "*"
      },
      {
        "Sid": "TranscribeAccess",
        "Effect": "Allow",
        "Action": ["transcribe:StartTranscriptionJob","transcribe:GetTranscriptionJob"],
        "Resource": "*"
      },
      {
        "Sid": "S3Access",
        "Effect": "Allow",
        "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject"],
        "Resource": "arn:aws:s3:::alexa-india-demo-audio/*"
      },
      {
        "Sid": "CloudWatchLogs",
        "Effect": "Allow",
        "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
        "Resource": "*"
      }
    ]
  }'

echo "Role ARN:"
aws iam get-role --role-name AlexaIndiaAppRunnerRole --query 'Role.Arn' --output text
```

---

## PART 3 — Amazon Bedrock: Model Access (Updated June 2026)

> **The Model Access page has been retired.**
>
> Foundation models are now **automatically enabled on first invocation** — no manual activation required. You no longer need to navigate to "Model access" and click "Enable specific models."

### Current Model Access Rules

| Model | Auto-enabled? | Action needed |
|---|---|---|
| `amazon.nova-micro-v1:0` | **Yes — instant** | None. Invoke directly. |
| `amazon.nova-lite-v1:0` | **Yes — instant** | None. Invoke directly. |
| `amazon.nova-pro-v1:0` | **Yes — instant** | None. Invoke directly. |
| `anthropic.claude-haiku-4-5-20251001` | **First-time users may need use case details** | See below. |
| `anthropic.claude-sonnet-4-6` | **First-time users may need use case details** | See below. |
| AWS Marketplace models | **Requires one invocation by Marketplace-permitted user** | Invoke once from console to unlock account-wide. |

### For Anthropic Claude Models

If you change `BEDROCK_MODEL_ID` to any `anthropic.*` model in `.env`:

1. Go to **Amazon Bedrock → Model Catalog** in the AWS Console
2. Search for the model (e.g., "Claude Haiku")
3. Click the model card → if you see **"Request model access"**, click it
4. Fill in:
   - **Company name**: your name or org
   - **Use case**: "Smart home voice assistant with IoT automation for demo/hackathon"
   - **Country**: your country
5. Submit — approval is typically **instant** for standard use cases
6. Once approved, all IAM users/roles in the account can invoke the model

### Administrator Access Control

Admins can restrict Bedrock access at the organization level using IAM and Service Control Policies:

```json
{
  "Sid": "DenyBedrockExceptAppRunner",
  "Effect": "Deny",
  "Action": "bedrock:InvokeModel",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "aws:PrincipalArn": "arn:aws:iam::ACCOUNT_ID:role/AlexaIndiaAppRunnerRole"
    }
  }
}
```

### Verify Bedrock Access

```bash
# Test Nova Micro (the default model for this project)
aws bedrock-runtime invoke-model \
  --model-id amazon.nova-micro-v1:0 \
  --body '{"messages":[{"role":"user","content":[{"text":"Say OK"}]}],"inferenceConfig":{"maxTokens":5}}' \
  --content-type application/json \
  --accept application/json \
  --region us-east-1 \
  /tmp/bedrock-test.json

cat /tmp/bedrock-test.json
# Expected: {"output":{"message":{"role":"assistant","content":[{"text":"OK"}]}}, ...}
```

> This test costs approximately $0.000001 — about 1/1000th of a cent.

---

## PART 4 — Local Development Setup

### Step 5: Configure Local `.env`

```bash
cd C:\Users\arman\Desktop\alexa2\backend

# Copy the example env file
copy .env.example .env
```

Edit `.env` with your values:

```env
# ── Server ─────────────────────────────────────────────────────────────────────
PORT=3001

# ── AWS Credentials (for local development only — never commit this file) ──────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your_key_from_step_3...
AWS_SECRET_ACCESS_KEY=...your_secret_from_step_3...

# ── Bedrock Model ──────────────────────────────────────────────────────────────
# Options:
#   amazon.nova-micro-v1:0      — cheapest ($0.000035/1K tokens), recommended for demo
#   amazon.nova-lite-v1:0       — slightly smarter, ~3× cost
#   anthropic.claude-haiku-4-5-20251001 — fastest Anthropic model (may need use case approval)
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0

# ── Financial Safety ───────────────────────────────────────────────────────────
MOCK_LLM=false        # true = no AWS calls (safe for offline dev), false = live Bedrock

# ── Amazon Polly TTS ──────────────────────────────────────────────────────────
POLLY_DEFAULT_VOICE=kajal   # Indian English neural voice (us-east-1 only)
# Other options: aditi (Hindi), raveena (Indian English)

# ── Optional: Transcribe STT via S3 ───────────────────────────────────────────
# Leave blank to use browser Web Speech API (recommended for demo)
# S3_BUCKET=alexa-india-demo-audio-YOURUNIQUENAME
```

### Step 6: Install Dependencies and Run

```bash
cd backend
npm install
npm run start:ts
```

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║   Alexa+ India Context Layer — Backend API v2            ║
║   HTTP  → http://localhost:3001/api/health               ║
║   WS    → ws://localhost:3001/ws?home_id=demo_home_001   ║
║   T0 Rule Engine    : ACTIVE (<10ms, $0)                 ║
║   T1 Local NLU      : ACTIVE (<100ms, $0)                ║
║   T3 Bedrock Agent  :  [LIVE — Bedrock enabled]          ║
║   Amazon Polly TTS  : ACTIVE (Indian English voice)      ║
╚══════════════════════════════════════════════════════════╝
```

### Step 7: Run All Three Tiers Locally

```bash
BASE=http://localhost:3001/api

# Seed a demo home (15 devices, 5 rooms, 10 T0 rules)
curl -X POST $BASE/homes/demo_home_001/seed

# T0 — instant local reflex ($0.00)
curl -X POST $BASE/simulate/geyser \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","outdoor_temp":18}'
# Expect: tier="T0", latency<10ms, cost="$0.00"

# T1 — local NLU ($0.00)
curl -X POST $BASE/events \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","event_type":"voice_command","data":{"utterance":"turn off the fan"}}'
# Expect: tier="T1", latency<100ms

# T3 — Bedrock (real cost ~$0.00004)
curl -X POST $BASE/simulate/inventory_drop \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","item":"milk","quantity":0.3}'
# Expect: tier="T3", model_id="amazon.nova-micro-v1:0", is_mock=false

# Polly TTS test
curl "$BASE/voice/speak?text=Geyser+turned+on&voice=kajal" --output test_audio.mp3
# Open test_audio.mp3 — should play Indian English voice
```

---

## PART 5 — Production Fix: IAM Role Credential Chain

The backend's `bedrockClient.ts` currently hard-codes credential reading from env vars:

```typescript
// Current code (works for local dev, but fails on App Runner with empty strings)
credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
},
```

In production (App Runner), credentials come from the IAM role — **do not set static keys**. Update the file to use the AWS SDK's default credential chain:

**Edit `backend/src/bedrockClient.ts` line 20–26:**

```typescript
// Replace the old BedrockRuntimeClient initialization with this:
export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // Credentials: SDK auto-detects in order:
  //   1. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars (local dev)
  //   2. IAM instance role (App Runner, EC2, Lambda — no keys needed in prod)
  //   3. ~/.aws/credentials file (local developer machines)
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});
```

This makes the same code work in both local development (env vars) and production (IAM role).

---

## PART 6 — Deploy Backend: Amazon ECR + AWS App Runner

### Step 8: Create Dockerfile

Create `C:\Users\arman\Desktop\alexa2\backend\Dockerfile`:

```dockerfile
# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled JS and production dependencies
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production

EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
```

Create `C:\Users\arman\Desktop\alexa2\backend\.dockerignore`:

```
node_modules
dist
.env
.env.*
__tests__
*.test.ts
*.test.js
coverage
.git
README.md
```

Test the Docker build locally:
```bash
cd C:\Users\arman\Desktop\alexa2\backend
docker build -t alexa-india-backend .
docker run -p 3001:3001 --env-file .env alexa-india-backend
# Visit http://localhost:3001/api/health to verify
```

### Step 9: Push to Amazon ECR

```bash
# Variables (replace ACCOUNT_ID with your 12-digit AWS account ID)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REPO_NAME=alexa-india-backend

# Create ECR repository
aws ecr create-repository \
  --repository-name $REPO_NAME \
  --region $REGION \
  --image-scanning-configuration scanOnPush=true

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS \
               --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push
cd C:\Users\arman\Desktop\alexa2\backend
docker build -t $REPO_NAME .
docker tag $REPO_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

echo "Image URI: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"
```

### Step 10: Deploy to AWS App Runner

**Option A — AWS Console (Recommended)**

1. Go to **AWS App Runner → Create service**
2. **Source**:
   - Source type: **Container registry**
   - Provider: **Amazon ECR**
   - Container image URI: `ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest`
   - Deployment trigger: **Automatic** (redeploys when ECR image updates)
   - ECR access role: **AlexaIndiaAppRunnerRole**
3. **Service settings**:
   - Service name: `alexa-india-backend`
   - vCPU: `1 vCPU`
   - Memory: `2 GB`
   - Port: `3001`
4. **Environment variables** (click "Add environment variable" for each):

   | Key | Value |
   |---|---|
   | `PORT` | `3001` |
   | `AWS_REGION` | `us-east-1` |
   | `BEDROCK_MODEL_ID` | `amazon.nova-micro-v1:0` |
   | `MOCK_LLM` | `false` |
   | `POLLY_DEFAULT_VOICE` | `kajal` |
   | `NODE_ENV` | `production` |

   > **Do NOT add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`** — App Runner uses the IAM role automatically.

5. **Instance role**: `AlexaIndiaAppRunnerRole`
6. **Health check**:
   - Protocol: `HTTP`
   - Path: `/api/health`
   - Interval: 10 seconds
7. Click **Create & deploy**

**Option B — AWS CLI**

```bash
ROLE_ARN=$(aws iam get-role --role-name AlexaIndiaAppRunnerRole --query 'Role.Arn' --output text)
IMAGE_URI=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest

aws apprunner create-service \
  --service-name alexa-india-backend \
  --source-configuration "{
    \"ImageRepository\": {
      \"ImageIdentifier\": \"$IMAGE_URI\",
      \"ImageConfiguration\": {
        \"Port\": \"3001\",
        \"RuntimeEnvironmentVariables\": {
          \"PORT\": \"3001\",
          \"AWS_REGION\": \"us-east-1\",
          \"BEDROCK_MODEL_ID\": \"amazon.nova-micro-v1:0\",
          \"MOCK_LLM\": \"false\",
          \"POLLY_DEFAULT_VOICE\": \"kajal\",
          \"NODE_ENV\": \"production\"
        }
      },
      \"ImageRepositoryType\": \"ECR\"
    },
    \"AuthenticationConfiguration\": {
      \"AccessRoleArn\": \"$ROLE_ARN\"
    },
    \"AutoDeploymentsEnabled\": true
  }" \
  --instance-configuration "{
    \"Cpu\": \"1 vCPU\",
    \"Memory\": \"2 GB\",
    \"InstanceRoleArn\": \"$ROLE_ARN\"
  }" \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }' \
  --region $REGION
```

### Step 11: Get Your Backend URL and Test

```bash
# Get the service ARN (copy from console, or from the CLI output above)
SERVICE_ARN=arn:aws:apprunner:us-east-1:ACCOUNT_ID:service/alexa-india-backend/XXXX

# Check deployment status (takes 3–5 minutes)
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --query 'Service.Status' --output text
# Wait until: RUNNING

# Get your URL
BACKEND_URL=https://$(aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --query 'Service.ServiceUrl' --output text)

echo "Backend URL: $BACKEND_URL"
# Example: https://abc123xyz.us-east-1.awsapprunner.com
```

Test the deployed backend:
```bash
# Health check
curl $BACKEND_URL/api/health

# Seed and run demo
curl -X POST $BACKEND_URL/api/homes/demo_home_001/seed
curl -X POST $BACKEND_URL/api/simulate/geyser \
  -H "Content-Type: application/json" \
  -d '{"home_id":"demo_home_001","outdoor_temp":18}'

# WebSocket test (install wscat: npm install -g wscat)
wscat -c "wss://$(echo $BACKEND_URL | sed 's|https://||')/ws?home_id=demo_home_001"
```

> **Important:** WebSocket URL uses `wss://` (secure) in production, not `ws://`.

---

## PART 7 — Deploy Frontend: AWS Amplify

AWS Amplify provides zero-config hosting for the React + Vite frontend with automatic HTTPS and CI/CD from GitHub.

### Step 12: Update Frontend Environment for Production

In `C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin`, create `.env.production`:

```env
VITE_API_BASE_URL=https://abc123xyz.us-east-1.awsapprunner.com
VITE_WS_URL=wss://abc123xyz.us-east-1.awsapprunner.com
```

> If the frontend doesn't yet use these env vars, any API calls to the backend should be updated to use `import.meta.env.VITE_API_BASE_URL` instead of hardcoded `localhost:3001`.

### Step 13: Update Backend CORS

The backend currently allows all origins (`origin: '*'`). For production, update `backend/src/index.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow configured origins and all Amplify preview URLs
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.amplifyapp.com')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
```

### Step 14: Push Both Repos to GitHub

```bash
# Frontend repo — push to GitHub
cd C:\Users\arman\Desktop\Alexa2Frontend
git add .
git commit -m "Add production env config"
git push origin master

# Backend repo — push to GitHub
cd C:\Users\arman\Desktop\alexa2
git add .
git commit -m "Fix credential chain + Dockerfile + CORS update"
git push origin master
```

### Step 15: Deploy via AWS Amplify Console

1. Go to **AWS Amplify → New app → Host web app**
2. **Source**: GitHub → **Authorize AWS Amplify** (one-time GitHub permission)
3. Select repository: `Arman-Saini/Alexa2Frontend`
4. Branch: `master`
5. **Build settings** — Amplify auto-detects Vite. Verify the build spec:

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

6. **Environment variables** (Amplify console → App settings → Environment variables):

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://abc123xyz.us-east-1.awsapprunner.com` |
   | `VITE_WS_URL` | `wss://abc123xyz.us-east-1.awsapprunner.com` |

7. Click **Save and deploy** (takes ~2-3 minutes)
8. Your frontend URL: `https://main.d1abc123.amplifyapp.com`

### Step 16: Fix SPA Routing (Required for React)

In Amplify console → **Rewrites and redirects** → Add rule:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

This ensures page refreshes and direct URL access work correctly.

### Step 17: Add Amplify Domain to Backend CORS

After you get your Amplify URL, add it to the App Runner environment:

```bash
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --source-configuration "{
    \"ImageRepository\": {
      \"ImageConfiguration\": {
        \"RuntimeEnvironmentVariables\": {
          \"ALLOWED_ORIGINS\": \"https://main.d1abc123.amplifyapp.com\"
        }
      }
    }
  }" \
  --region us-east-1
```

This triggers an automatic redeployment of App Runner with the new env var.

---

## PART 8 — Optional: Amazon S3 + Transcribe (Live Audio)

Only needed if using the `/api/voice/transcribe` endpoint with real audio (not `mock_text`).

### Step 18: Create S3 Bucket

```bash
# Bucket name must be globally unique
BUCKET_NAME=alexa-india-audio-$(date +%s)
aws s3 mb s3://$BUCKET_NAME --region us-east-1

# Auto-delete audio after 1 day (privacy)
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "auto-delete-audio",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "Expiration": {"Days": 1}
    }]
  }'

echo "Add to App Runner env: S3_BUCKET=$BUCKET_NAME"
```

Then add `S3_BUCKET=alexa-india-audio-XXXXXXXXXX` to App Runner environment variables and redeploy.

---

## PART 9 — Financial Safety Controls

### Three Built-in Layers

**Layer 1 — MOCK_LLM Mode**
```env
MOCK_LLM=true   # Development: zero Bedrock cost, hardcoded responses
MOCK_LLM=false  # Production: real Bedrock calls (~$0.000035 per T3 escalation)
```

**Layer 2 — Rate Limiter (built-in, `src/financialSafety.ts`)**
- Max **15 Bedrock calls/minute** per `home_id`
- Returns HTTP 429 + `retry_after_seconds` when exceeded
- Prevents runaway loops or accidental batch calls

**Layer 3 — Timeout (built-in)**
- Every Bedrock call has a **10-second hard timeout**
- Prevents hanging requests from accumulating cost

### Add AWS Budget Alert (Recommended)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws budgets create-budget \
  --account-id $ACCOUNT_ID \
  --budget '{
    "BudgetName": "alexa-india-monthly-limit",
    "BudgetLimit": {"Amount": "20", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "ranobackup13@gmail.com"
    }]
  }]'
```

### Monitor Real-Time Costs

```bash
# Check accumulated Bedrock call cost per home
curl $BACKEND_URL/api/homes/demo_home_001/stats
# Returns: { total_cost_usd, T0_calls, T1_calls, T3_calls, ... }
```

---

## PART 10 — CI/CD: Automatic Deploys on Push

### GitHub Actions for Backend (App Runner via ECR)

Create `.github/workflows/deploy-backend.yml` in the `alexa2` repo:

```yaml
name: Deploy Backend to AWS App Runner

on:
  push:
    branches: [main, master]
    paths: ['backend/**']

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: alexa-india-backend

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
                     $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "Image: $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"

      # App Runner auto-deploys because AutoDeploymentsEnabled=true
      - name: Deployment triggered
        run: echo "App Runner will auto-deploy from the new ECR image (latest tag)"
```

Add to GitHub repo secrets (**Settings → Secrets → Actions**):
- `AWS_ACCESS_KEY_ID` — the dev user's access key from Step 3
- `AWS_SECRET_ACCESS_KEY` — the dev user's secret from Step 3

> **Amplify** already provides built-in CI/CD for the frontend — it redeploys automatically on every GitHub push. No additional configuration needed.

---

## PART 11 — Custom Domain (Optional)

### Frontend (Amplify)

1. Amplify Console → **Domain management → Add domain**
2. Enter your domain: `alexa-india.yourdomain.com`
3. Amplify automatically provisions an SSL/TLS certificate via AWS ACM
4. Add the provided CNAME record to your DNS registrar (GoDaddy, Namecheap, etc.)
5. Propagation takes 5–30 minutes

### Backend (App Runner)

1. App Runner Console → Your service → **Custom domain → Add domain**
2. Enter: `api.alexa-india.yourdomain.com`
3. App Runner provides certificate validation records
4. Add the CNAME records to your DNS provider
5. SSL is fully managed by AWS

---

## PART 12 — Monitoring & Logs

### CloudWatch Logs (Automatic)

App Runner streams application logs automatically:

```bash
# View live backend logs
LOG_GROUP=/aws/apprunner/alexa-india-backend
aws logs tail $LOG_GROUP --follow --format short

# Search for T3 Bedrock calls
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern "T3" \
  --start-time $(date -d '1 hour ago' +%s000)
```

### Key Metrics to Monitor

```bash
# API health and status
curl $BACKEND_URL/api/health

# Cost and tier breakdown
curl $BACKEND_URL/api/homes/demo_home_001/stats

# All active homes
curl $BACKEND_URL/api/homes
```

---

## Quick Reference: Final URLs

Fill in after deployment:

| Resource | URL |
|---|---|
| **Backend API** | `https://XXXX.us-east-1.awsapprunner.com` |
| **Backend Health** | `https://XXXX.us-east-1.awsapprunner.com/api/health` |
| **WebSocket** | `wss://XXXX.us-east-1.awsapprunner.com/ws?home_id=demo_home_001` |
| **Frontend** | `https://main.XXXX.amplifyapp.com` |
| **AWS Console** | `https://console.aws.amazon.com` → Region: `us-east-1` |

---

## Deployment Checklist

- [ ] AWS account created, region set to `us-east-1`
- [ ] IAM user `alexa-india-dev` created with inline policy (Step 3)
- [ ] IAM role `AlexaIndiaAppRunnerRole` created (Step 4)
- [ ] Bedrock verified: `aws bedrock-runtime invoke-model ...` succeeds
- [ ] Local `.env` configured and backend runs on port 3001
- [ ] All three tiers tested locally (T0, T1, T3)
- [ ] Polly TTS produces audio file
- [ ] `bedrockClient.ts` updated for IAM role credential chain (Part 5)
- [ ] `Dockerfile` and `.dockerignore` created in `backend/`
- [ ] Docker image builds successfully locally
- [ ] ECR repository created and image pushed
- [ ] App Runner service deployed, status: RUNNING
- [ ] Backend health check passes at production URL
- [ ] WebSocket connects via `wscat` (wss://)
- [ ] Frontend `.env.production` created with backend URL
- [ ] Backend CORS updated to allow Amplify domain
- [ ] Both repos pushed to GitHub
- [ ] AWS Amplify app created and deployed
- [ ] Amplify SPA rewrite rule added
- [ ] GitHub Actions CI/CD configured and tested
- [ ] AWS Budget alert created at $20/month
- [ ] ALLOWED_ORIGINS updated in App Runner with Amplify URL

---

## Troubleshooting

### "AccessDeniedException" on Bedrock calls
- Check `AWS_REGION=us-east-1` (Nova Micro not available in all regions)
- Verify IAM role has `bedrock:InvokeModel` for the specific model ARN
- For Anthropic models: check if use case submission is needed in Bedrock Model Catalog

### "CredentialsProviderError" in App Runner
- Do NOT set `AWS_ACCESS_KEY_ID` in App Runner env vars — it conflicts with the IAM role
- Verify the instance role (`AlexaIndiaAppRunnerRole`) is attached to the App Runner service
- Apply the `bedrockClient.ts` fix from Part 5

### App Runner deployment fails (build error)
- Test locally: `docker build -t test . && docker run -p 3001:3001 test`
- Ensure `npm run build` succeeds locally (`npx tsc --noEmit` to check types)
- Check ECR login hasn't expired: re-run `aws ecr get-login-password ...`

### WebSocket not connecting in production
- Use `wss://` not `ws://` for App Runner HTTPS endpoints
- App Runner supports WebSocket connections (persistent HTTP upgrades)
- Check browser console for CORS or mixed-content errors

### CORS error in browser (frontend → backend)
- Add Amplify URL to `ALLOWED_ORIGINS` env var in App Runner
- Redeploy App Runner after changing env vars
- Check the URL matches exactly (no trailing slash)

### Polly "Voice not found: kajal"
- `kajal` is an Indian English neural voice available only in `us-east-1`
- Confirm `AWS_REGION=us-east-1` in environment
- Alternative voices: `aditi` (Hindi, us-east-1), `raveena` (Indian English, us-east-1)

### Amplify build fails
- Check `baseDirectory` in build spec matches the actual `dist` folder path
- Ensure `VITE_*` env vars are set in Amplify environment variables (not just local `.env.production`)
- TypeScript errors will fail the build — run `npx tsc --noEmit` locally first

---

## Architecture Decision Notes

### Why App Runner instead of Lambda or EC2?

| Option | Pros | Cons |
|---|---|---|
| **App Runner** ✅ | Zero config, auto-scales, WebSocket support, HTTPS auto-managed | Cold starts on free tier (mitigated by min instances setting) |
| Lambda | Cheapest at zero traffic | WebSocket requires API Gateway WebSocket — complex setup |
| EC2 | Full control | Requires manual SSL, load balancer, and scaling configuration |
| Elastic Beanstalk | Familiar for Node.js | More setup than App Runner for the same result |

### Why Amplify instead of S3+CloudFront?

Amplify = S3 + CloudFront + CI/CD + SPA rewrites, all configured automatically. For a hackathon/demo, Amplify saves ~2 hours of CloudFront configuration. For production at scale, S3+CloudFront gives more control (edge functions, cache policies, etc.).

### About the Bedrock Converse API

This project uses `@aws-sdk/client-bedrock-runtime` with the `ConverseCommand` (Converse API). This is the **recommended API** for all foundation models as of 2024 — it provides a unified interface across all Bedrock models (Nova, Claude, Titan, Mistral, etc.) without model-specific request formatting.

The older `InvokeModel` API still works but requires model-specific JSON body formatting. All new development should use `ConverseCommand`.
