"""
EcomSec — Base Agent Class
All security agents inherit from this base.
Author: Alvin, Security Architect
"""

import os
import logging
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


class BaseSecurityAgent(ABC):
    """
    Abstract base class for all EcomSec security agents.
    Provides: health check, event publishing, metric reporting,
    Paperclip registration, and secrets retrieval.
    """

    def __init__(self, agent_id: str, agent_name: str, port: int):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.port = port
        self.started_at = datetime.now(timezone.utc)
        self.status = "initializing"
        self.metrics: dict = {}
        self.event_bus_url = os.getenv("PAPERCLIP_EVENT_BUS_URL", "http://localhost:9000/events")
        self.paperclip_url = os.getenv("PAPERCLIP_ORCHESTRATOR_URL", "http://localhost:9000")

        logging.basicConfig(
            level=logging.INFO,
            format=f"%(asctime)s [{self.agent_id}] %(levelname)s %(message)s"
        )

    @abstractmethod
    async def run(self):
        """Main agent execution loop. Must be implemented by each agent."""
        pass

    @abstractmethod
    async def collect_metrics(self) -> dict:
        """Collect and return agent-specific security metrics."""
        pass

    @abstractmethod
    async def process_event(self, event: dict):
        """Handle incoming events from the Paperclip event bus."""
        pass

    def get_secret(self, env_key: str) -> Optional[str]:
        """
        Retrieve a secret from environment (injected by vault).
        NEVER hardcode secrets — always use this method.
        """
        value = os.getenv(env_key)
        if not value:
            logger.warning(f"Secret '{env_key}' not found in environment. Check vault injection.")
        return value

    async def health_check(self) -> dict:
        """Standard health check response for Paperclip monitoring."""
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "uptime_seconds": (datetime.now(timezone.utc) - self.started_at).total_seconds(),
            "last_metrics_collected": self.metrics.get("collected_at"),
        }

    async def publish_event(self, event_type: str, payload: dict):
        """Publish an event to the Paperclip async event bus."""
        event = {
            "source_agent": self.agent_id,
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.event_bus_url,
                    json=event,
                    timeout=10.0
                )
                response.raise_for_status()
                logger.info(f"Event published: {event_type}")
        except Exception as e:
            logger.error(f"Failed to publish event '{event_type}': {e}")

    async def report_metrics(self):
        """Collect and push metrics to the Risk Dashboard Agent."""
        self.metrics = await self.collect_metrics()
        self.metrics["collected_at"] = datetime.now(timezone.utc).isoformat()
        await self.publish_event("metrics_update", {
            "agent_id": self.agent_id,
            "metrics": self.metrics
        })
        logger.info(f"Metrics reported: {list(self.metrics.keys())}")

    async def register_with_paperclip(self):
        """Self-register with the Paperclip orchestration layer on startup."""
        registration = {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "port": self.port,
            "health_endpoint": f"http://localhost:{self.port}/health",
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.paperclip_url}/agents/register",
                    json=registration,
                    timeout=10.0
                )
                response.raise_for_status()
                self.status = "running"
                logger.info(f"Agent '{self.agent_id}' registered with Paperclip")
        except Exception as e:
            logger.error(f"Paperclip registration failed: {e}")
            self.status = "registration_failed"

    async def start(self):
        """Bootstrap sequence: register → run metrics loop → main loop."""
        logger.info(f"Starting {self.agent_name}...")
        await self.register_with_paperclip()
        asyncio.create_task(self._metrics_loop())
        await self.run()

    async def _metrics_loop(self):
        """Report metrics every 5 minutes."""
        while True:
            await asyncio.sleep(300)
            await self.report_metrics()
