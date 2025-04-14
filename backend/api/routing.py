from django.urls import re_path
from . import lobby_consumer

websocket_urlpatterns = [
    re_path(r'ws/lobby/$', lobby_consumer.LobbyConsumer.as_asgi()),
]