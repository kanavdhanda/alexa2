# AWS Free Deployment Guide — EC2 + HTTPS + WebSocket
### Picks up after Step 9 (ECR image already pushed ✓)
### Account: 116137269322 | Region: us-east-1 | Image: alexa-india-backend:latest

---

## What you'll get (all free)
- AWS EC2 t2.micro — free 12 months
- AWS Elastic IP — free while instance is running
- DuckDNS — free subdomain (e.g. `alexa-india.duckdns.org`)
- Let's Encrypt — free SSL certificate → proper `https://` and `wss://`
- IAM Instance Role — no static credentials on the server (secure)

---

## PART A — IAM: Create EC2 Instance Role

This role lets the EC2 server pull your Docker image from ECR and call Bedrock/Polly
without putting any credentials on the server.

### A1 — Create the role in IAM Console

1. Go to **IAM → Roles → Create role**
2. **Trusted entity**: `AWS service`
3. **Use case**: `EC2` → click Next
4. On the permissions page click **Next** (skip for now)
5. **Role name**: `AlexaIndiaEC2Role` → **Create role**

### A2 — Edit trust policy (already correct for EC2 — skip this step)

EC2 trust policy is set automatically. Move on.

### A3 — Attach permissions

Click the role → **Permissions → Add permissions → Attach policies**:

Search and attach these two managed policies:
- `AmazonEC2ContainerRegistryReadOnly` — lets EC2 pull your Docker image from ECR
- `AmazonSSMManagedInstanceCore` — lets you connect via Session Manager (backup SSH)

Then **Add permissions → Create inline policy → JSON** — paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockAccess",
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
      "Sid": "PollyAccess",
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech", "polly:DescribeVoices"],
      "Resource": "*"
    },
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

Name it `AlexaIndiaEC2Permissions` → **Create policy**

---

## PART B — Launch EC2 t2.micro

### B1 — Launch the instance

1. Go to **EC2 → Instances → Launch instances**
2. **Name**: `alexa-india-backend`
3. **AMI**: `Amazon Linux 2023 AMI` (top of the list, free tier eligible)
4. **Instance type**: `t2.micro` (Free tier eligible — must say this label)
5. **Key pair**:
   - Click **Create new key pair**
   - Name: `alexa-india-key`
   - Type: `RSA`, Format: `.pem`
   - Click **Create** — your browser downloads `alexa-india-key.pem`
   - Move it somewhere safe: `C:\Users\arman\Downloads\alexa-india-key.pem`
6. **Network settings** → click **Edit**:
   - VPC: default
   - Subnet: any
   - Auto-assign public IP: **Enable**
   - Firewall: **Create security group** → name it `alexa-india-sg`
   - Add these rules:

   | Type | Protocol | Port | Source |
   |---|---|---|---|
   | SSH | TCP | 22 | My IP |
   | HTTP | TCP | 80 | 0.0.0.0/0 |
   | HTTPS | TCP | 443 | 0.0.0.0/0 |

7. **Advanced details → IAM instance profile**: select `AlexaIndiaEC2Role`
8. **Storage**: 8 GB gp3 (default, free)
9. Click **Launch instance**

### B2 — Allocate and attach an Elastic IP

Without this, your EC2 public IP changes every reboot.

1. **EC2 → Elastic IPs → Allocate Elastic IP address** → **Allocate**
2. Select the new IP → **Actions → Associate Elastic IP address**
3. **Instance**: select `alexa-india-backend` → **Associate**
4. **Copy the Elastic IP** — you'll need it for DuckDNS (e.g. `54.123.45.67`)

> Elastic IP is **free** as long as it's attached to a running instance.

---

## PART C — Free Domain via DuckDNS

You need a real domain for Let's Encrypt SSL. DuckDNS gives you one free.

1. Go to **duckdns.org** → log in with Google/GitHub
2. **Add domain** — pick any name, e.g. `alexa-india` → it becomes `alexa-india.duckdns.org`
3. In the **current ip** field, paste your Elastic IP from B2
4. Click **update ip**
5. Verify in a browser: `http://alexa-india.duckdns.org` (will timeout — that's fine, server isn't set up yet)

---

## PART D — Connect to EC2 and Set Up the Server

### D1 — SSH from Windows PowerShell

```powershell
# Fix permissions on the key file (required)
icacls "C:\Users\arman\Downloads\alexa-india-key.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"

# Connect (replace with your Elastic IP)
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP
```

You're now inside the EC2 instance. All commands below run **on the EC2 server**.

### D2 — Install Docker

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Re-login so docker group takes effect
exit
```

SSH back in:
```powershell
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP
```

Verify Docker works:
```bash
docker ps
```

### D3 — Install AWS CLI v2

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

### D4 — Pull Your Docker Image from ECR

The EC2 instance role (`AlexaIndiaEC2Role`) handles auth automatically — no credentials needed.

```bash
# Login Docker to ECR using the instance role
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS \
               --password-stdin 116137269322.dkr.ecr.us-east-1.amazonaws.com

# Pull your image
docker pull 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest

# Verify
docker images
```

### D5 — Run the Container

```bash
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
```

> No AWS keys in environment — the IAM instance role provides credentials automatically.

Verify it started:
```bash
docker logs alexa-backend
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok", ...}`

---

## PART E — Nginx + HTTPS with Let's Encrypt

### E1 — Install Nginx and Certbot

