import random

def create_empty_board():
    """
    Create an empty 10x10 game board.

    Returns:
        list[list[str]]: A 10x10 grid initialized with empty strings.
    """
    return [["" for _ in range(10)] for _ in range(10)]


class GameEngine:
    """
    Game engine for managing game state, ship placement, moves,
        and player turns in a two-player battleship game.
    """

    def __init__(self):
        """
        Initialize the GameEngine with an empty game dictionary.
        """
        self.games = {}

    def create_game(self, game_id, player1, player2):
        """
        Create a new game with two players.

        Args:
            game_id (str): Unique identifier for the game.
            player1 (str): Username of the first player.
            player2 (str): Username of the second player.
        """
        self.games[game_id] = {
            "players": [player1, player2],
            "boards": {
                player1: create_empty_board(),
                player2: create_empty_board()
            },
            "hits": {
                player1: create_empty_board(),
                player2: create_empty_board()
            },
            "ships_left": {
                player1: {2: 1, 3: 2, 4: 1, 5: 1},
                player2: {2: 1, 3: 2, 4: 1, 5: 1}
            },
            "placed_ships": {
                player1: [],
                player2: []
            },
            "ready": {
                player1: False,
                player2: False
            },
            "turn": random.choice([player1, player2]),
            "winner": None
        }

    def get_game(self, game_id):
        """
        Retrieve the game data by its ID.

        Args:
            game_id (str): Unique game identifier.

        Returns:
            dict: The game state dictionary.
        """
        return self.games[game_id]
    
    def place_ships(
            self,
            game_id,
            player,
            x_start,
            y_start,
            length,
            orientation
        ):
        """
        Place a ship for the player on the board.

        Args:
            game_id (str): Game identifier.
            player (str): Player username.
            x_start (int): Starting X position.
            y_start (int): Starting Y position.
            length (int): Length of the ship.
            orientation (str): "horizontal" or "vertical".

        Returns:
            dict: Placement result with message and access type.
        """
        game = self.get_game(game_id)
        if not game:
            return {"result": "GAME NOT FOUND",
                    "access": "private"}
        
        board = game["boards"][player]
        ships_left = game["ships_left"][player]

        if ships_left[length] == 0:
            return {"result": f"NO MORE SHIPS OF LENGTH {length} AVAILABLE",
                    "access": "private"}

        coords = []

        for i in range(length):
            x = x_start + i if orientation == "horizontal" else x_start
            y = y_start if orientation == "horizontal" else y_start + i
            coords.append((x, y))

        for x, y in coords:
            board[y][x] = "S"

        game["placed_ships"][player].append({
            "coords": coords,
            "sunk": False
        })
        game["ships_left"][player][length] -= 1

        return {"result": "SHIP PLACED",
                "access": "private"}

    def remove_ship(self, game_id, player, x, y):
        """
        Remove a ship from the board by clicking on one of its coordinates.

        Args:
            game_id (str): Game identifier.
            player (str): Player username.
            x (int): X position.
            y (int): Y position.

        Returns:
            dict: Result of removal operation.
        """
        game = self.get_game(game_id)
        if not game:
            return {"result": "GAME NOT FOUND",
                    "access": "private"}

        board = game["boards"][player]
        ships = game["placed_ships"][player]
        ships_left = game["ships_left"][player]

        ship_to_remove = None
        for ship in ships:
            if (x, y) in ship["coords"]:
                ship_to_remove = ship
                break

        if ship_to_remove:
            for sx, sy in ship_to_remove["coords"]:
                board[sy][sx] = ""
            ships.remove(ship_to_remove)
            ships_left[len(ship_to_remove["coords"])] += 1
            return {"result": "SHIP REMOVED",
                    "access": "private"}
        else:
            return {"result": "NO SHIP FOUND AT CHOSEN POSITION",
                    "access": "private"}


    def set_ready(self, game_id, player):
        """
        Mark a player as ready if all ships are placed.

        Args:
            game_id (str): Game identifier.
            player (str): Player username.

        Returns:
            dict: Readiness confirmation or error.
        """
        game = self.get_game(game_id)
        if not game:
            return {"result": "GAME NOT FOUND",
                    "access": "private"}

        if any(count > 0 for count in game["ships_left"][player].values()):
            return {"result": "YOU MUST PLACE ALL SHIPS FIRST",
                    "access": "private"}

        game["ready"][player] = True
        return {"result": f"{str(player).upper()} IS READY",
                "access": "public"}


    def make_move(self, game_id, player, x, y):
        """
        Handle player's move and determine if it's a hit, miss, or game over.

        Args:
            game_id (str): Game identifier.
            player (str): Player username.
            x (int): X coordinate to fire at.
            y (int): Y coordinate to fire at.

        Returns:
            dict: Move result, including whether it was a hit, miss, or win.
        """
        game = self.get_game(game_id)

        if not game:
            return {"result": "GAME NOT FOUND",
                    "access": "private"}
        
        enemy = [p for p in game["players"] if p != player][0]
        enemy_board = game["boards"][enemy]
        hit_board = game["hits"][player]

        if hit_board[y][x] != "":
            return {"result": "ALREADY SHOT THIS POSITION - CHOOSE ANOTHER",
                    "access": "private"}

        if enemy_board[y][x] == "S":
            hit_board[y][x] = "X"
            result = f"{str(player).upper()} LANDED A HIT"

            for ship in game["placed_ships"][enemy]:
                if (x, y) in ship["coords"]:
                    if all(
                        hit_board[yy][xx] == "X" for xx, yy in ship["coords"]
                    ):
                        result = f"{str(player).upper()} SUNK ENEMY SHIP"
                        ship["sunk"] = True
                        
                        if all(
                            s["sunk"] for s in game["placed_ships"][enemy]
                        ):
                            result = f"GAME OVER! {str(player).upper()} WON!"
                            game["winner"] = player
                    break
        else:
            hit_board[y][x] = "O"
            result = f"{str(player).upper()} MISSED"

        game["turn"] = enemy

        return {
            "result": result,
            "access": "public",
            "x": x,
            "y": y,
            "next_turn": game["turn"]
        }
    
    def get_game_state(self, game_id, player):
        """
        Get the full game state from the player's perspective.

        Args:
            game_id (str): Game identifier.
            player (str): Player username.

        Returns:
            dict: Game state including boards, hits, turn, and winner.
        """
        game = self.get_game(game_id)
        enemy = [p for p in game["players"] if p != player][0]

        if not game:
            return None
        return {
            "players": game["players"],
            "self": player,
            "own_board": game["boards"][player],
            "opponent_board": game["boards"][enemy],
            "hits": game["hits"][player],
            "opponent_hits": game["hits"][enemy],
            "placed_ships": game["placed_ships"][player],
            "opponent_placed_ships": game["placed_ships"][enemy],
            "ships_left": game["ships_left"][player],
            "ready": game["ready"][player],
            "opponent_ready": game["ready"][enemy],
            "turn": game["turn"],
            "winner": game["winner"]
        }
    
    def end_game(self, game_id):
        """
        Delete the game and its data by ID.

        Args:
            game_id (str): Game identifier.
        """
        if game_id in self.games:
            del self.games[game_id]

# Global instance of the game engine
game_engine = GameEngine()