"""Request/Response logging middleware with timing and structured output."""
import time
import logging
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("ai_service.requests")

SKIP_LOGGING = {"/ai/health", "/ai/health/models", "/"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every request with:
      - Unique request ID (X-Request-ID header)
      - Client IP
      - Method + path
      - Response status
      - Duration in ms
    Skips health checks to avoid log spam.
    """

    async def dispatch(self, request: Request, call_next):
        if request.url.path in SKIP_LOGGING:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start      = time.perf_counter()
        ip         = self._get_ip(request)

        try:
            response  = await call_next(request)
            elapsed   = (time.perf_counter() - start) * 1000
            status    = response.status_code
            log_fn    = logger.warning if status >= 400 else logger.info

            log_fn(
                "[%s] %s %s %s → %d (%.0fms)",
                request_id, ip, request.method, request.url.path, status, elapsed,
            )

            response.headers["X-Request-ID"]   = request_id
            response.headers["X-Response-Time"] = f"{elapsed:.0f}ms"
            return response

        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(
                "[%s] %s %s %s → 500 ERROR (%.0fms): %s",
                request_id, ip, request.method, request.url.path, elapsed, e,
            )
            raise

    @staticmethod
    def _get_ip(request: Request) -> str:
        fwd = request.headers.get("X-Forwarded-For")
        return fwd.split(",")[0].strip() if fwd else (
            request.client.host if request.client else "unknown"
        )
