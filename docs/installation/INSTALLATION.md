# EcomSec — Complete Installation Guide

> **Author:** Alvin, Security Architect  
> **Version:** 1.0  
> **Last Updated:** 2025  

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository Setup](#2-repository-setup)
3. [Secrets & Vault Configuration](#3-secrets--vault-configuration)
4. [Infrastructure Setup](#4-infrastructure-setup)
5. [Paperclip Orchestration Setup](#5-paperclip-orchestration-setup)
6. [Chat Interface Configuration](#6-chat-interface-configuration)
   - [Slack Setup](#61-slack-setup)
   - [Microsoft Teams Setup](#62-microsoft-teams-setup)
   - [Webex Setup](#63-webex-setup)
   - [Google Chat Setup](#64-google-chat-setup)
7. [Agent Deployment (All Agents)](#7-agent-deployment)
8. [SPOG Dashboard Setup](#8-spog-dashboard-setup)
9. [CI/CD Pipeline Configuration](#9-cicd-pipeline-configuration)
10. [Validation & Health Checks](#10-validation--health-checks)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### Required Software

| Tool | Minimum Version | Installation |
|------|----------------|--------------|
| Git | 2.40+ | https://git-scm.com |
| Docker | 24.0+ | https://docs.docker.com/get-docker |
| Docker Compose | 2.20+ | Included with Docker Desktop |
| Python | 3.11+ | https://python.org |
| Node.js | 20 LTS+ | https://nodejs.org |
| kubectl | 1.28+ | https://kubernetes.io/docs/tasks/tools (production) |
| Helm | 3.13+ | https://helm.sh (production) |
| Paperclip CLI | latest | See Section 5 |

### Network Requirements

- Outbound HTTPS (443) to all integrated security tool APIs
- Outbound HTTPS (443) to GitHub (for CI/CD)
- Internal: Ports 8001–8025 (agents), 9000 (Paperclip), 6379 (Redis), 5432 (Postgres), 3000 (Dashboard)

### Accounts Required (Phase 1 minimum)

- GitHub account with access to `manabouprj/ecomsec`
- CrowdStrike or SentinelOne (EDR)
- Microsoft Defender / Proofpoint (Email Security)
- Cisco Umbrella or Cloudflare Gateway (DNS)
- Splunk or Microsoft Sentinel (SIEM)
- Tenable or Qualys (Vulnerability)
- Axonius or ServiceNow (Asset Management)
- Slack workspace **and/or** Microsoft Teams tenant (Chat Interface)

---

## 2. Repository Setup

```bash
# Clone the repository
git clone https://github.com/manabouprj/ecomsec.git
cd ecomsec

# Verify structure
ls -la
# Expected: agents/ orchestration/ dashboard/ infrastructure/ docs/ reports/ .github/

# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies for dashboard
cd dashboard/single-pane-of-glass
npm install
cd ../..

# Copy environment template
cp .env.example .env
# ⚠️ DO NOT populate .env with real secrets yet — use vault (Section 3)
```

---

## 3. Secrets & Vault Configuration

**⚠️ CRITICAL: All credentials MUST be stored in a secrets vault. Never hardcode credentials.**

### Option A — HashiCorp Vault (Recommended for Production)

```bash
# Install Vault
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault

# Start Vault (dev mode for testing only)
vault server -dev &

# Set up ecomsec secret path
export VAULT_ADDR='http://127.0.0.1:8200'
vault secrets enable -path=secret kv-v2

# Store secrets (example — repeat for all agents)
vault kv put secret/ecomsec/crowdstrike api_key="YOUR_CROWDSTRIKE_KEY"
vault kv put secret/ecomsec/splunk api_key="YOUR_SPLUNK_KEY" host="https://splunk.company.com:8089"
vault kv put secret/ecomsec/slack bot_token="xoxb-..." app_token="xapp-..."
vault kv put secret/ecomsec/teams tenant_id="..." client_id="..." client_secret="..."
# ... repeat for all agents per .env.example
```

### Option B — AWS Secrets Manager (Cloud Deployments)

```bash
# Store a secret
aws secretsmanager create-secret \
  --name "ecomsec/crowdstrike/api_key" \
  --secret-string "YOUR_CROWDSTRIKE_KEY"

# Agents read via IAM role — no manual env vars needed
# Attach the ecomsec-agents IAM role to your ECS/EKS workloads
```

### Option C — GitHub Actions Secrets (CI/CD Only)

```
Go to: https://github.com/manabouprj/ecomsec/settings/secrets/actions
Add each secret from .env.example as a repository secret
Reference as: ${{ secrets.SECRET_NAME }} in workflows
```

---

## 4. Infrastructure Setup

### Development (Docker Compose)

```bash
cd infrastructure/docker

# Pull all base images
docker compose pull

# Start core infrastructure first
docker compose up -d postgres redis paperclip
sleep 15  # Wait for services to be ready

# Verify core services
docker compose ps
docker compose logs paperclip | tail -20

# Start Phase 1 agents (see Section 7 for phased approach)
docker compose up -d edr-agent email-security-agent dns-security-agent \
  asset-management-agent siem-agent vulnerability-agent \
  risk-dashboard-agent chat-interface-agent

# Start SPOG dashboard
docker compose up -d spog-dashboard

# Verify all running
docker compose ps
```

### Production (Kubernetes)

```bash
# Add ecomsec Helm repo
helm repo add ecomsec https://manabouprj.github.io/ecomsec/helm
helm repo update

# Create namespace
kubectl create namespace ecomsec

# Deploy core infrastructure
helm install ecomsec-core ecomsec/core \
  --namespace ecomsec \
  --set vault.address=https://vault.company.com \
  --set vault.role=ecomsec-agents

# Deploy Phase 1 agents
helm install ecomsec-phase1 ecomsec/agents \
  --namespace ecomsec \
  --set phase=1

# Monitor rollout
kubectl rollout status deployment -n ecomsec
kubectl get pods -n ecomsec
```

---

## 5. Paperclip Orchestration Setup

```bash
# Install Paperclip CLI
pip install paperclip-cli  
# OR: npm install -g @paperclip/cli

# Authenticate Paperclip
paperclip auth login --url http://localhost:9000

# Validate agent registry
paperclip validate --config orchestration/paperclip-config/agent-registry.yaml

# Register all agents
paperclip register --config orchestration/paperclip-config/agent-registry.yaml

# Verify all agents registered
paperclip agents list

# Check platform health
paperclip health --all

# Expected output:
# ✅ edr-agent           running   port=8001
# ✅ email-security-agent running   port=8002
# ✅ siem-agent           running   port=8005
# ... (all agents listed)
```

---

## 6. Chat Interface Configuration

### 6.1 Slack Setup

**Step 1 — Create Slack App**

1. Go to https://api.slack.com/apps → **Create New App** → **From Scratch**
2. Name: `EcomSec Security Bot`
3. Workspace: Select your security workspace

**Step 2 — Configure Permissions**

Under **OAuth & Permissions → Bot Token Scopes**, add:
```
channels:read        channels:write       chat:write
commands             files:write          im:write
users:read           reactions:write
```

**Step 3 — Enable Socket Mode**

1. Go to **Socket Mode** → Enable
2. Generate App-Level Token with `connections:write` scope
3. Save as `SLACK_APP_TOKEN`

**Step 4 — Create Slash Commands**

Under **Slash Commands**, create:
```
/status   → Request URL: http://chat-agent:8025/slack/commands
/alert    → Request URL: http://chat-agent:8025/slack/commands
/isolate  → Request URL: http://chat-agent:8025/slack/commands
/block    → Request URL: http://chat-agent:8025/slack/commands
/scan     → Request URL: http://chat-agent:8025/slack/commands
/report   → Request URL: http://chat-agent:8025/slack/commands
/playbook → Request URL: http://chat-agent:8025/slack/commands
/setup    → Request URL: http://chat-agent:8025/slack/commands
/help     → Request URL: http://chat-agent:8025/slack/commands
```

**Step 5 — Create Channels**

```
#sec-edr, #sec-siem, #sec-email, #sec-dns, #sec-vuln, #sec-dlp,
#sec-waf, #sec-api, #sec-cloud, #sec-fraud, #sec-iam, #sec-ir,
#sec-brand, #sec-compliance, #sec-pci, #sec-3p, #sec-mobile,
#sec-data, #sec-cdn, #sec-asset, #sec-all, #sec-dashboard
```

**Step 6 — Store Tokens in Vault**

```bash
vault kv put secret/ecomsec/slack \
  bot_token="xoxb-YOUR-BOT-TOKEN" \
  app_token="xapp-YOUR-APP-TOKEN"
```

---

### 6.2 Microsoft Teams Setup

**Step 1 — Register Azure AD Application**

```bash
# Using Azure CLI
az ad app create --display-name "EcomSec Security Bot"
az ad sp create --id <app-id>
az ad app credential reset --id <app-id>
# Save: tenant_id, client_id, client_secret
```

**Step 2 — Grant Graph API Permissions**

In Azure Portal → App Registrations → EcomSec Security Bot → API Permissions:
```
ChannelMessage.Send    (Application)
Channel.ReadBasic.All  (Application)
Team.ReadBasic.All     (Application)
```
→ Click **Grant admin consent**

**Step 3 — Create Incoming Webhooks (for quick alerts)**

For each Teams channel:
1. Open channel → ··· → Connectors → Incoming Webhook → Configure
2. Name: `EcomSec Agent`
3. Copy webhook URL

**Step 4 — Store Credentials**

```bash
vault kv put secret/ecomsec/teams \
  tenant_id="YOUR-TENANT-ID" \
  client_id="YOUR-CLIENT-ID" \
  client_secret="YOUR-CLIENT-SECRET" \
  webhook_url="https://company.webhook.office.com/..."
```

---

### 6.3 Webex Setup

**Step 1 — Create Webex Bot**

1. Go to https://developer.webex.com/my-apps → **Create New App** → **Bot**
2. Name: `EcomSec Security Bot`
3. Save the **Bot Access Token**

**Step 2 — Configure Webhooks**

```bash
curl -X POST https://webexapis.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EcomSec Message Handler",
    "targetUrl": "https://chat-agent.company.com/webex/events",
    "resource": "messages",
    "event": "created"
  }'
```

**Step 3 — Store Token**

```bash
vault kv put secret/ecomsec/webex access_token="YOUR-BOT-ACCESS-TOKEN"
```

---

### 6.4 Google Chat Setup

**Step 1 — Create Google Cloud Project & Chat API**

1. https://console.cloud.google.com → New Project → Enable **Google Chat API**
2. Configure Bot → **Slash Commands** tab → Add each `/command`

**Step 2 — Create Service Account**

```bash
gcloud iam service-accounts create ecomsec-chat-bot \
  --display-name="EcomSec Chat Bot"
gcloud iam service-accounts keys create chat-key.json \
  --iam-account=ecomsec-chat-bot@PROJECT.iam.gserviceaccount.com
```

**Step 3 — Create Space Webhooks**

For each security space (equivalent to Slack channels):
```
Chat Space → Apps → Add webhooks → Copy URL
```

```bash
vault kv put secret/ecomsec/gchat webhook_url="https://chat.googleapis.com/v1/spaces/..."
```

---

## 7. Agent Deployment

### Phase 1 — Core Visibility (Deploy First)

```bash
cd infrastructure/docker

# Deploy Phase 1 agents
docker compose up -d \
  edr-agent \
  email-security-agent \
  dns-security-agent \
  asset-management-agent \
  siem-agent \
  vulnerability-agent \
  risk-dashboard-agent \
  chat-interface-agent

# Verify Phase 1
docker compose ps | grep -E "edr|email|dns|asset|siem|vuln|risk|chat"

# Run initial setup wizard via Slack
# In #sec-edr: /setup edr-agent
# In #sec-siem: /setup siem-agent
# (repeat for each agent)
```

### Phase 2 — Application & Data Protection

```bash
docker compose up -d \
  waf-bot-agent \
  api-gateway-agent \
  dlp-agent \
  web-proxy-agent \
  sast-dast-agent \
  pci-dss-segmentation-agent \
  fraud-detection-agent
```

### Phase 3 — Identity, Cloud & Response

```bash
docker compose up -d \
  iam-pam-agent \
  cloud-security-agent \
  incident-response-agent \
  threat-intel-agent \
  brand-protection-agent
```

### Phase 4 — Governance & Resilience

```bash
docker compose up -d \
  compliance-grc-agent \
  backup-recovery-agent \
  third-party-risk-agent \
  mobile-app-security-agent \
  data-residency-agent \
  cdn-security-agent
```

### Per-Agent Verification

After deploying each agent, verify with:

```bash
# Health check
curl http://localhost:<PORT>/health

# Expected response:
# {"agent_id": "edr-agent", "status": "running", "uptime_seconds": 45.2, ...}

# Check Paperclip registration
paperclip agents status <agent-id>

# Check Slack channel for startup notification
# The Chat Interface Agent will post: ✅ <agent-name> is online
```

---

## 8. SPOG Dashboard Setup

```bash
cd dashboard/single-pane-of-glass

# Install dependencies
npm install

# Configure environment
cat > .env.local << EOF
NEXT_PUBLIC_PAPERCLIP_URL=http://localhost:9000
NEXT_PUBLIC_DB_URL=postgresql://user:pass@localhost:5432/ecomsec
NEXT_PUBLIC_REFRESH_INTERVAL=30000
EOF

# Development
npm run dev
# Dashboard available at: http://localhost:3000

# Production build
npm run build
npm start

# Or via Docker (recommended)
docker compose up -d spog-dashboard
# Dashboard available at: http://localhost:3000
```

**Dashboard default credentials:**
```
Admin:    admin / (set on first launch)
Analyst:  analyst / (set on first launch)
Business: business / (set on first launch — business view only)
```

---

## 9. CI/CD Pipeline Configuration

```bash
# In GitHub repository settings → Secrets → Actions
# Add the following secrets:

SNYK_TOKEN              # Snyk security scanning
PAPERCLIP_STAGING_URL   # Staging Paperclip URL
PAPERCLIP_PROD_URL      # Production Paperclip URL
PAPERCLIP_DEPLOY_TOKEN  # Paperclip deploy token
SLACK_WEBHOOK_URL       # Deployment notifications

# The CI/CD pipeline will automatically:
# 1. Run SAST scan (Snyk + Bandit + Semgrep) on every push
# 2. Check for hardcoded secrets (TruffleHog)
# 3. Run unit tests with 70% coverage gate
# 4. Build and scan Docker images (Trivy)
# 5. Deploy to staging (develop branch)
# 6. Deploy to production (main branch, requires manual approval)
```

---

## 10. Validation & Health Checks

```bash
# Full platform health check
paperclip health --all

# Individual agent health
curl http://localhost:8001/health  # EDR
curl http://localhost:8005/health  # SIEM
curl http://localhost:8025/health  # Chat Interface
curl http://localhost:8013/health  # Risk Dashboard

# Test Slack integration
# In any #sec-* channel: /status
# Expected: Agent status card with metrics

# Test alert pipeline
paperclip test --event critical_endpoint_alert --agent edr-agent
# Expected: Alert card appears in #sec-edr on Slack/Teams

# Test report generation
# In #sec-dashboard: /report monthly
# Expected: PDF report generated and shared in channel

# Check dashboard
open http://localhost:3000
# Toggle between Business and Technical views
# Verify all agent widgets showing data
```

---

## 11. Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Agent not starting | `docker compose logs <agent>` | Check secret availability in vault |
| Paperclip registration failed | `paperclip agents list` | Verify PAPERCLIP_ORCHESTRATOR_URL is reachable |
| Slack commands not responding | Check Socket Mode is enabled | Verify SLACK_APP_TOKEN in vault |
| Teams messages not sending | Check Graph API permissions | Grant admin consent in Azure Portal |
| SIEM not receiving events | Check event bus URL | Verify Redis is running: `docker compose ps redis` |
| Dashboard blank | Check browser console | Verify PAPERCLIP_URL env var in dashboard config |
| CI failing on SAST | Review Snyk report | Fix high/critical vulnerabilities before merge |
| Agent metrics not updating | Check metrics loop | Verify agent logs: `docker compose logs <agent> -f` |
| Secret not found warning | Check vault injection | Run `vault kv get secret/ecomsec/<tool>` to verify |

---

## Support

- **Documentation:** `docs/` directory in this repository
- **Runbooks:** `docs/runbooks/` for per-agent operational runbooks
- **Architecture:** `docs/hld/EcomSec-HLD-v1.0.docx` and `docs/lld/EcomSec-LLD-v1.0.docx`
- **Issues:** https://github.com/manabouprj/ecomsec/issues

---

*EcomSec Installation Guide v1.0 | Author: Alvin, Security Architect*
