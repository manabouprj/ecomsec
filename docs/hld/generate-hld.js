const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak, Header, Footer, TabStopType,
  TabStopPosition, LevelFormat
} = require('docx');
const fs = require('fs');

const BRAND_BLUE = "1E3A5F";
const ACCENT_CYAN = "0891B2";
const LIGHT_BLUE = "DBEAFE";
const LIGHT_GREY = "F1F5F9";
const MID_GREY = "94A3B8";
const WHITE = "FFFFFF";
const RED = "DC2626";
const AMBER = "D97706";
const GREEN = "16A34A";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_CYAN, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND_BLUE, font: "Arial" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND_BLUE, font: "Arial" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, color: ACCENT_CYAN, font: "Arial" })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 20, font: "Arial", ...opts })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, font: "Arial" })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun("")] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function headerRow(cells, widths) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((text, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: WHITE, font: "Arial" })]
      })]
    }))
  });
}

function dataRow(cells, widths, shade = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: { fill: shade ? LIGHT_GREY : WHITE, type: ShadingType.CLEAR },
      children: [new Paragraph({
        children: [new TextRun({ text: String(text), size: 18, font: "Arial" })]
      })]
    }))
  });
}

function coloredDataRow(cells, widths, cellColors) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: { fill: cellColors[i] || WHITE, type: ShadingType.CLEAR },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(text), size: 18, font: "Arial", bold: i === 0 })]
      })]
    }))
  });
}

