import json
import redis
from app.config.settings import settings

# Singleton Redis connection
_redis_client: redis.Redis = None


def get_redis_client() -> redis.Redis:
    """Get or create Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
    return _redis_client


def cache_set(key: str, value: dict | list, ttl: int = 10) -> bool:
    """Set a cache entry with TTL. Default TTL is 10 seconds."""
    try:
        client = get_redis_client()
        serialized = json.dumps(value, default=str)
        client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        print(f"[Redis] cache_set error for key '{key}': {e}")
        return False


def cache_get(key: str) -> dict | list | None:
    """Get a cache entry. Returns None if not found or error."""
    try:
        client = get_redis_client()
        data = client.get(key)
        if data is None:
            return None
        return json.loads(data)
    except Exception as e:
        print(f"[Redis] cache_get error for key '{key}': {e}")
        return None


def cache_delete(key: str) -> bool:
    """Delete a cache entry."""
    try:
        client = get_redis_client()
        client.delete(key)
        return True
    except Exception as e:
        print(f"[Redis] cache_delete error for key '{key}': {e}")
        return False


def cache_invalidate_pattern(pattern: str) -> bool:
    """Delete all keys matching a pattern."""
    try:
        client = get_redis_client()
        keys = client.keys(pattern)
        if keys:
            client.delete(*keys)
        return True
    except Exception as e:
        print(f"[Redis] cache_invalidate_pattern error for '{pattern}': {e}")
        return False


# ── Cache key helpers ──────────────────────────────────────────────
CACHE_TTL_SHORT = 10  # seconds

SLOTS_ALL_KEY = "slots_all"
LOGS_RECENT_KEY = "logs_recent"


def slot_by_id_key(slot_id: int) -> str:
    return f"slot_{slot_id}"
