from .redis_service import RedisService

class InviteService:
    """
    Service for managing game invites using Redis.
    Handles adding, removing, checking, and expiring invites.
    """

    @staticmethod
    async def add_invite(from_user, to_user):
        """
        Add a new game invite to Redis with expiration.

        Args:
            from_user (str): Username of the sender.
            to_user (str): Username of the recipient.
        """
        await RedisService.add_to_set(
            f"invites_incoming:{to_user}",
            from_user, ex=60
        )
        await RedisService.add_to_set(
            f"invites_outgoing:{from_user}",
            to_user, ex=60
        )

    @staticmethod
    async def remove_invite(from_user, to_user):
        """
        Remove an existing game invite from Redis.

        Args:
            from_user (str): Username of the sender.
            to_user (str): Username of the recipient.
        """
        await RedisService.remove_from_set(
            f"invites_incoming:{to_user}",
            from_user
        )
        await RedisService.remove_from_set(
            f"invites_outgoing:{from_user}",
            to_user
        )

    @staticmethod
    async def get_state(username):
        """
        Retrieve the current invites for a user (incoming and outgoing).

        Args:
            username (str): The username for which to check invites.

        Returns:
            dict: A dictionary with keys 'incoming' and 'outgoing',
                each containing a list of usernames.
        """
        incoming = await RedisService.get_set(
            f"invites_incoming:{username}"
        )
        outgoing = await RedisService.get_set(
            f"invites_outgoing:{username}"
        )
        return {"incoming": incoming, "outgoing": outgoing}

    @staticmethod
    async def invites_expired(user1, user2):
        """
        Check if invites between two users have expired.

        Args:
            user1 (str): The first username.
            user2 (str): The second username.

        Returns:
            bool: True if both invites no longer exist in Redis.
        """
        exists_incoming = await RedisService.exists(
            f"invites_incoming:{user2}"
        )
        exists_outgoing = await RedisService.exists(
            f"invites_outgoing:{user1}"
        )
        return not exists_incoming and not exists_outgoing