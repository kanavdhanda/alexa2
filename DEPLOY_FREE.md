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

## STEP 12 — Update Backend CORS ✓ Already done

`backend/src/index.ts` already has the correct CORS config allowing all `.vercel.app` domains
and any URL set in the `ALLOWED_ORIGINS` environment variable. No changes needed here.

For reference, the active code looks like this:
```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
```

---

## STEP 13 — Create Frontend Production Config ✓ Already done

`C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin\.env.production` already exists:
```env
VITE_API_BASE_URL=https://alexa-india.duckdns.org
VITE_WS_URL=wss://alexa-india.duckdns.org
```

---

## STEP 14 — Add vercel.json for SPA Routing ✓ Already done

`vercel.json` is already committed in `alexa-digital-twin/`. It tells Vercel to serve
`index.html` for all routes so page refreshes don't 404.

---

## STEP 15 — Push Both Repos to GitHub ✓ Already done

Both repos have been pushed with the correct production config.

---

## STEP 16 — Deploy Frontend on Vercel

1. Go to **vercel.com** → sign in with GitHub
2. Click **Add New → Project**
3. Find and import `Arman-Saini/Alexa2Frontend`
4. **Configure project**:
   - **Root Directory** → click Edit → type `alexa-digital-twin` → Save
   - Framework Preset will auto-detect as **Vite** ✓
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
5. Expand **Environment Variables** → add both:

   | Name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://alexa-india.duckdns.org` |
   | `VITE_WS_URL` | `wss://alexa-india.duckdns.org` |

6. Click **Deploy** — takes ~2 minutes
7. Vercel gives you a URL like `https://alexa2-frontend.vercel.app`

> Every future `git push origin master` automatically triggers a new Vercel deployment.

---

## STEP 17 — Add Your Vercel URL to Backend CORS

Once you have the Vercel URL, SSH into EC2 and restart the container with it.

```powershell
ssh -i "C:\Users\arman\Downloads\alexa-india-key.pem" ec2-user@YOUR_ELASTIC_IP
```

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
  -e ALLOWED_ORIGINS=https://alexa2-frontend.vercel.app \
  116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

Replace `https://alexa2-frontend.vercel.app` with your actual Vercel URL.

> All `*.vercel.app` preview URLs (created on every PR) are also auto-allowed by the CORS
> code — you only need `ALLOWED_ORIGINS` for your custom domain if you add one later.

---

## STEP 18 — Final Check

Open your Vercel URL in the browser and confirm:
- 3D home renders
- Voice commands trigger and play Indian English Polly audio
- Device toggles update in the 3D view
- T3 escalations call real Bedrock (check browser network tab — no `is_mock: true`)

Quick API smoke test from your **laptop PowerShell**:

```powershell
$BASE = "https://alexa-india.duckdns.org/api"
Invoke-RestMethod "$BASE/health"
Invoke-RestMethod -Method Post "$BASE/homes/demo_home_001/seed"
Invoke-RestMethod -Method Post "$BASE/simulate/geyser" `
  -ContentType "application/json" `
  -Body '{"home_id":"demo_home_001","outdoor_temp":18}'
```

WebSocket test (run `npm install -g wscat` first):
```powershell
wscat -c "wss://alexa-india.duckdns.org/ws?home_id=demo_home_001"
```

---

## Your URLs

| | URL |
|---|---|
| **Backend API** | `https://alexa-india.duckdns.org` |
| **Backend Health** | `https://alexa-india.duckdns.org/api/health` |
| **WebSocket** | `wss://alexa-india.duckdns.org/ws?home_id=demo_home_001` |
| **Frontend** | `https://alexa2-frontend.vercel.app` |

---

## Updating the Backend After Code Changes

On your **laptop** — rebuild and push to ECR:

```powershell
cd C:\Users\arman\Desktop\alexa2\backend

aws ecr get-login-password --region us-east-1 | `
  docker login --username AWS --password-stdin 116137269322.dkr.ecr.us-east-1.amazonaws.com

docker build -t alexa-india-backend .
docker tag alexa-india-backend:latest 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
docker push 116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

SSH into EC2 and pull the new image:

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
  -e ALLOWED_ORIGINS=https://alexa2-frontend.vercel.app \
  116137269322.dkr.ecr.us-east-1.amazonaws.com/alexa-india-backend:latest
```

## Updating the Frontend After Code Changes

Just push to GitHub — Vercel auto-deploys on every push:

```powershell
cd C:\Users\arman\Desktop\Alexa2Frontend\alexa-digital-twin
git add .
git commit -m "your message"
git push origin master
```

---

## What Would Have Been Different If We Knew Vercel From the Start

| Item | What changed |
|---|---|
| `backend/src/index.ts` CORS | `.amplifyapp.com` → `.vercel.app` |
| `vercel.json` | Added to frontend (handles SPA routing — replaces Amplify rewrite rule) |
| No AWS Amplify setup needed | Saves ~10 minutes and avoids the YAML build spec |
| `.env.production` | Same either way |
| Backend EC2 deployment | Identical — Vercel only affects the frontend |

---

## Troubleshooting

**SSH says permission denied**
- Run the `icacls` command from Step 5 first
- Use `ec2-user` not `root`

**`http://alexa-india.duckdns.org` times out**
- Security group must have port 80 open (EC2 → Security Groups → add HTTP rule)
- Wait 5 min after updating DuckDNS for DNS to propagate

**Certbot fails**
- Port 80 must work before running certbot — test Step 9 HTTP check first

**Bedrock AccessDeniedException on EC2**
- EC2 console → Instance → Security tab → confirm IAM role is `AlexaIndiaEC2Role`
- Role must have `bedrock:InvokeModel` in its inline policy

**Docker container not starting**
```bash
docker logs alexa-backend
```

**WebSocket fails from Vercel frontend**
- `.env.production` must use `wss://` not `ws://`
- `ALLOWED_ORIGINS` on EC2 must match your Vercel URL exactly (no trailing slash)
- Check browser DevTools → Console for CORS errors

**Vercel build fails**
- Confirm Root Directory is set to `alexa-digital-twin` in Vercel project settings
- Run `npm run build` locally in that folder first to catch TypeScript errors
