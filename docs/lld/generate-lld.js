const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak, Header, Footer, TabStopType,
  TabStopPosition, LevelFormat
} = require('docx');
const fs = require('fs');

const BRAND_BLUE = "1E3A5F";
const ACCENT = "7C3AED";
const LIGHT = "EDE9FE";
const GREY = "F1F5F9";
const MID_GREY = "94A3B8";
const WHITE = "FFFFFF";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND_BLUE, font: "Arial" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND_BLUE, font: "Arial" })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: ACCENT, font: "Arial" })]
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 20, font: "Arial", ...opts })]
  });
}
function code(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    shading: { fill: "0F172A", type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Courier New", color: "86EFAC" })]
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, font: "Arial" })]
  });
}
function spacer() { return new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun("")] }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function hRow(cells, widths) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((t, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      shading: { fill: ACCENT, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18, color: WHITE, font: "Arial" })] })]
    }))
  });
}
function dRow(cells, widths, shade = false) {
  return new TableRow({
    children: cells.map((t, i) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: { fill: shade ? GREY : WHITE, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: String(t), size: 18, font: "Arial" })] })]
    }))
  });
}

const agentDetails = [
  {
    id: "edr-agent", name: "EDR Agent", port: 8001, category: "Endpoint",
    tools: "CrowdStrike Falcon API v2 / SentinelOne REST API v2.1",
    polling: "60s threat poll, webhook for real-time detections",
    events_pub: ["critical_endpoint_alert", "endpoint_isolated", "metrics_update"],
    events_sub: ["isolate_endpoint", "threat_intel_ioc", "siem_correlation_hit"],
    metrics: "Detections by severity, MTTD, MTTR, endpoint_compromise_rate",
    auth: "OAuth2 client credentials (CrowdStrike), API token (SentinelOne)",
    secrets: "CROWDSTRIKE_API_KEY, SENTINELONE_API_KEY",
    scaling: "Stateless — scale horizontally. Max 1 instance per CrowdStrike tenant.",
    retry: "Exponential backoff 3x, then dead-letter queue",
    chat_cmds: "/isolate <host>, /status, /alert list",
  },
  {
    id: "siem-agent", name: "SIEM Agent", port: 8005, category: "Detection",
    tools: "Splunk REST API v9 / Microsoft Sentinel Log Analytics API",
    polling: "30s alert poll, streaming for high-priority rules",
    events_pub: ["siem_critical_alert", "trigger_incident_response", "metrics_update"],
    events_sub: ["all agent events for correlation"],
    metrics: "Alert volume, true_positive_rate, MTTD, coverage_sources",
    auth: "Splunk token auth, Azure AD service principal (Sentinel)",
    secrets: "SPLUNK_API_KEY, SPLUNK_HOST, SENTINEL_API_KEY",
    scaling: "Stateless with Redis for deduplication cache",
    retry: "Exponential backoff 3x",
    chat_cmds: "/status, /alert list, /alert acknowledge <id>, /scan",
  },
  {
    id: "fraud-detection-agent", name: "Fraud Detection Agent", port: 8021, category: "E-Commerce",
    tools: "Stripe Radar API / Sift Science API / Signifyd API",
    polling: "5s transaction poll, 30s login event poll",
    events_pub: ["fraud_transaction_blocked", "fraud_transaction_flagged", "ato_detected", "fraud_step_up_required"],
    events_sub: ["new_ioc_ip", "waf_bot_detected", "iam_login_anomaly"],
    metrics: "transactions_scored, blocked, flagged, ato_detections, fraud_rate_percent",
    auth: "Stripe secret key, Sift API key",
    secrets: "STRIPE_RADAR_API_KEY, SIGNIFYD_API_KEY, SIFT_API_KEY",
    scaling: "Horizontal — stateless scoring, thresholds in env vars",
    retry: "Non-blocking — failed scoring defaults to REVIEW action",
    chat_cmds: "/status, /alert list, /block <ip>",
  },
  {
    id: "chat-interface-agent", name: "Chat Interface Agent", port: 8025, category: "Integration",
    tools: "Slack Bolt SDK / MS Teams Bot Framework + Graph API / Webex API / Google Chat API",
    polling: "Event-driven — webhook listeners per platform",
    events_pub: ["human_command_issued", "alert_acknowledged", "setup_completed"],
    events_sub: ["ALL agent events — broadcasts alerts to relevant channels"],
    metrics: "messages_processed, commands_executed, alerts_dispatched, setups_completed",
    auth: "Slack: Bot Token + App Token; Teams: Azure AD OAuth2; Webex: Bearer token; GChat: Service Account",
    secrets: "SLACK_BOT_TOKEN, SLACK_APP_TOKEN, TEAMS_TENANT_ID, TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, WEBEX_ACCESS_TOKEN, GCHAT_WEBHOOK_URL",
    scaling: "Stateless — load balance across instances. Wizard sessions in Redis.",
    retry: "Fire-and-forget for alerts, retry 3x for command responses",
    chat_cmds: "ALL commands — this agent IS the command interface",
  },
  {
    id: "pci-dss-segmentation-agent", name: "PCI DSS Segmentation Agent", port: 8020, category: "E-Commerce",
    tools: "Palo Alto / Fortinet Firewall API / AWS VPC Flow Logs / Network Monitor API",
    polling: "120s CDE boundary check, webhook on firewall rule change",
    events_pub: ["pci_scope_violation", "pci_firewall_violation", "metrics_update"],
    events_sub: ["new_asset_discovered", "network_topology_change"],
    metrics: "cde_assets_in_scope, scope_violations, firewall_rules_reviewed, pci_requirement_coverage",
    auth: "Firewall API key, AWS IAM role for VPC logs",
    secrets: "FIREWALL_API_KEY, NETWORK_MONITOR_API_KEY, CDE_SUBNETS (env)",
    scaling: "Single instance per network segment. Stateful CDE asset tracking.",
    retry: "Alert on failure — CDE monitoring must not have silent failures",
    chat_cmds: "/status, /alert list, /scan [cde-audit]",
  },
];

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
        children: [new TextRun({ text: "EcomSec Platform  |  Low Level Design (LLD)  |  CONFIDENTIAL", size: 16, color: MID_GREY, font: "Arial" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "Alvin · Security Architect · LLD v1.0", size: 16, color: MID_GREY, font: "Arial" }),
          new TextRun({ text: "\tPage ", size: 16, color: MID_GREY, font: "Arial" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MID_GREY, font: "Arial" }),
          new TextRun({ text: " of ", size: 16, color: MID_GREY, font: "Arial" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MID_GREY, font: "Arial" }),
        ]
      })] })
    },
    children: [

      // Cover
      new Paragraph({ spacing: { before: 2000 }, children: [new TextRun("")] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "EcomSec", size: 72, bold: true, color: BRAND_BLUE, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "AI-Powered Security Agent Platform", size: 36, color: ACCENT, font: "Arial" })] }),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT }, bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "LOW LEVEL DESIGN (LLD)", size: 32, bold: true, color: BRAND_BLUE, font: "Arial" })]
      }),
      spacer(),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Author: Alvin | Security Architect", size: 22, color: MID_GREY, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Version: 1.0 | Classification: CONFIDENTIAL", size: 20, color: MID_GREY, font: "Arial" })] }),
      pageBreak(),

      // 1. Base Agent Class
      h1("1. Base Agent Class — Technical Specification"),
      body("All 26 security agents inherit from BaseSecurityAgent. This ensures consistent behaviour across the platform including registration, health checks, event publishing, metrics reporting, and secrets management."),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [2600, 6760],
        rows: [
          hRow(["Method", "Description"], [2600, 6760]),
          dRow(["start()", "Bootstrap: register with Paperclip → start metrics loop → call run()"], [2600, 6760], false),
          dRow(["run()", "Abstract — each agent implements its main polling/event loop"], [2600, 6760], true),
          dRow(["collect_metrics()", "Abstract — returns agent-specific dict of KPIs for the Risk Dashboard"], [2600, 6760], false),
          dRow(["process_event(event)", "Abstract — handles incoming events from the Paperclip event bus"], [2600, 6760], true),
          dRow(["publish_event(type, payload)", "POST event to Paperclip event bus — async, with error logging"], [2600, 6760], false),
          dRow(["report_metrics()", "Calls collect_metrics() then publishes metrics_update event — runs every 5 min"], [2600, 6760], true),
          dRow(["health_check()", "Returns agent_id, status, uptime_seconds, last_metrics_collected"], [2600, 6760], false),
          dRow(["get_secret(env_key)", "Reads from environment (injected by vault). Logs warning if missing."], [2600, 6760], true),
          dRow(["register_with_paperclip()", "POST /agents/register to Paperclip on startup. Sets status=running."], [2600, 6760], false),
        ]
      }),
      spacer(),

      // 2. Agent Specifications
      h1("2. Per-Agent Technical Specifications"),
      body("The following tables detail the low-level implementation specification for each key agent. All agents follow the BaseSecurityAgent pattern."),
      spacer(),

      ...agentDetails.flatMap((a, idx) => [
        h2(`2.${idx+1} ${a.name}`),
        new Table({
          width: { size: 9360, type: WidthType.DXA }, columnWidths: [2400, 6960],
          rows: [
            hRow(["Attribute", "Value"], [2400, 6960]),
            dRow(["Agent ID", a.id], [2400, 6960], false),
            dRow(["Port", String(a.port)], [2400, 6960], true),
            dRow(["Category", a.category], [2400, 6960], false),
            dRow(["Tool Integrations", a.tools], [2400, 6960], true),
            dRow(["Polling / Trigger", a.polling], [2400, 6960], false),
            dRow(["Events Published", a.events_pub.join(", ")], [2400, 6960], true),
            dRow(["Events Subscribed", Array.isArray(a.events_sub) ? a.events_sub.join(", ") : a.events_sub], [2400, 6960], false),
            dRow(["Key Metrics", a.metrics], [2400, 6960], true),
            dRow(["Authentication", a.auth], [2400, 6960], false),
            dRow(["Required Secrets", a.secrets], [2400, 6960], true),
            dRow(["Scaling Strategy", a.scaling], [2400, 6960], false),
            dRow(["Retry Strategy", a.retry], [2400, 6960], true),
            dRow(["Chat Commands", a.chat_cmds], [2400, 6960], false),
          ]
        }),
        spacer(),
      ]),

      // 3. Event Bus Specification
      h1("3. Paperclip Event Bus — Event Catalogue"),
      body("All inter-agent communication is asynchronous via the Paperclip event bus. Events are typed, versioned, and delivered with guaranteed-at-least-once semantics."),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 2000, 4360],
        rows: [
          hRow(["Event Type", "Source Agent", "Subscribers / Purpose"], [3000, 2000, 4360]),
          dRow(["critical_endpoint_alert", "EDR", "SIEM, IR Agent, Chat Interface — triggers correlation + notification"], [3000, 2000, 4360], false),
          dRow(["siem_critical_alert", "SIEM", "IR Agent, Chat Interface, Risk Dashboard"], [3000, 2000, 4360], true),
          dRow(["fraud_transaction_blocked", "Fraud Detection", "SIEM, Chat Interface — block + audit trail"], [3000, 2000, 4360], false),
          dRow(["ato_detected", "Fraud Detection", "IAM/PAM, SIEM, Chat Interface — force password reset flow"], [3000, 2000, 4360], true),
          dRow(["pci_scope_violation", "PCI Segmentation", "SIEM, Compliance/GRC, Chat Interface"], [3000, 2000, 4360], false),
          dRow(["isolate_endpoint", "Chat Interface / SIEM", "EDR Agent — endpoint isolation command"], [3000, 2000, 4360], true),
          dRow(["block_indicator", "Chat Interface", "DNS, WAF, Web Proxy — broadcast block across layers"], [3000, 2000, 4360], false),
          dRow(["new_asset_discovered", "Asset Mgmt", "Vulnerability, EDR, PCI Segmentation, Cloud Security"], [3000, 2000, 4360], true),
          dRow(["alert_acknowledged", "Chat Interface", "SIEM, Risk Dashboard — update alert status"], [3000, 2000, 4360], false),
          dRow(["generate_report", "Chat Interface / Scheduler", "Risk Dashboard Agent — triggers report generation"], [3000, 2000, 4360], true),
          dRow(["metrics_update", "All Agents", "Risk Dashboard — continuous posture score update"], [3000, 2000, 4360], false),
          dRow(["run_playbook", "Chat Interface / SIEM", "IR Agent — playbook execution"], [3000, 2000, 4360], true),
          dRow(["threat_intel_ioc", "Threat Intel", "DNS, WAF, EDR, Email — IOC distribution"], [3000, 2000, 4360], false),
        ]
      }),
      spacer(),

      // 4. Database Schema
      h1("4. Database Schema"),
      body("PostgreSQL is used as the primary datastore for agent metrics, alert history, and report data."),
      spacer(),
      h3("4.1 Key Tables"),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 2200, 4960],
        rows: [
          hRow(["Table", "Primary Key", "Purpose"], [2200, 2200, 4960]),
          dRow(["agents", "agent_id (varchar)", "Agent registry — status, port, last_seen, version"], [2200, 2200, 4960], false),
          dRow(["agent_metrics", "id (uuid)", "Time-series metrics per agent — JSON payload + timestamp"], [2200, 2200, 4960], true),
          dRow(["alerts", "alert_id (uuid)", "All alerts with severity, status, source_agent, acknowledged_by"], [2200, 2200, 4960], false),
          dRow(["events", "event_id (uuid)", "Full event bus audit log — immutable append-only"], [2200, 2200, 4960], true),
          dRow(["posture_scores", "id (uuid)", "Daily security posture score snapshots for trend analysis"], [2200, 2200, 4960], false),
          dRow(["reports", "report_id (uuid)", "Generated reports — type, period, file_path, delivered_to"], [2200, 2200, 4960], true),
          dRow(["chat_commands", "id (uuid)", "Audit log of all human chat commands — user, platform, action"], [2200, 2200, 4960], false),
          dRow(["wizard_sessions", "user_id (varchar)", "Active setup wizard state — agent_id, current_step"], [2200, 2200, 4960], true),
        ]
      }),
      spacer(),

      // 5. Infrastructure
      h1("5. Infrastructure Specification"),
      h2("5.1 Container Architecture"),
      bullet("Each agent runs as an independent Docker container"),
      bullet("Kubernetes (K8s) deployment for production — one Deployment per agent"),
      bullet("Resource limits: 256MB RAM, 0.5 CPU per agent (minimum). Scale up per load."),
      bullet("Persistent volumes only for Postgres and Redis — all agents are stateless"),
      bullet("Network Policy: agents can only communicate via Paperclip event bus ports"),
      spacer(),
      h2("5.2 Minimum Infrastructure Requirements"),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [2400, 2400, 2280, 2280],
        rows: [
          hRow(["Environment", "Compute", "Memory", "Storage"], [2400, 2400, 2280, 2280]),
          dRow(["Development", "4 vCPU", "16 GB RAM", "100 GB SSD"], [2400, 2400, 2280, 2280], false),
          dRow(["Staging", "8 vCPU", "32 GB RAM", "250 GB SSD"], [2400, 2400, 2280, 2280], true),
          dRow(["Production (Cloud)", "16 vCPU (auto-scale)", "64 GB RAM", "500 GB SSD + S3 for reports"], [2400, 2400, 2280, 2280], false),
        ]
      }),
      spacer(),
      h2("5.3 Ports Reference"),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 2340, 2340],
        rows: [
          hRow(["Agent", "Internal Port", "Exposed"], [4680, 2340, 2340]),
          ...["EDR:8001","Email:8002","DNS:8003","Asset:8004","SIEM:8005","Proxy:8006","DLP:8007","API-GW:8008",
              "WAF:8009","SAST-DAST:8010","Brand:8011","Vuln:8012","Risk-Dashboard:8013","IAM:8014",
              "Cloud-Sec:8015","IR:8016","Threat-Intel:8017","Backup:8018","Compliance:8019",
              "PCI:8020","Fraud:8021","3P-Risk:8022","Mobile:8023","Data-Residency:8024","CDN:8025","Chat:8025",
              "Paperclip:9000","Redis:6379","Postgres:5432","SPOG Dashboard:3000"].map((s, i) => {
            const [name, port] = s.split(":");
            const expose = ["Paperclip:9000","SPOG Dashboard:3000"].some(x => x.startsWith(name)) ? "Yes" : "Internal only";
            return dRow([name, port, expose], [4680, 2340, 2340], i % 2 === 1);
          })
        ]
      }),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "— End of Low Level Design —", size: 18, italics: true, color: MID_GREY, font: "Arial" })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/claude/ecomsec/docs/lld/EcomSec-LLD-v1.0.docx', buffer);
  console.log('LLD generated successfully');
});
