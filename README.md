# 🛡️ EcomSec — AI-Powered Security Agent Platform

> **Author:** Alvin, Security Architect  
> **Platform:** E-Commerce Security Operations  
> **Orchestration:** Paperclip  
> **Version:** 1.1.0**  
> **Agents:** 26 (13 Required · 7 Recommended · 6 E-Commerce Specific)  

---

## Overview

EcomSec is a fully autonomous, AI-agent-driven security platform built for a medium e-commerce organisation. It consists of **20 specialised security agents** orchestrated via **Paperclip**, surfaced through a **Single Pane of Glass (SPOG) dashboard**, and reporting automatically on a monthly and quarterly cadence.

All agents are modular, independently deployable, and communicate via an async event bus managed by the Paperclip orchestration layer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PAPERCLIP ORCHESTRATION LAYER               │
│         (Agent Registry · Event Bus · Health Monitor)    │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  [Endpoint]        [Network]        [Application]
  EDR Agent         DNS Agent        WAF+Bot Agent
  IAM/PAM Agent     Web Proxy        API Gateway Agent
                                     SAST/DAST Agent

  [Detection]       [Data]           [Governance]
  SIEM Agent        DLP Agent        Asset Mgmt Agent
  IR Agent          Email Agent      Vulnerability Agent
  Threat Intel                       Compliance/GRC Agent
                                     Risk Dashboard Agent

  [Threat Intel]    [Cloud]          [Resilience]
  Brand Protection  CSPM Agent       Backup/Recovery Agent
                         │
                         ▼
        ┌────────────────────────────────┐
        │   SINGLE PANE OF GLASS (SPOG)  │
        │   Monthly & Quarterly Reports  │
        └────────────────────────────────┘
```

---

## Agent Registry

| Agent | Category | Priority | Status |
|-------|----------|----------|--------|
| EDR Agent | Endpoint | P1 | Required |
| Email Security Agent | Communication | P1 | Required |
| DNS Security Agent | Network | P1 | Required |
| Asset Management Agent | Governance | P1 | Required |
| SIEM Agent | Detection | P1 | Required |
| Web Proxy Agent | Network | P2 | Required |
| DLP Agent | Data | P1 | Required |
| API Gateway Agent | Application | P1 | Required |
| WAF + Bot Management Agent | Application | P1 | Required |
| SAST/DAST Agent | AppSec | P1 | Required |
| Brand Protection Agent | Threat Intel | P2 | Required |
| Vulnerability Management Agent | Governance | P1 | Required |
| Risk Assessment Dashboard Agent | Governance | P1 | Required |
| IAM/PAM Agent | Identity | P1 | Recommended |
| Cloud Security Posture Agent | Cloud | P1 | Recommended |
| Incident Response Agent | Detection | P1 | Recommended |
| Threat Intelligence Agent | Threat Intel | P2 | Recommended |
| Backup & Recovery Agent | Resilience | P2 | Recommended |
| Compliance & GRC Agent | Governance | P2 | Recommended |

---

## Repository Structure

```
ecomsec/
├── agents/                    # All 20 security agents
│   ├── <agent-name>/
│   │   ├── src/               # Agent source code
│   │   ├── tests/             # Unit + integration tests
│   │   └── config/            # Agent configuration
├── orchestration/             # Paperclip config + agent registry
├── dashboard/                 # SPOG dashboard + reporting engine
├── infrastructure/            # Docker, K8s, Terraform
├── docs/                      # Architecture, runbooks, API specs
├── reports/                   # Generated reports
├── scripts/                   # Utility scripts
└── .github/workflows/         # CI/CD pipelines
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Docker + Docker Compose
- Paperclip CLI installed
- Access to secrets vault (HashiCorp Vault / AWS Secrets Manager)

### Setup

```bash
# Clone the repository
git clone https://github.com/manabouprj/ecomsec.git
cd ecomsec

# Install dependencies
pip install -r requirements.txt

# Configure secrets (DO NOT hardcode credentials)
cp .env.example .env
# Edit .env with your vault references

# Start orchestration layer
docker-compose up -d

# Register all agents with Paperclip
paperclip register --config orchestration/paperclip-config/agent-registry.yaml

# Launch SPOG dashboard
cd dashboard/single-pane-of-glass && npm install && npm start
```

---

## Security Notice

