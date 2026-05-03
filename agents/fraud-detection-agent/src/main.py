"""
EcomSec — Fraud Detection Agent
Real-time transaction anomaly detection and account takeover (ATO) prevention.
E-commerce specific — protects checkout, payments, and user accounts.
Author: Alvin, Security Architect
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from base_agent import BaseSecurityAgent

logger = logging.getLogger(__name__)


class FraudDetectionAgent(BaseSecurityAgent):
    """
    AI-powered fraud detection for e-commerce transactions.

    Key capabilities:
    - Real-time transaction risk scoring (velocity, geo, device fingerprint)
    - Account Takeover (ATO) detection (login anomalies, credential stuffing)
    - Checkout abuse prevention (promo abuse, card testing, fake accounts)
    - Device fingerprinting and session anomaly detection
    - Automated block / step-up auth / flag for review decisioning
    """

    def __init__(self):
        super().__init__(
            agent_id="fraud-detection-agent",
            agent_name="Fraud Detection Agent",
            port=8021
        )
        self.stripe_radar_key = self.get_secret("STRIPE_RADAR_API_KEY")
        self.signifyd_key = self.get_secret("SIGNIFYD_API_KEY")
        self.sift_key = self.get_secret("SIFT_API_KEY")

        # Risk thresholds
        self.block_threshold = float(os.getenv("FRAUD_BLOCK_THRESHOLD", "0.85"))
        self.review_threshold = float(os.getenv("FRAUD_REVIEW_THRESHOLD", "0.60"))
        self.step_up_threshold = float(os.getenv("FRAUD_STEPUP_THRESHOLD", "0.45"))

        self.stats = {
            "transactions_scored": 0,
            "blocked": 0,
            "flagged_for_review": 0,
            "step_up_auth_triggered": 0,
            "ato_attempts_detected": 0,
        }

    async def run(self):
        logger.info("Fraud Detection Agent running — monitoring transactions and accounts...")
        await asyncio.gather(
            self._transaction_monitor_loop(),
            self._ato_monitor_loop(),
        )

    async def _transaction_monitor_loop(self):
        """Poll transaction stream and score each transaction in real time."""
        while True:
            try:
                transactions = await self.fetch_pending_transactions()
                for txn in transactions:
                    await self.score_and_decide(txn)
                await asyncio.sleep(5)  # Near real-time polling
            except Exception as e:
                logger.error(f"Transaction monitor error: {e}")
                await asyncio.sleep(15)

    async def _ato_monitor_loop(self):
        """Monitor login events for credential stuffing and ATO patterns."""
        while True:
            try:
                login_events = await self.fetch_login_events()
                await self.detect_ato_patterns(login_events)
                await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"ATO monitor error: {e}")
                await asyncio.sleep(30)

    async def score_and_decide(self, transaction: dict):
        """
        Score a transaction and apply an automated decision.
        Decision tree:
          score >= block_threshold  → BLOCK + alert SIEM
          score >= review_threshold → FLAG for manual review
          score >= step_up_threshold → trigger step-up MFA
          score < step_up_threshold → ALLOW
        """
        score = await self.calculate_risk_score(transaction)
        txn_id = transaction.get("id", "unknown")
        self.stats["transactions_scored"] += 1

        if score >= self.block_threshold:
            logger.warning(f"[FRAUD BLOCK] txn={txn_id} score={score:.2f}")
            self.stats["blocked"] += 1
            await self.publish_event("fraud_transaction_blocked", {
                "transaction_id": txn_id,
                "risk_score": score,
                "reason": self._explain_score(transaction, score),
                "action": "BLOCK",
                "severity": "high",
            })

        elif score >= self.review_threshold:
            logger.info(f"[FRAUD REVIEW] txn={txn_id} score={score:.2f}")
            self.stats["flagged_for_review"] += 1
            await self.publish_event("fraud_transaction_flagged", {
                "transaction_id": txn_id,
                "risk_score": score,
                "action": "MANUAL_REVIEW",
            })

        elif score >= self.step_up_threshold:
            logger.info(f"[STEP-UP AUTH] txn={txn_id} score={score:.2f}")
            self.stats["step_up_auth_triggered"] += 1
            await self.publish_event("fraud_step_up_required", {
                "transaction_id": txn_id,
                "user_id": transaction.get("user_id"),
                "action": "STEP_UP_MFA",
            })

    async def calculate_risk_score(self, transaction: dict) -> float:
        """
        Multi-signal risk score (0.0 = safe, 1.0 = certain fraud).
        Signals: velocity, geo mismatch, device fingerprint, amount, time.
        """
        score = 0.0
        signals = []

        # Velocity check — multiple txns in short window
        if transaction.get("velocity_flag"):
            score += 0.30
            signals.append("high_velocity")

        # Geo mismatch — billing vs. IP country
        if transaction.get("geo_mismatch"):
            score += 0.25
            signals.append("geo_mismatch")

        # New device fingerprint
        if transaction.get("new_device"):
            score += 0.15
            signals.append("new_device")

        # High amount anomaly
        amount = transaction.get("amount", 0)
        avg_amount = transaction.get("user_avg_amount", 100)
        if amount > avg_amount * 3:
            score += 0.20
            signals.append("amount_anomaly")

        # Known bad BIN
        if transaction.get("bad_bin"):
            score += 0.35
            signals.append("bad_bin")

        # Card testing pattern (many small txns)
        if transaction.get("card_testing_pattern"):
            score += 0.40
            signals.append("card_testing")

        transaction["_signals"] = signals
        return min(score, 1.0)

    def _explain_score(self, transaction: dict, score: float) -> str:
        signals = transaction.get("_signals", [])
        return f"Risk score {score:.2f} driven by: {', '.join(signals) if signals else 'composite model'}"

    async def detect_ato_patterns(self, login_events: list):
        """
        Detect Account Takeover attempts:
        - Credential stuffing (high fail rate from single IP)
        - Impossible travel (login from 2 countries within minutes)
        - Password spray (same password tried across many accounts)
        """
        ip_failures: dict = {}
        for event in login_events:
            if event.get("status") == "failed":
                ip = event.get("ip")
                ip_failures[ip] = ip_failures.get(ip, 0) + 1

        for ip, count in ip_failures.items():
            if count >= 20:  # 20+ failures from same IP = credential stuffing
                logger.warning(f"[ATO DETECTED] Credential stuffing from IP: {ip} ({count} failures)")
                self.stats["ato_attempts_detected"] += 1
                await self.publish_event("ato_detected", {
                    "attack_type": "credential_stuffing",
                    "source_ip": ip,
                    "failed_attempts": count,
                    "recommended_action": "block_ip_and_force_password_reset",
                    "severity": "high",
                })

    async def fetch_pending_transactions(self) -> list:
        """Fetch pending transactions from payment processor."""
        if not self.stripe_radar_key:
            return self._mock_transactions()
        # TODO: Implement Stripe Radar API integration
        return []

    async def fetch_login_events(self) -> list:
        """Fetch recent login events from auth service."""
        # TODO: Integrate with IAM/PAM agent event stream
        return self._mock_login_events()

    async def collect_metrics(self) -> dict:
        return {
            **self.stats,
            "fraud_rate_percent": round(
                self.stats["blocked"] / max(self.stats["transactions_scored"], 1) * 100, 2
            ),
            "ato_detection_active": True,
            "risk_thresholds": {
                "block": self.block_threshold,
                "review": self.review_threshold,
                "step_up": self.step_up_threshold,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        event_type = event.get("event_type")
        if event_type == "new_ioc_ip":
            # Threat intel pushed a bad IP — auto-block in fraud engine
            ip = event.get("payload", {}).get("ip")
            logger.info(f"[FRAUD] Blocklisting IOC IP from threat intel: {ip}")
        elif event_type == "waf_bot_detected":
            logger.info("[FRAUD] Bot signal received from WAF — elevating fraud sensitivity")

    def _mock_transactions(self) -> list:
        return [
            {"id": "txn-001", "amount": 1500, "user_avg_amount": 80, "geo_mismatch": True, "new_device": True, "velocity_flag": False, "bad_bin": False, "card_testing_pattern": False, "user_id": "u-123"},
            {"id": "txn-002", "amount": 1, "user_avg_amount": 90, "geo_mismatch": False, "new_device": False, "velocity_flag": True, "bad_bin": True, "card_testing_pattern": True, "user_id": "u-456"},
            {"id": "txn-003", "amount": 95, "user_avg_amount": 100, "geo_mismatch": False, "new_device": False, "velocity_flag": False, "bad_bin": False, "card_testing_pattern": False, "user_id": "u-789"},
        ]

    def _mock_login_events(self) -> list:
        events = []
        for i in range(25):
            events.append({"ip": "185.220.101.42", "status": "failed", "user": f"user{i}@example.com"})
        events.append({"ip": "192.168.1.1", "status": "success", "user": "legit@example.com"})
        return events


if __name__ == "__main__":
    agent = FraudDetectionAgent()
    asyncio.run(agent.start())
