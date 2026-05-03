"""
EcomSec — Human-Agent Chat Interface
Provides conversational access to each security agent via Slack, Microsoft Teams,
and other enterprise messaging platforms.

Each security agent gets its own dedicated channel/conversation window.
Humans can query status, issue instructions, trigger playbooks, and receive alerts.

Author: Alvin, Security Architect
"""

import asyncio
import logging
import json
import os
import sys
from datetime import datetime, timezone
from typing import Optional
import httpx

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from base_agent import BaseSecurityAgent

logger = logging.getLogger(__name__)


# ─── PLATFORM ADAPTERS ──────────────────────────────────────────────────────

class SlackAdapter:
    """
    Slack adapter using Bolt for Python (Socket Mode).
    Each security agent maps to a dedicated Slack channel.
    Supports slash commands, interactive buttons, and rich Block Kit messages.
    """

    def __init__(self, bot_token: str, app_token: str):
        self.bot_token = bot_token
        self.app_token = app_token
        self.base_url = "https://slack.com/api"

    async def send_message(self, channel: str, text: str, blocks: Optional[list] = None):
        payload = {"channel": channel, "text": text}
        if blocks:
            payload["blocks"] = blocks
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/chat.postMessage",
                headers={"Authorization": f"Bearer {self.bot_token}"},
                json=payload,
                timeout=10.0
            )

    async def send_alert_card(self, channel: str, agent_name: str, severity: str, message: str, actions: list):
        """Send a rich interactive alert card with action buttons."""
        severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{severity_emoji} {agent_name} Alert"}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Severity:* {severity.upper()}\n{message}"}
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": action["label"]},
                        "style": action.get("style", "default"),
                        "value": action["value"],
                        "action_id": action["action_id"],
                    }
                    for action in actions
                ]
            }
        ]
        await self.send_message(channel, f"{severity_emoji} {agent_name}: {message}", blocks)

    def build_status_blocks(self, agent_id: str, metrics: dict) -> list:
        """Build a rich Slack Block Kit status card for an agent."""
        return [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"📊 {agent_id} Status Report"}
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Status:* ✅ Running"},
                    {"type": "mrkdwn", "text": f"*Last Updated:* {metrics.get('collected_at', 'N/A')}"},
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "\n".join([f"• *{k}:* `{v}`" for k, v in metrics.items() if k != "collected_at"])
                }
            },
            {"type": "divider"},
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"EcomSec Platform · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"}]
            }
        ]


