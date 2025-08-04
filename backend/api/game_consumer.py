import json
import asyncio
import os
import redis.asyncio as redis
from channels.generic.websocket import AsyncWebsocketConsumer
from .game_engine import game_engine
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.connected_to_game = False
        if self.user.is_authenticated:
            self.game_id = self.scope["url_route"]["kwargs"]["game_id"]

            game = game_engine.get_game(self.game_id)
            status = await self.get_player_status()

            if not status:
                status = await self.init_player_status()

            await self.accept()

            if (
                not game
                or self.user.username not in game["players"]
                or status["full_disconnect"]
            ):
                await self.close(code=4000)
                return

            self.connected_to_game = True
            await self.channel_layer.group_add(self.game_id, self.channel_name)

            await self.set_temp_disconnect(False)
            await self.refresh_user_ttl()

            await self.channel_layer.group_send(self.game_id, {
                    "type": "game.update"
                })
            await self.channel_layer.group_send(self.game_id, {
                    "type": "send.chat.history"
                })

    async def disconnect(self, close_code):
        if not self.connected_to_game:
            return
        
        await self.set_temp_disconnect(True)
        self.delayed_task = asyncio.create_task(self.delayed_leave())

    async def delayed_leave(self):
        status = await self.get_player_status()

        if status["full_disconnect"]:
            await self.handle_full_disconnect()
        else:
            await asyncio.sleep(10)

            status = await self.get_player_status()
            if status["temp_disconnect"]:
                await self.set_full_disconnect(True)
                await self.handle_full_disconnect()

    async def handle_full_disconnect(self):
        if hasattr(self, "delayed_task") and self.delayed_task is not asyncio.current_task():
            self.delayed_task.cancel()

        await self.channel_layer.group_discard(self.game_id, self.channel_name)
        asyncio.create_task(self.cleanup_lobby_chat())

        if await self.check_all_status("full_disconnect"):
            await self.delete_chat_history()
            await self.delete_player_status()
            game_engine.end_game(self.game_id)
            return

        await self.push_message("system",
                                f"{str(self.user.username).upper()} HAS LEFT THE GAME",
                                "public")
        await self.channel_layer.group_send(self.game_id, {
            "type": "game.update"
        })

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")

        username = self.user.username
        game = game_engine.get_game(self.game_id)

        match action:
            case "place_ship":
                await self.refresh_user_ttl()
                result = game_engine.place_ships(
                    self.game_id,
                    username,
                    data["x"],
                    data["y"],
                    data["length"],
                    data["orientation"]
                )
                await self.push_message("system", result["result"], result["access"])
                await self.send_game_state()

            case "remove_ship":
                await self.refresh_user_ttl()
                result = game_engine.remove_ship(
                    self.game_id,
                    username,
                    data["x"],
                    data["y"]
                )
                await self.push_message("system", result["result"], result["access"])
                await self.send_game_state()

            case "set_ready":
                await self.refresh_user_ttl()
                result = game_engine.set_ready(
                    self.game_id,
                    username
                )

                await self.push_message("system", result["result"], result["access"])
                await self.channel_layer.group_send(self.game_id, {
                    "type": "game.update"
                })

            case "make_move":
                await self.refresh_user_ttl()
                result = game_engine.make_move(
                    self.game_id,
                    username,
                    data["x"],
                    data["y"]
                )

                await self.channel_layer.group_send(self.game_id, {
                    "type": "game.update"
                })
                await self.push_message("system", result["result"], result["access"])

            case "restart_game":
                await self.refresh_user_ttl()
                if game:
                    await self.set_restart(True)
                    await self.push_message(
                            "system",
                            f"{str(self.user.username).upper()} HAS VOTED FOR A REMATCH",
                            "public"
                        )
                    player1, player2 = sorted(game["players"])
                    if await self.check_all_status("restart"):
                        await self.channel_layer.group_send(self.game_id, {
                            "type": "send.restart"
                        })
                        game_engine.create_game(self.game_id, player1, player2)
                        await self.channel_layer.group_send(self.game_id, {
                            "type": "game.update"
                        })

            case "leave_game":
                await self.set_full_disconnect(True)

            case "send_msg":
                await self.refresh_user_ttl()
                await self.push_message("user", data["msg"], "public")

            case "ping":
                await self.refresh_user_ttl()

    async def send_game_state(self):
        state = game_engine.get_game_state(self.game_id, self.user.username)

        redis = await self.get_redis()
        players_status = await redis.hgetall(self.game_id)
        parsed_status = {p: json.loads(s) for p, s in players_status.items()}

        opponent = next(p for p in state["players"] if p != self.user.username)
        opponent_left = parsed_status.get(opponent, {}).get("full_disconnect", False)

        await self.send(text_data=json.dumps({
            "type": "game_state",
            "state": state,
            "opponent_left": opponent_left
        }))

    async def game_update(self, event):
        await self.send_game_state()

    async def player_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "enemy_left",
        }))

    async def send_restart(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_game"
        }))

    async def send_chat_history(self, event):
        history = await self.get_chat_history()
        await self.send(text_data=json.dumps({
            "type": "chat_history",
            "history": history
        }))

    async def get_redis(self):
        return await redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    async def push_message(self, msg_type, msg, msg_access):
        redis = await self.get_redis()
        await redis.rpush(f"gamechat:{self.game_id}", json.dumps({
                "from": self.user.username,
                "msg_type": msg_type,
                "msg": msg,
                "access": msg_access
            }))
        await self.channel_layer.group_send(self.game_id, {
                "type": "send.chat.history"
            })

    async def get_chat_history(self):
        redis = await self.get_redis()
        history = await redis.lrange(f"gamechat:{self.game_id}", 0, -1)
        return [json.loads(m) for m in history]
    
    async def delete_chat_history(self):
        redis = await self.get_redis()
        await redis.delete(f"gamechat:{self.game_id}")

    async def refresh_user_ttl(self):
        redis = await self.get_redis()
        await redis.set(f"online:{self.user.username}", 1, ex=30)

    async def init_player_status(self):
        redis = await self.get_redis()
        value = {"temp_disconnect": False, "full_disconnect": False, "restart": False}
        await redis.hset(self.game_id, self.user.username, json.dumps(value))
        return value

    async def delete_player_status(self):
        redis = await self.get_redis()
        players = self.game_id.split("-")[1:]
        for player in players:
            await redis.hdel(self.game_id, player)

    async def get_player_status(self):
        redis = await self.get_redis()
        data = await redis.hget(self.game_id, self.user.username)
        if not data:
            return
        return json.loads(data)

    async def set_temp_disconnect(self, value: bool):
        redis = await self.get_redis()
        status = await self.get_player_status()
        status["temp_disconnect"] = value
        await redis.hset(self.game_id, self.user.username, json.dumps(status))

    async def set_full_disconnect(self, value: bool):
        redis = await self.get_redis()
        status = await self.get_player_status()
        status["full_disconnect"] = value
        await redis.hset(self.game_id, self.user.username, json.dumps(status))

    async def set_restart(self, value: bool):
        redis = await self.get_redis()
        status = await self.get_player_status()
        status["restart"] = value
        await redis.hset(self.game_id, self.user.username, json.dumps(status))

    async def check_all_status(self, value):
        redis = await self.get_redis()
        data = await redis.hgetall(self.game_id)
        if data:
            for player in data.values():
                status = json.loads(player)
                if not status[value]:
                    return False
            return True

    async def cleanup_lobby_chat(self):
        await asyncio.sleep(30)
        redis = await self.get_redis()
        chats = await redis.smembers(f"lobby_chats:{self.user.username}")

        for chat_id in chats:
            players = chat_id.split("_")
            active = False
            for player in players:
                if player != self.user.username and await redis.exists(f"online:{player}"):
                    active = True
                    break
            if not active:
                await redis.delete(chat_id)
                for player in players:
                    await redis.delete(f"lobby_chats:{player}", chat_id)
                    if not await redis.scard(f"lobby_chats:{player}"):
                        await redis.delete(f"lobby_chats:{player}")