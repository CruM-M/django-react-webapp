from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework import generics
from .serializers import UserSerializer
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.views.decorators.csrf import ensure_csrf_cookie
from api.lobby_consumer import LobbyConsumer
from channels.layers import get_channel_layer
import asyncio

@api_view(['GET'])
@ensure_csrf_cookie
def get_csrf(request):
    return Response({'message': 'CSRF cookie set'})

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class LoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)

        if user is not None:
            login(request, user)
            return Response({"message": "Logged in"})
        else:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
class LogoutView(APIView):
    def post(self, request):
        user = request.user

        if user.is_authenticated:
            username = user.username

            consumer = LobbyConsumer(scope={"user": user})
            consumer.channel_layer = get_channel_layer()

            asyncio.run(consumer.remove_user_from_lobby(username))

            asyncio.run(consumer.channel_layer.group_send("lobby", {
                "type": "user.left",
                "username": username
            }))

            logout(request)
            return Response({"message": "Logged out"})
        
        return Response({"error": "User not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
class CheckAuthView(APIView):
    def get(self, request):
        if request.user.is_authenticated:
            return Response({"isAuthenticated": True})
        else:
            return Response({"isAuthenticated": False})

class UserListView(APIView):
    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
