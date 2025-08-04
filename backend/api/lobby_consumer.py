import json
import asyncio
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
            await self.accept()

            await self.channel_layer.group_add("lobby_users", self.channel_name)
            await self.channel_layer.group_add(f"user_{self.user.username}", self.channel_name)

            await self.add_to_lobby_users()
            await self.refresh_user_ttl()
            await self.group_send_user_list()
            await self.send_invite_state()

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            await self.channel_layer.group_discard("lobby_users", self.channel_name)
            await self.channel_layer.group_discard(f"user_{self.user.username}", self.channel_name)

            await self.remove_from_lobby_users()
            await self.group_send_user_list()

            asyncio.create_task(self.cleanup_lobby_chat())

    async def receive(self, text_data):
        if self.user.is_authenticated:
            data = json.loads(text_data)
            action = data.get("action")

            match action:
                case "invite":
                    await self.refresh_user_ttl()
                    target_user = data.get("to")
                    redis = await self.get_redis()

                    await redis.sadd(f"invites_incoming:{target_user}", self.user.username)
                    await redis.sadd(f"invites_outgoing:{self.user.username}", target_user)
                    await redis.expire(f"invites_incoming:{target_user}", 60)
                    await redis.expire(f"invites_outgoing:{self.user.username}", 60)

                    await self.channel_layer.group_send(f"user_{self.user.username}", {
                        "type": "group.send.invite.state"
                    })
                    await self.channel_layer.group_send(f"user_{target_user}", {
                        "type": "group.send.invite.state"
                    })

                case "invite.response":
                    await self.refresh_user_ttl()
                    from_user = data.get("from")
                    status = data.get("status")
                    redis = await self.get_redis()

                    await redis.srem(f"invites_incoming:{self.user.username}", from_user)
                    await redis.srem(f"invites_outgoing:{from_user}", self.user.username)

                    if status == "accepted":
                        await self.channel_layer.group_send(f"user_{from_user}", {
                            "type": "send.invite.accepted",
                            "from": self.user.username
                        })
                        player1, player2 = sorted([from_user, self.user.username])
                        game_id = f"game-{player1}-{player2}"
                        game_engine.create_game(game_id, player1, player2)

                    elif status == "declined":
                        await self.channel_layer.group_send(f"user_{from_user}", {
                            "type": "send.invite.declined",
                            "from": self.user.username
                        })
                        await self.channel_layer.group_send(f"user_{self.user.username}", {
                            "type": "group.send.invite.state"
                        })
                        await self.channel_layer.group_send(f"user_{from_user}", {
                            "type": "group.send.invite.state"
                        })

                case "invite.cancel":
                    await self.refresh_user_ttl()
                    target_user = data.get("to")
                    redis = await self.get_redis()

                    await redis.srem(f"invites_outgoing:{self.user.username}", target_user)
                    await redis.srem(f"invites_incoming:{target_user}", self.user.username)

                    await self.channel_layer.group_send(f"user_{self.user.username}", {
                        "type": "group.send.invite.state"
                    })
                    await self.channel_layer.group_send(f"user_{target_user}", {
                        "type": "group.send.invite.state"
                    })

                case "send_msg":
                    await self.refresh_user_ttl()
                    receiver = data.get("chatWith")
                    player1, player2 = sorted([receiver, self.user.username])
                    await self.push_message(f"{player1}_{player2}", data["msg"])
                    await self.send_chat_notify(receiver)

                case "join_chat":
                    await self.refresh_user_ttl()
                    player1, player2 = sorted([data.get("chatWith"), self.user.username])
                    chat_id = f"{player1}_{player2}"
                    await self.channel_layer.group_add(chat_id, self.channel_name)
                    await self.channel_layer.group_send(chat_id, {
                        "type": "send.chat.history",
                        "chat_id": chat_id
                    })

                case "ping":
                    await self.refresh_user_ttl()

    async def get_redis(self):
        return await redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    async def add_to_lobby_users(self):
        redis = await self.get_redis()
        await redis.sadd("lobby_users", self.user.username)

    async def remove_from_lobby_users(self):
        redis = await self.get_redis()
        await redis.srem("lobby_users", self.user.username)

    async def get_lobby_users(self):
        redis = await self.get_redis()
        return list(await redis.smembers("lobby_users"))

    async def refresh_user_ttl(self):
        redis = await self.get_redis()
        await redis.set(f"online_{self.user.username}", 1, ex=30)

    async def group_send_user_list(self):
        await self.channel_layer.group_send("lobby_users", {
            "type": "send.user.list"
        })

    async def send_user_list(self, event):
        users = await self.get_lobby_users()
        await self.send(text_data=json.dumps({
            "type": "user.list",
            "users": users,
            "self": self.user.username
        }))

    async def group_send_invite_state(self, event):
        await self.send_invite_state()

    async def send_invite_state(self):
        redis = await self.get_redis()
        incoming = list(await redis.smembers(f"invites_incoming:{self.user.username}"))
        outgoing = list(await redis.smembers(f"invites_outgoing:{self.user.username}"))
        await self.send(text_data=json.dumps({
            "type": "invite.state",
            "incoming": incoming,
            "outgoing": outgoing
        }))

    async def send_invite_accepted(self, event):
        await self.send(text_data=json.dumps({
            "type": "invite.accepted",
            "from": event["from"]
        }))

    async def send_invite_declined(self, event):
        await self.send(text_data=json.dumps({
            "type": "invite.declined",
            "from": event["from"]
        }))

    async def send_chat_notify(self, receiver):
        await self.channel_layer.group_send(f"user_{receiver}", {
            "type": "chat.notify",
            "from": self.user.username
        })

    async def chat_notify(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_notify",
            "from": event["from"]
        }))

    async def send_chat_history(self, event):
        history = await self.get_chat_history(event["chat_id"])
        await self.send(text_data=json.dumps({
            "type": "chat_history",
            "history": history
        }))

    async def push_message(self, chat_id, msg):
        redis = await self.get_redis()
        await redis.rpush(chat_id, json.dumps({
                "from": self.user.username,
                "msg": msg
            }))
        await self.channel_layer.group_send(chat_id, {
                "type": "send.chat.history",
                "chat_id": chat_id
            })

    async def get_chat_history(self, chat_id):
        redis = await self.get_redis()
        history = await redis.lrange(chat_id, 0, -1)
        return [json.loads(m) for m in history]
    
    async def cleanup_lobby_chat(self):
        await asyncio.sleep(30)
        redis = await self.get_redis()
        chats = await redis.smembers(f"lobby_chats:{self.user.username}")

        for chat_id in chats:
            players = chat_id.split("_")
            active = False
            for player in players:
                if player != self.user.username and await redis.exists(f"online_{player}"):
                    active = True
                    break
            if not active:
                await redis.delete(chat_id)
                for player in players:
                    await redis.delete(f"lobby_chats:{player}", chat_id)
                    if not await redis.scard(f"lobby_chats:{player}"):
                        await redis.delete(f"lobby_chats:{player}")