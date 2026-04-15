import time
import redis # type: ignore
from fastapi import Request, HTTPException
from app.core.redis_client import get_redis_client

def rate_limit(limit: int = 100, window: int = 60):
    """
    Dependency to rate limit requests.
    limit: max requests per window.
    window: time window in seconds.
    """
    def _rate_limit_dep(request: Request):
        redis_client = get_redis_client()
        client_ip = request.client.host if request.client else "127.0.0.1"
        key = f"rate_limit:{client_ip}:{request.url.path}"

        try:
            current = redis_client.get(key)
            if current and int(current) > limit:
                raise HTTPException(status_code=429, detail="Too Many Requests")
            
            pipeline = redis_client.pipeline()
            pipeline.incr(key, 1)
            pipeline.expire(key, window)
            pipeline.execute()
        except redis.ConnectionError:
            # If Redis is down, fail open or closed depending on requirements.
            # Failing open (allowing request) for beginner-friendly resilience.
            pass

    return _rate_limit_dep
