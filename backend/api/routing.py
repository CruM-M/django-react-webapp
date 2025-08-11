from django.urls import re_path
from .consumers import lobby_consumer, game_consumer

# WebSocket URL patterns
# Defines routes for WebSocket connections used by Django Channels.

websocket_urlpatterns = [
    # Lobby WebSocket endpoint:
    # Handles connections for the game lobby (user list, invites, chat).
    re_path("ws/lobby/", lobby_consumer.LobbyConsumer.as_asgi()),

    # Game WebSocket endpoint:
    # Handles connections for a specific game identified by `game_id`.
    # The `game_id` parameter is captured from the URL.
    re_path(
        r"^ws/game/(?P<game_id>[^/]+)/$",
        game_consumer.GameConsumer.as_asgi()
    ),
]