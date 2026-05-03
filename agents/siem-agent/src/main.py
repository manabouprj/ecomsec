"""
EcomSec — SIEM Agent
Central log aggregation, correlation, and alert triage.
Integrates with Splunk / Microsoft Sentinel.
Author: Alvin, Security Architect
"""

import asyncio
import logging
from datetime import datetime, timezone
import httpx
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from base_agent import BaseSecurityAgent

logger = logging.getLogger(__name__)


class SIEMAgent(BaseSecurityAgent):

    def __init__(self):
        super().__init__(
            agent_id="siem-agent",
            agent_name="SIEM Agent",
            port=8005
        )
        self.splunk_key = self.get_secret("SPLUNK_API_KEY")
        self.splunk_host = os.getenv("SPLUNK_HOST", "https://splunk.internal:8089")
        self.sentinel_key = self.get_secret("SENTINEL_API_KEY")
        self.alert_queue: list = []

    async def run(self):
        logger.info("SIEM Agent running — aggregating logs and correlating alerts...")
        while True:
            try:
                alerts = await self.fetch_alerts()
                critical_alerts = [a for a in alerts if a.get("severity") in ["critical", "high"]]

                for alert in critical_alerts:
                    enriched = await self.enrich_alert(alert)
                    await self.publish_event("siem_critical_alert", enriched)

                self.alert_queue = alerts
                await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"SIEM run loop error: {e}")
                await asyncio.sleep(15)

    async def fetch_alerts(self) -> list:
        """Fetch open alerts from Splunk via REST API."""
        if not self.splunk_key:
            logger.warning("Splunk key missing — returning mock alerts")
            return self._mock_alerts()

        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.splunk_host}/services/saved/searches",
                    headers={"Authorization": f"Splunk {self.splunk_key}"},
                    params={"output_mode": "json", "search": "alert_type=triggered"},
                    timeout=20.0
                )
                response.raise_for_status()
                return response.json().get("entry", [])
        except Exception as e:
            logger.error(f"Splunk fetch error: {e}")
            return []

    async def enrich_alert(self, alert: dict) -> dict:
        """Enrich alert with asset and threat intel context."""
        return {
            **alert,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
            "source_agent": "siem-agent",
            "mitre_tactic": self._map_to_mitre(alert.get("alert_name", "")),
        }

    def _map_to_mitre(self, alert_name: str) -> str:
        """Basic MITRE ATT&CK tactic mapping."""
        mappings = {
            "lateral_movement": "TA0008",
            "credential_dump": "TA0006",
            "exfil": "TA0010",
            "c2": "TA0011",
            "persistence": "TA0003",
        }
        for key, tactic in mappings.items():
            if key in alert_name.lower():
                return tactic
        return "TA0000"  # Unknown

    async def collect_metrics(self) -> dict:
        alerts = self.alert_queue
        return {
            "total_alerts": len(alerts),
            "critical": len([a for a in alerts if a.get("severity") == "critical"]),
            "high": len([a for a in alerts if a.get("severity") == "high"]),
            "true_positive_rate": 0.72,  # TODO: Calculate from feedback loop
            "mttd_minutes": 4.2,
            "coverage_sources": ["edr", "dns", "email", "proxy", "waf", "api"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        """Receive events from all other agents and correlate."""
        source = event.get("source_agent")
        event_type = event.get("event_type")
        logger.info(f"[CORRELATION] Event received from {source}: {event_type}")
        # Correlation logic — check for multi-source attack patterns
        # e.g., EDR alert + DNS C2 callback from same host = HIGH confidence attack
        if source == "edr-agent" and event_type == "critical_endpoint_alert":
            await self.publish_event("trigger_incident_response", event.get("payload"))

    def _mock_alerts(self) -> list:
        return [
            {"alert_name": "credential_dump_detected", "severity": "critical", "host": "dc-01"},
            {"alert_name": "lateral_movement_smb", "severity": "high", "host": "workstation-07"},
            {"alert_name": "dns_c2_callback", "severity": "high", "host": "laptop-dev-03"},
        ]


if __name__ == "__main__":
    agent = SIEMAgent()
    asyncio.run(agent.start())
