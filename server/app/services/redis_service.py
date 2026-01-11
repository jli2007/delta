import json
from typing import Optional, Any
import redis

from ..config import get_settings


class JobStore:
    """
    Job storage that uses Redis if available, falls back to in-memory.
    Handles JSON serialization automatically.
    """

    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._memory: dict[str, dict] = {}  # Fallback storage
        self._connect()

    def _connect(self):
        """Try to connect to Redis."""
        settings = get_settings()
        if settings.redis_url:
            try:
                self._redis = redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5
                )
                # Test connection
                self._redis.ping()
                print(f"✓ Connected to Redis")
            except (redis.ConnectionError, redis.TimeoutError) as e:
                print(f"✗ Redis connection failed: {e}")
                print("  Falling back to in-memory storage")
                self._redis = None
        else:
            print("  No REDIS_URL set - using in-memory storage")

    @property
    def is_redis(self) -> bool:
        """Check if using Redis."""
        return self._redis is not None

    def set(self, prefix: str, key: str, value: dict, ttl: int = 3600) -> None:
        """
        Store a job. TTL is in seconds (default 1 hour).
        """
        full_key = f"{prefix}:{key}"
        json_value = json.dumps(value)

        if self._redis:
            self._redis.setex(full_key, ttl, json_value)
        else:
            self._memory[full_key] = value

    def get(self, prefix: str, key: str) -> Optional[dict]:
        """Retrieve a job."""
        full_key = f"{prefix}:{key}"

        if self._redis:
            data = self._redis.get(full_key)
            if data:
                return json.loads(data)
            return None
        else:
            return self._memory.get(full_key)

    def delete(self, prefix: str, key: str) -> None:
        """Delete a job."""
        full_key = f"{prefix}:{key}"

        if self._redis:
            self._redis.delete(full_key)
        else:
            self._memory.pop(full_key, None)

    def get_all(self, prefix: str) -> list[dict]:
        """Get all jobs with a given prefix."""
        if self._redis:
            keys = self._redis.keys(f"{prefix}:*")
            jobs = []
            for key in keys:
                data = self._redis.get(key)
                if data:
                    job = json.loads(data)
                    jobs.append(job)
            return jobs
        else:
            return [
                v for k, v in self._memory.items()
                if k.startswith(f"{prefix}:")
            ]


# Global instance
_job_store: Optional[JobStore] = None


def get_job_store() -> JobStore:
    """Get the global job store instance."""
    global _job_store
    if _job_store is None:
        _job_store = JobStore()
    return _job_store
