from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework import generics
from .serializers import UserSerializer
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.views.decorators.csrf import ensure_csrf_cookie

@api_view(["GET"])
@ensure_csrf_cookie
def get_csrf(request):
    """
    Sets a CSRF cookie for the client.

    Called by the frontend before making any POST requests
    to ensure CSRF protection. Returns a confirmation message.
    """
    return Response({"message": "CSRF cookie set"})

class CreateUserView(generics.CreateAPIView):
    """
    Handles user registration.

    - Uses Django's User model and UserSerializer.
    - Accepts POST request with 'username' and 'password'.
    - Hashes the password before saving.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class LoginView(APIView):
    """
    Handles user login.

    - Accepts POST request with 'username' and 'password'.
    - Authenticates the user using Django's built-in authentication.
    - On success: logs the user in and returns a success message.
    - On failure: returns 401 Unauthorized with an error message.
    """
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)

        if user is not None:
            login(request, user)
            return Response({"message": "Logged in"})
        else:
            return Response(
                {"error": "Invalid login credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
class LogoutView(APIView):
    """
    Handles user logout.

    - Accepts POST request (requires user to be authenticated).
    - Logs the user out by clearing the session.
    - Returns success message on logout or 401 if user is not authenticated.
    """
    def post(self, request):
        user = request.user

        if user.is_authenticated:
            logout(request)
            return Response({"message": "Logged out"})
        
        return Response(
            {"error": "User not authenticated"},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
class CheckAuthView(APIView):
    """
    Checks if the current user is authenticated.

    - Accepts GET request.
    - Returns {"isAuthenticated": True} if user is logged in, else False.
    """
    def get(self, request):
        if request.user.is_authenticated:
            return Response({"isAuthenticated": True})
        else:
            return Response({"isAuthenticated": False})
