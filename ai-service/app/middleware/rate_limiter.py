"""
rate_limiter.py — Request Rate Limiting Middleware.

Implements a per-IP sliding window rate limiter using in-memory counters.
For multi-instance deployments, replace with Redis-backed implementation.

Limits:
  /ai/traffic/analyze  — 30 req/minute (prevents OCR overload)
  /ai/traffic/upload   — 5  req/minute (prevents large video queue flood)
  /ai/lpr/*            — 60 req/minute
  /ai/cameras/add      — 10 req/minute
  Everything else      — 120 req/minute (general limit)
"""
import time
import logging
from collections import defaultdict
from threading import Lock
from typing import Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ── Rate Limit Rules (path_prefix → requests_per_minute) ─────────────────────
RATE_RULES: list[tuple[str, int]] = [
    ("/ai/traffic/upload",    5),    # Video upload — heavy processing
    ("/ai/traffic/analyze",   30),   # Image analysis — OCR + inference
    ("/ai/lpr/",              60),   # LPR endpoints
    ("/ai/cameras/add",       10),   # Camera registration
    ("/ai/slots/analyze",     20),   # Slot analysis
    ("/ai/slots/spatial",     20),   # Spatial analysis
    ("/ai/",                  120),  # General AI endpoints
]

WINDOW_SECONDS = 60


def _get_rule(path: str) -> int:
    """Return the rpm limit for the most specific matching rule."""
    for prefix, limit in RATE_RULES:
        if path.startswith(prefix):
            return limit
    return 120


class _Window:
    """Sliding-window counter for one (ip, path_prefix)."""
    __slots__ = ("count", "window_start")

    def __init__(self):
        self.count        = 0
        self.window_start = time.time()

    def increment(self) -> int:
        now = time.time()
        if now - self.window_start >= WINDOW_SECONDS:
            self.count        = 1
            self.window_start = now
        else:
            self.count += 1
        return self.count


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    IP-based sliding window rate limiter.
    Returns HTTP 429 with Retry-After header when limit exceeded.
    Skips health checks and static files.
    """

    SKIP_PATHS = {"/", "/docs", "/openapi.json", "/ai/health", "/ai/health/models"}

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self._enabled  = enabled
        self._counters: dict[str, _Window] = defaultdict(_Window)
        self._lock     = Lock()
        if enabled:
            logger.info("[RateLimiter] Enabled. Rules: %d path patterns", len(RATE_RULES))
        else:
            logger.info("[RateLimiter] Disabled (set RATE_LIMIT_ENABLED=true to enable).")

    async def dispatch(self, request: Request, call_next):
        if not self._enabled:
            return await call_next(request)

        path = request.url.path
        if path in self.SKIP_PATHS:
            return await call_next(request)

        ip    = self._get_ip(request)
        limit = _get_rule(path)
        key   = f"{ip}:{path[:30]}"

        with self._lock:
            window = self._counters[key]
            count  = window.increment()

        if count > limit:
            retry_after = int(WINDOW_SECONDS - (time.time() - window.window_start))
            logger.warning(
                "[RateLimiter] 429 %s %s — %d/%d req/min",
                ip, path, count, limit,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error":   f"Rate limit exceeded: {limit} requests/minute.",
                    "retry_after_seconds": max(1, retry_after),
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )

        return await call_next(request)

    @staticmethod
    def _get_ip(request: Request) -> str:
        # Respect X-Forwarded-For for reverse proxy setups
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
