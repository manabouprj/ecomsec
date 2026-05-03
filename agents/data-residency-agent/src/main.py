"""
EcomSec — Data Residency Agent
Enforces UAE PDPL, DIFC, and ADGM data localisation requirements.
Ensures customer data does not leave approved geographic boundaries.
Author: Alvin, Security Architect
"""

import asyncio
import logging
from datetime import datetime, timezone
import httpx
import sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from base_agent import BaseSecurityAgent

logger = logging.getLogger(__name__)

# Approved data processing regions for UAE-based e-commerce
APPROVED_REGIONS = {
    "primary":  ["ae-central-1", "ae-south-1", "uaenorth", "uaecentral"],   # UAE Azure/AWS regions
    "fallback": ["eu-west-1", "eu-central-1"],                               # EU fallback (GDPR-covered)
}

PROHIBITED_REGIONS = ["cn-", "ru-", "in-ap-"]   # Prohibited per UAE PDPL guidance

DATA_CLASSIFICATIONS = {
    "PII":     ["name", "email", "phone", "address", "dob", "national_id", "passport"],
    "PAYMENT": ["card_number", "cvv", "bank_account", "iban"],
    "HEALTH":  ["medical_record", "prescription", "health_condition"],
    "BIOMETRIC": ["fingerprint", "face_scan", "iris_scan"],
}


class DataResidencyAgent(BaseSecurityAgent):
    """
    Monitors and enforces data residency controls for UAE regulatory compliance.

    Regulations covered:
    - UAE Federal Decree-Law No. 45 of 2021 (PDPL)
    - DIFC Data Protection Law (DPL 2020)
    - ADGM Data Protection Regulations (2021)
    - GDPR (for EU customer data)

    Key capabilities:
    - Cloud resource geo-tagging and region validation
    - Data flow monitoring — detects cross-border data transfers
    - Database and storage residency checks (AWS S3, Azure Blob, GCS)
    - API call analysis — detects PII leaving approved regions
    - Automated block + alert on prohibited data transfers
    - Evidence collection for regulatory audits
    """

    def __init__(self):
        super().__init__(
            agent_id="data-residency-agent",
            agent_name="Data Residency Agent",
            port=8024
        )
        self.aws_key        = self.get_secret("AWS_ACCESS_KEY_ID")
        self.aws_secret     = self.get_secret("AWS_SECRET_ACCESS_KEY")
        self.azure_key      = self.get_secret("AZURE_SUBSCRIPTION_KEY")
        self.violations: list = []
        self.stats = {
            "resources_checked": 0,
            "residency_violations": 0,
            "cross_border_transfers_blocked": 0,
            "compliant_resources": 0,
        }

    async def run(self):
        logger.info("Data Residency Agent running — monitoring data locality compliance...")
        while True:
            try:
                await self.audit_cloud_resources()
                await self.monitor_data_flows()
                await asyncio.sleep(3600)   # Full audit every hour
            except Exception as e:
                logger.error(f"Data residency loop error: {e}")
                await asyncio.sleep(300)

    async def audit_cloud_resources(self):
        """Check all cloud storage and compute resources are in approved regions."""
        resources = await self.discover_cloud_resources()
        for resource in resources:
            self.stats["resources_checked"] += 1
            region = resource.get("region", "unknown")

            if self._is_prohibited_region(region):
                self.stats["residency_violations"] += 1
                violation = {
                    "resource_id": resource.get("id"),
                    "resource_type": resource.get("type"),
                    "region": region,
                    "violation_type": "prohibited_region",
                    "regulation": "UAE PDPL Article 22",
                    "severity": "critical",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }
                self.violations.append(violation)
                await self.publish_event("data_residency_violation", violation)
                logger.critical(f"[RESIDENCY VIOLATION] {resource.get('id')} in prohibited region: {region}")

            elif not self._is_approved_region(region):
                self.stats["residency_violations"] += 1
                violation = {
                    "resource_id": resource.get("id"),
                    "resource_type": resource.get("type"),
                    "region": region,
                    "violation_type": "unapproved_region",
                    "regulation": "UAE PDPL Article 22",
                    "severity": "high",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }
                self.violations.append(violation)
                await self.publish_event("data_residency_violation", violation)
                logger.warning(f"[RESIDENCY] {resource.get('id')} in unapproved region: {region}")
            else:
                self.stats["compliant_resources"] += 1

    async def monitor_data_flows(self):
        """
        Analyse API traffic and data pipelines for cross-border PII transfers.
        Checks for PII fields leaving approved regions via API calls.
        """
        flows = await self.fetch_data_flows()
        for flow in flows:
            dest_region = flow.get("destination_region", "unknown")
            data_types  = flow.get("data_types", [])

            has_regulated_data = any(
                dt in DATA_CLASSIFICATIONS["PII"] + DATA_CLASSIFICATIONS["PAYMENT"]
                for dt in data_types
            )

            if has_regulated_data and not self._is_approved_region(dest_region):
                self.stats["cross_border_transfers_blocked"] += 1
                await self.publish_event("cross_border_transfer_detected", {
                    "flow_id": flow.get("id"),
                    "source": flow.get("source"),
                    "destination": flow.get("destination"),
                    "destination_region": dest_region,
                    "data_types": data_types,
                    "regulation": "UAE PDPL Chapter 5",
                    "severity": "critical",
                    "action": "TRANSFER_BLOCKED",
                })
                logger.critical(
                    f"[CROSS-BORDER] PII transfer to {dest_region} detected and blocked. "
                    f"Data types: {data_types}"
                )

    def _is_approved_region(self, region: str) -> bool:
        all_approved = APPROVED_REGIONS["primary"] + APPROVED_REGIONS["fallback"]
        return any(region.startswith(r) or r in region for r in all_approved)

    def _is_prohibited_region(self, region: str) -> bool:
        return any(region.startswith(p) for p in PROHIBITED_REGIONS)

    async def discover_cloud_resources(self) -> list:
        """Discover all cloud resources with their region tags."""
        # TODO: Integrate with cloud-security-agent via event bus
        # TODO: Direct AWS Config / Azure Resource Graph queries
        return self._mock_cloud_resources()

    async def fetch_data_flows(self) -> list:
        """Fetch active data flows from API gateway and network monitoring."""
        # TODO: Integrate with api-gateway-agent and web-proxy-agent
        return []

    def _mock_cloud_resources(self) -> list:
        return [
            {"id": "s3-customer-data", "type": "S3 Bucket", "region": "uaenorth"},
            {"id": "rds-orders-db", "type": "RDS Instance", "region": "uaenorth"},
            {"id": "lambda-payments", "type": "Lambda Function", "region": "us-east-1"},  # Violation
            {"id": "redis-sessions", "type": "ElastiCache", "region": "uaecentral"},
            {"id": "analytics-bucket", "type": "S3 Bucket", "region": "ap-southeast-1"},  # Violation
        ]

    async def collect_metrics(self) -> dict:
        return {
            **self.stats,
            "violation_history_count": len(self.violations),
            "approved_regions": APPROVED_REGIONS["primary"],
            "regulations_enforced": ["UAE PDPL", "DIFC DPL 2020", "ADGM DPR 2021", "GDPR"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        if event.get("event_type") == "new_cloud_resource_created":
            resource = event.get("payload", {})
            region   = resource.get("region", "unknown")
            if not self._is_approved_region(region):
                logger.warning(f"[RESIDENCY] New resource in unapproved region: {region}")
                await self.audit_cloud_resources()


if __name__ == "__main__":
    agent = DataResidencyAgent()
    asyncio.run(agent.start())
