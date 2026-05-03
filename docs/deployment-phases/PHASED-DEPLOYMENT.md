# EcomSec — Phased Deployment Plan

> **Author:** Alvin, Security Architect  
> **Purpose:** Budget-conscious deployment roadmap for a medium e-commerce startup  
> **Total Timeline:** 12–14 months across 4 phases  

---

## Deployment Philosophy

Each phase is independently valuable and does not require the next phase to deliver security ROI.  
Phases are sequenced to address the highest-risk controls first.

```
Phase 1 (Months 1-3)  → Core visibility + endpoint + email + DNS
Phase 2 (Months 4-6)  → Application + data + e-commerce specific
Phase 3 (Months 7-10) → Identity + cloud + automated response
Phase 4 (Months 11-14)→ Governance + compliance + resilience
```

---

## Phase 1 — Core Visibility & Critical Controls

**Timeline:** Months 1–3  
**Budget (Cloud-First):** AED 180,000–280,000 / year  
**Security Coverage Achieved:** ~55% of total platform  

### Agents Deployed (8)

| Agent | Tool Options | Est. Annual Cost (AED) | Value Delivered |
|-------|-------------|----------------------|-----------------|
| EDR Agent | CrowdStrike Go (50 endpoints) | 45,000–65,000 | Endpoint threat detection + auto-response |
| Email Security Agent | MS Defender for O365 P1 | 18,000–28,000 | Phishing + BEC prevention |
| DNS Security Agent | Cloudflare Gateway (free tier) | 0–12,000 | C2 blocking, malicious domain filtering |
| Asset Management Agent | Axonius (startup tier) OR CMDB module | 20,000–35,000 | Full asset inventory + shadow IT |
| SIEM Agent | Microsoft Sentinel (PAYG) | 25,000–45,000 | Log correlation + alerting |
| Vulnerability Agent | Tenable.io Essentials | 22,000–35,000 | Continuous CVE scanning |
| Risk Dashboard Agent | Paperclip BI (built-in) | 0 (included) | SPOG dashboard + reports |
| Chat Interface Agent | Slack (existing) or Teams | 0–8,000 | Human-agent chat for all above |

**Phase 1 Milestones:**
- [ ] All Phase 1 agents running and registered with Paperclip
- [ ] SPOG dashboard live with Phase 1 widget data
- [ ] Slack/Teams channels configured for all 8 agents
- [ ] First monthly security report generated
- [ ] Agent setup wizards completed for all Phase 1 agents
- [ ] CI/CD pipeline active — all code changes scanned before deploy

**Phase 1 Security Controls Active:**
- Endpoint threat detection and auto-isolation
- Email phishing and BEC prevention
- DNS-level malware blocking and C2 callback prevention
- Full asset inventory with shadow IT alerts
- Security event correlation and alerting (SIEM)
- Vulnerability scanning with patch SLA tracking
- Real-time SPOG dashboard for business and technical audiences
- Human-in-the-loop chat commands on Slack/Teams

---

## Phase 2 — Application Protection & E-Commerce Controls

**Timeline:** Months 4–6  
**Budget (Cloud-First):** AED 220,000–350,000 / year (cumulative with Phase 1)  
**Additional Security Coverage:** ~25% incremental  

### Agents Deployed (7)

| Agent | Tool Options | Est. Annual Cost (AED) | Value Delivered |
|-------|-------------|----------------------|-----------------|
| WAF + Bot Agent | Cloudflare Pro/Business | 18,000–30,000 | OWASP Top 10 blocking, bot management |
| API Gateway Agent | Kong OSS (free) + AWS API GW | 8,000–20,000 | API authentication, rate limiting, anomaly detection |
| DLP Agent | Microsoft Purview (E3) | 25,000–40,000 | Data classification, exfiltration prevention |
| Web Proxy Agent | Zscaler ZIA Essentials | 30,000–50,000 | SSL inspection, URL filtering |
| SAST/DAST Agent | Snyk (startup plan) + OWASP ZAP | 15,000–28,000 | Code scanning in CI/CD pipeline |
| PCI DSS Segmentation Agent | Custom + Firewall API | 10,000–20,000 | CDE isolation, PCI DSS Req 1 compliance |
| Fraud Detection Agent | Stripe Radar (built-in) + Sift | 12,000–25,000 | Transaction fraud, ATO prevention |

**Phase 2 Milestones:**
- [ ] WAF blocking OWASP Top 10 attacks in production
- [ ] API Gateway enforcing auth + rate limits on all endpoints
- [ ] DLP policies active for customer PII and payment data
- [ ] SAST/DAST integrated into CI/CD pipeline — blocking on Critical CVEs
- [ ] CDE subnets defined and monitored by PCI agent
- [ ] Fraud detection active for all checkout transactions
- [ ] PCI DSS gap assessment completed (Requirement 1, 6, 11)

**Phase 2 Security Controls Active (in addition to Phase 1):**
- Web application firewall with bot scoring
- API security with anomaly detection
- Data loss prevention across email, web, and cloud
- Secure software development lifecycle (SSDLC)
- PCI DSS network segmentation monitoring
- Real-time transaction fraud scoring and ATO detection

---

