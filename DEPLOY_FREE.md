# Complete Free AWS Deployment Guide
### Account: 116137269322 | Region: us-east-1

## Already done ✓
- IAM user `kdd` created and configured in AWS CLI
- Backend runs locally on port 3001
- Dockerfile built and tested
- ECR repo created, image pushed:
  `116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest`

## What's left
- EC2 t2.micro (free) to run the Docker container
- Free DuckDNS domain + Let's Encrypt for HTTPS/WSS
- AWS Amplify for the React frontend (free)

---

## STEP 1 — Create IAM Role for the EC2 Server

This lets the EC2 call Bedrock and Polly without storing credentials on the server.

1. AWS Console → **IAM → Roles → Create role**
2. Trusted entity: **AWS service** → Use case: **EC2** → Next
3. Skip permissions for now → Next
4. Role name: `AlexaIndiaEC2Role` → **Create role**
5. Click into the role → **Permissions → Add permissions → Attach policies**
6. Search and attach: `AmazonEC2ContainerRegistryReadOnly` → Add permissions
7. **Add permissions → Create inline policy → JSON tab** → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices",
        "ecr:GetAuthorizationToken",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

8. Policy name: `AlexaIndiaEC2Permissions` → **Create policy**

---

## STEP 2 — Launch EC2 t2.micro

1. AWS Console → **EC2 → Launch instances**
2. Name: `alexa-india-backend`
3. AMI: **Amazon Linux 2023** (first option, says "Free tier eligible")
4. Instance type: **t2.micro** (must say "Free tier eligible")
5. Key pair → **Create new key pair**
   - Name: `alexa-india-key`
   - Type: RSA, Format: `.pem`
   - Click Create — saves `alexa-india-key.pem` to your Downloads
6. Network settings → **Edit**
   - Auto-assign public IP: **Enable**
   - Firewall: **Create security group**, name it `alexa-india-sg`
   - Keep the default SSH rule
   - **Add security group rule** → Type: HTTP, Source: Anywhere
   - **Add security group rule** → Type: HTTPS, Source: Anywhere
7. Advanced details → **IAM instance profile** → select `AlexaIndiaEC2Role`
8. **Launch instance**

---

## STEP 3 — Assign a Fixed IP Address

1. EC2 → **Elastic IPs → Allocate Elastic IP address → Allocate**
2. Select the new IP → **Actions → Associate Elastic IP address**
3. Instance: select `alexa-india-backend` → **Associate**
4. **Copy the IP address** — you need it in the next step (e.g. `54.123.45.67`)

---

## STEP 4 — Get a Free Domain

You need a real domain name for HTTPS. DuckDNS is free and takes 2 minutes.

1. Go to **duckdns.org** → log in with Google
2. Type a subdomain name in the box, e.g. `alexa-india` → **add domain**
3. In the **current ip** box, paste your Elastic IP from Step 3 → **update ip**
4. Your backend domain is now: `alexa-india.duckdns.org`

---

## STEP 5 — Connect to the EC2 Server

In **Windows PowerShell** on your laptop:

```powershell
# Fix key file permissions (required for SSH to work)
icacls "C:\Users\arman\Downloads\alexa-india-key.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"

# SSH in — replace YOUR_ELASTIC_IP with the IP from Step 3
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP
```

Type `yes` when asked about fingerprint. You're now inside the server.

---

## STEP 6 — Install Docker on the Server

Run these commands **inside the SSH session**:

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
exit
```

SSH back in (same command as Step 5), then verify:

```bash
docker ps
```

---

## STEP 7 — Install AWS CLI on the Server

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

---

## STEP 8 — Pull and Run Your Docker Image

The EC2 role handles AWS auth automatically — no credentials needed.

```bash
# Login Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS \
               --password-stdin 116137269322.dkr.ecr.us-east-1.amazonaws.com

# Pull your image
docker pull 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest

# Run it (--restart ensures it starts again if the server reboots)
docker run -d \
  --name alexa-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  -e AWS_REGION=us-east-1 \
  -e BEDROCK_MODEL_ID=amazon.nova-micro-v1:0 \
  -e MOCK_LLM=false \
  -e POLLY_DEFAULT_VOICE=kajal \
  -e NODE_ENV=production \
  -e PORT=3001 \
  116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest

# Verify it's running
docker logs alexa-backend
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok",...}`

---

## STEP 9 — Set Up Nginx (Web Proxy)

```bash
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create the config file:

```bash
sudo tee /etc/nginx/conf.d/alexa-india.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name alexa-india.duckdns.org;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
}
EOF
```

> Replace `alexa-india.duckdns.org` with your actual DuckDNS subdomain if different.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP (from your **laptop PowerShell**, not SSH):

```powershell
Invoke-RestMethod "http://alexa-india.duckdns.org/api/health"
```

---

## STEP 10 — Add Free HTTPS (Let's Encrypt)

Back in the **SSH session**:

```bash
sudo dnf install -y python3-certbot-nginx

sudo certbot --nginx \
  -d alexa-india.duckdns.org \
  --non-interactive \
  --agree-tos \
  -m ranobackup13@gmail.com

# Auto-renew SSL every 90 days
sudo systemctl enable certbot-renew.timer
sudo certbot renew --dry-run
```

Test HTTPS from your **laptop PowerShell**:

```powershell
Invoke-RestMethod "https://alexa-india.duckdns.org/api/health"
```

Expected: `{"status":"ok",...}`

---

## STEP 11 — Test All Three Tiers

From your **laptop PowerShell**:

```powershell
$BASE = "https://alexa-india.duckdns.org/api"

