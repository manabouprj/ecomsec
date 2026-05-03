import { useState, useEffect, useRef } from "react";

/* ─── MOCK DATA ─────────────────────────────────────────────── */
const AGENTS = [
  { id:"edr-agent",                  name:"EDR",              category:"Endpoint",    port:8001, status:"running",  uptime:"14d 6h",  last_alert:"2m ago",  alerts:3  },
  { id:"email-security-agent",       name:"Email Security",   category:"Comms",       port:8002, status:"running",  uptime:"14d 6h",  last_alert:"18m ago", alerts:1  },
  { id:"dns-security-agent",         name:"DNS Security",     category:"Network",     port:8003, status:"running",  uptime:"14d 6h",  last_alert:"5m ago",  alerts:2  },
  { id:"asset-management-agent",     name:"Asset Mgmt",       category:"Governance",  port:8004, status:"running",  uptime:"14d 6h",  last_alert:"1h ago",  alerts:0  },
  { id:"siem-agent",                 name:"SIEM",             category:"Detection",   port:8005, status:"running",  uptime:"14d 6h",  last_alert:"1m ago",  alerts:9  },
  { id:"web-proxy-agent",            name:"Web Proxy",        category:"Network",     port:8006, status:"running",  uptime:"14d 5h",  last_alert:"2h ago",  alerts:0  },
  { id:"dlp-agent",                  name:"DLP",              category:"Data",        port:8007, status:"running",  uptime:"14d 6h",  last_alert:"32m ago", alerts:1  },
  { id:"api-gateway-agent",          name:"API Gateway",      category:"Application", port:8008, status:"running",  uptime:"14d 6h",  last_alert:"8m ago",  alerts:2  },
  { id:"waf-bot-agent",              name:"WAF + Bot",        category:"Application", port:8009, status:"running",  uptime:"14d 6h",  last_alert:"3m ago",  alerts:4  },
  { id:"sast-dast-agent",            name:"SAST/DAST",        category:"AppSec",      port:8010, status:"running",  uptime:"9d 2h",   last_alert:"6h ago",  alerts:0  },
  { id:"brand-protection-agent",     name:"Brand Protection", category:"ThreatIntel", port:8011, status:"running",  uptime:"14d 6h",  last_alert:"4h ago",  alerts:0  },
  { id:"vulnerability-agent",        name:"Vulnerability",    category:"Governance",  port:8012, status:"running",  uptime:"14d 6h",  last_alert:"12m ago", alerts:5  },
  { id:"risk-dashboard-agent",       name:"Risk Dashboard",   category:"Governance",  port:8013, status:"running",  uptime:"14d 6h",  last_alert:"—",       alerts:0  },
  { id:"iam-pam-agent",              name:"IAM / PAM",        category:"Identity",    port:8014, status:"running",  uptime:"12d 4h",  last_alert:"45m ago", alerts:1  },
  { id:"cloud-security-agent",       name:"Cloud Security",   category:"Cloud",       port:8015, status:"warning",  uptime:"14d 6h",  last_alert:"7m ago",  alerts:3  },
  { id:"incident-response-agent",    name:"Incident Resp.",   category:"Detection",   port:8016, status:"running",  uptime:"11d 8h",  last_alert:"2m ago",  alerts:2  },
  { id:"threat-intel-agent",         name:"Threat Intel",     category:"ThreatIntel", port:8017, status:"running",  uptime:"14d 6h",  last_alert:"22m ago", alerts:1  },
  { id:"backup-recovery-agent",      name:"Backup & Recovery",category:"Resilience",  port:8018, status:"running",  uptime:"14d 6h",  last_alert:"—",       alerts:0  },
  { id:"compliance-grc-agent",       name:"Compliance / GRC", category:"Governance",  port:8019, status:"running",  uptime:"10d 3h",  last_alert:"1d ago",  alerts:0  },
  { id:"pci-dss-segmentation-agent", name:"PCI DSS Seg.",     category:"E-Commerce",  port:8020, status:"running",  uptime:"8d 12h",  last_alert:"1h ago",  alerts:1  },
  { id:"fraud-detection-agent",      name:"Fraud Detection",  category:"E-Commerce",  port:8021, status:"running",  uptime:"8d 12h",  last_alert:"4m ago",  alerts:6  },
  { id:"third-party-risk-agent",     name:"3rd Party Risk",   category:"Governance",  port:8022, status:"running",  uptime:"6d 1h",   last_alert:"2h ago",  alerts:0  },
  { id:"mobile-app-security-agent",  name:"Mobile App Sec.",  category:"AppSec",      port:8023, status:"running",  uptime:"6d 1h",   last_alert:"8h ago",  alerts:0  },
  { id:"data-residency-agent",       name:"Data Residency",   category:"Data",        port:8024, status:"warning",  uptime:"5d 4h",   last_alert:"15m ago", alerts:2  },
  { id:"cdn-security-agent",         name:"CDN Security",     category:"Network",     port:8026, status:"running",  uptime:"5d 4h",   last_alert:"3h ago",  alerts:0  },
  { id:"chat-interface-agent",       name:"Chat Interface",   category:"Integration", port:8025, status:"running",  uptime:"14d 6h",  last_alert:"—",       alerts:0  },
];

