import json
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv
import os
import redis.asyncio as redis
from .game_engine import game_engine

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

class LobbyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_authenticated:
            await self.channel_layer.group_add("lobby", self.channel_name)
            await self.channel_layer.group_add(f"user_{self.user.username}", self.channel_name)
            await self.accept()

            await self.add_user_to_lobby(self.user.username)

            users = await self.get_all_users()
            await self.send(text_data=json.dumps({
                "type": "user.list",
                "users": users,
                "self": self.user.username
            }))

            await self.channel_layer.group_send("lobby", {
                "type": "user.joined",
                "username": self.user.username
            })

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            await self.channel_layer.group_discard("lobby", self.channel_name)
            await self.channel_layer.group_discard(f"user_{self.user.username}", self.channel_name)

            await self.remove_user_from_lobby(self.user.username)

            await self.channel_layer.group_send("lobby", {
                "type": "user.left",
                "username": self.user.username
            })

    async def receive(self, text_data):
        if self.user.is_authenticated:
            data = json.loads(text_data)
            event_type = data.get("type")

            if event_type == "invite":
                target_user = data.get("to")
                await self.send_invite(target_user)

            elif event_type == "invite.accept":
                from_user = data.get("from")
                status = data.get("status")

                await self.send_invite_accepted(from_user, status)

                if status == "accepted":
                    player1, player2 = sorted([from_user, self.user.username])
                    game_id = f"game-{player1}-{player2}"
                    game_engine.create_game(game_id, player1, player2)

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
    
    async def send_invite(self, target_user):
        await self.channel_layer.group_send(f"user_{target_user}", {
            "type": "receive.invite",
            "from": self.user.username
        })

    async def send_invite_accepted(self, from_user, acceptance_status):
        await self.channel_layer.group_send(f"user_{from_user}", {
            "type": "receive.invite.accepted",
            "from": self.user.username,
            "status": acceptance_status
        })

    async def receive_invite(self, event):
        await self.send(text_data=json.dumps({
            "type": "invite",
            "from": event["from"]
        }))

    async def receive_invite_accepted(self, event):
        await self.send(text_data=json.dumps({
            "type": "invite.accepted",
            "from": event["from"],
            "status": event["status"]
        }))