# Seed the demo home
Invoke-RestMethod -Method Post "$BASE/homes/demo_home_001/seed"

# T0 — instant rule engine ($0, <10ms)
Invoke-RestMethod -Method Post "$BASE/simulate/geyser" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","outdoor_temp":18}'

# T3 — real Bedrock call (~$0.00004)
Invoke-RestMethod -Method Post "$BASE/simulate/inventory_drop" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","item":"milk","quantity":0.3}'

# WebSocket (install first: npm install -g wscat)
wscat -c "wss://alexa-india.duckdns.org/ws?home_id=demo_home_001"
```

---

## STEP 12 — Update Backend CORS

On your **laptop**, edit `C:\Users\arman\Desktop\alexa2\backend\src\index.ts`.

Replace line 14:
```typescript
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
```

With:
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

## STEP 13 — Create Frontend Production Config

Create this file: `C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin\.env.production`

```env
VITE_API_BASE_URL=https://alexa-india.duckdns.org
VITE_WS_URL=wss://alexa-india.duckdns.org
```

---

## STEP 14 — Push Both Repos to GitHub

```powershell
# Backend — push CORS fix
cd C:\Users\arman\Desktop\alexa2
git add backend/src/index.ts
git commit -m "Update CORS for Amplify production domain"
git push origin main

# Frontend — push production env
cd C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin
git add .env.production
git commit -m "Add production env pointing to EC2 backend"
git push origin master
```

---

## STEP 15 — Deploy Frontend on AWS Amplify

1. AWS Console → **Amplify → New app → Host web app**
2. Source: **GitHub** → Authorize → pick `Arman-Saini/Alexa2Frontend` → branch: `master`
3. Build settings — confirm it looks like this (edit if needed):

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

4. Scroll to **Environment variables** → Add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://alexa-india.duckdns.org` |
   | `VITE_WS_URL` | `wss://alexa-india.duckdns.org` |

5. **Save and deploy** (~3 minutes)
6. Copy your Amplify URL: `https://main.XXXX.amplifyapp.com`

---

## STEP 16 — Fix SPA Page Refresh (Required)

Amplify Console → your app → **Rewrites and redirects → Add rule**:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

**Save**

---

## STEP 17 — Add Amplify URL to Backend CORS

SSH back into EC2:

```powershell
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP
```

Restart the container with your Amplify URL (replace `main.XXXX`):

```bash
docker stop alexa-backend && docker rm alexa-backend

docker run -d \
  --name alexa-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  -e AWS_REGION=us-east-1 \
  -e BEDROCK_MODEL_ID=amazon.nova-micro-v1:0 \
  -e MOCK_LLM=false \
  -e POLLY_DEFAULT_VOICE=kajal \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e ALLOWED_ORIGINS=https://main.XXXX.amplifyapp.com \
  116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

---

## STEP 18 — Final Check

Open `https://main.XXXX.amplifyapp.com` in your browser.
- 3D home should load
- Voice commands should play Indian English Polly audio
- Device toggles should reflect in the 3D view

```powershell
# Quick smoke test from PowerShell
Invoke-RestMethod "https://alexa-india.duckdns.org/api/health"
```

---

## Your URLs

| | URL |
|---|---|
| Backend API | `https://alexa-india.duckdns.org` |
| WebSocket | `wss://alexa-india.duckdns.org/ws?home_id=demo_home_001` |
| Frontend | `https://main.XXXX.amplifyapp.com` |

---

## Updating the backend after code changes

On your laptop — rebuild and push to ECR:

```powershell
cd C:\Users\arman\Desktop\alexa2\backend

aws ecr get-login-password --region us-east-1 | `
  docker login --username AWS --password-stdin 116137269322.dkr.ecr.us-east-1.amazonaws.com

docker build -t alexa-india-backend .
docker tag alexa-india-backend:latest 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
docker push 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

Then SSH into EC2 and run:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 116137269322.dkr.ecr.us-east-1.amazonaws.com

docker pull 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
docker stop alexa-backend && docker rm alexa-backend

docker run -d \
  --name alexa-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  -e AWS_REGION=us-east-1 \
  -e BEDROCK_MODEL_ID=amazon.nova-micro-v1:0 \
  -e MOCK_LLM=false \
  -e POLLY_DEFAULT_VOICE=kajal \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e ALLOWED_ORIGINS=https://main.XXXX.amplifyapp.com \
  116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

---

## Troubleshooting

**SSH says permission denied**
- Run the `icacls` command from Step 5 first
- Make sure you're using `ec2-user` not `root`

**`curl http://alexa-india.duckdns.org` times out**
- Wait 5 min for DNS to propagate after setting DuckDNS
- Confirm security group has port 80 open

**Certbot fails**
- Port 80 must be reachable from the internet before running certbot
- Run Step 9 HTTP test first and confirm it works

**Bedrock AccessDeniedException on EC2**
- EC2 console → Instance → Security tab → confirm IAM role is `AlexaIndiaEC2Role`
- Check the inline policy has `bedrock:InvokeModel`

**Docker container not starting**
```bash
docker logs alexa-backend
```

**WebSocket fails from Amplify**
- Must be `wss://` not `ws://` in `.env.production`
- ALLOWED_ORIGINS must match your Amplify URL exactly (no trailing slash)