const ALERTS = [
  { id:"ALT-001", agent:"Fraud Detection",  sev:"critical", msg:"ATO credential stuffing: 47 failures from 185.220.101.42", mitre:"TA0006", time:"2m ago",  status:"open" },
  { id:"ALT-002", agent:"SIEM",             sev:"critical", msg:"Lateral movement detected: SMB relay from workstation-07 to DC-01", mitre:"TA0008", time:"3m ago",  status:"open" },
  { id:"ALT-003", agent:"WAF + Bot",        sev:"high",     msg:"SQLi attack blocked: 312 requests from 91.108.4.0/22", mitre:"TA0001", time:"3m ago",  status:"open" },
  { id:"ALT-004", agent:"Cloud Security",   sev:"high",     msg:"S3 bucket public-access enabled: ecomsec-analytics-raw", mitre:"TA0010", time:"7m ago",  status:"open" },
  { id:"ALT-005", agent:"EDR",              sev:"high",     msg:"Mimikatz.Dropper on server-db-02 — process injected into lsass.exe", mitre:"TA0006", time:"12m ago", status:"ack"  },
  { id:"ALT-006", agent:"Data Residency",   sev:"high",     msg:"Lambda function in us-east-1 processing UAE customer PII", mitre:"TA0040", time:"15m ago", status:"open" },
  { id:"ALT-007", agent:"Vulnerability",    sev:"high",     msg:"CVE-2024-3094 (CVSS 10.0) on 3 unpatched hosts — SLA breach in 2 days", mitre:"TA0002", time:"12m ago", status:"open" },
  { id:"ALT-008", agent:"API Gateway",      sev:"medium",   msg:"Rate limit breach on /api/v2/checkout — 1,847 req/min from single IP", mitre:"TA0040", time:"8m ago",  status:"open" },
  { id:"ALT-009", agent:"DNS Security",     sev:"medium",   msg:"C2 callback attempt blocked: laptop-dev-03 → malware-c2.onion", mitre:"TA0011", time:"5m ago",  status:"ack"  },
  { id:"ALT-010", agent:"DLP",              sev:"medium",   msg:"PII exfiltration attempt: 8,400 customer emails in outbound HTTPS", mitre:"TA0010", time:"32m ago", status:"open" },
];

const COMPLIANCE = [
  { name:"PCI DSS v4.0",    score:78, target:90, color:"#f59e0b" },
  { name:"ISO 27001:2022",  score:82, target:90, color:"#22c55e" },
  { name:"NIST CSF 2.0",    score:74, target:85, color:"#f59e0b" },
  { name:"UAE PDPL",        score:61, target:80, color:"#ef4444" },
  { name:"DIFC DPL",        score:68, target:80, color:"#f59e0b" },
  { name:"OWASP Top 10",    score:88, target:95, color:"#22c55e" },
];

