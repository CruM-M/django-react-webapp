from django.urls import path
from api.views import (
    UserListView,
    CreateUserView,
    LoginView,
    LogoutView,
    CheckAuthView,
    get_csrf
)

# API URL patterns for authentication and user management.
urlpatterns = [
    # Endpoint to get CSRF token for secure requests.
    path("csrf/", get_csrf),

    # Returns a list of all registered users (Admin purpose).
    path("user-list/", UserListView.as_view(), name="user_list"),

    # Registers a new user.
    path("register/", CreateUserView.as_view(), name="register"),

    # Logs in a user by validating credentials and setting session cookies.
    path("login/", LoginView.as_view(), name="login"),

    # Logs out the current user and clears session cookies.
    path("logout/", LogoutView.as_view(), name="logout"),

    # Checks if the current user is authenticated.
    path("check-auth/", CheckAuthView.as_view(), name="check_auth"),
]