⚠️ **NEVER commit credentials, API keys, or secrets to this repository.**  
All credentials must be stored in the secrets vault and referenced via environment variables.  
See `docs/runbooks/secrets-management.md` for the approved secrets handling procedure.

---

## Compliance Alignment

- ISO/IEC 27001:2022
- PCI DSS v4.0
- NIST CSF 2.0
- MITRE ATT&CK v14
- UAE PDPL (Personal Data Protection Law)
- DIFC Data Protection Law
- ADGM Data Protection Regulations
- OWASP Top 10 (2021)

---

## Reporting

- **Monthly Technical Reports** → `reports/generated/monthly/`
- **Quarterly Business Reports** → `reports/generated/quarterly/`
- Auto-generated by the Risk Dashboard Agent via the Reporting Engine

---

## Author

**Alvin** | Security Architect  
Platform: EcomSec v1.0  
Orchestration: Paperclip  

---

## v1.1 — Modified Design Summary

### 1. Human-Agent Chat Interface (All Enterprise Platforms)

Every security agent exposes a **dedicated conversational channel** in your enterprise messaging platform. Security operators interact with agents using slash commands — no dashboard, no CLI, no server access required.

**Supported platforms:**

| Platform | Integration | Key Feature |
|----------|------------|-------------|
| **Slack** | Bolt SDK + Socket Mode | Block Kit cards, interactive approval buttons, setup wizard |
| **Microsoft Teams** | Bot Framework + Graph API | Adaptive Cards, action buttons, full approval flows |
| **Cisco Webex** | Webex REST API | Markdown cards, room management, rich bot interactions |
| **Google Chat** | Chat API + Webhooks | Card widgets, space management, slash commands |

**Channel-to-Agent mapping (dedicated window per agent):**
```
#sec-edr        ↔  EDR Agent              /isolate /alert /status
#sec-siem       ↔  SIEM Agent             /scan /alert /report
#sec-fraud      ↔  Fraud Detection Agent  /block /status /alert
#sec-vuln       ↔  Vulnerability Agent    /scan /status /report
#sec-ir         ↔  Incident Response      /playbook run <name>
#sec-pci        ↔  PCI Segmentation       /status /alert list
#sec-iam        ↔  IAM/PAM Agent          /status /alert
#sec-cloud      ↔  Cloud Security Agent   /scan /status
#sec-all        ↔  ALL Agents broadcast   critical platform alerts
... 12 more dedicated channels
```

**Interactive Setup Wizard** — run `/setup <agent-id>` from within any agent channel to walk through credential verification, connectivity testing, threshold configuration, notification routing, and baseline scan — all conversationally, step by step.

**Full command reference:**

| Command | Description |
|---------|-------------|
| `/status [agent-id]` | Live health + current metrics |
| `/alert list` | Active alerts for this agent's domain |
| `/alert acknowledge <id>` | Ack with operator name + timestamp |
| `/isolate <hostname>` | Endpoint isolation (EDR only) |
| `/block <ip\|domain>` | Block across DNS + WAF + Proxy simultaneously |
| `/scan [target]` | On-demand scan trigger |
| `/report [monthly\|quarterly]` | Generate report → PDF delivered to channel |
| `/playbook run <name>` | Execute IR playbook, tracked in #sec-ir |
| `/setup <agent-id>` | Interactive step-by-step agent setup wizard |
| `/help` | Full command reference for this channel's agent |

---

### 2. Single Pane of Glass Dashboard — Dual-Audience Design

The SPOG dashboard renders different widget sets for different audiences via a **Business / Technical toggle**:

**Business View (Executive / Non-Technical Audience)**
- Security Posture Score (0–100, RAG status, trend arrow)
- Risk Heatmap — plain-English risk categories on likelihood × impact matrix
- Compliance status tiles — PCI DSS, ISO 27001, NIST CSF, UAE PDPL percentage bars
- Fraud KPIs — transactions protected, fraud rate %, ATO detections, estimated revenue protected
- Incident summary with business impact language (not alert IDs)
- One-click quarterly board report generation → PDF in under 60 seconds

**Technical View (SOC / Engineering Audience)**
- Real-time alert feed with severity, source agent, MITRE tactic tag, time-to-acknowledge
- Agent Health Matrix — live status grid of all 26 agents (uptime, port, last-seen)
- MITRE ATT&CK Coverage Heatmap — covered vs. uncovered techniques per tactic
- CVE table — open vulnerabilities by severity with patch SLA countdown timer
- Alert volume time-series charts by agent category (stacked, 24h / 7d / 30d views)
- Embedded chat command panel — issue `/isolate`, `/block`, `/scan` directly from dashboard
- Raw expandable metric widgets per agent with drill-down