const MITRE_TACTICS = [
  { id:"TA0001", name:"Initial Access",       coverage:85 },
  { id:"TA0002", name:"Execution",            coverage:72 },
  { id:"TA0003", name:"Persistence",          coverage:60 },
  { id:"TA0004", name:"Privilege Escalation", coverage:68 },
  { id:"TA0005", name:"Defense Evasion",      coverage:55 },
  { id:"TA0006", name:"Credential Access",    coverage:80 },
  { id:"TA0007", name:"Discovery",            coverage:65 },
  { id:"TA0008", name:"Lateral Movement",     coverage:75 },
  { id:"TA0009", name:"Collection",           coverage:58 },
  { id:"TA0010", name:"Exfiltration",         coverage:82 },
  { id:"TA0011", name:"C2",                   coverage:88 },
  { id:"TA0040", name:"Impact",               coverage:70 },
];

const SEV_COLOR = { critical:"#ef4444", high:"#f97316", medium:"#eab308", low:"#22c55e" };
const STATUS_COLOR = { running:"#22c55e", warning:"#f59e0b", stopped:"#ef4444" };
const CAT_COLOR = {
  Endpoint:"#ef4444", Comms:"#f97316", Network:"#eab308", Governance:"#22c55e",
  Detection:"#3b82f6", Data:"#8b5cf6", Application:"#06b6d4", AppSec:"#ec4899",
  ThreatIntel:"#f59e0b", Identity:"#6366f1", Cloud:"#14b8a6", Resilience:"#84cc16",
  "E-Commerce":"#a855f7", Integration:"#64748b",
};

function coverageColor(pct) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}

/* ─── WIDGETS ───────────────────────────────────────────────── */
function PostureScore({ score }) {
  const r = 54, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "STRONG" : score >= 60 ? "MODERATE" : "AT RISK";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%" }}>
      <svg width="140" height="140" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1e293b" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 1s ease" }}/>
      </svg>
      <div style={{ marginTop:-110, textAlign:"center", pointerEvents:"none" }}>
        <div style={{ fontSize:36, fontWeight:800, color, letterSpacing:-2 }}>{score}</div>
        <div style={{ fontSize:11, color:"#64748b", letterSpacing:3 }}>/100</div>
      </div>
      <div style={{ marginTop:16, fontSize:12, fontWeight:700, color, letterSpacing:3 }}>{label}</div>
      <div style={{ fontSize:10, color:"#475569", marginTop:4 }}>▲ +4 vs last month</div>
    </div>
  );
}

function AlertFeed({ alerts, onAck }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:320, overflowY:"auto" }}>
      {alerts.filter(a => a.status === "open").slice(0, 8).map(a => (
        <div key={a.id} style={{
          background:"rgba(15,23,42,0.8)", border:`1px solid ${SEV_COLOR[a.sev]}30`,
          borderLeft:`3px solid ${SEV_COLOR[a.sev]}`, borderRadius:6,
          padding:"8px 12px", display:"flex", alignItems:"flex-start", gap:10,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:9, padding:"1px 7px", borderRadius:3, background:`${SEV_COLOR[a.sev]}20`, color:SEV_COLOR[a.sev], fontWeight:700, letterSpacing:1 }}>{a.sev.toUpperCase()}</span>
              <span style={{ fontSize:9, color:"#475569" }}>{a.agent}</span>
              <span style={{ fontSize:9, color:"#334155", marginLeft:"auto" }}>{a.time}</span>
            </div>
            <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.msg}</div>
            <div style={{ fontSize:9, color:"#334155", marginTop:3 }}>MITRE: {a.mitre}</div>
          </div>
          <button onClick={() => onAck(a.id)} style={{
            background:"none", border:"1px solid #1e293b", borderRadius:4,
            color:"#475569", fontSize:9, padding:"3px 8px", cursor:"pointer",
            whiteSpace:"nowrap", flexShrink:0,
          }}>ACK</button>
        </div>
      ))}
    </div>
  );
}

