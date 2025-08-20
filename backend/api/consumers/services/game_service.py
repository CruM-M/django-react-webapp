import json
from .redis_service import RedisService

class GameService:
    """
    Service for managing player status in a game using Redis.
    Handles initialization, updates, and checks for player status flags.
    """

    @staticmethod
    async def init_player_status(game_id, username):
        """
        Initialize a player's status in a specific game with default values.

        Args:
            game_id (str): The unique identifier for the game.
            username (str): The player's username.

        Returns:
            dict: The initialized status dictionary.
        """
        status = {
            "temp_disconnect": False,
            "full_disconnect": False,
            "restart": False
        }
        await RedisService.set_hash(game_id, username, json.dumps(status))
        return status

    @staticmethod
    async def get_player_status(game_id, username):
        """
        Retrieve the status of a specific player in a game.

        Args:
            game_id (str): The unique identifier for the game.
            username (str): The player's username.

        Returns:
            dict | None: The player's status dictionary, or None if not found.
        """
        data = await RedisService.get_hash(game_id, username)
        return json.loads(data) if data else None

    @staticmethod
    async def set_status(game_id, username, key, value):
        """
        Update a specific status key for a player in a game.

        Args:
            game_id (str): The unique identifier for the game.
            username (str): The player's username.
            key (str): The status key to update (e.g., "restart").
            value (bool): The new value for the status key.
        """
        status = await GameService.get_player_status(game_id, username)
        status[key] = value
        await RedisService.set_hash(game_id, username, json.dumps(status))

    @staticmethod
    async def all_status_true(game_id, key):
        """
        Check if a given status key is True for all players in a game.

        Args:
            game_id (str): The unique identifier for the game.
            key (str): The status key to check.

        Returns:
            bool: True if all players have the status key set to True,
                False otherwise.
        """
        players = await RedisService.get_all_hash(game_id)
        return all(json.loads(v)[key] for v in players.values())

    @staticmethod
    async def delete_game_status(game_id):
        """
        Delete all status data for a game.

        Args:
            game_id (str): The unique identifier for the game.
        """
        await RedisService.delete(game_id)