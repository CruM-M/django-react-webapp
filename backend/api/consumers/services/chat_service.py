import json
from .redis_service import RedisService

class ChatService:
    """
    Service for handling chat messages stored in Redis.
    Provides methods to push messages, retrieve chat history,
    and delete chat data.
    """

    @staticmethod
    async def push_message(chat_id: str, message: dict):
        """
        Store a chat message in Redis.

        Args:
            chat_id (str): The unique identifier for the chat.
            message (dict): The message to store, as a dictionary.
        """
        await RedisService.push_list(chat_id, json.dumps(message))

    @staticmethod
    async def get_history(chat_id):
        """
        Retrieve full chat history from Redis.

        Args:
            chat_id (str): The unique identifier for the chat.

        Returns:
            list[dict]: List of messages as dictionaries.
        """
        history = await RedisService.get_list(chat_id)
        return [json.loads(m) for m in history]
    
    @staticmethod
    async def delete_chat(chat_id: str):
        """
        Delete all messages for a given chat.

        Args:
            chat_id (str): The unique identifier for the chat.
        """
        await RedisService.delete(chat_id)