from .redis_service import RedisService

class LobbyService:
    """
    Service for managing users in the game lobby using Redis.
    Handles adding, removing, and listing active lobby users.
    """

    @staticmethod
    async def add_user(username):
        """
        Add a user to the lobby set in Redis.

        Args:
            username (str): The username to add.
        """
        await RedisService.add_to_set("lobby_users", username)

    @staticmethod
    async def remove_user(username):
        """
        Remove a user from the lobby set in Redis.

        Args:
            username (str): The username to remove.
        """
        await RedisService.remove_from_set("lobby_users", username)

    @staticmethod
    async def get_users():
        """
        Retrieve all active users currently in the lobby.

        Returns:
            list[str]: A list of usernames in the lobby.
        """
        return await RedisService.get_set("lobby_users")