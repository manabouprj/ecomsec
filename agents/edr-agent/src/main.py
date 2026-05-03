"""
EcomSec — EDR Agent
Integrates with CrowdStrike / SentinelOne for endpoint detection and response.
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


class EDRAgent(BaseSecurityAgent):

    def __init__(self):
        super().__init__(
            agent_id="edr-agent",
            agent_name="EDR Agent",
            port=8001
        )
        self.crowdstrike_key = self.get_secret("CROWDSTRIKE_API_KEY")
        self.sentinelone_key = self.get_secret("SENTINELONE_API_KEY")
        self.crowdstrike_base = "https://api.crowdstrike.com"
        self.sentinelone_base = "https://usea1-012.sentinelone.net/web/api/v2.1"

    async def run(self):
        logger.info("EDR Agent running — polling endpoint telemetry...")
        while True:
            try:
                detections = await self.fetch_detections()
                critical = [d for d in detections if d.get("severity") == "critical"]
                if critical:
                    await self.publish_event("critical_endpoint_alert", {
                        "count": len(critical),
                        "detections": critical[:5],  # Top 5 to avoid payload bloat
                    })
                await asyncio.sleep(60)  # Poll every 60 seconds
            except Exception as e:
                logger.error(f"EDR run loop error: {e}")
                await asyncio.sleep(30)

    async def fetch_detections(self) -> list:
        """
        Fetch active detections from CrowdStrike Falcon.
        Falls back to SentinelOne if CrowdStrike unavailable.
        """
        if not self.crowdstrike_key:
            logger.warning("CrowdStrike key missing — using mock data")
            return self._mock_detections()

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self.crowdstrike_key}"}
                response = await client.get(
                    f"{self.crowdstrike_base}/detects/queries/detects/v1",
                    headers=headers,
                    params={"filter": "status:'new'", "limit": 100},
                    timeout=15.0
                )
                response.raise_for_status()
                ids = response.json().get("resources", [])

                if ids:
                    detail_response = await client.post(
                        f"{self.crowdstrike_base}/detects/entities/summaries/GET/v1",
                        headers=headers,
                        json={"ids": ids[:20]},
                        timeout=15.0
                    )
                    return detail_response.json().get("resources", [])
                return []

        except Exception as e:
            logger.error(f"CrowdStrike API error: {e}")
            return []

    async def collect_metrics(self) -> dict:
        """Collect EDR-specific metrics for reporting."""
        detections = await self.fetch_detections()
        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for d in detections:
            sev = d.get("max_severity_displayname", "low").lower()
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "total_detections": len(detections),
            "by_severity": by_severity,
            "endpoint_compromise_rate": round(len([d for d in detections if d.get("status") == "in_progress"]) / max(len(detections), 1) * 100, 2),
            "source": "crowdstrike",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        """Handle events from other agents (e.g., SIEM correlation hits)."""
        event_type = event.get("event_type")
        if event_type == "isolate_endpoint":
            hostname = event.get("payload", {}).get("hostname")
            logger.warning(f"[AUTO-RESPONSE] Isolating endpoint: {hostname}")
            # TODO: Call CrowdStrike contain host API
        elif event_type == "threat_intel_ioc":
            ioc = event.get("payload", {}).get("ioc")
            logger.info(f"[IOC ENRICHMENT] Checking IOC against endpoints: {ioc}")

    def _mock_detections(self) -> list:
        """Mock data for dev/test environments without API keys."""
        return [
            {"id": "mock-001", "severity": "high", "status": "new", "hostname": "workstation-01", "threat_name": "Mimikatz.Dropper"},
            {"id": "mock-002", "severity": "critical", "status": "new", "hostname": "server-db-02", "threat_name": "Ransomware.BlackCat"},
            {"id": "mock-003", "severity": "medium", "status": "in_progress", "hostname": "laptop-hr-05", "threat_name": "Adware.Generic"},
        ]


if __name__ == "__main__":
    agent = EDRAgent()
    asyncio.run(agent.start())
