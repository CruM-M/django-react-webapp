import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from .services.redis_service import RedisService
from functools import wraps

class BaseConsumer(AsyncWebsocketConsumer):
    """
    Base WebSocket consumer providing common functionality for other consumers.
    Handles JSON sending, TTL refreshing for online users, and chat cleanup.
    """

    async def send_json(self, data: dict):
        """
        Send a JSON-encoded message to the WebSocket client.

        Args:
            data (dict): The data to send.
        """
        await self.send(text_data=json.dumps(data))

    async def refresh_user_ttl(self):
        """
        Refresh the TTL (Time-To-Live) for the current user's online status
            in Redis.
        Keeps the user marked as 'online' for a set time.
        """
        await RedisService.set_with_ttl(f"online_{self.user.username}")

    async def cleanup_lobby_chat(self):
        """
        Clean up inactive lobby chat groups.
        - Waits 30 seconds before checking for active users.
        - If no users remain active in a chat, deletes it from Redis
            and unsubscribes the channel.
        """
        await asyncio.sleep(30)
        username = self.user.username
        chats = await RedisService.get_set(f"lobby_chats:{username}")

        for chat_id in chats:
            players = chat_id.split("_")
            active = False
            for player in players:
                if (
                    player != username
                    and await RedisService.exists(f"online_{player}")
                ):
                    active = True
                    break

            if not active:
                await RedisService.delete(chat_id)
                await self.channel_layer.group_discard(
                    chat_id,
                    self.channel_name
                )
                for player in players:
                    await RedisService.remove_from_set(
                        f"lobby_chats:{player}",
                        chat_id
                    )
                    if not await RedisService.get_set(f"lobby_chats:{player}"):
                        await RedisService.delete(f"lobby_chats:{player}")

    @staticmethod
    def refresh_ttl_on_action(func):
        """
        Decorator for refreshing user TTL before executing an action.
        Ensures the user stays marked as online when performing an action.

        Args:
            func (Callable): The function to wrap.

        Returns:
            Callable: Wrapped function with TTL refresh.
        """
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            await self.refresh_user_ttl()
            return await func(self, *args, **kwargs)
        return wrapper