class TeamsAdapter:
    """
    Microsoft Teams adapter using Adaptive Cards and webhooks.
    Each agent maps to a dedicated Teams channel within the Security Operations team.
    Supports Adaptive Card actions for human-in-the-loop approvals.
    """

    def __init__(self, webhook_url: str, tenant_id: str, client_id: str, client_secret: str):
        self.webhook_url = webhook_url
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.graph_base = "https://graph.microsoft.com/v1.0"
        self._access_token: Optional[str] = None

    async def get_access_token(self) -> str:
        """Obtain Microsoft Graph API access token via client credentials flow."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                }
            )
            self._access_token = response.json().get("access_token")
            return self._access_token

    async def send_adaptive_card(self, channel_id: str, team_id: str, card: dict):
        """Post an Adaptive Card to a Teams channel via Graph API."""
        token = self._access_token or await self.get_access_token()
        payload = {
            "body": {
                "contentType": "html",
                "content": "<attachment id='card'></attachment>"
            },
            "attachments": [
                {
                    "id": "card",
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": json.dumps(card)
                }
            ]
        }
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.graph_base}/teams/{team_id}/channels/{channel_id}/messages",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
                timeout=10.0
            )

    def build_alert_card(self, agent_name: str, severity: str, message: str, actions: list) -> dict:
        """Build a Microsoft Adaptive Card for security alerts."""
        severity_color = {"critical": "attention", "high": "warning", "medium": "accent", "low": "good"}.get(severity, "default")
        return {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.5",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Large",
                    "weight": "Bolder",
                    "text": f"🛡️ {agent_name}",
                    "color": severity_color
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {"title": "Severity", "value": severity.upper()},
                        {"title": "Time", "value": datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')},
                        {"title": "Details", "value": message},
                    ]
                },
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": action["label"],
                    "data": {"action": action["value"], "agent": agent_name}
                }
                for action in actions
            ]
        }

    async def send_webhook_message(self, title: str, message: str, color: str = "0076D7"):
        """Simple webhook message for quick notifications."""
        card = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": color,
            "summary": title,
            "sections": [{"activityTitle": title, "activityText": message}]
        }
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=card, timeout=10.0)


class WebexAdapter:
    """Cisco Webex adapter for enterprise environments using Webex."""

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://webexapis.com/v1"

    async def send_message(self, room_id: str, markdown: str):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/messages",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json={"roomId": room_id, "markdown": markdown},
                timeout=10.0
            )


class GoogleChatAdapter:
    """Google Chat adapter via incoming webhooks or Chat API."""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send_card(self, header: str, sections: list):
        payload = {
            "cards": [{
                "header": {"title": header, "subtitle": "EcomSec Security Platform"},
                "sections": sections
            }]
        }
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=payload, timeout=10.0)


# ─── COMMAND PARSER ─────────────────────────────────────────────────────────

class AgentCommandParser:
    """
    Parses natural language and slash commands from chat messages
    into structured agent instructions.

    Supported commands (all platforms):
      /status [agent-id]          — Get agent health and metrics
      /alert list                 — List active alerts
      /alert acknowledge <id>     — Acknowledge an alert
      /scan [target]              — Trigger an on-demand scan
      /isolate <hostname>         — Isolate endpoint (EDR)
      /block <ip|domain>          — Block IP or domain
      /report [monthly|quarterly] — Generate a report
      /playbook list              — List available playbooks
      /playbook run <name>        — Execute a playbook
      /setup <agent-id>           — Interactive agent setup wizard
      /help                       — Show all commands
    """

    COMMANDS = {
        "/status": "get_status",
        "/alert": "manage_alerts",
        "/scan": "trigger_scan",
        "/isolate": "isolate_endpoint",
        "/block": "block_indicator",
        "/report": "generate_report",
        "/playbook": "run_playbook",
        "/setup": "agent_setup",
        "/help": "show_help",
    }

    def parse(self, message: str, user: str, agent_id: str) -> dict:
        message = message.strip()
        parts = message.split()
        command = parts[0].lower() if parts else ""
        args = parts[1:] if len(parts) > 1 else []

        action = self.COMMANDS.get(command, "natural_language")

        return {
            "action": action,
            "command": command,
            "args": args,
            "raw_message": message,
            "requested_by": user,
            "target_agent": agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_help_text(self) -> str:
        return (
            "🛡️ *EcomSec Agent Commands*\n\n"
            "`/status [agent-id]` — Agent health + metrics\n"
            "`/alert list` — Active alerts\n"
            "`/alert acknowledge <id>` — Ack an alert\n"
            "`/scan [target]` — On-demand scan\n"
            "`/isolate <hostname>` — Isolate endpoint (EDR only)\n"
            "`/block <ip|domain>` — Block indicator\n"
            "`/report [monthly|quarterly]` — Generate report\n"
            "`/playbook list` — Available playbooks\n"
            "`/playbook run <name>` — Run a playbook\n"
            "`/setup <agent-id>` — Interactive setup wizard\n"
            "`/help` — Show this message\n"
        )


# ─── SETUP WIZARD ──────────────────────────────────────────────────────────

class AgentSetupWizard:
    """
    Interactive setup wizard delivered via chat.
    Guides operators through initial agent configuration
    without needing direct server access.

    Wizard steps per agent:
    1. Confirm API credentials are stored in vault
    2. Test connectivity to the tool (CrowdStrike, Splunk, etc.)
    3. Set alert thresholds
    4. Configure notification channels
    5. Run initial baseline scan
    6. Confirm successful registration with Paperclip
    """

    SETUP_FLOWS = {
        "edr-agent": [
            {"step": 1, "prompt": "Have you stored CROWDSTRIKE_API_KEY in the vault? (yes/no)"},
            {"step": 2, "prompt": "Enter your CrowdStrike Falcon console URL (e.g. https://falcon.crowdstrike.com):"},
            {"step": 3, "prompt": "Set the alert severity threshold for auto-isolation (critical/high/medium):"},
            {"step": 4, "prompt": "Which Slack channel should EDR critical alerts go to? (e.g. #soc-alerts):"},
            {"step": 5, "prompt": "Run initial endpoint baseline scan now? (yes/no)"},
        ],
        "siem-agent": [
            {"step": 1, "prompt": "Have you stored SPLUNK_API_KEY in the vault? (yes/no)"},
            {"step": 2, "prompt": "Enter your Splunk host URL (e.g. https://splunk.company.com:8089):"},
            {"step": 3, "prompt": "How many days of historical logs to ingest initially? (7/30/90):"},
            {"step": 4, "prompt": "Set true positive alert threshold (0-100, default 70):"},
            {"step": 5, "prompt": "Which channels should SIEM critical alerts route to? (comma separated):"},
        ],
        "default": [
            {"step": 1, "prompt": "Have you stored the required API keys in the secrets vault? (yes/no)"},
            {"step": 2, "prompt": "Enter the primary tool endpoint URL:"},
            {"step": 3, "prompt": "Set alert notification channel:"},
            {"step": 4, "prompt": "Run connectivity test now? (yes/no)"},
        ]
    }

    def get_flow(self, agent_id: str) -> list:
        return self.SETUP_FLOWS.get(agent_id, self.SETUP_FLOWS["default"])

    def format_step(self, agent_id: str, step_number: int) -> str:
        flow = self.get_flow(agent_id)
        step = next((s for s in flow if s["step"] == step_number), None)
        if not step:
            return "✅ Setup complete! Agent is now configured and registered with Paperclip."
        total = len(flow)
        return f"*Setup Wizard — {agent_id}* (Step {step_number}/{total})\n\n{step['prompt']}"


# ─── MAIN CHAT INTERFACE AGENT ──────────────────────────────────────────────

class ChatInterfaceAgent(BaseSecurityAgent):
    """
    Central chat interface agent.
    Routes messages between human operators and all security agents
    across Slack, Teams, Webex, and Google Chat.

    Channel mapping:
    - #sec-edr         ↔ EDR Agent
    - #sec-siem        ↔ SIEM Agent
    - #sec-email       ↔ Email Security Agent
    - #sec-dns         ↔ DNS Security Agent
    - #sec-vuln        ↔ Vulnerability Agent
    - #sec-dlp         ↔ DLP Agent
    - #sec-waf         ↔ WAF + Bot Agent
    - #sec-api         ↔ API Gateway Agent
    - #sec-cloud       ↔ Cloud Security Agent
    - #sec-fraud       ↔ Fraud Detection Agent
    - #sec-iam         ↔ IAM/PAM Agent
    - #sec-ir          ↔ Incident Response Agent
    - #sec-brand       ↔ Brand Protection Agent
    - #sec-compliance  ↔ Compliance/GRC Agent
    - #sec-all         ↔ Broadcast to all agents
    - #sec-dashboard   ↔ SPOG Dashboard queries
    """

    CHANNEL_TO_AGENT = {
        "sec-edr": "edr-agent",
        "sec-siem": "siem-agent",
        "sec-email": "email-security-agent",
        "sec-dns": "dns-security-agent",
        "sec-vuln": "vulnerability-agent",
        "sec-dlp": "dlp-agent",
        "sec-waf": "waf-bot-agent",
        "sec-api": "api-gateway-agent",
        "sec-cloud": "cloud-security-agent",
        "sec-fraud": "fraud-detection-agent",
        "sec-iam": "iam-pam-agent",
        "sec-ir": "incident-response-agent",
        "sec-brand": "brand-protection-agent",
        "sec-compliance": "compliance-grc-agent",
        "sec-pci": "pci-dss-segmentation-agent",
        "sec-3p": "third-party-risk-agent",
        "sec-mobile": "mobile-app-security-agent",
        "sec-data": "data-residency-agent",
        "sec-cdn": "cdn-security-agent",
        "sec-asset": "asset-management-agent",
    }

    def __init__(self):
        super().__init__(
            agent_id="chat-interface-agent",
            agent_name="Human-Agent Chat Interface",
            port=8025
        )
        # Initialize platform adapters
        self.slack = SlackAdapter(
            bot_token=self.get_secret("SLACK_BOT_TOKEN"),
            app_token=self.get_secret("SLACK_APP_TOKEN"),
        )
        self.teams = TeamsAdapter(
            webhook_url=self.get_secret("TEAMS_WEBHOOK_URL"),
            tenant_id=self.get_secret("TEAMS_TENANT_ID"),
            client_id=self.get_secret("TEAMS_CLIENT_ID"),
            client_secret=self.get_secret("TEAMS_CLIENT_SECRET"),
        )
        self.webex = WebexAdapter(access_token=self.get_secret("WEBEX_ACCESS_TOKEN"))
        self.gchat = GoogleChatAdapter(webhook_url=self.get_secret("GCHAT_WEBHOOK_URL"))

        self.parser = AgentCommandParser()
        self.wizard = AgentSetupWizard()
        self.wizard_sessions: dict = {}  # user_id → {agent_id, step}

        self.stats = {
            "messages_processed": 0,
            "commands_executed": 0,
            "alerts_dispatched": 0,
            "setups_completed": 0,
        }

    async def run(self):
        logger.info("Chat Interface Agent running — listening on all platforms...")
        # In production: start Slack Bolt app + Teams Bot Framework listener
        # Here we start the event loop that processes inbound events from Paperclip
        while True:
            await asyncio.sleep(10)

    async def handle_incoming_message(self, platform: str, channel: str, user: str, text: str):
        """
        Entry point for all incoming messages from any platform.
        Routes to the correct agent based on channel name.
        """
        self.stats["messages_processed"] += 1
        agent_id = self.CHANNEL_TO_AGENT.get(channel.lstrip("#").lstrip("sec-"), "unknown")
        command = self.parser.parse(text, user, agent_id)

        logger.info(f"[{platform}] #{channel} @{user}: {text} → action={command['action']}")

        response = await self.execute_command(command, platform)
        await self.send_response(platform, channel, response)

    async def execute_command(self, command: dict, platform: str) -> dict:
        """Execute a parsed command and return response payload."""
        action = command["action"]
        agent_id = command["target_agent"]
        self.stats["commands_executed"] += 1

        if action == "get_status":
            metrics = await self.fetch_agent_metrics(agent_id)
            return {"type": "status", "agent_id": agent_id, "metrics": metrics}

        elif action == "manage_alerts":
            args = command["args"]
            sub = args[0] if args else "list"
            if sub == "list":
                alerts = await self.fetch_agent_alerts(agent_id)
                return {"type": "alert_list", "alerts": alerts}
            elif sub == "acknowledge" and len(args) > 1:
                await self.publish_event("alert_acknowledged", {"alert_id": args[1], "by": command["requested_by"]})
                return {"type": "text", "text": f"✅ Alert `{args[1]}` acknowledged by {command['requested_by']}"}

        elif action == "isolate_endpoint":
            if agent_id != "edr-agent":
                return {"type": "text", "text": "⚠️ `/isolate` is only available in `#sec-edr`"}
            hostname = command["args"][0] if command["args"] else None
            if hostname:
                await self.publish_event("isolate_endpoint", {"hostname": hostname, "requested_by": command["requested_by"]})
                return {"type": "text", "text": f"🔴 Isolation request sent for `{hostname}`. EDR Agent will confirm shortly."}

        elif action == "block_indicator":
            indicator = command["args"][0] if command["args"] else None
            if indicator:
                await self.publish_event("block_indicator", {"indicator": indicator, "requested_by": command["requested_by"]})
                return {"type": "text", "text": f"🚫 Block request sent for `{indicator}` across DNS + WAF + Proxy layers."}

        elif action == "trigger_scan":
            target = command["args"][0] if command["args"] else "all"
            await self.publish_event("trigger_scan", {"target": target, "agent_id": agent_id})
            return {"type": "text", "text": f"🔍 On-demand scan triggered for `{target}` via `{agent_id}`. Results will appear here."}

        elif action == "generate_report":
            report_type = command["args"][0] if command["args"] else "monthly"
            await self.publish_event("generate_report", {"type": report_type})
            return {"type": "text", "text": f"📊 {report_type.capitalize()} report generation started. You'll receive the PDF in this channel shortly."}

        elif action == "run_playbook":
            if len(command["args"]) < 2:
                return {"type": "text", "text": "Usage: `/playbook run <playbook-name>`"}
            pb_name = command["args"][1]
            await self.publish_event("run_playbook", {"playbook": pb_name, "requested_by": command["requested_by"]})
            return {"type": "text", "text": f"▶️ Playbook `{pb_name}` started by {command['requested_by']}. Tracking in #sec-ir"}

        elif action == "agent_setup":
            target = command["args"][0] if command["args"] else agent_id
            user = command["requested_by"]
            self.wizard_sessions[user] = {"agent_id": target, "step": 1}
            step_text = self.wizard.format_step(target, 1)
            return {"type": "text", "text": step_text}

        elif action == "show_help":
            return {"type": "text", "text": self.parser.get_help_text()}

        return {"type": "text", "text": f"⚙️ Command processed by `{agent_id}`. Check logs for details."}

    async def send_response(self, platform: str, channel: str, response: dict):
        """Route response to correct platform."""
        text = response.get("text", "")
        metrics = response.get("metrics", {})

        if platform == "slack":
            if response["type"] == "status" and metrics:
                blocks = self.slack.build_status_blocks(response.get("agent_id", ""), metrics)
                await self.slack.send_message(f"#{channel}", text or "Status update", blocks)
            else:
                await self.slack.send_message(f"#{channel}", text)

        elif platform == "teams":
            await self.teams.send_webhook_message("EcomSec Agent Response", text)

        elif platform == "webex":
            await self.webex.send_message(channel, text)

        elif platform == "gchat":
            await self.gchat.send_card("EcomSec Response", [{"widgets": [{"textParagraph": {"text": text}}]}])

    async def broadcast_alert(self, agent_id: str, severity: str, message: str):
        """
        Push an alert from any agent to all registered platforms simultaneously.
        Called when agents publish critical/high events to the event bus.
        """
        channel = f"sec-{agent_id.replace('-agent', '')}"
        self.stats["alerts_dispatched"] += 1

        actions = [
            {"label": "Acknowledge", "value": "ack", "action_id": "ack_alert", "style": "primary"},
            {"label": "View Details", "value": "details", "action_id": "view_details"},
            {"label": "Run Playbook", "value": "playbook", "action_id": "run_playbook"},
        ]

        # Push to all platforms in parallel
        await asyncio.gather(
            self.slack.send_alert_card(f"#{channel}", agent_id, severity, message, actions),
            self.teams.send_webhook_message(
                f"{severity.upper()} Alert — {agent_id}",
                message,
                color="FF0000" if severity == "critical" else "FFA500"
            ),
            return_exceptions=True  # Don't fail if one platform is down
        )

    async def fetch_agent_metrics(self, agent_id: str) -> dict:
        """Fetch live metrics from a specific agent via Paperclip."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.paperclip_url}/agents/{agent_id}/metrics",
                    timeout=10.0
                )
                return response.json()
        except Exception:
            return {"error": "Agent unreachable", "agent_id": agent_id}

    async def fetch_agent_alerts(self, agent_id: str) -> list:
        """Fetch active alerts for a specific agent."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.paperclip_url}/agents/{agent_id}/alerts",
                    timeout=10.0
                )
                return response.json().get("alerts", [])
        except Exception:
            return []

    async def collect_metrics(self) -> dict:
        return {
            **self.stats,
            "active_wizard_sessions": len(self.wizard_sessions),
            "channel_mappings": len(self.CHANNEL_TO_AGENT),
            "supported_platforms": ["slack", "teams", "webex", "google_chat"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        """Receive agent events and broadcast to appropriate channels."""
        event_type = event.get("event_type")
        source = event.get("source_agent")
        payload = event.get("payload", {})

        if event_type in ["critical_endpoint_alert", "pci_scope_violation", "fraud_transaction_blocked",
                          "ato_detected", "siem_critical_alert", "pci_firewall_violation"]:
            severity = payload.get("severity", "high")
            message = json.dumps(payload, indent=2)[:500]  # Truncate for chat
            await self.broadcast_alert(source, severity, message)


if __name__ == "__main__":
    agent = ChatInterfaceAgent()
    asyncio.run(agent.start())