```bash
sudo dnf install -y nginx
sudo dnf install -y python3-certbot-nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### E2 — Initial Nginx Config (HTTP only first)

```bash
sudo nano /etc/nginx/conf.d/alexa-india.conf
```

Paste this (replace `alexa-india.duckdns.org` with your actual DuckDNS subdomain):

```nginx
server {
    listen 80;
    server_name alexa-india.duckdns.org;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Save: `Ctrl+X` → `Y` → `Enter`

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify HTTP works:
```bash
curl http://alexa-india.duckdns.org/api/health
```

### E3 — Get Free SSL Certificate

```bash
sudo certbot --nginx -d alexa-india.duckdns.org \
  --non-interactive --agree-tos -m ranobackup13@gmail.com
```

Certbot automatically edits your Nginx config to add HTTPS.

Verify HTTPS works:
```bash
curl https://alexa-india.duckdns.org/api/health
```

Expected: `{"status":"ok", ...}`

### E4 — Auto-renew SSL (Let's Encrypt certs expire every 90 days)

```bash
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer

# Test the renewal process
sudo certbot renew --dry-run
```

---

## PART F — Test Everything

Run these from your **Windows PowerShell** (not the EC2 SSH session):

```powershell
$BACKEND_URL = "https://alexa-india.duckdns.org"

# Health check
Invoke-RestMethod "$BACKEND_URL/api/health"

# Seed demo home
Invoke-RestMethod -Method Post "$BACKEND_URL/api/homes/demo_home_001/seed"

# T0 test — instant rule engine ($0)
Invoke-RestMethod -Method Post "$BACKEND_URL/api/simulate/geyser" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","outdoor_temp":18}'
# Expect: tier="T0", latency<10ms

# T3 test — real Bedrock call (~$0.00004)
Invoke-RestMethod -Method Post "$BACKEND_URL/api/simulate/inventory_drop" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","item":"milk","quantity":0.3}'
# Expect: tier="T3", model_id="amazon.nova-micro-v1:0", is_mock=false

# WebSocket test (install wscat first: npm install -g wscat)
wscat -c "wss://alexa-india.duckdns.org/ws?home_id=demo_home_001"
```

---

## PART G — Update Frontend and Deploy Amplify

### G1 — Create frontend production env file

In `C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin\`, create `.env.production`:

```env
VITE_API_BASE_URL=https://alexa-india.duckdns.org
VITE_WS_URL=wss://alexa-india.duckdns.org
```

### G2 — Update Backend CORS for Amplify

Edit `C:\Users\arman\Desktop\alexa2\backend\src\index.ts` — replace line 14:

```typescript
// Replace this:
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));

// With this:
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

### G3 — Push Both Repos

```powershell
# Backend
cd C:\Users\arman\Desktop\alexa2
git add backend/src/index.ts
git commit -m "Update CORS for production Amplify domain"
git push origin main

# Frontend
cd C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin
git add .env.production
git commit -m "Add production env pointing to EC2 backend"
git push origin master
```

### G4 — Deploy Frontend on AWS Amplify

1. Go to **AWS Amplify → New app → Host web app**
2. **Source**: GitHub → Authorize → select `Arman-Saini/Alexa2Frontend` → branch `master`
3. **Build settings** — confirm or paste:

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

4. **Environment variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://alexa-india.duckdns.org` |
   | `VITE_WS_URL` | `wss://alexa-india.duckdns.org` |

5. **Save and deploy** (~2-3 min)
6. Your frontend: `https://main.XXXX.amplifyapp.com`

### G5 — Add Amplify URL to Backend CORS

SSH back into EC2 and update the running container:

```bash
docker stop alexa-backend
docker rm alexa-backend
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

Replace `https://main.XXXX.amplifyapp.com` with your actual Amplify URL.

---

## PART H — Redeploy After Code Changes

When you push new backend code, pull and restart the container on EC2:

```bash
# SSH into EC2
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP

# Pull latest image (after rebuilding and pushing to ECR from your laptop)
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

## Final URLs (fill in after deployment)

| Resource | URL |
|---|---|
| **Backend API** | `https://alexa-india.duckdns.org` |
| **Health check** | `https://alexa-india.duckdns.org/api/health` |
| **WebSocket** | `wss://alexa-india.duckdns.org/ws?home_id=demo_home_001` |
| **Frontend** | `https://main.XXXX.amplifyapp.com` |
| **EC2 Console** | EC2 → Instances → alexa-india-backend |

---

## Cost Summary

| Service | Cost |
|---|---|
| EC2 t2.micro | **$0** (free tier 12 months) |
| Elastic IP (attached) | **$0** (free while instance running) |
| ECR storage | **~$0.01/month** (small image) |
| AWS Amplify | **$0** (free tier) |
| DuckDNS domain | **$0** (free forever) |
| Let's Encrypt SSL | **$0** (free forever) |
| Bedrock Nova Micro | **~$0.0001** per demo session |
| **Total** | **~$0/month** |

---

## Troubleshooting

### SSH connection refused
- Check security group allows port 22 from your IP
- Your IP may have changed — update the inbound rule: EC2 → Security Groups → alexa-india-sg → Edit inbound rules

### `curl https://alexa-india.duckdns.org` fails after cert
- Check Nginx is running: `sudo systemctl status nginx`
- Check container is running: `docker ps`
- Check Nginx config: `sudo nginx -t`
- View Nginx errors: `sudo tail -f /var/log/nginx/error.log`

### Bedrock AccessDeniedException on EC2
- Confirm the instance profile is `AlexaIndiaEC2Role`: EC2 console → Instance → Security tab
- Confirm the role has `bedrock:InvokeModel` for `amazon.nova-micro-v1:0` ARN

### Docker container keeps restarting
```bash
docker logs alexa-backend --tail 50
```
Most likely missing env var or port conflict.

### WebSocket not connecting from Amplify
- Confirm `wss://` (not `ws://`) in `.env.production`
- Confirm Nginx config has the `Upgrade` and `Connection` headers (see E2)
- Check browser console for CORS errors — add Amplify URL to ALLOWED_ORIGINS
