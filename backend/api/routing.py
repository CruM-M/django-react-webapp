from django.urls import re_path
from . import lobby_consumer, game_consumer

websocket_urlpatterns = [
    re_path("ws/lobby/", lobby_consumer.LobbyConsumer.as_asgi()),
    re_path(r"^ws/game/(?P<game_id>[^/]+)/$", game_consumer.GameConsumer.as_asgi()),
]