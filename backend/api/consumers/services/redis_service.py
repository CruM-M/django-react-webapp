import redis.asyncio as redis
import os
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

class RedisService:
    """
    Async Redis client wrapper for common Redis operations.
    Implements a singleton pattern to reuse Redis connection.

    Attributes:
        redis (redis.Redis | None): Cached Redis connection instance.
    """

    redis = None

    @classmethod
    async def get_redis(cls):
        """
        Initialize or return the cached Redis connection.

        Returns:
            redis.Redis: Async Redis connection instance.
        """
        if not cls.redis:
            cls.redis = await redis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        return cls.redis

    @classmethod
    async def set_with_ttl(cls, key, ex=30):
        """
        Set a key with a value of 1 and an expiration time (TTL).

        Args:
            key (str): Redis key to set.
            ex (int, optional): Expiration time in seconds. Defaults to 30.
        """
        conn = await cls.get_redis()
        await conn.set(key, 1, ex=ex)

    @classmethod
    async def add_to_set(cls, key, value, ex=None):
        """
        Add a value to a Redis set and optionally set expiration time.

        Args:
            key (str): Redis set key.
            value (str): Value to add to the set.
            ex (int | None, optional): Expiration time in seconds.
                Defaults to None.
        """
        conn = await cls.get_redis()
        await conn.sadd(key, value)
        if ex:
            await conn.expire(key, ex)

    @classmethod
    async def remove_from_set(cls, key, value):
        """
        Remove a value from a Redis set.

        Args:
            key (str): Redis set key.
            value (str): Value to remove from the set.
        """
        conn = await cls.get_redis()
        await conn.srem(key, value)

    @classmethod
    async def get_set(cls, key):
        """
        Retrieve all members of a Redis set as a list.

        Args:
            key (str): Redis set key.

        Returns:
            list[str]: List of set members.
        """

        conn = await cls.get_redis()
        return list(await conn.smembers(key))

    @classmethod
    async def push_list(cls, key, value):
        """
        Append a value to the end of a Redis list.

        Args:
            key (str): Redis list key.
            value (str): Value to append.
        """
        conn = await cls.get_redis()
        await conn.rpush(key, value)

    @classmethod
    async def get_list(cls, key):
        """
        Retrieve all elements from a Redis list.

        Args:
            key (str): Redis list key.

        Returns:
            list[str]: List elements.
        """
        conn = await cls.get_redis()
        return await conn.lrange(key, 0, -1)

    @classmethod
    async def delete(cls, key):
        """
        Delete a key from Redis.

        Args:
            key (str): Redis key to delete.
        """
        conn = await cls.get_redis()
        await conn.delete(key)

    @classmethod
    async def exists(cls, key):
        """
        Check if a Redis key exists.

        Args:
            key (str): Redis key to check.

        Returns:
            int: 1 if exists, 0 otherwise.
        """
        conn = await cls.get_redis()
        return await conn.exists(key)

    @classmethod
    async def set_hash(cls, name, key, value):
        """
        Set a field in a Redis hash.

        Args:
            name (str): Redis hash key.
            key (str): Field name in the hash.
            value (str): Value to set.
        """
        conn = await cls.get_redis()
        await conn.hset(name, key, value)

    @classmethod
    async def get_hash(cls, name, key):
        """
        Get a field value from a Redis hash.
        
        Args:
            name (str): Redis hash key.
            key (str): Field name.

        Returns:
            str | None: Value of the field or None if not found.
        """
        conn = await cls.get_redis()
        return await conn.hget(name, key)

    @classmethod
    async def get_all_hash(cls, name):
        """
        Retrieve all fields and values from a Redis hash.
        
        Args:
            name (str): Redis hash key.

        Returns:
            dict[str, str]: All key-value pairs in the hash.
        """
        conn = await cls.get_redis()
        return await conn.hgetall(name)

    @classmethod
    async def delete_from_hash(cls, name, key):
        """
        Delete a field from a Redis hash.

        Args:
            name (str): Redis hash key.
            key (str): Field to delete.
        """
        conn = await cls.get_redis()
        await conn.hdel(name, key)

    @classmethod
    async def incr_user_connections(cls, page, user_id):
        """
        Increment the active WebSocket connections count for a user.

        Args:
            user_id (str): User identifier.
        """
        conn = await cls.get_redis()
        key = f"{page}:{user_id}:connections"
        await conn.incr(key)

    @classmethod
    async def decr_user_connections(cls, page, user_id):
        """
        Decrement the active WebSocket connections count for a user.

        Args:
            user_id (str): User identifier.

        Returns:
            int: Remaining number of active connections.
        """
        conn = await cls.get_redis()
        key = f"{page}:{user_id}:connections"
        count = await conn.decr(key)
        if count < 0:
            await conn.set(key, 0)
            count = 0
        return int(count)