import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from .game_engine import game_engine

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.game_id = self.scope["url_route"]["kwargs"]["game_id"]

        if not self.user.is_authenticated:
            await self.close()
            return

        game = game_engine.get_game(self.game_id)
        if (not game or self.user.username not in game["players"]
            or game["full_disconnect"].get(self.user.username)):
            await self.close()
            return
        
        game["temp_disconnect"][self.user.username] = False
        await self.channel_layer.group_add(self.game_id, self.channel_name)
        await self.accept()
        await self.channel_layer.group_send(self.game_id, {
                "type": "game.update"
            })

    async def disconnect(self, close_code):
        game = game_engine.get_game(self.game_id)
        if game:
            game["temp_disconnect"][self.user.username] = True
            asyncio.create_task(self.delayed_leave(game, self.game_id))

    async def delayed_leave(self, game, game_id):
        await asyncio.sleep(10)
        try:
            current_game = game_engine.get_game(game_id)
        except Exception:
            return
        if current_game is game and game["temp_disconnect"].get(self.user.username):
            game["full_disconnect"][self.user.username] = True

            if all(game["full_disconnect"].values()):
                game_engine.end_game(self.game_id)
                await self.close()
                return

            await self.channel_layer.group_discard(self.game_id, self.channel_name)
            await self.channel_layer.group_send(self.game_id, {
                "type": "game.update"
            })


    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")

        username = self.user.username
        game = game_engine.get_game(self.game_id)

        if action == "place_ship":
            result = game_engine.place_ships(
                self.game_id,
                username,
                data["x"],
                data["y"],
                data["length"],
                data["orientation"]
            )
            await self.send(text_data = json.dumps(result))
            await self.send_game_state()

        elif action == "remove_ship":
            result = game_engine.remove_ship(
                self.game_id,
                username,
                data["x"],
                data["y"]
            )
            await self.send(text_data = json.dumps(result))
            await self.send_game_state()

        elif action == "set_ready":
            result = game_engine.set_ready(
                self.game_id,
                username
            )

            await self.send(text_data = json.dumps(result))
            await self.channel_layer.group_send(self.game_id, {
                "type": "game.update"
            })

        elif action == "make_move":
            result = game_engine.make_move(
                self.game_id,
                username,
                data["x"],
                data["y"]
            )
            if result["result"] == "win":
                game["winner"] = username

            await self.channel_layer.group_send(self.game_id, {
                "type": "game.update"
            })
            await self.send(text_data = json.dumps(result))

        elif action == "restart_game":
            if game:
                game["restart"][username] = True
                player1, player2 = sorted(game["players"])
                if game["restart"][player1] and game["restart"][player2]:
                    game_engine.create_game(self.game_id, player1, player2)
                    await self.channel_layer.group_send(self.game_id, {
                        "type": "game.update"
                    })
            else:
                await self.send(text_data=json.dumps({"error": "Game not found."}))

        elif action == "leave_game":
            if game:
                game["full_disconnect"][username] = True
                await self.channel_layer.group_send(self.game_id, {
                    "type": "game.update"
                })

    async def send_game_state(self):
        state = game_engine.get_game_state(self.game_id, self.user.username)
        await self.send(text_data=json.dumps({
            "type": "game_state",
            "state": state,
        }))

    async def game_update(self, event):
        await self.send_game_state()