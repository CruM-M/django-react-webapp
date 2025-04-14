import json
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv
import os
import redis.asyncio as redis

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

class LobbyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_authenticated:
            await self.channel_layer.group_add("lobby", self.channel_name)
            await self.accept()

            await self.add_user_to_lobby(self.user.username)

            users = await self.get_all_users()
            await self.send(text_data=json.dumps({
                "type": "user.list",
                "users": users
            }))

            await self.channel_layer.group_send("lobby", {
                "type": "user.joined",
                "username": self.user.username
            })

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            await self.channel_layer.group_discard("lobby", self.channel_name)

            await self.remove_user_from_lobby(self.user.username)

            await self.channel_layer.group_send("lobby", {
                "type": "user.left",
                "username": self.user.username
            })

    async def user_joined(self, event):
        await self.send(text_data=json.dumps({
                "type": "join",
                "username": event["username"]
            }))
        
    async def user_left(self, event):
        await self.send(text_data=json.dumps({
                "type": "leave",
                "username": event["username"]
            }))

    async def get_redis(self):
        return await redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    async def add_user_to_lobby(self, username):
        redis = await self.get_redis()
        await redis.sadd("lobby_users", username)

    async def remove_user_from_lobby(self, username):
        redis = await self.get_redis()
        result = await redis.srem("lobby_users", username)
        return result

    async def get_all_users(self):
        redis = await self.get_redis()
        return list(await redis.smembers("lobby_users"))