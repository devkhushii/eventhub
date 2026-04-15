import redis # type: ignore
from app.core.config import settings

# Create a connection pool to avoid creating a new connection for every request
redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True
)

def get_redis_client() -> redis.Redis:
    """Dependency to get the Redis client from the pool."""
    return redis.Redis(connection_pool=redis_pool)
