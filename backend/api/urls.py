from django.urls import path
from api.views import UserListView, CreateUserView, LoginView, LogoutView, get_csrf

urlpatterns = [
    path("csrf/", get_csrf),
    path('userlist/', UserListView.as_view(), name='user_list'),
    path('register/', CreateUserView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
]