## Phase 3 — Identity, Cloud & Automated Response

**Timeline:** Months 7–10  
**Budget (Cloud-First):** AED 280,000–420,000 / year (cumulative)  
**Additional Security Coverage:** ~12% incremental — closes critical gaps  

### Agents Deployed (5)

| Agent | Tool Options | Est. Annual Cost (AED) | Value Delivered |
|-------|-------------|----------------------|-----------------|
| IAM/PAM Agent | Okta Workforce (startup) + CyberArk | 40,000–70,000 | SSO, MFA, privileged access control |
| Cloud Security Agent | Wiz (startup plan) OR Prisma Cloud | 35,000–60,000 | Cloud misconfiguration detection |
| Incident Response Agent | TheHive (OSS) + PagerDuty | 15,000–28,000 | Automated playbooks, MTTR reduction |
| Threat Intelligence Agent | MISP (OSS) + VirusTotal API | 8,000–18,000 | IOC enrichment, MITRE ATT&CK correlation |
| Brand Protection Agent | ZeroFox Startup | 20,000–35,000 | Lookalike domains, dark web monitoring |

**Phase 3 Milestones:**
- [ ] SSO enforced for all internal systems (IAM)
- [ ] MFA adoption rate > 95% tracked by IAM agent
- [ ] Cloud misconfiguration baseline scan complete
- [ ] First IR playbook automated (credential stuffing response)
- [ ] Threat intel feeds active and enriching SIEM alerts
- [ ] Brand protection monitoring live for primary domain

**Phase 3 Security Controls Active (in addition to Phase 1+2):**
- Single Sign-On (SSO) with MFA enforcement across all applications
- Privileged access session recording and vault (PAM)
- Cloud security posture management — misconfig detection
- Automated incident response with playbook execution
- Live threat intelligence enrichment of all SIEM alerts
- Brand and domain impersonation monitoring

---

## Phase 4 — Governance, Compliance & Resilience

**Timeline:** Months 11–14  
**Budget (Cloud-First):** AED 180,000–260,000 / year (cumulative)  
**Outcome:** Audit-ready, fully compliant, resilient platform  

### Agents Deployed (6)

| Agent | Tool Options | Est. Annual Cost (AED) | Value Delivered |
|-------|-------------|----------------------|-----------------|
| Compliance/GRC Agent | Vanta (startup) OR Drata | 25,000–45,000 | ISO 27001, PCI DSS, GDPR evidence collection |
| Backup & Recovery Agent | Veeam + AWS Backup | 18,000–30,000 | Ransomware recovery, RTO/RPO compliance |
| Third-Party Risk Agent | SecurityScorecard | 20,000–35,000 | Vendor risk scoring, supply chain monitoring |
| Mobile App Security Agent | NowSecure OR MobSF (OSS) | 12,000–22,000 | Mobile app SAST/DAST, runtime protection |
| Data Residency Agent | Custom (cloud-native) | 8,000–15,000 | UAE PDPL/DIFC data locality enforcement |
| CDN Security Agent | Cloudflare (existing) extension | 5,000–12,000 | Cache poisoning prevention, origin protection |

**Phase 4 Milestones:**
- [ ] ISO 27001 readiness score > 80%
- [ ] PCI DSS self-assessment questionnaire (SAQ) completed
- [ ] Backup recovery drill completed successfully
- [ ] All third-party vendors scored
- [ ] Mobile app security testing integrated into app release pipeline
- [ ] Data residency controls active for UAE customer data
- [ ] First quarterly business report delivered to board

---

## Full Platform Cost Summary

| Phase | Agents Added | Cumulative Agents | Est. Annual Cost (AED) |
|-------|-------------|------------------|----------------------|
| Phase 1 | 8 | 8 | 180,000–280,000 |
| Phase 2 | 7 | 15 | 220,000–350,000 |
| Phase 3 | 5 | 20 | 280,000–420,000 |
| Phase 4 | 6 | 26 | 180,000–260,000 |
| **Full Platform** | **26** | **26** | **AED 860K–1.31M/yr** |

> **Note:** Costs are cloud-first estimates including SaaS licensing, cloud compute, and agent infrastructure.  
> On-premises deployments eliminate SaaS costs but add hardware CAPEX (~AED 300–500K one-time).  
> Many tools have startup/SMB tiers 40-60% below enterprise pricing — negotiate aggressively.

---

## Budget Optimisation Tips

1. **Prioritise open-source tools** — MISP, TheHive, OWASP ZAP, MobSF, Kong OSS are free and enterprise-grade.
2. **Cloudflare consolidation** — One Cloudflare Business subscription covers WAF, Bot, DNS, and CDN agents.
3. **Microsoft E3/E5 bundles** — Defender, Purview (DLP), and Sentinel are dramatically cheaper bundled.
4. **Startup programmes** — CrowdStrike, Okta, Wiz, and Snyk all offer 50-90% startup discounts.
5. **Phase 1 first, procure Phase 2 at end of Phase 1** — Demonstrates ROI before budget commitments.
6. **Chat Interface Agent is free** — Slack/Teams are likely already licensed. Zero additional cost.

---

*EcomSec Phased Deployment Plan v1.0 | Author: Alvin, Security Architect*
