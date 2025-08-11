from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.

    Features:
    - Handles user creation with proper password hashing.
    - Validates unique username.
    """

    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        """
        Create a new user instance with hashed password.

        Args:
            validated_data (dict): Validated user data containing
                username and password.

        Returns:
            User: Created user instance.
        """
        user = User.objects.create(**validated_data)
        user.set_password(user.password)
        user.save()
        return user
    
    def validate_username(self, value):
        """
        Validate that the username is unique.

        Args:
            value (str): The username to validate.

        Raises:
            serializers.ValidationError: If the username already exists.

        Returns:
            str: The validated username.
        """
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username is already taken.")
        return value