**Auto-Generated Reports:**
- **Monthly Technical Report** — threat landscape, CVE status, DLP incidents, alert trends, compliance snapshot
- **Quarterly Business Report** — risk heatmap, posture trend, fraud KPIs, investment recommendations, board-ready narrative

Reports generated as PDFs, stored in `reports/generated/`, and auto-delivered to configured Slack/Teams channels.

---

### 3. High Level Design (HLD) and Low Level Design (LLD)

Full architecture documentation is included in the repository:

| Document | Location | Contents |
|----------|----------|---------|
| **HLD v1.0** | `docs/hld/EcomSec-HLD-v1.0.docx` | Executive summary, layered architecture, agent categories, data flow, chat interface design, SPOG widget catalogue, compliance mapping, phased deployment overview |
| **LLD v1.0** | `docs/lld/EcomSec-LLD-v1.0.docx` | Base agent class spec, per-agent technical tables (port, tools, events, auth, secrets, scaling, retry, chat commands), full event catalogue, database schema, infrastructure sizing, port reference |

---

### 4. Installation Guide

Full step-by-step installation guide: **`docs/installation/INSTALLATION.md`**

Covers:
- Prerequisites and required accounts
- Repository setup and dependency installation
- Secrets vault configuration (HashiCorp Vault, AWS Secrets Manager, GitHub Secrets)
- Infrastructure setup (Docker Compose for dev, Kubernetes for production)
- Paperclip orchestration setup and agent registration
- Chat interface configuration for all four platforms (Slack, Teams, Webex, Google Chat)
- Per-phase agent deployment commands
- SPOG dashboard setup
- CI/CD pipeline configuration
- Validation and health checks
- Troubleshooting reference

---

### 5. Phased Deployment (Budget-Conscious Rollout)

Full phased plan: **`docs/deployment-phases/PHASED-DEPLOYMENT.md`**

| Phase | Agents | Timeline | Budget Band (AED/yr) | Key Security Outcome |
|-------|--------|----------|---------------------|---------------------|
| **Phase 1** | 8 | Months 1–3 | 180K–280K | Core visibility — EDR, email, DNS, SIEM, vuln, asset, dashboard, chat |
| **Phase 2** | +7 | Months 4–6 | 220K–350K | App + data protection — WAF, API GW, DLP, proxy, SAST/DAST, PCI, fraud |
| **Phase 3** | +5 | Months 7–10 | 280K–420K | Identity + cloud + response — IAM, CSPM, IR, threat intel, brand |
| **Phase 4** | +6 | Months 11–14 | 180K–260K | Governance + resilience — compliance, backup, 3P risk, mobile, data residency, CDN |

Each phase delivers standalone security value. Phase 1 can be live within 30 days.

---

### 6. E-Commerce Specific Controls (6 New Agents)

| Agent | Module | Key Function |
|-------|--------|-------------|
| **PCI DSS Segmentation** | `agents/pci-dss-segmentation-agent/` | CDE boundary enforcement, firewall rule auditing, PCI DSS v4.0 Req 1 compliance |
| **Fraud Detection** | `agents/fraud-detection-agent/` | Real-time transaction risk scoring, ATO detection, card testing prevention |
| **Third-Party Risk** | `agents/third-party-risk-agent/` | Vendor security scoring via SecurityScorecard, supply chain monitoring |
| **Mobile App Security** | `agents/mobile-app-security-agent/` | iOS/Android SAST via MobSF, OWASP Mobile Top 10, CI/CD release gating |
| **Data Residency** | `agents/data-residency-agent/` | UAE PDPL / DIFC / ADGM data locality enforcement, cross-border transfer blocking |
| **CDN Security** | `agents/cdn-security-agent/` | Cache poisoning detection, security header enforcement, origin protection |

---

## Repository Structure