function AgentHealthGrid({ agents }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(168px, 1fr))", gap:6 }}>
      {agents.map(a => (
        <div key={a.id} style={{
          background:"rgba(15,23,42,0.8)", border:`1px solid ${STATUS_COLOR[a.status]}20`,
          borderRadius:6, padding:"8px 10px", position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:CAT_COLOR[a.category] || "#6366f1" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#e2e8f0", lineHeight:1.3 }}>{a.name}</div>
            <div style={{ width:7, height:7, borderRadius:"50%", background:STATUS_COLOR[a.status], flexShrink:0, marginTop:2 }}/>
          </div>
          <div style={{ fontSize:9, color:"#475569", marginTop:4 }}>:{a.port} · {a.uptime}</div>
          {a.alerts > 0 && (
            <div style={{ display:"inline-block", marginTop:4, fontSize:9, padding:"1px 6px", borderRadius:3, background:`${SEV_COLOR["high"]}20`, color:SEV_COLOR["high"] }}>
              {a.alerts} alert{a.alerts > 1 ? "s" : ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ComplianceWidget({ items }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {items.map(c => (
        <div key={c.name}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:11, color:"#94a3b8" }}>{c.name}</span>
            <span style={{ fontSize:11, fontWeight:700, color:c.color }}>{c.score}%</span>
          </div>
          <div style={{ height:6, background:"#1e293b", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${c.score}%`, background:c.color, borderRadius:3, transition:"width 1s ease" }}/>
          </div>
          <div style={{ fontSize:9, color:"#334155", marginTop:2 }}>Target: {c.target}% · Gap: {c.target - c.score}%</div>
        </div>
      ))}
    </div>
  );
}

function MitreHeatmap({ tactics }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:4 }}>
      {tactics.map(t => (
        <div key={t.id} style={{
          background:`${coverageColor(t.coverage)}12`,
          border:`1px solid ${coverageColor(t.coverage)}30`,
          borderRadius:5, padding:"6px 8px", cursor:"default",
        }} title={`${t.name}: ${t.coverage}% covered`}>
          <div style={{ fontSize:9, color:"#64748b", letterSpacing:0.5 }}>{t.id}</div>
          <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginTop:1, lineHeight:1.2 }}>{t.name}</div>
          <div style={{ marginTop:5, height:3, background:"#1e293b", borderRadius:2 }}>
            <div style={{ height:"100%", width:`${t.coverage}%`, background:coverageColor(t.coverage), borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:9, color:coverageColor(t.coverage), marginTop:2 }}>{t.coverage}%</div>
        </div>
      ))}
    </div>
  );
}

function RiskHeatmap() {
  const items = [
    { label:"Data Breach — Customer PII",  likelihood:3, impact:5, color:"#ef4444" },
    { label:"Ransomware Attack",           likelihood:2, impact:5, color:"#ef4444" },
    { label:"Payment Fraud",              likelihood:4, impact:4, color:"#ef4444" },
    { label:"Account Takeover (ATO)",     likelihood:4, impact:3, color:"#f97316" },
    { label:"Cloud Misconfiguration",     likelihood:3, impact:4, color:"#f97316" },
    { label:"Supply Chain Compromise",    likelihood:2, impact:4, color:"#f97316" },
    { label:"DDoS on Checkout",           likelihood:3, impact:3, color:"#eab308" },
    { label:"Insider Threat",             likelihood:2, impact:4, color:"#f97316" },
    { label:"Phishing Campaign",          likelihood:4, impact:2, color:"#eab308" },
    { label:"API Abuse",                  likelihood:4, impact:3, color:"#f97316" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {items.map(r => (
        <div key={r.label} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:r.color, flexShrink:0 }}/>
          <div style={{ fontSize:11, color:"#94a3b8", flex:1 }}>{r.label}</div>
          <div style={{ display:"flex", gap:3 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ width:12, height:12, borderRadius:2, background:i <= r.likelihood ? "#6366f1" : "#1e293b" }}/>
            ))}
          </div>
          <div style={{ display:"flex", gap:3 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ width:12, height:12, borderRadius:2, background:i <= r.impact ? r.color : "#1e293b" }}/>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:20, marginTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:9, color:"#475569" }}>
          <div style={{ display:"flex", gap:2 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ width:8, height:8, borderRadius:1, background:"#6366f1" }}/>)}</div>
          LIKELIHOOD →
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:9, color:"#475569" }}>
          <div style={{ display:"flex", gap:2 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ width:8, height:8, borderRadius:1, background:"#ef4444" }}/>)}</div>
          IMPACT →
        </div>
      </div>
    </div>
  );
}

function FraudKPIs() {
  const kpis = [
    { label:"Transactions Scored Today", value:"48,291",  delta:"+12%", color:"#6366f1" },
    { label:"Fraud Rate",               value:"0.31%",   delta:"-0.08%", color:"#22c55e" },
    { label:"Blocked (High Risk)",      value:"149",     delta:"+21",  color:"#ef4444" },
    { label:"ATO Attempts Detected",    value:"12",      delta:"—",    color:"#f97316" },
    { label:"Revenue Protected (AED)",  value:"241,800", delta:"est.", color:"#22c55e" },
    { label:"Step-Up Auth Triggers",    value:"83",      delta:"—",    color:"#eab308" },
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
      {kpis.map(k => (
        <div key={k.label} style={{ background:"rgba(15,23,42,0.8)", border:"1px solid #1e293b", borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:9, color:"#475569", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
          <div style={{ fontSize:22, fontWeight:800, color:k.color, letterSpacing:-1 }}>{k.value}</div>
          <div style={{ fontSize:9, color:"#64748b", marginTop:2 }}>{k.delta} vs yesterday</div>
        </div>
      ))}
    </div>
  );
}

function ChatPanel({ onCommand }) {
  const [input, setInput] = useState("");
  const [log, setLog] = useState([
    { dir:"out", text:"Platform online — all 26 agents registered ✅", t:"14d ago" },
    { dir:"in",  text:"/status edr-agent", t:"2m ago" },
    { dir:"out", text:"✅ edr-agent RUNNING | Port 8001 | Uptime 14d 6h | Alerts: 3 critical", t:"2m ago" },
    { dir:"in",  text:"/isolate workstation-07", t:"3m ago" },
    { dir:"out", text:"🔴 Isolation request sent for workstation-07. EDR Agent confirming...", t:"3m ago" },
  ]);
  const ref = useRef(null);

  const submit = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setLog(l => [...l, { dir:"in", text:cmd, t:"now" }]);
    setTimeout(() => {
      setLog(l => [...l, { dir:"out", text: simulateResponse(cmd), t:"now" }]);
      ref.current?.scrollTo(0, 9999);
    }, 400);
    setInput("");
  };

  function simulateResponse(cmd) {
    const c = cmd.toLowerCase();
    if (c.startsWith("/status")) return "✅ Agent RUNNING | Uptime: 14d 6h | Active alerts: 3";
    if (c.startsWith("/alert list")) return "🔴 ALT-001 · ATO detected\n🟠 ALT-003 · WAF SQLi block\n🟠 ALT-007 · CVE SLA breach";
    if (c.startsWith("/isolate")) return `🔴 Isolation command dispatched to EDR Agent for: ${cmd.split(" ")[1] || "host"}`;
    if (c.startsWith("/block")) return `🚫 Block request propagated to DNS + WAF + Web Proxy for: ${cmd.split(" ")[1] || "target"}`;
    if (c.startsWith("/report")) return "📊 Report generation started. PDF will be delivered to #sec-dashboard in ~60s.";
    if (c.startsWith("/scan")) return "🔍 On-demand scan triggered. Results will stream to this panel.";
    if (c.startsWith("/playbook")) return `▶️ Playbook ${cmd.split(" ")[2] || "?"} started. Tracking in #sec-ir.`;
    if (c.startsWith("/help")) return "/status /alert /isolate /block /scan /report /playbook /setup /help";
    return `⚙️ Command dispatched to relevant agent. Check channel for response.`;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div ref={ref} style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, paddingBottom:8, maxHeight:200 }}>
        {log.map((l, i) => (
          <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span style={{ fontSize:9, color:"#334155", paddingTop:2, flexShrink:0 }}>{l.t}</span>
            <div style={{
              fontSize:11, padding:"5px 10px", borderRadius:6, maxWidth:"85%", whiteSpace:"pre-wrap",
              background: l.dir === "in" ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.8)",
              color: l.dir === "in" ? "#a5b4fc" : "#94a3b8",
              border: l.dir === "in" ? "1px solid #6366f130" : "1px solid #1e293b",
            }}>{l.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="/status edr-agent"
          style={{
            flex:1, background:"rgba(15,23,42,0.9)", border:"1px solid #1e293b",
            borderRadius:6, padding:"7px 12px", color:"#e2e8f0", fontSize:12,
            fontFamily:"'JetBrains Mono', monospace", outline:"none",
          }}
        />
        <button onClick={submit} style={{
          background:"#6366f1", border:"none", borderRadius:6, padding:"7px 16px",
          color:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", letterSpacing:1,
        }}>SEND</button>
      </div>
    </div>
  );
}

/* ─── WIDGET CARD WRAPPER ───────────────────────────────────── */
function Card({ title, badge, children, span = 1 }) {
  return (
    <div style={{
      background:"rgba(15,23,42,0.9)", border:"1px solid #1e293b",
      borderRadius:12, padding:"18px 20px",
      gridColumn: span > 1 ? `span ${span}` : undefined,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#6366f1", letterSpacing:3, textTransform:"uppercase", fontWeight:700 }}>{title}</div>
        {badge && <span style={{ fontSize:9, padding:"2px 8px", borderRadius:4, background:"rgba(99,102,241,0.15)", color:"#a5b4fc", border:"1px solid #6366f130" }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

/* ─── MAIN DASHBOARD ────────────────────────────────────────── */
export default function SPOGDashboard() {
  const [view, setView] = useState("technical");
  const [alerts, setAlerts] = useState(ALERTS);
  const [pulse, setPulse] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(t);
  }, []);

  const ackAlert = (id) => setAlerts(a => a.map(x => x.id === id ? { ...x, status:"ack" } : x));

  const openAlerts  = alerts.filter(a => a.status === "open").length;
  const critAlerts  = alerts.filter(a => a.sev === "critical" && a.status === "open").length;
  const runningAgts = AGENTS.filter(a => a.status === "running").length;
  const postureScore = 71;

  return (
    <div style={{
      fontFamily:"'JetBrains Mono', 'Fira Code', monospace",
      background:"#070d1a",
      minHeight:"100vh",
      color:"#e2e8f0",
      position:"relative",
      overflow:"hidden",
    }}>
      {/* Background mesh */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:`
          radial-gradient(circle at 15% 25%, rgba(99,102,241,0.07) 0%, transparent 45%),
          radial-gradient(circle at 85% 70%, rgba(6,182,212,0.05) 0%, transparent 45%),
          radial-gradient(circle at 50% 100%, rgba(168,85,247,0.04) 0%, transparent 40%)
        `,
      }}/>

      <div style={{ position:"relative", zIndex:1 }}>
        {/* ── HEADER ── */}
        <div style={{
          background:"rgba(7,13,26,0.95)", borderBottom:"1px solid #0f1f3d",
          padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between",
          backdropFilter:"blur(10px)", position:"sticky", top:0, zIndex:100,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#6366f1,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🛡️</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", letterSpacing:-0.5 }}>EcomSec</div>
                <div style={{ fontSize:9, color:"#334155", letterSpacing:2 }}>SECURITY OPERATIONS CENTER</div>
              </div>
            </div>
            <div style={{ width:1, height:28, background:"#1e293b" }}/>
            {/* View toggle */}
            <div style={{ display:"flex", gap:0, background:"rgba(15,23,42,0.8)", border:"1px solid #1e293b", borderRadius:8, overflow:"hidden" }}>
              {["business", "technical"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  background: view === v ? "#6366f1" : "none",
                  border:"none", color: view === v ? "#fff" : "#475569",
                  padding:"6px 16px", fontSize:10, cursor:"pointer",
                  fontFamily:"inherit", letterSpacing:1, textTransform:"uppercase",
                  transition:"all 0.2s",
                }}>{v === "business" ? "⬦ Business" : "⬡ Technical"}</button>
              ))}
            </div>
          </div>

          {/* Status pills */}
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#64748b" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background: critAlerts > 0 ? "#ef4444" : "#22c55e", boxShadow: critAlerts > 0 && pulse ? "0 0 8px #ef4444" : "none", transition:"box-shadow 0.5s" }}/>
              {critAlerts > 0 ? `${critAlerts} CRITICAL` : "NO CRITICAL"}
            </div>
            <div style={{ fontSize:10, color:"#334155" }}>|</div>
            <div style={{ fontSize:10, color:"#64748b" }}>{runningAgts}/26 AGENTS UP</div>
            <div style={{ fontSize:10, color:"#334155" }}>|</div>
            <div style={{ fontSize:10, color:"#64748b" }}>{time.toUTCString().slice(17,25)} UTC</div>
          </div>
        </div>

        {/* ── TOP KPI BAR ── */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(6, 1fr)",
          gap:1, padding:"0", background:"#0a1628", borderBottom:"1px solid #0f1f3d",
        }}>
          {[
            { label:"Posture Score",       value:`${postureScore}/100`,  color: postureScore >= 75 ? "#22c55e" : "#f59e0b" },
            { label:"Open Alerts",         value:openAlerts,            color:"#ef4444" },
            { label:"Agents Online",       value:`${runningAgts}/26`,   color:"#22c55e" },
            { label:"Threats Blocked 24h", value:"4,291",               color:"#6366f1" },
            { label:"Fraud Rate",          value:"0.31%",               color:"#22c55e" },
            { label:"Compliance Avg",      value:"75%",                 color:"#f59e0b" },
          ].map(k => (
            <div key={k.label} style={{ padding:"12px 20px", borderRight:"1px solid #0f1f3d" }}>
              <div style={{ fontSize:9, color:"#334155", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:k.color, letterSpacing:-1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ padding:"20px 24px" }}>

          {/* ── BUSINESS VIEW ── */}
          {view === "business" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
              <Card title="Security Posture Score" badge="LIVE">
                <PostureScore score={postureScore} />
              </Card>

              <Card title="Compliance Status" badge="6 frameworks" span={2}>
                <ComplianceWidget items={COMPLIANCE} />
              </Card>

              <Card title="Business Risk Heatmap" badge="Top 10 risks" span={3}>
                <RiskHeatmap />
              </Card>

              <Card title="Fraud & E-Commerce KPIs" badge="Today" span={2}>
                <FraudKPIs />
              </Card>

              <Card title="Incident Summary" badge={`${openAlerts} open`}>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { label:"Account Takeover Attempt", impact:"High customer risk", status:"Mitigating", color:"#ef4444" },
                    { label:"Cloud Data Exposure",       impact:"Compliance risk",   status:"Investigating", color:"#f97316" },
                    { label:"API Rate Limit Breach",     impact:"Service disruption risk", status:"Monitoring", color:"#eab308" },
                  ].map(inc => (
                    <div key={inc.label} style={{ padding:"10px 12px", background:"rgba(15,23,42,0.8)", borderRadius:8, borderLeft:`3px solid ${inc.color}` }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#f1f5f9" }}>{inc.label}</div>
                      <div style={{ fontSize:10, color:"#64748b", marginTop:2 }}>{inc.impact}</div>
                      <div style={{ fontSize:9, color:inc.color, marginTop:4, letterSpacing:1 }}>● {inc.status}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Generate Report" badge="Auto-deliver" span={3}>
                <div style={{ display:"flex", gap:12 }}>
                  {[
                    { type:"Monthly Technical", desc:"Threat landscape · CVEs · DLP · Compliance snapshot", icon:"📋" },
                    { type:"Quarterly Business", desc:"Risk heatmap · Posture trend · Fraud KPIs · Board narrative", icon:"📊" },
                  ].map(r => (
                    <div key={r.type} style={{
                      flex:1, background:"rgba(99,102,241,0.08)", border:"1px solid #6366f130",
                      borderRadius:10, padding:"16px 18px", cursor:"pointer",
                      transition:"border-color 0.2s",
                    }}>
                      <div style={{ fontSize:22, marginBottom:8 }}>{r.icon}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>{r.type} Report</div>
                      <div style={{ fontSize:10, color:"#64748b", marginTop:4, lineHeight:1.5 }}>{r.desc}</div>
                      <button style={{
                        marginTop:12, background:"#6366f1", border:"none", borderRadius:6,
                        color:"#fff", fontSize:10, padding:"6px 14px", cursor:"pointer",
                        fontFamily:"inherit", letterSpacing:1,
                      }}>GENERATE PDF →</button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── TECHNICAL VIEW ── */}
          {view === "technical" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
              <Card title="Live Alert Feed" badge={`${openAlerts} open`} span={2}>
                <AlertFeed alerts={alerts} onAck={ackAlert} />
              </Card>

              <Card title="Security Posture" badge="LIVE">
                <PostureScore score={postureScore} />
              </Card>

              <Card title="Agent Health Matrix" badge="26 agents" span={3}>
                <AgentHealthGrid agents={AGENTS} />
              </Card>

              <Card title="MITRE ATT&CK Coverage" badge="v14" span={2}>
                <MitreHeatmap tactics={MITRE_TACTICS} />
              </Card>

              <Card title="Compliance Status" badge="6 frameworks">
                <ComplianceWidget items={COMPLIANCE} />
              </Card>

              <Card title="Open CVEs" badge="By severity" span={1}>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { sev:"Critical", count:7,  color:"#ef4444", sla:"48h" },
                    { sev:"High",     count:23, color:"#f97316", sla:"7d"  },
                    { sev:"Medium",   count:84, color:"#eab308", sla:"30d" },
                    { sev:"Low",      count:162,color:"#22c55e", sla:"90d" },
                  ].map(c => (
                    <div key={c.sev} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:60, fontSize:10, color:"#94a3b8" }}>{c.sev}</div>
                      <div style={{ flex:1, height:8, background:"#1e293b", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.min(c.count/2, 100)}%`, background:c.color, borderRadius:4 }}/>
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:c.color, width:28, textAlign:"right" }}>{c.count}</div>
                      <div style={{ fontSize:9, color:"#334155", width:28 }}>SLA:{c.sla}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Chat Command Panel" badge="All platforms" span={2}>
                <ChatPanel />
              </Card>

              <Card title="Fraud Detection KPIs" badge="Live">
                <FraudKPIs />
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop:"1px solid #0f1f3d", padding:"12px 28px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:"rgba(7,13,26,0.95)",
        }}>
          <div style={{ fontSize:9, color:"#1e293b" }}>EcomSec v1.1.0 · Alvin, Security Architect · Paperclip Orchestrated</div>
          <div style={{ display:"flex", gap:12 }}>
            {["PCI DSS v4.0","ISO 27001","NIST CSF 2.0","UAE PDPL","MITRE ATT&CK v14"].map(t => (
              <span key={t} style={{ fontSize:8, color:"#1e293b", padding:"2px 7px", border:"1px solid #0f1f3d", borderRadius:3 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