const agents = [
  ["EDR Agent", "Endpoint", "P1", "Required", "CrowdStrike / SentinelOne"],
  ["Email Security Agent", "Communication", "P1", "Required", "MS Defender / Proofpoint"],
  ["DNS Security Agent", "Network", "P1", "Required", "Cisco Umbrella / Cloudflare"],
  ["Asset Management Agent", "Governance", "P1", "Required", "Axonius / ServiceNow"],
  ["SIEM Agent", "Detection", "P1", "Required", "Splunk / MS Sentinel"],
  ["Web Proxy Agent", "Network", "P2", "Required", "Zscaler"],
  ["DLP Agent", "Data", "P1", "Required", "MS Purview / Nightfall AI"],
  ["API Gateway Agent", "Application", "P1", "Required", "Kong / AWS API GW"],
  ["WAF + Bot Agent", "Application", "P1", "Required", "Cloudflare / Imperva"],
  ["SAST/DAST Agent", "AppSec", "P1", "Required", "Checkmarx / Snyk / OWASP ZAP"],
  ["Brand Protection Agent", "Threat Intel", "P2", "Required", "Recorded Future / ZeroFox"],
  ["Vulnerability Agent", "Governance", "P1", "Required", "Tenable / Qualys"],
  ["Risk Dashboard Agent", "Governance", "P1", "Required", "Paperclip BI"],
  ["IAM/PAM Agent", "Identity", "P1", "Recommended", "Okta / CyberArk"],
  ["Cloud Security Agent", "Cloud", "P1", "Recommended", "Wiz / Prisma Cloud"],
  ["Incident Response Agent", "Detection", "P1", "Recommended", "TheHive / PagerDuty"],
  ["Threat Intel Agent", "Threat Intel", "P2", "Recommended", "MISP / VirusTotal"],
  ["Backup & Recovery Agent", "Resilience", "P2", "Recommended", "Veeam / AWS Backup"],
  ["Compliance/GRC Agent", "Governance", "P2", "Recommended", "Vanta / Drata"],
  ["PCI DSS Segmentation Agent", "E-Commerce", "P1", "E-Com Specific", "Custom / Network API"],
  ["Fraud Detection Agent", "E-Commerce", "P1", "E-Com Specific", "Stripe Radar / Sift"],
  ["Third-Party Risk Agent", "Governance", "P2", "E-Com Specific", "SecurityScorecard"],
  ["Mobile App Security Agent", "AppSec", "P2", "E-Com Specific", "NowSecure / MobSF"],
  ["Data Residency Agent", "Data", "P1", "E-Com Specific", "Custom / Cloud Native"],
  ["CDN Security Agent", "Network", "P2", "E-Com Specific", "Cloudflare / Akamai"],
  ["Chat Interface Agent", "Integration", "P1", "Required", "Slack / Teams / Webex"],
];

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_CYAN, space: 4 } },
          children: [
            new TextRun({ text: "EcomSec Platform  |  High Level Design (HLD)  |  CONFIDENTIAL", size: 16, color: MID_GREY, font: "Arial" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_CYAN, space: 4 } },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "Alvin · Security Architect · v1.0", size: 16, color: MID_GREY, font: "Arial" }),
            new TextRun({ text: "\tPage ", size: 16, color: MID_GREY, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MID_GREY, font: "Arial" }),
            new TextRun({ text: " of ", size: 16, color: MID_GREY, font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MID_GREY, font: "Arial" }),
          ]
        })]
      })
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────
      new Paragraph({ spacing: { before: 2000 }, children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "EcomSec", size: 72, bold: true, color: BRAND_BLUE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: "AI-Powered Security Agent Platform", size: 36, color: ACCENT_CYAN, font: "Arial" })]
      }),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_CYAN },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_CYAN }
        },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "HIGH LEVEL DESIGN (HLD)", size: 32, bold: true, color: BRAND_BLUE, font: "Arial" })]
      }),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Author: Alvin | Security Architect", size: 22, color: MID_GREY, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Version: 1.0 | Classification: CONFIDENTIAL", size: 20, color: MID_GREY, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-GB', {year:'numeric',month:'long',day:'numeric'})}`, size: 20, color: MID_GREY, font: "Arial" })]
      }),
      pageBreak(),

      // ── 1. EXECUTIVE SUMMARY ──────────────────────────────────────
      h1("1. Executive Summary"),
      body("EcomSec is a fully autonomous, AI-agent-driven security platform designed for a medium-scale e-commerce organisation. It delivers comprehensive security coverage across 14 security domains through 26 specialised AI agents, orchestrated by the Paperclip platform, and unified under a Single Pane of Glass (SPOG) dashboard accessible to both technical and business stakeholders."),
      spacer(),
      body("The platform is designed with four foundational principles:", { bold: true }),
      bullet("Autonomous Operation — Agents run continuously, detect threats, and respond without requiring human intervention for routine events."),
      bullet("Human-in-the-Loop — Critical decisions (endpoint isolation, policy changes, report approval) require human confirmation via Slack, Microsoft Teams, Webex, or Google Chat."),
      bullet("Phased Deployment — The platform is structured across 4 deployment phases to accommodate budget constraints, delivering immediate value from Phase 1 onwards."),
      bullet("Compliance-by-Design — Every agent maps to regulatory frameworks including PCI DSS v4.0, ISO 27001:2022, NIST CSF 2.0, UAE PDPL, DIFC, and ADGM regulations."),
      spacer(),

      // ── 2. ARCHITECTURE OVERVIEW ──────────────────────────────────
      h1("2. Architecture Overview"),
      h2("2.1 Layered Architecture"),
      body("The platform is organised into five horizontal layers:"),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 7160],
        rows: [
          headerRow(["Layer", "Description"], [2200, 7160]),
          dataRow(["Layer 5 — Reporting", "SPOG dashboard delivering monthly technical and quarterly business reports with AI-generated insights for both technical and executive audiences."], [2200, 7160], false),
          dataRow(["Layer 4 — Human Interface", "Chat-based human-agent interaction via Slack, Microsoft Teams, Webex, and Google Chat. Each agent has a dedicated channel with slash commands, interactive buttons, and setup wizards."], [2200, 7160], true),
          dataRow(["Layer 3 — Orchestration", "Paperclip orchestration layer managing agent registration, health monitoring, inter-agent event bus, secrets injection, and versioning."], [2200, 7160], false),
          dataRow(["Layer 2 — Agent Mesh", "26 specialised AI agents communicating asynchronously. Each agent is independently deployable, versioned, and CI/CD gated."], [2200, 7160], true),
          dataRow(["Layer 1 — Tool Integration", "External security tool APIs (CrowdStrike, Splunk, Cloudflare, Okta, etc.) providing the raw data and enforcement capabilities consumed by agents."], [2200, 7160], false),
        ]
      }),
      spacer(),

      h2("2.2 Agent Categories"),
      body("The 26 agents are organised into 12 security domains:"),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 2400, 4960],
        rows: [
          headerRow(["Domain", "Agents", "Primary Function"], [2000, 2400, 4960]),
          dataRow(["Endpoint", "EDR", "Detect and respond to endpoint threats"], [2000, 2400, 4960], false),
          dataRow(["Network", "DNS, Web Proxy, CDN Security", "Control and monitor network traffic"], [2000, 2400, 4960], true),
          dataRow(["Application", "WAF+Bot, API Gateway, SAST/DAST, Mobile", "Protect web and API attack surfaces"], [2000, 2400, 4960], false),
          dataRow(["Identity", "IAM/PAM", "Manage access and privileged sessions"], [2000, 2400, 4960], true),
          dataRow(["Data", "DLP, Data Residency", "Prevent data loss and enforce locality"], [2000, 2400, 4960], false),
          dataRow(["Detection", "SIEM, Incident Response", "Correlate events and orchestrate response"], [2000, 2400, 4960], true),
          dataRow(["Threat Intel", "Threat Intel, Brand Protection", "Provide context and protect brand"], [2000, 2400, 4960], false),
          dataRow(["Governance", "Asset Mgmt, Vulnerability, Compliance/GRC, Risk Dashboard", "Risk management and compliance"], [2000, 2400, 4960], true),
          dataRow(["Cloud", "CSPM", "Cloud posture and misconfiguration detection"], [2000, 2400, 4960], false),
          dataRow(["E-Commerce", "Fraud Detection, PCI DSS Segmentation, Third-Party Risk", "E-commerce specific controls"], [2000, 2400, 4960], true),
          dataRow(["Resilience", "Backup & Recovery", "Business continuity and ransomware recovery"], [2000, 2400, 4960], false),
          dataRow(["Integration", "Chat Interface", "Human-agent communication across platforms"], [2000, 2400, 4960], true),
        ]
      }),
      spacer(),

      h2("2.3 Data Flow"),
      body("Security events flow through the platform in four stages:"),
      bullet("Collect — Agents continuously poll or receive webhooks from integrated security tools."),
      bullet("Detect — AI-powered analysis identifies threats, anomalies, and policy violations."),
      bullet("Respond — Automated responses (block, isolate, alert) are executed. Critical actions require human approval via chat."),
      bullet("Report — Metrics aggregate to the Risk Dashboard Agent, populating the SPOG dashboard and generating scheduled reports."),
      spacer(),

      // ── 3. HUMAN-AGENT CHAT INTERFACE ─────────────────────────────
      h1("3. Human-Agent Chat Interface"),
      h2("3.1 Design Principles"),
      body("Every security agent exposes a conversational interface allowing operators to query status, issue instructions, and receive alerts without requiring direct server or dashboard access. This design enables SOC analysts, engineers, and management to interact with the security platform from within their existing communication tools."),
      spacer(),
      h2("3.2 Supported Platforms"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 2600, 4560],
        rows: [
          headerRow(["Platform", "Integration Method", "Capabilities"], [2200, 2600, 4560]),
          dataRow(["Slack", "Bolt SDK + Socket Mode", "Block Kit cards, slash commands, interactive buttons, file sharing, setup wizard"], [2200, 2600, 4560], false),
          dataRow(["Microsoft Teams", "Bot Framework + Graph API", "Adaptive Cards, action buttons, approval flows, channel messaging"], [2200, 2600, 4560], true),
          dataRow(["Cisco Webex", "Webex REST API", "Markdown messages, cards, bot interactions, room management"], [2200, 2600, 4560], false),
          dataRow(["Google Chat", "Chat API + Webhooks", "Card messages, widget interactions, space management"], [2200, 2600, 4560], true),
        ]
      }),
      spacer(),
      h2("3.3 Channel Mapping"),
      body("Each agent is assigned a dedicated channel. Alerts, status updates, and human commands are routed through the correct channel automatically by the Chat Interface Agent."),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 3160, 4000],
        rows: [
          headerRow(["Channel", "Mapped Agent", "Primary Use"], [2200, 3160, 4000]),
          dataRow(["#sec-edr", "EDR Agent", "Endpoint alerts, isolation commands"], [2200, 3160, 4000], false),
          dataRow(["#sec-siem", "SIEM Agent", "Correlation alerts, threat hunting queries"], [2200, 3160, 4000], true),
          dataRow(["#sec-fraud", "Fraud Detection Agent", "Transaction blocks, ATO alerts, risk scores"], [2200, 3160, 4000], false),
          dataRow(["#sec-vuln", "Vulnerability Agent", "CVE alerts, patch SLA tracking"], [2200, 3160, 4000], true),
          dataRow(["#sec-ir", "Incident Response Agent", "Active incidents, playbook execution"], [2200, 3160, 4000], false),
          dataRow(["#sec-pci", "PCI DSS Segmentation Agent", "CDE violations, firewall audit alerts"], [2200, 3160, 4000], true),
          dataRow(["#sec-all", "All Agents (Broadcast)", "Platform-wide announcements and critical alerts"], [2200, 3160, 4000], false),
          dataRow(["#sec-dashboard", "Risk Dashboard Agent", "Report requests, posture score queries"], [2200, 3160, 4000], true),
        ]
      }),
      spacer(),
      h2("3.4 Supported Commands"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 6560],
        rows: [
          headerRow(["Command", "Description"], [2800, 6560]),
          dataRow(["/status [agent-id]", "Returns live health check and current metrics for the specified agent"], [2800, 6560], false),
          dataRow(["/alert list", "Lists all active alerts for the agent associated with the current channel"], [2800, 6560], true),
          dataRow(["/alert acknowledge <id>", "Acknowledges an alert and records the operator name and timestamp"], [2800, 6560], false),
          dataRow(["/isolate <hostname>", "Sends endpoint isolation command to EDR Agent (EDR channel only)"], [2800, 6560], true),
          dataRow(["/block <ip|domain>", "Broadcasts a block request across DNS, WAF, and Web Proxy agents simultaneously"], [2800, 6560], false),
          dataRow(["/scan [target]", "Triggers an on-demand scan for the relevant agent"], [2800, 6560], true),
          dataRow(["/report [monthly|quarterly]", "Initiates report generation — PDF delivered back to the channel"], [2800, 6560], false),
          dataRow(["/playbook run <name>", "Executes a named IR playbook, tracked in #sec-ir"], [2800, 6560], true),
          dataRow(["/setup <agent-id>", "Launches the interactive agent setup wizard in the current channel"], [2800, 6560], false),
          dataRow(["/help", "Displays full command reference for the current channel's agent"], [2800, 6560], true),
        ]
      }),
      spacer(),

      // ── 4. SINGLE PANE OF GLASS DASHBOARD ──────────────────────
      h1("4. Single Pane of Glass (SPOG) Dashboard"),
      h2("4.1 Dual-Audience Design"),
      body("The SPOG dashboard is designed for two distinct audiences, selectable via a toggle on the dashboard header:"),
      bullet("Business View — Executive-facing with KPI tiles, risk score trend, compliance heatmap, and plain-English summaries. No technical jargon."),
      bullet("Technical View — SOC analyst-facing with real-time alert feeds, agent health matrix, MITRE ATT&CK coverage map, CVE tables, and raw metric charts."),
      spacer(),
      h2("4.2 Widget Catalogue"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 1600, 4960],
        rows: [
          headerRow(["Widget", "Audience", "Description"], [2800, 1600, 4960]),
          dataRow(["Security Posture Score", "Both", "0-100 composite risk score with trend line and colour-coded RAG status"], [2800, 1600, 4960], false),
          dataRow(["Threat Activity Map", "Both", "World map showing live attack origins and blocked indicators"], [2800, 1600, 4960], true),
          dataRow(["Agent Health Matrix", "Technical", "Grid showing real-time status of all 26 agents with uptime and last-seen timestamps"], [2800, 1600, 4960], false),
          dataRow(["Alert Volume Chart", "Technical", "Time-series chart of alerts by severity and source agent"], [2800, 1600, 4960], true),
          dataRow(["MITRE ATT&CK Coverage", "Technical", "Heatmap of covered vs. uncovered MITRE tactics and techniques"], [2800, 1600, 4960], false),
          dataRow(["CVE Severity Breakdown", "Technical", "Donut chart of open CVEs by severity with top-10 table"], [2800, 1600, 4960], true),
          dataRow(["Compliance Heatmap", "Both", "Framework compliance percentage for PCI DSS, ISO 27001, NIST CSF, UAE PDPL"], [2800, 1600, 4960], false),
          dataRow(["Fraud KPIs", "Business", "Transactions scored, fraud rate %, ATO detections, revenue protected"], [2800, 1600, 4960], true),
          dataRow(["Incident Timeline", "Both", "Chronological view of incidents with severity, status, and MTTR"], [2800, 1600, 4960], false),
          dataRow(["Risk Heatmap", "Business", "Business-language risk categories mapped to likelihood vs. impact matrix"], [2800, 1600, 4960], true),
          dataRow(["Report Generator", "Both", "One-click monthly/quarterly report generation with PDF download and chat delivery"], [2800, 1600, 4960], false),
          dataRow(["Chat Command Panel", "Technical", "Embedded chat command interface for issuing agent commands from the dashboard"], [2800, 1600, 4960], true),
        ]
      }),
      spacer(),

      // ── 5. AGENT REGISTRY ─────────────────────────────────────────
      h1("5. Agent Registry"),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 1400, 900, 2000, 2260],
        rows: [
          headerRow(["Agent", "Category", "Priority", "Status", "Primary Tool"], [2800, 1400, 900, 2000, 2260]),
          ...agents.map((row, i) => dataRow(row, [2800, 1400, 900, 2000, 2260], i % 2 === 1))
        ]
      }),
      spacer(),

      // ── 6. INTEGRATION ARCHITECTURE ───────────────────────────────
      h1("6. Integration & Orchestration"),
      h2("6.1 Paperclip Orchestration"),
      bullet("Agent registration via agent-registry.yaml — auto-discovery on startup"),
      bullet("Asynchronous event bus — agents publish and subscribe to typed events"),
      bullet("Health monitoring — 60-second heartbeat per agent with auto-restart on failure"),
      bullet("Secrets injection — credentials injected at runtime from vault (HashiCorp Vault / AWS Secrets Manager)"),
      bullet("Agent versioning — blue/green deployment with instant rollback via Paperclip CLI"),
      spacer(),
      h2("6.2 Security Architecture"),
      bullet("Zero-trust inter-agent communication — mTLS between all agents"),
      bullet("Secrets vault integration — no credentials in code, environment, or configuration files"),
      bullet("CI/CD security gates — SAST, dependency scan, container scan, and secret detection on every commit"),
      bullet("RBAC on dashboard and chat commands — role-based access enforced per command and widget"),
      bullet("Audit logging — every human command and agent action written to immutable audit log"),
      spacer(),

      // ── 7. COMPLIANCE MAPPING ──────────────────────────────────────
      h1("7. Compliance Framework Alignment"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 3160, 4000],
        rows: [
          headerRow(["Framework", "Key Requirements Covered", "Primary Agents"], [2200, 3160, 4000]),
          dataRow(["PCI DSS v4.0", "Req 1 (Network), Req 6 (AppSec), Req 10 (Logging), Req 11 (Vuln Mgmt)", "PCI Segmentation, WAF, SIEM, Vulnerability"], [2200, 3160, 4000], false),
          dataRow(["ISO/IEC 27001:2022", "A.8 (Asset), A.9 (Access), A.12 (Operations), A.16 (Incident)", "Asset Mgmt, IAM/PAM, SIEM, IR Agent"], [2200, 3160, 4000], true),
          dataRow(["NIST CSF 2.0", "Identify, Protect, Detect, Respond, Recover", "All agents mapped across 5 functions"], [2200, 3160, 4000], false),
          dataRow(["UAE PDPL / DIFC / ADGM", "Data localisation, breach notification, privacy by design", "Data Residency, DLP, IR Agent"], [2200, 3160, 4000], true),
          dataRow(["MITRE ATT&CK v14", "TTP detection across all 14 tactics", "SIEM, EDR, Threat Intel, WAF"], [2200, 3160, 4000], false),
          dataRow(["OWASP Top 10 (2021)", "A01-A10 web application risks", "WAF+Bot, API Gateway, SAST/DAST"], [2200, 3160, 4000], true),
        ]
      }),
      spacer(),
      pageBreak(),

      // ── 8. DEPLOYMENT PHASES ──────────────────────────────────────
      h1("8. Phased Deployment Overview"),
      body("The platform is structured across 4 phases to deliver immediate security value while managing budget constraints. Each phase is independently deployable and builds on the previous."),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1200, 2600, 3000, 2560],
        rows: [
          headerRow(["Phase", "Agents Deployed", "Security Value", "Budget Band"], [1200, 2600, 3000, 2560]),
          dataRow(["Phase 1", "EDR, Email Security, DNS, SIEM, Vulnerability, Asset Mgmt, Risk Dashboard, Chat Interface", "Critical threat detection and visibility. Immediate ROI on endpoint + email protection.", "AED 180-280K/yr"], [1200, 2600, 3000, 2560], false),
          dataRow(["Phase 2", "WAF+Bot, API Gateway, DLP, Web Proxy, SAST/DAST, PCI Segmentation, Fraud Detection", "Application and data protection. E-commerce specific controls active.", "AED 220-350K/yr"], [1200, 2600, 3000, 2560], true),
          dataRow(["Phase 3", "IAM/PAM, Cloud Security, Incident Response, Threat Intel, Brand Protection", "Identity, cloud posture, and automated IR. Closes critical identity gap.", "AED 280-420K/yr"], [1200, 2600, 3000, 2560], false),
          dataRow(["Phase 4", "Compliance/GRC, Backup & Recovery, Third-Party Risk, Mobile App Security, Data Residency, CDN Security", "Governance, compliance readiness, and resilience. Audit-ready posture.", "AED 180-260K/yr"], [1200, 2600, 3000, 2560], true),
        ]
      }),

      spacer(),
      body("Note: Budget bands are indicative cloud-first estimates including SaaS tool licensing, compute, and implementation effort. On-premises deployments will vary.", { italics: true, color: MID_GREY }),

      spacer(),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "— End of High Level Design —", size: 18, italics: true, color: MID_GREY, font: "Arial" })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/claude/ecomsec/docs/hld/EcomSec-HLD-v1.0.docx', buffer);
  console.log('HLD generated successfully');
});