```
ecomsec/
├── agents/
│   ├── base_agent.py                    # Shared base class for all 26 agents
│   ├── chat-interface/                  # Slack · Teams · Webex · Google Chat
│   ├── edr-agent/                       # Endpoint detection & response
│   ├── email-security-agent/            # Phishing · BEC prevention
│   ├── dns-security-agent/              # DNS sinkholing · C2 blocking
│   ├── asset-management-agent/          # Asset discovery · CMDB
│   ├── siem-agent/                      # Log correlation · alerting
│   ├── web-proxy-agent/                 # SSL inspection · URL filtering
│   ├── dlp-agent/                       # Data loss prevention
│   ├── api-gateway-agent/               # API auth · rate limiting · anomaly detection
│   ├── waf-bot-agent/                   # WAF · bot management · DDoS
│   ├── sast-dast-agent/                 # Code scanning · CI/CD gating
│   ├── brand-protection-agent/          # Lookalike domains · dark web monitoring
│   ├── vulnerability-agent/             # CVE scanning · patch SLA tracking
│   ├── risk-dashboard-agent/            # Posture scoring · report generation
│   ├── iam-pam-agent/                   # SSO · MFA · privileged access
│   ├── cloud-security-agent/            # CSPM · cloud misconfiguration detection
│   ├── incident-response-agent/         # IR playbooks · MTTR automation
│   ├── threat-intel-agent/              # IOC enrichment · MITRE ATT&CK mapping
│   ├── backup-recovery-agent/           # Backup integrity · recovery drills
│   ├── compliance-grc-agent/            # ISO 27001 · PCI DSS · GDPR evidence
│   ├── pci-dss-segmentation-agent/      # CDE isolation · firewall audit [E-COM]
│   ├── fraud-detection-agent/           # Transaction fraud · ATO prevention [E-COM]
│   ├── third-party-risk-agent/          # Vendor risk scoring [E-COM]
│   ├── mobile-app-security-agent/       # Mobile SAST/DAST [E-COM]
│   ├── data-residency-agent/            # UAE PDPL · DIFC · ADGM [E-COM]
│   └── cdn-security-agent/              # CDN hardening · cache poisoning [E-COM]
├── orchestration/
│   └── paperclip-config/
│       └── agent-registry.yaml          # All 26 agents registered
├── dashboard/
│   ├── single-pane-of-glass/            # React SPOG — business + technical views
│   └── reporting-engine/                # Monthly + quarterly report templates
├── infrastructure/
│   ├── docker/docker-compose.yml        # Full platform compose (all 26 agents)
│   ├── k8s/                             # Kubernetes manifests
│   └── terraform/                       # Infrastructure as Code
├── docs/
│   ├── hld/EcomSec-HLD-v1.0.docx        # High Level Design
│   ├── lld/EcomSec-LLD-v1.0.docx        # Low Level Design
│   ├── installation/INSTALLATION.md     # Full installation guide
│   └── deployment-phases/PHASED-DEPLOYMENT.md
├── .github/workflows/agent-ci.yml       # SAST → Tests → Container Scan → Deploy
├── .env.example                          # Vault-referenced env template (no secrets)
├── requirements.txt
└── README.md
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/manabouprj/ecomsec.git && cd ecomsec

# 2. Configure secrets vault (see docs/installation/INSTALLATION.md §3)
cp .env.example .env

# 3. Start core infrastructure
cd infrastructure/docker && docker compose up -d postgres redis paperclip

# 4. Deploy Phase 1 (8 agents — core visibility)
docker compose up -d edr-agent email-security-agent dns-security-agent \
  asset-management-agent siem-agent vulnerability-agent \
  risk-dashboard-agent chat-interface-agent

# 5. Launch dashboard
open http://localhost:3000

# 6. Configure Slack (or Teams) — then in #sec-edr:
# /setup edr-agent   ← interactive wizard, no server access needed
```

---

## Compliance

| Framework | Coverage |
|-----------|---------|
| PCI DSS v4.0 | Req 1, 6, 10, 11, 12 |
| ISO/IEC 27001:2022 | A.8, A.9, A.12, A.16 |
| NIST CSF 2.0 | All 5 functions |
| UAE PDPL | Data residency, breach notification |
| DIFC DPL 2020 | Controller obligations, localisation |
| ADGM DPR 2021 | Privacy by design, processing records |
| MITRE ATT&CK v14 | All 14 tactics mapped |
| OWASP Top 10 (2021) | A01–A10 fully covered |

---

⚠️ **NEVER commit credentials to this repository.** All secrets go in the vault. The CI/CD pipeline runs TruffleHog on every push and will block commits containing secrets.

---

*EcomSec v1.1.0 · Alvin, Security Architect · Paperclip Orchestrated*
