import json
import asyncio
from .base_consumer import BaseConsumer
from .services.redis_service import RedisService
from .services.chat_service import ChatService
from .services.invite_service import InviteService
from .services.lobby_service import LobbyService
from .services.game_service import GameService
from ..game_engine import game_engine

class LobbyConsumer(BaseConsumer):
    """
    Handles WebSocket communication in the lobby.
    Manages lobby presence, chat communication, and invite-based
        game initiation.
    """

    async def connect(self):
        """
        Handles a new WebSocket connection.
        Authenticates the user, adds them to relevant channel groups,
            and notifies others about the updated lobby user list.
        """
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            return

        await self.accept()

        game_id = await self.find_game_id()
        if game_id:
            status = await GameService.get_player_status(
                game_id,
                self.user.username
            )
            if status["full_disconnect"] == False:
                await self.send_json({
                    "type": "in_game",
                    "game_id": game_id
                })

        await self.channel_layer.group_add(
            "lobby_users",
            self.channel_name
        )
        await self.channel_layer.group_add(
            f"user_{self.user.username}",
            self.channel_name
        )

        await LobbyService.add_user(self.user.username)
        await self.refresh_user_ttl()
        await self.group_send_user_list()
        await self.send_invite_state()

    async def disconnect(self, close_code):
        """
        Handles WebSocket disconnection.
        Removes the user from all groups and updates the lobby.
        """
        if not self.user.is_authenticated:
            return

        await self.channel_layer.group_discard(
            "lobby_users",
            self.channel_name
        )
        await self.channel_layer.group_discard(
            f"user_{self.user.username}",
            self.channel_name
        )

        await LobbyService.remove_user(self.user.username)
        await self.group_send_user_list()

        asyncio.create_task(self.cleanup_lobby_chat())

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
            "invite": self.action_invite,
            "invite_response": self.action_invite_response,
            "invite_cancel": self.action_invite_cancel,
            "send_msg": self.action_send_msg,
            "join_chat": self.action_join_chat,
            "ping": self.action_ping
        }

        handler = actions_map.get(action)
        if handler:
            await handler(data)
        else:
            return

    @BaseConsumer.refresh_ttl_on_action
    async def action_invite(self, data):
        """
        Handles sending an invite to another user.
        """
        username = self.user.username
        to_user = data.get("to")
        if not to_user:
            return

        await InviteService.add_invite(username, to_user)

        asyncio.create_task(self.schedule_invite_watch(username, to_user))

        await self.channel_layer.group_send(
            f"user_{username}",
            {"type": "group.send.invite.state"}
        )
        await self.channel_layer.group_send(
            f"user_{to_user}",
            {"type": "group.send.invite.state"}
        )


    @BaseConsumer.refresh_ttl_on_action
    async def action_invite_response(self, data):
        """
        Handles accepting or declining an invite.
        If accepted, a game is created.
        """
        username = self.user.username
        from_user = data.get("from")
        status = data.get("status")
        if not from_user or not status:
            return

        await InviteService.remove_invite(from_user, username)

        if status == "accepted":
            await self.channel_layer.group_send(
                f"user_{from_user}",
                {
                    "type": "send.invite.accepted",
                    "from": username
                }
            )
            player1, player2 = sorted([from_user, username])
            game_id = f"game-{player1}-{player2}"
            game_engine.create_game(game_id, player1, player2)
            await self.channel_layer.group_send(
                    f"user_{self.user.username}",
                    {"type": "send.in.game"}
                )

        elif status == "declined":
            await self.channel_layer.group_send(
                f"user_{from_user}",
                {
                    "type": "send.invite.declined",
                    "from": username
                }
            )
            await self.channel_layer.group_send(
                f"user_{username}",
                {"type": "group.send.invite.state"}
            )
            await self.channel_layer.group_send(
                f"user_{from_user}",
                {"type": "group.send.invite.state"}
            )

    @BaseConsumer.refresh_ttl_on_action
    async def action_invite_cancel(self, data):
        """
        Cancels a previously sent invite.
        """
        username = self.user.username
        to_user = data.get("to")
        if not to_user:
            return

        await InviteService.remove_invite(username, to_user)

        await self.channel_layer.group_send(
            f"user_{username}",
            {"type": "group.send.invite.state"}
        )
        await self.channel_layer.group_send(
            f"user_{to_user}",
            {"type": "group.send.invite.state"}
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_send_msg(self, data):
        """
        Sends a message in a 1:1 chat.
        Chat is identified by a consistent ID based on usernames.
        """
        username = self.user.username
        receiver = data.get("chatWith")
        msg = data.get("msg")
        if not receiver or not msg:
            return
        
        player1, player2 = sorted([receiver, username])
        chat_id = f"{player1}_{player2}"

        await RedisService.add_to_set(
            f"lobby_chats:{username}",
            chat_id
        )
        await RedisService.add_to_set(
            f"lobby_chats:{data.get('chatWith')}",
            chat_id
        )
        await self.push_message(chat_id, msg)
        await self.send_chat_notify(receiver)

    @BaseConsumer.refresh_ttl_on_action
    async def action_join_chat(self, data):
        """
        Adds the current user to the chat group and sends chat history.
        """
        chat_with = data.get("chatWith")
        if not chat_with:
            return

        player1, player2 = sorted([chat_with, self.user.username])
        chat_id = f"{player1}_{player2}"

        await self.channel_layer.group_add(chat_id, self.channel_name)
        await self.channel_layer.group_send(
            chat_id,
            {
                "type": "send.chat.history",
                "chat_id": chat_id
            }
        )

    @BaseConsumer.refresh_ttl_on_action
    async def action_ping(self, data):
        """
        Ping from client to keep user's lobby chat history.
        """
        pass

    async def group_send_user_list(self):
        """
        Sends an update to all lobby users with the current user list.
        """
        await self.channel_layer.group_send(
            "lobby_users",
            {"type": "send.user.list"}
        )

    async def send_user_list(self, event):
        """
        Sends the user list directly to the user.
        """
        users = await LobbyService.get_users()
        await self.send_json({
            "type": "user_list",
            "users": users,
            "self": self.user.username
        })

    async def group_send_invite_state(self, event):
        """
        Sends the current invite state to the user.
        """
        await self.send_invite_state()

    async def send_invite_state(self):
        """
        Sends the current invite state to the user.
        """
        state = await InviteService.get_state(self.user.username)
        await self.send_json({
            "type": "invite_state",
            **state
        })

    async def schedule_invite_watch(self, user1, user2):
        """
        Periodically checks whether an invite has expired.
        If so, updates both users' invite states.
        """
        await asyncio.sleep(60)
        while True:
            if await InviteService.invites_expired(user1, user2):
                await self.channel_layer.group_send(
                    f"user_{user1}",
                    {"type": "group.send.invite.state"}
                )
                await self.channel_layer.group_send(
                    f"user_{user2}",
                    {"type": "group.send.invite.state"}
                )
                break
            await asyncio.sleep(5)

    async def send_invite_accepted(self, event):
        """
        Sends a notification to the user that their invite was accepted.
        """
        await self.send_json({
            "type": "invite_accepted",
            "from": event["from"]
        })

    async def send_invite_declined(self, event):
        """
        Sends a notification to the user that their invite was declined.
        """
        await self.send_json({
            "type": "invite_declined",
            "from": event["from"]
        })

    async def send_chat_notify(self, receiver):
        """
        Notifies another user that they received a new message.
        """
        await self.channel_layer.group_send(
            f"user_{receiver}",
            {
                "type": "chat_notify",
                "from": self.user.username
            }
        )

    async def chat_notify(self, event):
        """
        Sends a chat notification to the user.
        """
        await self.send_json({
            "type": "chat_notify",
            "from": event["from"]
        })

    async def send_chat_history(self, event):
        """
        Sends a chat history for the specified chat to the user.
        """
        history = await ChatService.get_history(event["chat_id"])
        await self.send_json({
            "type": "chat_history",
            "history": history
        })

    async def push_message(self, chat_id, msg):
        """
        Stores a new message in the chat and updates the chat group
            with new history.
        """
        await ChatService.push_message(
            chat_id,
            {
                "from": self.user.username,
                "msg": msg
            }
        )
        await self.channel_layer.group_send(
            chat_id,
            {
                "type": "send.chat.history",
                "chat_id": chat_id
            }
        )

    async def send_in_game(self, game_id, event):
        """
        Sends a notification to the user that he's in a game.
        """
        await self.send_json({
            "type": "in_game",
            "game_id": game_id
        })

    async def find_game_id(self):
        """
        Checks if the user belongs to any games.

        Returns:
            string: Game id if game exists, None otherwise.
        """
        active_game_id = None
        for game_id, game in game_engine.games.items():
            if self.user.username in game["players"]:
                active_game_id = game_id
                break
        return active_game_id