# EcomSec — Low Level Design (LLD)

> **Author:** Alvin, Security Architect  
> **Version:** 2.0 (full agent detail)  
> **Classification:** CONFIDENTIAL  
> **Companion document:** `EcomSec-HLD-v1.0.docx` (architectural overview)

---

## Purpose of This Document

This LLD provides **per-agent implementation specifications** for all 26 agents in the EcomSec platform. For each agent, you will find:

1. **Tool integrations** — exact APIs / SDKs used, with documentation links
2. **Authentication mechanism** — token type, scope, lifetime
3. **Account / API setup steps** — exactly how to obtain credentials from the vendor
4. **Required secrets** — environment variable names referenced from the vault
5. **Required permissions / IAM scopes** — least-privilege role required by the agent
6. **Polling and event behaviour** — when and how the agent runs
7. **Events published and subscribed** — agent's role in the Paperclip event bus
8. **Key metrics** — what gets reported to the Risk Dashboard Agent
9. **Scaling and retry strategy** — production deployment guidance
10. **Chat commands** — operator interactions via Slack / Teams / Webex / Google Chat

---

## Table of Contents

- [Section 1 — Base Agent Class](#section-1--base-agent-class)
- [Section 2 — Required Agents (13)](#section-2--required-agents)
  - [2.1 EDR Agent](#21-edr-agent)
  - [2.2 Email Security Agent](#22-email-security-agent)
  - [2.3 DNS Security Agent](#23-dns-security-agent)
  - [2.4 Asset Management Agent](#24-asset-management-agent)
  - [2.5 SIEM Agent](#25-siem-agent)
  - [2.6 Web Proxy Agent](#26-web-proxy-agent)
  - [2.7 DLP Agent](#27-dlp-agent)
  - [2.8 API Gateway Agent](#28-api-gateway-agent)
  - [2.9 WAF + Bot Management Agent](#29-waf--bot-management-agent)
  - [2.10 SAST/DAST Agent](#210-sastdast-agent)
  - [2.11 Brand Protection Agent](#211-brand-protection-agent)
  - [2.12 Vulnerability Management Agent](#212-vulnerability-management-agent)
  - [2.13 Risk Assessment Dashboard Agent](#213-risk-assessment-dashboard-agent)
- [Section 3 — Recommended Agents (7)](#section-3--recommended-agents)
  - [3.1 IAM/PAM Agent](#31-iampam-agent)
  - [3.2 Cloud Security Posture Agent](#32-cloud-security-posture-agent)
  - [3.3 Incident Response Agent](#33-incident-response-agent)
  - [3.4 Threat Intelligence Agent](#34-threat-intelligence-agent)
  - [3.5 Backup & Recovery Agent](#35-backup--recovery-agent)
  - [3.6 Compliance & GRC Agent](#36-compliance--grc-agent)
  - [3.7 Chat Interface Agent](#37-chat-interface-agent)
- [Section 4 — E-Commerce Specific Agents (6)](#section-4--e-commerce-specific-agents)
  - [4.1 PCI DSS Segmentation Agent](#41-pci-dss-segmentation-agent)
  - [4.2 Fraud Detection Agent](#42-fraud-detection-agent)
  - [4.3 Third-Party Risk Agent](#43-third-party-risk-agent)
  - [4.4 Mobile App Security Agent](#44-mobile-app-security-agent)
  - [4.5 Data Residency Agent](#45-data-residency-agent)
  - [4.6 CDN Security Agent](#46-cdn-security-agent)
- [Section 5 — Paperclip Event Bus](#section-5--paperclip-event-bus)
- [Section 6 — Database Schema](#section-6--database-schema)
- [Section 7 — Infrastructure & Ports](#section-7--infrastructure--ports)

---

## Section 1 — Base Agent Class

All 26 agents inherit from `BaseSecurityAgent` defined in `agents/base_agent.py`.

| Method | Purpose |
|--------|---------|
| `start()` | Bootstrap: register with Paperclip → start metrics loop → call `run()` |
| `run()` | **Abstract** — each agent implements its main polling/event loop |
| `collect_metrics()` | **Abstract** — returns agent-specific KPI dict |
| `process_event(event)` | **Abstract** — handles inbound events from Paperclip event bus |
| `publish_event(type, payload)` | POST event to Paperclip event bus, async |
| `report_metrics()` | Calls `collect_metrics()` and publishes `metrics_update` every 5 minutes |
| `health_check()` | Returns `{agent_id, status, uptime_seconds, last_metrics}` |
| `get_secret(env_key)` | Reads from environment (vault-injected) — never reads from disk |
| `register_with_paperclip()` | POST `/agents/register` on startup, sets `status=running` |

**Inherited behaviour:**
- 60-second health check heartbeat to Paperclip
- 5-minute metrics report cycle
- Standard structured logging (JSON to stdout)
- Graceful shutdown on `SIGTERM`
- Automatic retry on Paperclip registration failure (3x exponential backoff)

---

## Section 2 — Required Agents

### 2.1 EDR Agent

**Module:** `agents/edr-agent/` · **Port:** `8001` · **Category:** Endpoint · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **CrowdStrike Falcon** | REST API v2 | https://developer.crowdstrike.com/crowdstrike/reference/api-overview |
| **SentinelOne** | REST API v2.1 | https://usea1-partners.sentinelone.net/docs/en/api-getting-started.html |
| **Microsoft Defender for Endpoint** | Graph API | https://learn.microsoft.com/en-us/microsoft-365/security/defender-endpoint/api/ |

#### Authentication
**CrowdStrike (preferred):** OAuth2 client credentials flow
**SentinelOne:** Long-lived API token

#### Setup Steps — CrowdStrike
1. Log in to **Falcon Console** at `https://falcon.crowdstrike.com`
2. Navigate to **Support → API Clients and Keys**
3. Click **Create API Client**
4. Name: `ecomsec-edr-agent`
5. **Required scopes (least privilege):**
   - `Detections (Read, Write)` — to read detections + acknowledge
   - `Hosts (Read, Write)` — for host enumeration + isolation
   - `Real-time response (Read, Write)` — for `/isolate` command
   - `Incidents (Read, Write)` — for incident management
6. Copy `Client ID` and `Client Secret`
7. Store in vault:
   ```bash
   vault kv put secret/ecomsec/crowdstrike \
     client_id="..." client_secret="..." \
     base_url="https://api.crowdstrike.com"
   ```

#### Setup Steps — SentinelOne (alternative)
1. Log in to **SentinelOne console**
2. Navigate to **Settings → Users → Service Users → Create**
3. Name: `ecomsec-edr-agent`
4. Role: `Site Viewer + Endpoint Operator` (read + isolate)
5. Generate token (save immediately — shown only once)
6. Store in vault: `vault kv put secret/ecomsec/sentinelone api_key="..."`

#### Required Secrets (env vars injected from vault)
```
CROWDSTRIKE_CLIENT_ID
CROWDSTRIKE_CLIENT_SECRET
CROWDSTRIKE_BASE_URL                    # default: https://api.crowdstrike.com
SENTINELONE_API_KEY                     # if using SentinelOne instead
SENTINELONE_HOST                        # e.g. usea1-012.sentinelone.net
```

#### Behaviour
- **Polling:** 60-second threat detection poll
- **Webhook (optional):** real-time detection push from CrowdStrike Streaming API
- **Events published:** `critical_endpoint_alert`, `endpoint_isolated`, `metrics_update`
- **Events subscribed:** `isolate_endpoint`, `threat_intel_ioc`, `siem_correlation_hit`

#### Metrics Reported
- `total_detections` — count over last 24h
- `by_severity` — critical/high/medium/low
- `endpoint_compromise_rate` — % of endpoints with active detections
- `mttd_minutes` — mean time to detect
- `mttr_minutes` — mean time to respond

#### Scaling
- **Stateless** — scale horizontally
- **Limit:** Max 1 instance per CrowdStrike tenant (rate limits apply)
- **Cache:** Redis-backed detection deduplication

#### Retry Strategy
- Exponential backoff: 1s → 2s → 4s → 8s
- After 3 failures: write to dead-letter queue, alert via SIEM

#### Chat Commands
| Command | Channel | Action |
|---------|---------|--------|
| `/status` | `#sec-edr` | Returns agent health + recent detection count |
| `/alert list` | `#sec-edr` | Lists active EDR detections |
| `/isolate <hostname>` | `#sec-edr` | Isolates endpoint via CrowdStrike RTR |

---

### 2.2 Email Security Agent

**Module:** `agents/email-security-agent/` · **Port:** `8002` · **Category:** Communication · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Microsoft Defender for O365** | Graph Security API | https://learn.microsoft.com/en-us/graph/security-concept-overview |
| **Proofpoint** | TAP REST API | https://help.proofpoint.com/Threat_Insight_Dashboard/API_Documentation |
| **Mimecast** | REST API v2 | https://developer.services.mimecast.com/ |

#### Authentication
**Microsoft Defender:** Azure AD app registration with delegated/application permissions
**Proofpoint:** Service Principal with API token

#### Setup Steps — Microsoft Defender for O365
1. Go to **Azure Portal → Azure Active Directory → App registrations → New registration**
2. Name: `ecomsec-email-security`
3. **API Permissions** (Application type, admin consent required):
   - `SecurityEvents.Read.All`
   - `ThreatIntelligence.Read.All`
   - `ThreatHunting.Read.All`
   - `Mail.Read` (for BEC analysis)
4. **Certificates & secrets** → New client secret → 24 months
5. Copy: Tenant ID, Client ID, Client Secret
6. Store in vault:
   ```bash
   vault kv put secret/ecomsec/ms_defender \
     tenant_id="..." client_id="..." client_secret="..."
   ```

#### Setup Steps — Proofpoint TAP (alternative)
1. Log in to **Proofpoint TAP Dashboard**
2. **Settings → Connected Applications → Create credentials**
3. Service principal name: `ecomsec-email-security`
4. Copy `Service Principal` and `Secret`
5. Store: `vault kv put secret/ecomsec/proofpoint sp="..." secret="..."`

#### Required Secrets
```
MS_DEFENDER_TENANT_ID
MS_DEFENDER_CLIENT_ID
MS_DEFENDER_CLIENT_SECRET
PROOFPOINT_SP                            # if using Proofpoint
PROOFPOINT_SECRET                        # if using Proofpoint
MIMECAST_APP_ID                          # if using Mimecast
MIMECAST_APP_KEY
MIMECAST_ACCESS_KEY
MIMECAST_SECRET_KEY
```

#### Behaviour
- **Polling:** 5-minute threat report poll
- **Events published:** `phishing_detected`, `bec_attempt_blocked`, `dmarc_failure`
- **Events subscribed:** `threat_intel_ioc`, `block_indicator` (for sender domains)

#### Metrics Reported
- `phishing_emails_blocked_24h`
- `bec_attempts_blocked_24h`
- `phishing_click_rate` — % of users who clicked
- `dmarc_pass_rate`, `spf_pass_rate`, `dkim_pass_rate`
- `attachment_sandboxing_verdicts` — clean/suspicious/malicious

#### Chat Commands
| Command | Channel | Action |
|---------|---------|--------|
| `/status` | `#sec-email` | Agent health + 24h email threat counts |
| `/block <sender-domain>` | `#sec-email` | Add to email transport rule blocklist |
| `/scan <message-id>` | `#sec-email` | On-demand re-scan of a specific message |

---

### 2.3 DNS Security Agent

**Module:** `agents/dns-security-agent/` · **Port:** `8003` · **Category:** Network · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Cisco Umbrella** | Reporting API v2, Enforcement API | https://developer.cisco.com/docs/cloud-security/ |
| **Cloudflare Gateway** | API v4 | https://developers.cloudflare.com/cloudflare-one/policies/gateway/ |
| **Infoblox BloxOne Threat Defense** | REST API | https://docs.infoblox.com/space/BloxOneThreatDefense |

#### Setup Steps — Cisco Umbrella
1. Log in to **Umbrella Dashboard** at `https://dashboard.umbrella.com`
2. Navigate to **Admin → API Keys**
3. **Create New Key:**
   - Type: `Umbrella Reporting`
   - Name: `ecomsec-dns-reporting`
4. **Create another key:**
   - Type: `Umbrella Management` (for adding domains to blocklist)
   - Name: `ecomsec-dns-enforcement`
5. Save Key + Secret pairs (only shown once)
6. Get **Org ID** from `Admin → Account Settings`
7. Store in vault:
   ```bash
   vault kv put secret/ecomsec/umbrella \
     org_id="..." reporting_key="..." reporting_secret="..." \
     enforcement_key="..." enforcement_secret="..."
   ```

#### Setup Steps — Cloudflare Gateway
1. Log in to **Cloudflare Zero Trust dashboard**
2. **My Profile → API Tokens → Create Token**
3. Use template: `Cloudflare One — Read & Edit`
4. Set permissions: `Zero Trust → Edit, Account Analytics → Read`
5. Copy token
6. Store: `vault kv put secret/ecomsec/cloudflare gateway_token="..." account_id="..."`

#### Required Secrets
```
UMBRELLA_ORG_ID
UMBRELLA_REPORTING_KEY
UMBRELLA_REPORTING_SECRET
UMBRELLA_ENFORCEMENT_KEY
UMBRELLA_ENFORCEMENT_SECRET
CLOUDFLARE_GATEWAY_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

#### Behaviour
- **Polling:** 60-second DNS query log poll
- **Real-time block:** when `block_indicator` event received → push to Umbrella enforcement API immediately
- **Events published:** `dns_c2_callback`, `dns_tunneling_detected`, `malicious_domain_blocked`
- **Events subscribed:** `block_indicator`, `threat_intel_ioc`

#### Metrics Reported
- `blocked_malicious_domains_24h`
- `c2_callbacks_prevented_24h`
- `dns_tunneling_attempts`
- `top_blocked_categories`
- `query_volume_per_hour`

#### Chat Commands
| Command | Channel | Action |
|---------|---------|--------|
| `/block <domain>` | `#sec-dns` or `#sec-all` | Adds domain to Umbrella blocklist |
| `/status` | `#sec-dns` | Agent health + block counts |

---

### 2.4 Asset Management Agent

**Module:** `agents/asset-management-agent/` · **Port:** `8004` · **Category:** Governance · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Axonius** | REST API v1 | https://docs.axonius.com/docs/axonius-rest-api |
| **ServiceNow CMDB** | Table API | https://docs.servicenow.com/bundle/utah-application-development/page/integrate/inbound-rest/ |
| **Qualys AssetView** | API v2 | https://docs.qualys.com/en/av/api/ |

#### Setup Steps — Axonius
1. Log in to Axonius
2. **My Account → API Key** → Generate
3. Copy `API Key` and `API Secret`
4. Store: `vault kv put secret/ecomsec/axonius api_key="..." api_secret="..." host="https://yourtenant.axonius.com"`

#### Setup Steps — ServiceNow CMDB (alternative)
1. Log in to ServiceNow as admin
2. **System Security → Users → New**
   - User ID: `ecomsec-asset-agent`
   - Web service access only: `true`
3. Assign roles: `cmdb_read`, `itil` (read-only access to CIs)
4. Generate password
5. Store: `vault kv put secret/ecomsec/servicenow user="..." pass="..." instance="..."`

#### Required Secrets
```
AXONIUS_HOST
AXONIUS_API_KEY
AXONIUS_API_SECRET
SERVICENOW_INSTANCE                      # e.g. https://acme.service-now.com
SERVICENOW_USER
SERVICENOW_PASSWORD
QUALYS_USERNAME                          # if using Qualys
QUALYS_PASSWORD
QUALYS_PLATFORM_URL
```

#### Behaviour
- **Polling:** 30-minute full asset reconciliation
- **Events published:** `new_asset_discovered`, `asset_decommissioned`, `shadow_it_detected`
- **Events subscribed:** `network_scan_complete` (for cross-correlation)

#### Metrics Reported
- `total_assets_managed`
- `unmanaged_devices_count`
- `shadow_it_findings`
- `assets_by_type` (server, workstation, mobile, IoT, cloud)
- `assets_missing_security_agent` (no EDR, no AV)

---

### 2.5 SIEM Agent

**Module:** `agents/siem-agent/` · **Port:** `8005` · **Category:** Detection · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Splunk Enterprise/Cloud** | REST API v9 | https://docs.splunk.com/Documentation/Splunk/latest/RESTREF |
| **Microsoft Sentinel** | Log Analytics API + Azure Monitor | https://learn.microsoft.com/en-us/rest/api/securityinsights/ |
| **Elastic SIEM** | Kibana API + Elasticsearch | https://www.elastic.co/guide/en/security/current/security-apis.html |

#### Setup Steps — Splunk
1. **Splunk Web UI → Settings → Users → New User**
   - Username: `ecomsec-siem-agent`
   - Roles: `power` + custom role with `rest_apps_read`
2. **Settings → Tokens → New Token**
   - User: `ecomsec-siem-agent`
   - Audience: `ecomsec`
   - Expiration: 90 days
3. Copy token
4. Store: `vault kv put secret/ecomsec/splunk api_token="..." host="https://splunk.acme.com:8089"`

#### Setup Steps — Microsoft Sentinel
1. **Azure Portal → Azure Active Directory → App registrations → New**
2. Name: `ecomsec-sentinel-agent`
3. **API Permissions** → Add: `Microsoft Sentinel — Reader, Responder`
4. Grant admin consent
5. **Certificates & secrets** → New client secret
6. Note: Tenant ID, Client ID, Client Secret, Workspace ID
7. Store:
   ```bash
   vault kv put secret/ecomsec/sentinel \
     tenant_id="..." client_id="..." client_secret="..." workspace_id="..."
   ```

#### Required Secrets
```
SPLUNK_HOST
SPLUNK_API_TOKEN
SENTINEL_TENANT_ID
SENTINEL_CLIENT_ID
SENTINEL_CLIENT_SECRET
SENTINEL_WORKSPACE_ID
ELASTIC_HOST                             # if using Elastic
ELASTIC_API_KEY
```

#### Behaviour
- **Polling:** 30-second alert poll
- **Streaming:** Splunk HEC for high-priority events
- **Events published:** `siem_critical_alert`, `correlation_hit`, `trigger_incident_response`
- **Events subscribed:** **All agent events** (correlates everything)

#### Metrics Reported
- `total_alerts_24h`
- `critical_alerts`, `high_alerts`, `medium_alerts`
- `true_positive_rate` — based on operator feedback via `/alert acknowledge`
- `mttd_minutes`
- `correlation_rules_firing`
- `coverage_sources` — list of agents feeding events

---

### 2.6 Web Proxy Agent

**Module:** `agents/web-proxy-agent/` · **Port:** `8006` · **Category:** Network · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Zscaler ZIA** | API v1 | https://help.zscaler.com/zia/api |
| **Symantec Web Security Service** | REST API | https://techdocs.broadcom.com/us/en/symantec-security-software/web-and-network-security/edge-swg-asg/proxysg-api.html |
| **Squid (open source)** | Native log + ACL config | http://www.squid-cache.org/Doc/config/ |

#### Setup Steps — Zscaler ZIA
1. Log in to **Zscaler admin console**
2. **Administration → Administrators → Add Admin**
   - Username: `ecomsec-proxy-agent`
   - Role: `Auditor` (read) + custom URL Category Manager
3. **Administration → API Key Management → Add**
4. Get: `Username`, `Password`, `API Key`, `Cloud name`
5. Store:
   ```bash
   vault kv put secret/ecomsec/zscaler \
     username="..." password="..." api_key="..." cloud="zscaler.net"
   ```

#### Required Secrets
```
ZSCALER_USERNAME
ZSCALER_PASSWORD
ZSCALER_API_KEY
ZSCALER_CLOUD                            # zscaler.net or zscalerone.net
```

#### Behaviour
- **Polling:** 5-minute log poll
- **Events published:** `proxy_block_event`, `data_exfil_attempt`, `policy_violation`
- **Events subscribed:** `block_indicator`, `dlp_policy_match`

#### Metrics Reported
- `blocked_categories_24h`
- `ssl_inspection_hits`
- `policy_violations`
- `top_users_blocked`
- `bandwidth_consumed_gb`

---

### 2.7 DLP Agent

**Module:** `agents/dlp-agent/` · **Port:** `8007` · **Category:** Data · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Microsoft Purview** | Graph API + Compliance API | https://learn.microsoft.com/en-us/purview/ |
| **Symantec DLP** | REST API | https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention.html |
| **Nightfall AI** | API v3 | https://docs.nightfall.ai/reference |

#### Setup Steps — Microsoft Purview
Reuse the Azure AD app from Section 2.2 (Email Security) and add these permissions:
- `InformationProtectionPolicy.Read.All`
- `Files.Read.All` (for SharePoint/OneDrive scanning)
- `Sites.Read.All`

#### Setup Steps — Nightfall AI (cloud DLP)
1. Sign up at https://nightfall.ai
2. **Settings → API Keys → Create**
3. Name: `ecomsec-dlp-agent`
4. Scope: `read` + `redact`
5. Store: `vault kv put secret/ecomsec/nightfall api_key="..."`

#### Required Secrets
```
PURVIEW_TENANT_ID                        # reuses MS_DEFENDER_TENANT_ID
PURVIEW_CLIENT_ID
PURVIEW_CLIENT_SECRET
NIGHTFALL_API_KEY
SYMANTEC_DLP_HOST                        # if using Symantec
SYMANTEC_DLP_USER
SYMANTEC_DLP_PASS
```

#### Behaviour
- **Polling:** 10-minute incident poll
- **Real-time:** Webhooks from Nightfall on detection
- **Events published:** `dlp_policy_match`, `pii_exfil_attempt`, `payment_data_exposed`
- **Events subscribed:** `cross_border_transfer_detected`

#### Metrics Reported
- `dlp_incidents_24h`
- `incidents_by_data_type` — PII / PCI / PHI / IP
- `policy_violations_by_user`
- `data_at_risk_volume_mb`

---

### 2.8 API Gateway Agent

**Module:** `agents/api-gateway-agent/` · **Port:** `8008` · **Category:** Application · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Kong Gateway** | Admin API | https://docs.konghq.com/gateway/latest/admin-api/ |
| **AWS API Gateway** | AWS SDK (boto3) | https://docs.aws.amazon.com/apigateway/latest/api/ |
| **Apigee** | Apigee API | https://cloud.google.com/apigee/docs/reference |

#### Setup Steps — Kong Gateway (open source)
1. Kong runs in your infrastructure — no SaaS account needed
2. Generate admin token if Kong Manager is enabled:
   ```bash
   curl -X POST http://kong-admin:8001/rbac/users \
     -d "name=ecomsec-api-agent" \
     -d "user_token=GENERATED_TOKEN"
   ```
3. Assign read-only role: `kong-rbac-readonly`
4. Store: `vault kv put secret/ecomsec/kong admin_token="..." admin_url="http://kong-admin:8001"`

#### Setup Steps — AWS API Gateway
1. **AWS IAM → Users → Add User**
   - Name: `ecomsec-api-agent`
   - Access type: `Programmatic`
2. Attach managed policy: `APIGatewayReadOnlyAccess`
3. Custom inline policy for CloudWatch metrics:
   ```json
   {
     "Effect": "Allow",
     "Action": ["cloudwatch:GetMetricStatistics"],
     "Resource": "*"
   }
   ```
4. Save Access Key + Secret
5. Store: `vault kv put secret/ecomsec/aws_apigw access_key="..." secret_key="..." region="me-central-1"`

#### Required Secrets
```
KONG_ADMIN_URL
KONG_ADMIN_TOKEN
AWS_APIGW_ACCESS_KEY
AWS_APIGW_SECRET_KEY
AWS_APIGW_REGION
```

#### Behaviour
- **Polling:** 60-second metric poll from CloudWatch / Kong stats
- **Events published:** `api_abuse_detected`, `auth_failure_spike`, `anomalous_endpoint_traffic`
- **Events subscribed:** `block_indicator`, `waf_attack_detected`

#### Metrics Reported
- `api_abuse_attempts_24h`
- `auth_failures_24h`
- `top_abused_endpoints`
- `rate_limit_hits`
- `4xx_5xx_error_rate`

---

### 2.9 WAF + Bot Management Agent

**Module:** `agents/waf-bot-agent/` · **Port:** `8009` · **Category:** Application · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Cloudflare WAF + Bot Management** | API v4 | https://developers.cloudflare.com/waf/ |
| **Imperva Cloud WAF** | API v3 | https://docs.imperva.com/bundle/cloud-application-security/page/api/api.htm |
| **AWS WAF** | AWS SDK | https://docs.aws.amazon.com/waf/latest/APIReference/ |

#### Setup Steps — Cloudflare
1. **Cloudflare dashboard → My Profile → API Tokens → Create Token**
2. Custom token with permissions:
   - `Zone → Firewall Services → Edit`
   - `Zone → Bot Management → Edit`
   - `Zone → Analytics → Read`
3. Zone resources: select your e-commerce domains
4. Copy token
5. Get `Zone ID` from each domain's dashboard sidebar
6. Store:
   ```bash
   vault kv put secret/ecomsec/cloudflare_waf \
     api_token="..." zone_ids="zone1,zone2,zone3"
   ```

#### Setup Steps — Imperva Cloud WAF (alternative)
1. **Imperva my.imperva.com → API Keys**
2. Generate `API ID` and `API Key`
3. Store: `vault kv put secret/ecomsec/imperva api_id="..." api_key="..."`

#### Required Secrets
```
CLOUDFLARE_WAF_TOKEN
CLOUDFLARE_ZONE_IDS                      # comma-separated list
IMPERVA_API_ID
IMPERVA_API_KEY
AWS_WAF_ACCESS_KEY                       # if using AWS WAF
AWS_WAF_SECRET_KEY
AWS_WAF_REGION
```

#### Behaviour
- **Polling:** 60-second WAF event poll
- **Events published:** `waf_attack_detected`, `bot_traffic_spike`, `ddos_mitigated`
- **Events subscribed:** `block_indicator`, `threat_intel_ioc`

#### Metrics Reported
- `attacks_blocked_24h`
- `bot_traffic_percentage`
- `top_attack_vectors` — SQLi, XSS, RCE, path traversal, etc.
- `top_attacking_countries`
- `false_positive_rate`

---

### 2.10 SAST/DAST Agent

**Module:** `agents/sast-dast-agent/` · **Port:** `8010` · **Category:** AppSec · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Snyk** | REST API v1 | https://docs.snyk.io/snyk-api |
| **Checkmarx SAST** | REST API | https://checkmarx.com/resource/documents/en/34965-19071-rest-api.html |
| **OWASP ZAP** | REST API | https://www.zaproxy.org/docs/api/ |
| **Veracode** | API v1 | https://docs.veracode.com/r/c_api_main |

#### Setup Steps — Snyk
1. **Snyk app.snyk.io → Settings → General → Auth Token**
2. Copy your personal API token (or create a service account in higher tiers)
3. Store: `vault kv put secret/ecomsec/snyk api_token="..." org_id="..."`

#### Setup Steps — Checkmarx SAST
1. **Checkmarx One web UI → Settings → API Keys**
2. Generate API key with `Engine User` role
3. Store: `vault kv put secret/ecomsec/checkmarx api_key="..." host="https://ast.checkmarx.net"`

#### Required Secrets
```
SNYK_API_TOKEN
SNYK_ORG_ID
CHECKMARX_API_KEY
CHECKMARX_HOST
ZAP_API_KEY
VERACODE_API_ID
VERACODE_API_KEY
```

#### Behaviour
- **Triggered:** On every PR via GitHub Actions webhook
- **Polling fallback:** 30-minute scan result poll
- **Events published:** `sast_critical_finding`, `dependency_vuln_found`, `release_blocked`
- **Events subscribed:** `new_pr_opened`, `new_release_candidate`

#### Metrics Reported
- `vulnerabilities_by_severity` — critical/high/medium/low
- `code_coverage_percentage`
- `remediation_sla_met` — % of high-severity fixed within 7 days
- `dependency_health_score`
- `false_positive_rate`

---

### 2.11 Brand Protection Agent

**Module:** `agents/brand-protection-agent/` · **Port:** `8011` · **Category:** Threat Intel · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Recorded Future** | Connect API | https://api.recordedfuture.com/ |
| **ZeroFox** | Platform API | https://api.zerofox.com/1.0/ |
| **BrandShield** | API v1 | https://www.brandshield.com/api-docs |

#### Setup Steps — ZeroFox
1. **ZeroFox dashboard → API Keys**
2. Generate token with `Read + Takedown Initiator` scope
3. Store: `vault kv put secret/ecomsec/zerofox api_token="..." account_id="..."`

#### Setup Steps — Recorded Future (alternative)
1. **Recorded Future → User Settings → API Tokens**
2. Generate token (Connect API access required — paid feature)
3. Store: `vault kv put secret/ecomsec/recorded_future api_token="..."`

#### Required Secrets
```
ZEROFOX_API_TOKEN
ZEROFOX_ACCOUNT_ID
RECORDED_FUTURE_API_TOKEN
BRANDSHIELD_API_KEY
MONITORED_BRANDS                         # comma-separated: "ecomsec,acme-shop"
MONITORED_DOMAINS                        # comma-separated
```

#### Behaviour
- **Polling:** 1-hour brand scan
- **Events published:** `lookalike_domain_detected`, `brand_abuse_found`, `dark_web_mention`
- **Events subscribed:** `new_phishing_indicator`

#### Metrics Reported
- `lookalike_domains_found`
- `takedowns_initiated`
- `takedowns_completed`
- `brand_abuse_incidents`
- `dark_web_mentions`

---

### 2.12 Vulnerability Management Agent

**Module:** `agents/vulnerability-agent/` · **Port:** `8012` · **Category:** Governance · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Tenable.io / Nessus** | REST API | https://developer.tenable.com/reference |
| **Qualys VM** | API v2 | https://docs.qualys.com/en/vm/api/ |
| **Rapid7 InsightVM** | API v3 | https://help.rapid7.com/insightvm/en-us/api/ |

#### Setup Steps — Tenable.io
1. **Tenable.io → Settings → My Account → API Keys → Generate**
2. Save `Access Key` and `Secret Key`
3. Store: `vault kv put secret/ecomsec/tenable access_key="..." secret_key="..."`

#### Setup Steps — Qualys (alternative)
1. **Qualys VM → Users → New User**
   - Role: `Reader` + `API Access`
2. Get username/password
3. Store: `vault kv put secret/ecomsec/qualys user="..." pass="..." url="https://qualysapi.qualys.com"`

#### Required Secrets
```
TENABLE_ACCESS_KEY
TENABLE_SECRET_KEY
QUALYS_USERNAME
QUALYS_PASSWORD
QUALYS_API_URL
RAPID7_API_KEY
```

#### Behaviour
- **Polling:** 1-hour scan result poll
- **Events published:** `critical_cve_found`, `patch_sla_breach`, `new_vulnerability`
- **Events subscribed:** `new_asset_discovered`

#### Metrics Reported
- `open_cves_by_severity`
- `patch_sla_compliance` — % within SLA (Critical: 48h, High: 7d, Medium: 30d)
- `mean_time_to_remediate`
- `top_vulnerable_assets`
- `risk_score_trend`

---

### 2.13 Risk Assessment Dashboard Agent

**Module:** `agents/risk-dashboard-agent/` · **Port:** `8013` · **Category:** Governance · **Priority:** P1

#### Tool Integrations
- **Internal aggregator** — consumes from PostgreSQL (all agent metrics)
- **Paperclip BI** — embedded analytics engine
- **WeasyPrint** — PDF report generation
- **Jinja2** — report templating

#### Authentication
No external API auth needed — only internal database connection.

#### Setup Steps
1. Create dedicated read-only PostgreSQL role:
   ```sql
   CREATE ROLE ecomsec_dashboard WITH LOGIN PASSWORD '...';
   GRANT CONNECT ON DATABASE ecomsec TO ecomsec_dashboard;
   GRANT USAGE ON SCHEMA public TO ecomsec_dashboard;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO ecomsec_dashboard;
   ```
2. Store: `vault kv put secret/ecomsec/postgres dashboard_user="ecomsec_dashboard" dashboard_pass="..."`

#### Required Secrets
```
DB_HOST
DB_PORT
DB_NAME                                  # ecomsec
DB_DASHBOARD_USER
DB_DASHBOARD_PASS
SLACK_REPORT_CHANNEL                     # default destination for monthly reports
TEAMS_REPORT_WEBHOOK
```

#### Behaviour
- **Polling:** Continuous — receives `metrics_update` from all 25 other agents
- **Cron jobs:**
  - Daily 02:00 UTC — posture score snapshot
  - 1st of month 06:00 UTC — generate monthly technical report
  - 1st day of quarter 06:00 UTC — generate quarterly business report
- **Events published:** `report_generated`, `posture_score_updated`
- **Events subscribed:** `metrics_update` (from all agents), `generate_report`

#### Metrics Reported
- `overall_security_posture_score` — 0-100 composite
- `risk_heatmap_data`
- `compliance_percentage` per framework
- `month_over_month_trend`

---

## Section 3 — Recommended Agents

### 3.1 IAM/PAM Agent

**Module:** `agents/iam-pam-agent/` · **Port:** `8014` · **Category:** Identity · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Okta Workforce Identity** | API v1 | https://developer.okta.com/docs/reference/ |
| **CyberArk PAM** | REST API v12 | https://docs.cyberark.com/PAS/Latest/en/Content/SDK/Privileged%20Account%20Security%20Web%20Services%20SDK.htm |
| **BeyondTrust Password Safe** | API v3 | https://www.beyondtrust.com/docs/beyondinsight-password-safe/ps/api/ |

#### Setup Steps — Okta
1. **Okta admin console → Security → API → Tokens → Create Token**
2. Name: `ecomsec-iam-agent`
3. Scope: API access (read for users/groups, audit log read)
4. Store: `vault kv put secret/ecomsec/okta api_token="..." domain="acme.okta.com"`

#### Setup Steps — CyberArk
1. **PVWA → Administration → Users → Add User**
   - Username: `ecomsec-pam-agent`
   - Authentication: API key
2. Permissions: `Audit users`, `List accounts`
3. Generate API key
4. Store: `vault kv put secret/ecomsec/cyberark api_key="..." pvwa_url="..." app_id="ecomsec"`

#### Required Secrets
```
OKTA_DOMAIN
OKTA_API_TOKEN
CYBERARK_PVWA_URL
CYBERARK_APP_ID
CYBERARK_API_KEY
BEYONDTRUST_API_KEY
```

#### Behaviour
- **Polling:** 5-minute audit log poll
- **Events published:** `iam_login_anomaly`, `privileged_session_started`, `mfa_disabled_alert`, `orphaned_account_detected`
- **Events subscribed:** `ato_detected` (forces password reset)

#### Metrics Reported
- `privileged_access_violations_24h`
- `mfa_adoption_rate`
- `orphaned_accounts`
- `failed_login_count`
- `privileged_sessions_recorded`

---

### 3.2 Cloud Security Posture Agent

**Module:** `agents/cloud-security-agent/` · **Port:** `8015` · **Category:** Cloud · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Wiz** | API v1 | https://docs.wiz.io/wiz-docs/docs/api |
| **Prisma Cloud** | REST API | https://prisma.pan.dev/api/cloud/ |
| **AWS Security Hub** | AWS SDK | https://docs.aws.amazon.com/securityhub/latest/APIReference/ |
| **Microsoft Defender for Cloud** | Azure REST API | https://learn.microsoft.com/en-us/rest/api/defenderforcloud/ |

#### Setup Steps — Wiz
1. **Wiz portal → Settings → Service Accounts → Create**
2. Name: `ecomsec-cspm-agent`
3. Scope: `read:all`
4. Copy `Client ID` and `Client Secret`
5. Store: `vault kv put secret/ecomsec/wiz client_id="..." client_secret="..." api_endpoint="https://api.us1.app.wiz.io/graphql"`

#### Setup Steps — AWS Security Hub
1. Create IAM Role `ecomsec-cspm-readonly` with policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": [
         "securityhub:Get*", "securityhub:List*", "securityhub:Describe*",
         "config:Describe*", "config:Get*",
         "ec2:Describe*", "s3:GetBucket*", "iam:Get*", "iam:List*"
       ],
       "Resource": "*"
     }]
   }
   ```
2. Create access keys for an IAM user assuming this role
3. Store: `vault kv put secret/ecomsec/aws_cspm access_key="..." secret_key="..." region="me-central-1"`

#### Required Secrets
```
WIZ_CLIENT_ID
WIZ_CLIENT_SECRET
WIZ_API_ENDPOINT
AWS_CSPM_ACCESS_KEY
AWS_CSPM_SECRET_KEY
AWS_CSPM_REGION
PRISMA_ACCESS_KEY                        # if using Prisma Cloud
PRISMA_SECRET_KEY
PRISMA_API_URL
```

#### Behaviour
- **Polling:** 30-minute posture scan
- **Events published:** `cloud_misconfiguration`, `public_s3_bucket`, `iam_overpermissive`, `unencrypted_resource`
- **Events subscribed:** `new_cloud_resource_created`

#### Metrics Reported
- `cloud_misconfigs_total`
- `cis_benchmark_compliance_percentage`
- `critical_cloud_risks`
- `unencrypted_resources_count`
- `iac_violations`

---

### 3.3 Incident Response Agent

**Module:** `agents/incident-response-agent/` · **Port:** `8016` · **Category:** Detection · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **TheHive** | REST API v1 | https://docs.strangebee.com/thehive/api-docs/ |
| **PagerDuty** | API v2 | https://developer.pagerduty.com/api-reference/ |
| **Atlassian Jira** | REST API v3 | https://developer.atlassian.com/cloud/jira/platform/rest/v3/ |
| **Slack Workflow Builder** | Slack API | https://api.slack.com |

#### Setup Steps — TheHive
1. **TheHive admin → Users → Add → API Account**
2. Name: `ecomsec-ir-agent`
3. Profile: `analyst`
4. Generate API key
5. Store: `vault kv put secret/ecomsec/thehive api_key="..." host="https://thehive.acme.com"`

#### Setup Steps — PagerDuty
1. **PagerDuty → Integrations → API Access Keys → Create New API Key**
2. Description: `ecomsec-ir-agent`
3. Store: `vault kv put secret/ecomsec/pagerduty api_key="..."`

#### Setup Steps — Jira
1. **Atlassian → Profile → Security → API tokens → Create**
2. Label: `ecomsec-ir-agent`
3. Store: `vault kv put secret/ecomsec/jira api_token="..." email="alvin@acme.com" host="https://acme.atlassian.net"`

#### Required Secrets
```
THEHIVE_API_KEY
THEHIVE_HOST
PAGERDUTY_API_KEY
JIRA_API_TOKEN
JIRA_EMAIL
JIRA_HOST
JIRA_PROJECT_KEY                         # e.g. "SOC"
```

#### Behaviour
- **Triggered:** Receives `siem_critical_alert`, `critical_endpoint_alert`, `ato_detected`
- **Events published:** `incident_created`, `playbook_executed`, `incident_resolved`
- **Events subscribed:** `siem_critical_alert`, `critical_endpoint_alert`, `ato_detected`, `pci_scope_violation`

#### Metrics Reported
- `incidents_by_severity`
- `mttr_minutes`
- `playbook_automation_rate`
- `incidents_resolved_24h`
- `escalations_to_human`

---

### 3.4 Threat Intelligence Agent

**Module:** `agents/threat-intel-agent/` · **Port:** `8017` · **Category:** Threat Intel · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **MISP** | REST API | https://www.misp-project.org/openapi/ |
| **VirusTotal** | API v3 | https://developers.virustotal.com/reference |
| **AlienVault OTX** | API v1 | https://otx.alienvault.com/api |
| **STIX/TAXII** | TAXII 2.1 | https://oasis-open.github.io/cti-documentation/taxii/intro |

#### Setup Steps — MISP
1. **MISP web UI → My Profile → View My Profile → Authkey**
2. Create dedicated user: `ecomsec-threat-intel`
3. Role: `read_only` + custom feed access
4. Store: `vault kv put secret/ecomsec/misp api_key="..." url="https://misp.acme.com"`

#### Setup Steps — VirusTotal
1. **VirusTotal → Profile → API Key**
2. Premium API recommended for production (rate limits on free tier)
3. Store: `vault kv put secret/ecomsec/virustotal api_key="..."`

#### Required Secrets
```
MISP_URL
MISP_API_KEY
VIRUSTOTAL_API_KEY
OTX_API_KEY
TAXII_DISCOVERY_URL
TAXII_USERNAME
TAXII_PASSWORD
```

#### Behaviour
- **Polling:** 15-minute IOC sync
- **Events published:** `threat_intel_ioc`, `new_ttp_observed`, `threat_actor_activity`
- **Events subscribed:** `unknown_indicator_query` (from any agent)

#### Metrics Reported
- `iocs_ingested_24h` — IPs, domains, hashes, URLs
- `ttps_observed`
- `threat_actor_activity_count`
- `ioc_match_rate` — % of agent queries that matched intel

---

### 3.5 Backup & Recovery Agent

**Module:** `agents/backup-recovery-agent/` · **Port:** `8018` · **Category:** Resilience · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Veeam Backup & Replication** | REST API | https://helpcenter.veeam.com/docs/backup/vbr_rest/ |
| **Cohesity DataProtect** | API v2 | https://developer.cohesity.com/ |
| **AWS Backup** | AWS SDK | https://docs.aws.amazon.com/aws-backup/latest/devguide/ |

#### Setup Steps — Veeam
1. **Veeam Backup Enterprise Manager → Configuration → Users**
2. Add user: `ecomsec-backup-agent` with `Restore Operator` role
3. Generate REST token via API:
   ```bash
   curl -X POST https://veeam:9419/api/oauth2/token \
     -d "grant_type=password&username=ecomsec-backup-agent&password=..."
   ```
4. Store: `vault kv put secret/ecomsec/veeam api_token="..." host="https://veeam.acme.com:9419"`

#### Setup Steps — AWS Backup
1. IAM Role `ecomsec-backup-readonly` with policy:
   ```json
   {
     "Effect": "Allow",
     "Action": ["backup:Describe*", "backup:Get*", "backup:List*"],
     "Resource": "*"
   }
   ```
2. Store: `vault kv put secret/ecomsec/aws_backup access_key="..." secret_key="..." region="me-central-1"`

#### Required Secrets
```
VEEAM_API_TOKEN
VEEAM_HOST
COHESITY_API_KEY
AWS_BACKUP_ACCESS_KEY
AWS_BACKUP_SECRET_KEY
AWS_BACKUP_REGION
```

#### Behaviour
- **Polling:** 1-hour backup status poll
- **Events published:** `backup_failed`, `recovery_drill_completed`, `rto_breach`
- **Events subscribed:** `ransomware_detected` (triggers air-gap check)

#### Metrics Reported
- `backup_success_rate_24h`
- `recovery_drill_results`
- `rto_compliance_percentage`
- `rpo_actual_vs_target`
- `air_gapped_backups_count`

---

### 3.6 Compliance & GRC Agent

**Module:** `agents/compliance-grc-agent/` · **Port:** `8019` · **Category:** Governance · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Vanta** | API v1 | https://developer.vanta.com/ |
| **Drata** | API v1 | https://developers.drata.com/ |
| **ServiceNow GRC** | Table API | https://docs.servicenow.com/bundle/utah-governance-risk-compliance |

#### Setup Steps — Vanta
1. **Vanta admin → Settings → API Tokens → Generate**
2. Name: `ecomsec-grc-agent`
3. Scope: `read:everything` (compliance evidence is read-only)
4. Store: `vault kv put secret/ecomsec/vanta api_token="..."`

#### Setup Steps — Drata (alternative)
1. **Drata → Settings → API Keys → Create API Key**
2. Permissions: Read access to controls, evidence, frameworks
3. Store: `vault kv put secret/ecomsec/drata api_key="..."`

#### Required Secrets
```
VANTA_API_TOKEN
DRATA_API_KEY
SERVICENOW_GRC_USER
SERVICENOW_GRC_PASS
SERVICENOW_GRC_INSTANCE
COMPLIANCE_FRAMEWORKS                    # comma-separated: "PCI-DSS,ISO-27001,GDPR,UAE-PDPL"
```

#### Behaviour
- **Polling:** 6-hour evidence collection cycle
- **Events published:** `compliance_control_failed`, `audit_evidence_missing`, `framework_drift`
- **Events subscribed:** `metrics_update` (correlates with control state)

#### Metrics Reported
- `compliance_percentage_per_framework`
- `open_findings`
- `audit_readiness_score`
- `controls_passing_count`
- `evidence_freshness` — average age in days

---

### 3.7 Chat Interface Agent

**Module:** `agents/chat-interface/` · **Port:** `8025` · **Category:** Integration · **Priority:** P1

#### Tool Integrations
| Platform | SDK / API | Documentation |
|----------|-----------|---------------|
| **Slack** | Bolt SDK + Socket Mode | https://api.slack.com/start/building/bolt-python |
| **Microsoft Teams** | Bot Framework + Graph API | https://learn.microsoft.com/en-us/microsoftteams/platform/bots/ |
| **Cisco Webex** | Webex REST API + Bot | https://developer.webex.com/docs/api/getting-started |
| **Google Chat** | Chat API + Webhook | https://developers.google.com/chat |

#### Setup Steps — Slack (full setup in `docs/installation/INSTALLATION.md` §6.1)
1. Create Slack app at https://api.slack.com/apps
2. Enable **Socket Mode**, generate App-Level Token (`xapp-...`)
3. **OAuth scopes:** `chat:write`, `commands`, `channels:read`, `im:write`
4. Generate Bot Token (`xoxb-...`)
5. Add slash commands per `docs/installation/INSTALLATION.md`
6. Create channels (`#sec-edr`, `#sec-siem`, etc.)
7. Store:
   ```bash
   vault kv put secret/ecomsec/slack \
     bot_token="xoxb-..." app_token="xapp-..." signing_secret="..."
   ```

#### Setup Steps — Microsoft Teams (full setup in `docs/installation/INSTALLATION.md` §6.2)
1. Register Azure AD app
2. Grant Graph API permissions: `ChannelMessage.Send`, `Channel.ReadBasic.All`
3. Create incoming webhooks per channel
4. Store:
   ```bash
   vault kv put secret/ecomsec/teams \
     tenant_id="..." client_id="..." client_secret="..." webhook_url="..."
   ```

#### Setup Steps — Webex (full setup in `docs/installation/INSTALLATION.md` §6.3)
1. Create Webex bot at https://developer.webex.com/my-apps
2. Copy Bot Access Token
3. Configure webhook for messages
4. Store: `vault kv put secret/ecomsec/webex access_token="..."`

#### Setup Steps — Google Chat (full setup in `docs/installation/INSTALLATION.md` §6.4)
1. GCP Console → New Project → Enable Google Chat API
2. Create service account, download JSON key
3. Configure bot in Google Chat → add slash commands
4. Store: `vault kv put secret/ecomsec/gchat service_account_json="..." webhook_url="..."`

#### Required Secrets
```
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
SLACK_SIGNING_SECRET
TEAMS_TENANT_ID
TEAMS_CLIENT_ID
TEAMS_CLIENT_SECRET
TEAMS_WEBHOOK_URL
WEBEX_ACCESS_TOKEN
GCHAT_SERVICE_ACCOUNT_JSON
GCHAT_WEBHOOK_URL
```

#### Behaviour
- **Event-driven:** Listens on Slack Socket Mode, Teams webhooks, Webex webhooks, Google Chat webhooks
- **Events published:** `human_command_issued`, `alert_acknowledged`, `setup_completed`, `playbook_requested`
- **Events subscribed:** **All agent events** — broadcasts critical/high alerts to relevant channels

#### Metrics Reported
- `messages_processed_24h`
- `commands_executed_24h`
- `alerts_dispatched`
- `setups_completed`
- `active_wizard_sessions`
- `platform_breakdown` — Slack/Teams/Webex/GChat usage

---

## Section 4 — E-Commerce Specific Agents

### 4.1 PCI DSS Segmentation Agent

**Module:** `agents/pci-dss-segmentation-agent/` · **Port:** `8020` · **Category:** E-Commerce · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Palo Alto NGFW** | PAN-OS API | https://docs.paloaltonetworks.com/pan-os/11-1/pan-os-panorama-api |
| **Fortinet FortiGate** | FortiOS API | https://docs.fortinet.com/document/fortigate/7.4.0/administration-guide/ |
| **AWS VPC Flow Logs** | CloudWatch Logs Insights | https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html |
| **Network monitoring (NetFlow)** | NetFlow v9 / IPFIX | RFC 7011 |

#### Setup Steps — Palo Alto NGFW
1. **Palo Alto admin web UI → Device → Admin Roles → Create**
   - Role: `ecomsec-readonly` (XML/REST API access, monitoring read)
2. **Device → Administrators → Add**
   - User: `ecomsec-pci-agent`
   - Role: `ecomsec-readonly`
3. Generate API key:
   ```bash
   curl -k "https://firewall/api/?type=keygen&user=ecomsec-pci-agent&password=..."
   ```
4. Store: `vault kv put secret/ecomsec/paloalto api_key="..." host="https://firewall.acme.com"`

#### Setup Steps — AWS VPC Flow Logs
1. Enable VPC Flow Logs to CloudWatch on all CDE-related VPCs
2. IAM role `ecomsec-pci-agent` with policy:
   ```json
   {
     "Effect": "Allow",
     "Action": ["logs:Get*", "logs:Describe*", "logs:Filter*", "logs:StartQuery", "logs:GetQueryResults"],
     "Resource": "arn:aws:logs:*:*:log-group:/aws/vpc/flow-logs*"
   }
   ```
3. Store: `vault kv put secret/ecomsec/aws_pci access_key="..." secret_key="..." region="me-central-1"`

#### Required Secrets
```
PALOALTO_API_KEY
PALOALTO_HOST
FORTINET_API_TOKEN                       # if using Fortinet
FORTINET_HOST
AWS_PCI_ACCESS_KEY
AWS_PCI_SECRET_KEY
AWS_PCI_REGION
CDE_SUBNETS                              # comma-separated: "10.10.0.0/24,10.10.1.0/24"
CDE_APPROVED_ASSETS                      # comma-separated IPs/hostnames
```

#### Behaviour
- **Polling:** 2-minute CDE boundary check
- **Webhook:** triggered on firewall rule change
- **Events published:** `pci_scope_violation`, `pci_firewall_violation`, `cde_asset_drift`
- **Events subscribed:** `new_asset_discovered`

#### Metrics Reported
- `cde_assets_in_scope`
- `scope_violations_24h`
- `firewall_rules_reviewed`
- `cross_segment_traffic_anomalies`
- `pci_requirement_coverage` — % of Req 1 controls passing

---

### 4.2 Fraud Detection Agent

**Module:** `agents/fraud-detection-agent/` · **Port:** `8021` · **Category:** E-Commerce · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Stripe Radar** | Stripe API | https://stripe.com/docs/radar |
| **Sift** | Events API | https://sift.com/developers/docs/curl/apis-overview |
| **Signifyd** | Cases API | https://developer.signifyd.com/api/ |
| **Riskified** | Decide API | https://developers.riskified.com/ |

#### Setup Steps — Stripe Radar
1. **Stripe Dashboard → Developers → API Keys**
2. Use restricted key with permissions: `Read access to Charges, PaymentIntents, Customers, Disputes, Reviews`
3. Store: `vault kv put secret/ecomsec/stripe api_key="rk_live_..." webhook_secret="whsec_..."`
4. Configure webhook endpoint: `https://fraud-agent.acme.com/stripe/webhook`

#### Setup Steps — Sift
1. **Sift console → Developer → API Keys**
2. Generate `Production API Key`
3. Store: `vault kv put secret/ecomsec/sift api_key="..." account_id="..."`

#### Required Secrets
```
STRIPE_API_KEY
STRIPE_WEBHOOK_SECRET
SIFT_API_KEY
SIFT_ACCOUNT_ID
SIGNIFYD_API_KEY
RISKIFIED_API_KEY
RISKIFIED_DOMAIN
FRAUD_BLOCK_THRESHOLD                    # default: 0.85
FRAUD_REVIEW_THRESHOLD                   # default: 0.60
FRAUD_STEPUP_THRESHOLD                   # default: 0.45
```

#### Behaviour
- **Polling:** 5-second transaction poll, 30-second login event poll
- **Webhook:** Stripe Radar webhooks for real-time decisions
- **Events published:** `fraud_transaction_blocked`, `fraud_transaction_flagged`, `ato_detected`, `fraud_step_up_required`
- **Events subscribed:** `new_ioc_ip`, `waf_bot_detected`, `iam_login_anomaly`

#### Metrics Reported
- `transactions_scored_24h`
- `blocked_count`, `flagged_count`, `step_up_triggered_count`
- `ato_attempts_detected`
- `fraud_rate_percentage`
- `false_positive_rate`
- `revenue_protected_estimate`

---

### 4.3 Third-Party Risk Agent

**Module:** `agents/third-party-risk-agent/` · **Port:** `8022` · **Category:** Governance · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **SecurityScorecard** | API v1 | https://platform-api.securityscorecard.io/api-docs |
| **BitSight** | API v1 | https://help.bitsight.com/hc/en-us/sections/360002708814-API-Documentation |
| **Socket.dev** | API v0 | https://docs.socket.dev/reference/introduction-to-socket-api |

#### Setup Steps — SecurityScorecard
1. **SecurityScorecard → My Account → API**
2. Generate token (read-only)
3. Store: `vault kv put secret/ecomsec/securityscorecard api_token="..."`

#### Setup Steps — BitSight (alternative)
1. **BitSight → Account → API Tokens → Create**
2. Store: `vault kv put secret/ecomsec/bitsight api_token="..."`

#### Required Secrets
```
SECURITYSCORECARD_API_TOKEN
BITSIGHT_API_TOKEN
SOCKET_DEV_API_KEY
VENDOR_LIST_PATH                         # path to vendors.yaml
VENDOR_SCORE_THRESHOLD                   # default: 70
```

#### Behaviour
- **Polling:** 1-hour vendor re-score
- **Events published:** `vendor_risk_alert`, `supply_chain_compromise`, `vendor_score_drop`
- **Events subscribed:** `new_vendor_added`

#### Metrics Reported
- `vendors_monitored`
- `by_risk_tier` — critical/high/medium/low counts
- `vendors_below_threshold`
- `supply_chain_alerts_24h`

---

### 4.4 Mobile App Security Agent

**Module:** `agents/mobile-app-security-agent/` · **Port:** `8023` · **Category:** AppSec · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **NowSecure** | Platform API | https://docs.nowsecure.com/auto/api/v1/ |
| **MobSF (open source)** | REST API v1 | https://mobsf.github.io/docs/#/rest_api |
| **Snyk Mobile** | REST API | https://docs.snyk.io/snyk-api |

#### Setup Steps — MobSF (recommended for cost)
1. Self-host MobSF on internal infrastructure
2. **MobSF web UI → API → API Key**
3. Store: `vault kv put secret/ecomsec/mobsf api_key="..." host="http://mobsf:8000"`

#### Setup Steps — NowSecure (commercial)
1. **NowSecure portal → Settings → API Tokens → Create**
2. Scope: `Submit + Read assessments`
3. Store: `vault kv put secret/ecomsec/nowsecure api_token="..."`

#### Required Secrets
```
MOBSF_API_KEY
MOBSF_HOST
NOWSECURE_API_TOKEN
SNYK_API_TOKEN                           # reused from SAST/DAST agent
APPSTORE_BUNDLE_IDS                      # comma-separated iOS bundle IDs
PLAYSTORE_PACKAGE_IDS                    # comma-separated Android packages
```

#### Behaviour
- **Triggered:** On new mobile build webhook from CI/CD (Bitrise, GitHub Actions, Fastlane)
- **Polling fallback:** 5-minute check for pending builds
- **Events published:** `mobile_build_blocked`, `mobile_build_warning`, `owasp_mobile_finding`
- **Events subscribed:** `new_mobile_build`

#### Metrics Reported
- `scans_completed_24h`
- `critical_findings`, `high_findings`
- `releases_blocked`
- `owasp_mobile_top10_coverage`
- `mean_scan_duration`

---

### 4.5 Data Residency Agent

**Module:** `agents/data-residency-agent/` · **Port:** `8024` · **Category:** Data · **Priority:** P1

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **AWS Config** | AWS SDK | https://docs.aws.amazon.com/config/latest/developerguide/ |
| **Azure Resource Graph** | Azure SDK | https://learn.microsoft.com/en-us/azure/governance/resource-graph/ |
| **Google Cloud Asset Inventory** | Cloud Asset API | https://cloud.google.com/asset-inventory/docs |

#### Setup Steps — AWS Config
1. Enable AWS Config in all UAE regions (`me-central-1`, `me-south-1`)
2. IAM Role `ecomsec-residency-agent`:
   ```json
   {
     "Effect": "Allow",
     "Action": ["config:Get*", "config:Describe*", "config:List*",
                "ec2:Describe*", "rds:Describe*", "s3:GetBucketLocation"],
     "Resource": "*"
   }
   ```
3. Store: `vault kv put secret/ecomsec/aws_residency access_key="..." secret_key="..."`

#### Setup Steps — Azure Resource Graph
1. **Azure → App registration** (reuse existing or create new)
2. Permissions: `Reader` role at subscription level
3. Store: `vault kv put secret/ecomsec/azure_residency tenant_id="..." client_id="..." client_secret="..." subscription_id="..."`

#### Required Secrets
```
AWS_RESIDENCY_ACCESS_KEY
AWS_RESIDENCY_SECRET_KEY
AZURE_RESIDENCY_TENANT_ID
AZURE_RESIDENCY_CLIENT_ID
AZURE_RESIDENCY_CLIENT_SECRET
AZURE_RESIDENCY_SUBSCRIPTION_ID
GCP_SERVICE_ACCOUNT_JSON
APPROVED_REGIONS                         # default: "me-central-1,me-south-1,uaenorth,uaecentral"
```

#### Behaviour
- **Polling:** 1-hour full audit
- **Real-time:** webhook on new resource creation
- **Events published:** `data_residency_violation`, `cross_border_transfer_detected`, `prohibited_region_resource`
- **Events subscribed:** `new_cloud_resource_created`

#### Metrics Reported
- `resources_checked`
- `residency_violations`
- `cross_border_transfers_blocked`
- `compliant_resources_percentage`
- `regulations_enforced` — list

---

### 4.6 CDN Security Agent

**Module:** `agents/cdn-security-agent/` · **Port:** `8026` · **Category:** Network · **Priority:** P2

#### Tool Integrations
| Vendor | API / SDK | Documentation |
|--------|-----------|---------------|
| **Cloudflare** | API v4 | https://developers.cloudflare.com/api/ |
| **Akamai** | OPEN APIs | https://techdocs.akamai.com/ |
| **AWS CloudFront** | AWS SDK | https://docs.aws.amazon.com/cloudfront/latest/APIReference/ |
| **Fastly** | API v1 | https://developer.fastly.com/reference/ |

#### Setup Steps — Cloudflare CDN
Reuse the Cloudflare API token from the WAF agent (Section 2.9) — same scopes apply.

Add additional permission to the token:
- `Zone → SSL and Certificates → Read`
- `Zone → Cache Purge → Edit` (for cache poisoning mitigation)

#### Setup Steps — Akamai (alternative)
1. **Akamai Control Center → Identity & Access → API users → Create**
2. Authorize APIs: `CDN Data → Read`, `Property Manager → Read`
3. Download `.edgerc` file with credentials
4. Store: `vault kv put secret/ecomsec/akamai client_token="..." client_secret="..." access_token="..." host="..."`

#### Required Secrets
```
CLOUDFLARE_CDN_TOKEN                     # reuses CLOUDFLARE_WAF_TOKEN
CLOUDFLARE_ZONE_IDS
AKAMAI_CLIENT_TOKEN
AKAMAI_CLIENT_SECRET
AKAMAI_ACCESS_TOKEN
AKAMAI_HOST
AWS_CLOUDFRONT_ACCESS_KEY
AWS_CLOUDFRONT_SECRET_KEY
CDN_MONITORED_DOMAINS                    # comma-separated
```

#### Behaviour
- **Polling:** 30-minute CDN configuration audit
- **Events published:** `cdn_misconfiguration`, `cache_poisoning_attempt`, `origin_exposure`, `weak_tls_detected`
- **Events subscribed:** `waf_rule_updated`, `new_domain_added`

#### Metrics Reported
- `domains_monitored`
- `misconfigs_found`
- `headers_missing_count`
- `cache_poisoning_attempts_24h`
- `origin_exposures`
- `security_score` — overall CDN hardening score

---

## Section 5 — Paperclip Event Bus

All inter-agent communication is asynchronous via the Paperclip event bus. Events are typed, versioned, and delivered with at-least-once semantics.

### Event Schema (every event)
```json
{
  "source_agent":  "edr-agent",
  "event_type":    "critical_endpoint_alert",
  "timestamp":     "2025-05-03T10:00:00Z",
  "version":       "1.0",
  "payload":       { /* event-specific */ }
}
```

### Full Event Catalogue

| Event Type | Source Agent | Subscribers / Purpose |
|------------|--------------|----------------------|
| `critical_endpoint_alert` | EDR | SIEM, IR Agent, Chat Interface |
| `endpoint_isolated` | EDR | SIEM, Risk Dashboard |
| `phishing_detected` | Email Security | SIEM, Brand Protection, IR Agent |
| `bec_attempt_blocked` | Email Security | SIEM, Risk Dashboard |
| `dns_c2_callback` | DNS Security | SIEM, EDR, Threat Intel |
| `dns_tunneling_detected` | DNS Security | SIEM, IR Agent |
| `malicious_domain_blocked` | DNS Security | SIEM, Risk Dashboard |
| `new_asset_discovered` | Asset Mgmt | Vulnerability, EDR, PCI Segmentation, Cloud Security |
| `shadow_it_detected` | Asset Mgmt | SIEM, Compliance/GRC |
| `siem_critical_alert` | SIEM | IR Agent, Chat Interface, Risk Dashboard |
| `correlation_hit` | SIEM | IR Agent |
| `trigger_incident_response` | SIEM / Chat | IR Agent |
| `proxy_block_event` | Web Proxy | SIEM, Risk Dashboard |
| `data_exfil_attempt` | Web Proxy | DLP, IR Agent |
| `dlp_policy_match` | DLP | SIEM, Web Proxy, IR Agent |
| `pii_exfil_attempt` | DLP | IR Agent, Compliance/GRC |
| `payment_data_exposed` | DLP | PCI Segmentation, IR Agent |
| `api_abuse_detected` | API Gateway | WAF, SIEM, Risk Dashboard |
| `auth_failure_spike` | API Gateway | IAM/PAM, Fraud Detection |
| `waf_attack_detected` | WAF + Bot | SIEM, IR Agent, Chat Interface |
| `bot_traffic_spike` | WAF + Bot | Fraud Detection, SIEM |
| `ddos_mitigated` | WAF + Bot | Risk Dashboard |
| `sast_critical_finding` | SAST/DAST | Vulnerability, Risk Dashboard |
| `dependency_vuln_found` | SAST/DAST | Vulnerability, Third-Party Risk |
| `release_blocked` | SAST/DAST | Chat Interface |
| `lookalike_domain_detected` | Brand Protection | DNS Security, Email Security |
| `brand_abuse_found` | Brand Protection | Risk Dashboard |
| `dark_web_mention` | Brand Protection | Threat Intel, Risk Dashboard |
| `critical_cve_found` | Vulnerability | Risk Dashboard, Patch Mgmt |
| `patch_sla_breach` | Vulnerability | Compliance/GRC, Chat Interface |
| `report_generated` | Risk Dashboard | Chat Interface (delivers PDF) |
| `posture_score_updated` | Risk Dashboard | (none — informational) |
| `iam_login_anomaly` | IAM/PAM | Fraud Detection, SIEM |
| `privileged_session_started` | IAM/PAM | SIEM, Risk Dashboard |
| `mfa_disabled_alert` | IAM/PAM | SIEM, IR Agent |
| `orphaned_account_detected` | IAM/PAM | Compliance/GRC |
| `cloud_misconfiguration` | Cloud Security | SIEM, Risk Dashboard |
| `public_s3_bucket` | Cloud Security | DLP, IR Agent |
| `iam_overpermissive` | Cloud Security | IAM/PAM, Compliance/GRC |
| `incident_created` | IR Agent | Risk Dashboard |
| `playbook_executed` | IR Agent | SIEM, Risk Dashboard |
| `incident_resolved` | IR Agent | Risk Dashboard |
| `threat_intel_ioc` | Threat Intel | DNS, WAF, EDR, Email |
| `new_ttp_observed` | Threat Intel | SIEM |
| `backup_failed` | Backup & Recovery | IR Agent, Risk Dashboard |
| `recovery_drill_completed` | Backup & Recovery | Compliance/GRC |
| `rto_breach` | Backup & Recovery | Risk Dashboard, Chat Interface |
| `compliance_control_failed` | Compliance/GRC | Risk Dashboard, Chat Interface |
| `audit_evidence_missing` | Compliance/GRC | Chat Interface |
| `pci_scope_violation` | PCI Segmentation | SIEM, Compliance/GRC, Chat Interface |
| `pci_firewall_violation` | PCI Segmentation | SIEM, IR Agent |
| `cde_asset_drift` | PCI Segmentation | Asset Mgmt, Compliance/GRC |
| `fraud_transaction_blocked` | Fraud Detection | SIEM, Chat Interface |
| `fraud_transaction_flagged` | Fraud Detection | SIEM, Risk Dashboard |
| `ato_detected` | Fraud Detection | IAM/PAM, SIEM, Chat Interface |
| `fraud_step_up_required` | Fraud Detection | IAM/PAM |
| `vendor_risk_alert` | Third-Party Risk | Risk Dashboard, Compliance/GRC |
| `supply_chain_compromise` | Third-Party Risk | SIEM, IR Agent |
| `mobile_build_blocked` | Mobile App Security | SAST/DAST, Risk Dashboard |
| `owasp_mobile_finding` | Mobile App Security | Vulnerability, Risk Dashboard |
| `data_residency_violation` | Data Residency | Compliance/GRC, Risk Dashboard |
| `cross_border_transfer_detected` | Data Residency | DLP, Compliance/GRC |
| `cdn_misconfiguration` | CDN Security | WAF Bot, Risk Dashboard |
| `cache_poisoning_attempt` | CDN Security | WAF Bot, IR Agent |
| `origin_exposure` | CDN Security | IR Agent, Risk Dashboard |
| `human_command_issued` | Chat Interface | (audit trail) |
| `alert_acknowledged` | Chat Interface | SIEM, Risk Dashboard |
| `setup_completed` | Chat Interface | (audit trail) |
| `block_indicator` | Chat Interface | DNS, WAF, Web Proxy (broadcast block) |
| `isolate_endpoint` | Chat Interface / SIEM | EDR Agent |
| `generate_report` | Chat Interface / Scheduler | Risk Dashboard |
| `run_playbook` | Chat Interface / SIEM | IR Agent |
| `metrics_update` | All agents | Risk Dashboard (continuous) |

---

## Section 6 — Database Schema

PostgreSQL is used as the primary datastore for agent metrics, alert history, and report data.

### Tables

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `agents` | `agent_id` (varchar) | Agent registry — status, port, last_seen, version |
| `agent_metrics` | `id` (uuid) | Time-series metrics per agent — JSON payload + timestamp |
| `alerts` | `alert_id` (uuid) | All alerts with severity, status, source_agent, acknowledged_by |
| `events` | `event_id` (uuid) | Full event bus audit log — immutable append-only |
| `posture_scores` | `id` (uuid) | Daily security posture score snapshots for trend analysis |
| `reports` | `report_id` (uuid) | Generated reports — type, period, file_path, delivered_to |
| `chat_commands` | `id` (uuid) | Audit log of all human chat commands — user, platform, action |
| `wizard_sessions` | `user_id` (varchar) | Active setup wizard state — agent_id, current_step |
| `compliance_evidence` | `id` (uuid) | Evidence collected for audit per framework + control |
| `vendor_scores` | `id` (uuid) | Third-party vendor security score history |

### Key Indexes
- `agent_metrics(agent_id, collected_at DESC)`
- `alerts(severity, status, source_agent)`
- `events(event_type, timestamp DESC)`
- `posture_scores(snapshot_date)`

---

## Section 7 — Infrastructure & Ports

### Container Architecture
- Each agent runs as an independent Docker container
- Kubernetes deployment for production — one Deployment per agent
- Resource limits: 256 MB RAM, 0.5 CPU per agent (minimum)
- Persistent volumes only for Postgres and Redis — all agents are stateless
- Network Policy: agents can only communicate via Paperclip event bus ports

### Minimum Infrastructure Sizing

| Environment | Compute | Memory | Storage |
|-------------|---------|--------|---------|
| Development | 4 vCPU | 16 GB RAM | 100 GB SSD |
| Staging | 8 vCPU | 32 GB RAM | 250 GB SSD |
| Production (Cloud) | 16 vCPU (auto-scale) | 64 GB RAM | 500 GB SSD + S3 for reports |

### Port Reference

| Port Range | Service |
|------------|---------|
| 8001 – 8004 | EDR · Email Security · DNS · Asset Management |
| 8005 – 8009 | SIEM · Web Proxy · DLP · API Gateway · WAF Bot |
| 8010 – 8013 | SAST/DAST · Brand Protection · Vulnerability · Risk Dashboard |
| 8014 – 8019 | IAM/PAM · Cloud Security · IR · Threat Intel · Backup · Compliance/GRC |
| 8020 – 8024 | PCI DSS · Fraud · 3rd Party Risk · Mobile App Security · Data Residency |
| 8025 – 8026 | Chat Interface · CDN Security |
| **9000** | **Paperclip Orchestrator (exposed)** |
| 6379 | Redis (internal only) |
| 5432 | PostgreSQL (internal only) |
| **3000** | **SPOG Dashboard (exposed)** |

---

## Cross-References

| For This Information | See |
|---------------------|-----|
| Architectural overview | `docs/hld/EcomSec-HLD-v2.0.md` |
| Step-by-step installation | `docs/installation/INSTALLATION.md` |
| Phased deployment plan | `docs/deployment-phases/PHASED-DEPLOYMENT.md` |
| Chat platform setup | `docs/installation/INSTALLATION.md` §6 |
| CI/CD pipeline | `.github/workflows/agent-ci.yml` |
| Paperclip registry | `orchestration/paperclip-config/agent-registry.yaml` |

---

*EcomSec LLD v2.0 · Author: Alvin, Security Architect · CONFIDENTIAL*
