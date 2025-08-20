import json
import asyncio
from .base_consumer import BaseConsumer
from .services.redis_service import RedisService
from .services.chat_service import ChatService
from .services.game_service import GameService
from ..game_engine import game_engine

class GameConsumer(BaseConsumer):
    """
    WebSocket consumer that handles real-time multiplayer game communication.
    Manages player connection state, in-game actions, chat messages 
        and game restarts.
    Uses Redis and internal game engine for state tracking.
    """

    async def connect(self):
        """
        Handles a new WebSocket connection.
        Accepts the connection only if the user is authenticated
            and part of a valid game.
        Adds the user to the game group and triggers a game state update.
        """
        self.user = self.scope["user"]
        self.connected_to_game = False

        if not self.user.is_authenticated:
            return

        self.game_id = self.scope["url_route"]["kwargs"]["game_id"]
        game = game_engine.get_game(self.game_id)
        status = await GameService.get_player_status(
            self.game_id,
            self.user.username
        )

        if not status:
            status = await GameService.init_player_status(
                self.game_id,
                self.user.username
            )

        await self.accept()

        if (
            not game
            or self.user.username not in game["players"]
            or status["full_disconnect"]
        ):
            await self.close(code=4000)
            return

        self.connected_to_game = True
        await self.channel_layer.group_add(
            self.game_id,
            self.channel_name
        )

        await self.set_temp_disconnect(False)
        await self.refresh_user_ttl()

        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "send.chat.history"}
        )

    async def disconnect(self, close_code):
        """
        Handles WebSocket disconnection.
        If the game connection was established, marks the user as
            temporarily disconnected and starts delayed cleanup logic.
        """
        if not self.user.is_authenticated or not self.connected_to_game:
            return

        await self.set_temp_disconnect(True)
        self.delayed_task = asyncio.create_task(self.delayed_leave())

    async def delayed_leave(self):
        """
        Waits 10 seconds before treating disconnect as permanent,
        allowing short disconnects to recover.
        """
        status = await GameService.get_player_status(
            self.game_id,
            self.user.username
        )

        if status["full_disconnect"]:
            await self.handle_full_disconnect()
        else:
            await asyncio.sleep(10)

            status = await GameService.get_player_status(
                self.game_id,
                self.user.username
            )
            if status["temp_disconnect"]:
                await self.set_full_disconnect(True)
                await self.handle_full_disconnect()

    async def handle_full_disconnect(self):
        """
        Handles a full disconnect: removes player from game group,
            sends notifications, and ends game if both players have left.
        """
        if (
            hasattr(self, "delayed_task")
            and self.delayed_task is not asyncio.current_task()
        ):
            self.delayed_task.cancel()

        await self.channel_layer.group_discard(
            self.game_id,
            self.channel_name
        )
        asyncio.create_task(self.cleanup_lobby_chat())

        if await GameService.all_status_true(
            self.game_id,
            "full_disconnect"
        ):
            await ChatService.delete_chat(f"gamechat:{self.game_id}")
            await GameService.delete_game_status(self.game_id)
            game_engine.end_game(self.game_id)
            return

        await self.push_message(
            "system",
            f"{str(self.user.username).upper()} HAS LEFT THE GAME",
            "public"
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )

    async def receive(self, text_data):
        """
        Handles messages received from WebSocket client.
        Dispatches the action based on a predefined map.
        """
        if not self.user.is_authenticated:
            return

        data = json.loads(text_data)

        action = data.get("action")
        if not action:
            return

        actions_map = {
            "place_ship": self.action_place_ship,
            "remove_ship": self.action_remove_ship,
            "set_ready": self.action_set_ready,
            "make_move": self.action_make_move,
            "restart_game": self.action_restart_game,
            "send_msg": self.action_send_msg,
            "ping": self.action_ping,
            "leave_game": self.action_leave_game
        }

        handler = actions_map.get(action)
        if handler:
            await handler(data)
        else:
            return

    @BaseConsumer.refresh_ttl_on_action
    async def action_place_ship(self, data):
        """
        Places a ship on the player's board.
        """
        result = game_engine.place_ships(
            self.game_id,
            self.user.username,
            data["x"],
            data["y"],
            data["length"],
            data["orientation"]
        )

        await self.push_message(
            "system",
            result["result"],
            result["access"]
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_remove_ship(self, data):
        """
        Removes a ship from the player's board.
        """
        result = game_engine.remove_ship(
            self.game_id,
            self.user.username,
            data["x"],
            data["y"]
        )

        await self.push_message(
            "system",
            result["result"],
            result["access"]
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_set_ready(self, data):
        """
        Marks player as ready for battle.
        """
        result = game_engine.set_ready(
            self.game_id,
            self.user.username
        )

        await self.push_message(
            "system",
            result["result"],
            result["access"]
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_make_move(self, data):
        """
        Handles player making a move.
        """
        result = game_engine.make_move(
            self.game_id,
            self.user.username,
            data["x"],
            data["y"]
        )

        await self.channel_layer.group_send(
            self.game_id,
            {"type": "game.update"}
        )
        await self.push_message(
            "system",
            result["result"],
            result["access"]
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_restart_game(self, data):
        """
        Handles player requesting a game restart.
        If both players agree, a new game instance is created.
        """
        game = game_engine.get_game(self.game_id)
        if not game:
            return

        player1, player2 = sorted(game["players"])

        await self.set_restart(True)
        await self.push_message(
                "system",
                f"{str(self.user.username).upper()} HAS VOTED FOR A REMATCH",
                "public"
            )

        if await GameService.all_status_true(self.game_id, "restart"):
            await self.channel_layer.group_send(
                self.game_id,
                {"type": "send.restart"}
            )
            game_engine.create_game(self.game_id, player1, player2)
            await self.channel_layer.group_send(
                self.game_id,
                {"type": "game.update"}
            )

    @BaseConsumer.refresh_ttl_on_action
    async def action_send_msg(self, data):
        """
        Sends a chat message.
        """
        await self.push_message(data["sender"], data["msg"], data["access"])

    @BaseConsumer.refresh_ttl_on_action
    async def action_ping(self, data):
        """
        Ping from client to keep user's lobby chat history.
        """
        pass

    async def action_leave_game(self, data):
        """
        Marks user as fully disconnected on leave action.
        """
        await self.set_full_disconnect(True)

    async def send_game_state(self):
        """
        Sends the full game state to the connected client.
        Includes both game and opponent status.
        """
        state = game_engine.get_game_state(
            self.game_id,
            self.user.username
        )

        players_status = await RedisService.get_all_hash(self.game_id)
        parsed_status = {p: json.loads(s) for p, s in players_status.items()}

        players_disconnect = {
            player: status.get("full_disconnect", False)
            for player, status in parsed_status.items()
        }

        await self.send_json({
            "type": "game_state",
            "state": state,
            "players_disconnect": players_disconnect
        })

    async def game_update(self, event):
        """
        Called on `game.update` event to push updated game state.
        """
        await self.send_game_state()

    async def player_left(self, event):
        """
        Notify client that opponent has disconnected.
        """
        await self.send_json({
            "type": "enemy_left",
        })

    async def send_restart(self, event):
        """
        Notify client that a new game has started.
        """
        await self.send_json({
            "type": "new_game"
        })

    async def send_chat_history(self, event):
        """
        Sends full chat history for the game.
        """
        history = await ChatService.get_history(f"gamechat:{self.game_id}")
        await self.send_json({
            "type": "chat_history",
            "history": history
        })

    async def push_message(self, msg_type, msg, msg_access):
        """
        Push a new message to the chat and broadcast it to all players.

        Args:
            msg_type (str): Type of message ("system" or "user").
            msg (str): Message content.
            msg_access (str): Visibility of the message ("public"/"private").
        """
        await ChatService.push_message(
            f"gamechat:{self.game_id}",
            {
                "from": self.user.username,
                "msg_type": msg_type,
                "msg": msg,
                "access": msg_access
            }
        )
        await self.channel_layer.group_send(
            self.game_id,
            {"type": "send.chat.history"}
        )

    async def set_temp_disconnect(self, value: bool):
        """
        Set temporary disconnect status for player.
        """
        await GameService.set_status(
            self.game_id,
            self.user.username,
            "temp_disconnect",
            value
        )

    async def set_full_disconnect(self, value: bool):
        """
        Set full disconnect status for player.
        """
        await GameService.set_status(
            self.game_id,
            self.user.username,
            "full_disconnect",
            value
        )

    async def set_restart(self, value: bool):
        """
        Set restart flag for player.
        """
        await GameService.set_status(
            self.game_id,
            self.user.username,
            "restart",
            value
        )