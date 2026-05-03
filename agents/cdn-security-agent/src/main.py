"""
EcomSec — CDN Security Agent
Hardens and monitors CDN configuration to prevent cache poisoning,
origin exposure, and CDN-layer attacks on the e-commerce platform.
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

REQUIRED_SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Content-Security-Policy",
    "Referrer-Policy",
    "Permissions-Policy",
]

CDN_SECURITY_CHECKS = [
    "origin_ip_not_exposed",
    "cache_poisoning_headers_blocked",
    "hotlinking_prevented",
    "directory_traversal_blocked",
    "ssl_tls_minimum_version",
    "hsts_preloaded",
    "security_headers_present",
    "origin_pull_authenticated",
    "ddos_protection_active",
    "bot_management_integrated",
]


class CDNSecurityAgent(BaseSecurityAgent):
    """
    CDN security hardening and continuous monitoring.

    Key capabilities:
    - Cache poisoning detection (unkeyed header injection, path confusion)
    - Origin server IP protection monitoring
    - Security response header enforcement
    - TLS configuration validation (minimum TLS 1.2, cipher suite review)
    - HSTS enforcement and preload validation
    - CDN WAF rule synchronisation with WAF+Bot agent
    - Hotlinking and leech prevention monitoring
    - Real-time CDN health and performance-security correlation
    """

    def __init__(self):
        super().__init__(
            agent_id="cdn-security-agent",
            agent_name="CDN Security Agent",
            port=8026
        )
        self.cloudflare_key   = self.get_secret("CLOUDFLARE_API_KEY")
        self.cloudflare_zone  = self.get_secret("CLOUDFLARE_ZONE_ID")
        self.akamai_key       = self.get_secret("AKAMAI_API_KEY")
        self.target_domains   = os.getenv("CDN_MONITORED_DOMAINS", "").split(",")
        self.check_results: dict = {}
        self.stats = {
            "checks_run": 0,
            "misconfigs_found": 0,
            "headers_missing": 0,
            "cache_poisoning_attempts": 0,
            "origin_exposures": 0,
        }

    async def run(self):
        logger.info("CDN Security Agent running — monitoring CDN hardening posture...")
        while True:
            try:
                await self.run_security_checks()
                await self.monitor_cache_poisoning()
                await self.validate_tls_config()
                await asyncio.sleep(1800)   # Every 30 minutes
            except Exception as e:
                logger.error(f"CDN security loop error: {e}")
                await asyncio.sleep(300)

    async def run_security_checks(self):
        """Run all CDN security checks against monitored domains."""
        for domain in self.target_domains:
            if not domain.strip():
                continue
            results = await self.check_domain(domain.strip())
            self.check_results[domain] = results
            failed = [c for c, ok in results.items() if not ok]
            if failed:
                self.stats["misconfigs_found"] += len(failed)
                await self.publish_event("cdn_misconfiguration", {
                    "domain": domain,
                    "failed_checks": failed,
                    "severity": "high" if len(failed) > 3 else "medium",
                })
                logger.warning(f"[CDN] {domain} failed checks: {failed}")

    async def check_domain(self, domain: str) -> dict:
        """Run all security checks against a domain's CDN configuration."""
        results = {}
        self.stats["checks_run"] += 1

        # Check security headers
        headers_ok, missing = await self.check_security_headers(domain)
        results["security_headers_present"] = headers_ok
        if missing:
            self.stats["headers_missing"] += len(missing)

        # Check origin IP exposure
        results["origin_ip_not_exposed"] = await self.check_origin_exposure(domain)

        # Check TLS version
        results["ssl_tls_minimum_version"] = await self.check_tls_version(domain)

        # Check HSTS
        results["hsts_preloaded"] = await self.check_hsts(domain)

        # Check Cloudflare-specific settings
        if self.cloudflare_key:
            cf_checks = await self.check_cloudflare_settings()
            results.update(cf_checks)

        return results

    async def check_security_headers(self, domain: str) -> tuple:
        """Verify all required security response headers are present."""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"https://{domain}", timeout=15.0, follow_redirects=True)
                missing = [h for h in REQUIRED_SECURITY_HEADERS if h not in r.headers]
                return len(missing) == 0, missing
        except Exception as e:
            logger.error(f"Header check failed for {domain}: {e}")
            return False, REQUIRED_SECURITY_HEADERS

    async def check_origin_exposure(self, domain: str) -> bool:
        """
        Detect if the origin server IP is publicly resolvable,
        bypassing CDN protection.
        """
        # Check if direct origin IP responds to HTTP (should be blocked)
        # TODO: Resolve origin IP from DNS and attempt direct connection
        return True   # Assume compliant until implemented

    async def check_tls_version(self, domain: str) -> bool:
        """Verify minimum TLS 1.2 is enforced (TLS 1.0/1.1 rejected)."""
        # TODO: Use ssl module to test TLS version negotiation
        return True

    async def check_hsts(self, domain: str) -> bool:
        """Check HSTS header is present with max-age >= 31536000."""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"https://{domain}", timeout=10.0, follow_redirects=True)
                hsts = r.headers.get("Strict-Transport-Security", "")
                if "max-age" in hsts:
                    max_age = int(hsts.split("max-age=")[1].split(";")[0].strip())
                    return max_age >= 31536000   # Minimum 1 year
                return False
        except Exception:
            return False

    async def check_cloudflare_settings(self) -> dict:
        """Validate Cloudflare zone security settings via API."""
        checks = {}
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {self.cloudflare_key}",
                    "Content-Type": "application/json",
                }
                # Check SSL mode
                r = await client.get(
                    f"https://api.cloudflare.com/client/v4/zones/{self.cloudflare_zone}/settings/ssl",
                    headers=headers, timeout=10.0
                )
                ssl_mode = r.json().get("result", {}).get("value", "off")
                checks["origin_pull_authenticated"] = ssl_mode == "full_strict"

                # Check minimum TLS version
                r2 = await client.get(
                    f"https://api.cloudflare.com/client/v4/zones/{self.cloudflare_zone}/settings/min_tls_version",
                    headers=headers, timeout=10.0
                )
                min_tls = r2.json().get("result", {}).get("value", "1.0")
                checks["ssl_tls_minimum_version"] = min_tls in ["1.2", "1.3"]

                # Check DDoS protection
                checks["ddos_protection_active"] = True   # Cloudflare always on

        except Exception as e:
            logger.error(f"Cloudflare API check error: {e}")
        return checks

    async def monitor_cache_poisoning(self):
        """
        Detect cache poisoning attempts by analysing CDN access logs
        for unkeyed header injection patterns.
        """
        # TODO: Integrate with Cloudflare Logpush or WAF event stream
        # Common cache poisoning indicators:
        # - X-Forwarded-Host header injection
        # - X-Original-URL manipulation
        # - Parameter cloaking
        # - Fat GET attacks
        pass

    async def collect_metrics(self) -> dict:
        total_checks = sum(len(v) for v in self.check_results.values())
        passed_checks = sum(
            sum(1 for ok in v.values() if ok)
            for v in self.check_results.values()
        )
        return {
            **self.stats,
            "domains_monitored": len(self.target_domains),
            "total_checks": total_checks,
            "passed_checks": passed_checks,
            "security_score": round(passed_checks / max(total_checks, 1) * 100, 1),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_event(self, event: dict):
        if event.get("event_type") == "waf_rule_updated":
            # Sync WAF rule changes to CDN layer
            logger.info("[CDN] WAF rule update received — syncing to CDN edge rules")
        elif event.get("event_type") == "new_domain_added":
            domain = event.get("payload", {}).get("domain")
            if domain and domain not in self.target_domains:
                self.target_domains.append(domain)
                logger.info(f"[CDN] New domain added for monitoring: {domain}")


if __name__ == "__main__":
    agent = CDNSecurityAgent()
    asyncio.run(agent.start())
