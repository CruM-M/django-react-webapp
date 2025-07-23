def create_empty_board():
        return [["" for _ in range(10)] for _ in range(10)]

class GameEngine:
    def __init__(self):
        self.games = {}

    def create_game(self, game_id, player1, player2):
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
            "restart": {
                player1: False,
                player2: False
            },
            "temp_disconnect": {
                player1: False,
                player2: False
            },
            "full_disconnect": {
                player1: False,
                player2: False
            },
            "turn": player1,
            "winner": None
        }

    def get_game(self, game_id):
        return self.games[game_id]
    
    def place_ships(self, game_id, player, x_start, y_start, length, orientation):
        game = self.get_game(game_id)
        if not game:
            return {"result": "Game not found."}
        
        board = game["boards"][player]
        ships_left = game["ships_left"][player]

        if ships_left[length] == 0:
            return {"result": f"No more ships of length {length} available."}

        coords = []

        for i in range(length):
            x = x_start + i if orientation == "horizontal" else x_start
            y = y_start if orientation == "horizontal" else y_start + i

            if not (0 <= x < 10 and 0 <= y < 10):
                return {"result": "Ship out of bounds."}
            
            if board[y][x] == "S":
                return {"result": "Ship overlaps with another."}
            
            coords.append((x, y))

        for x, y in coords:
            board[y][x] = "S"

        game["placed_ships"][player].append({
            "coords": coords,
            "sunk": False
        })
        game["ships_left"][player][length] -= 1

        return {"result": "Ship placed"}

    def remove_ship(self, game_id, player, x, y):
        game = self.get_game(game_id)
        if not game:
            return {"result": "Game not found."}

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
            return {"result": "Ship removed"}
        else:
            return {"result": "No ship found at this position."}


    def set_ready(self, game_id, player):
        game = self.get_game(game_id)
        if not game:
            return {"result": "Game not found."}

        if any(count > 0 for count in game["ships_left"][player].values()):
            return {"result": "You haven't placed all of the ships yet."}

        game["ready"][player] = True
        return {"result": "You're ready!"}


    def make_move(self, game_id, player, x, y):
        game = self.get_game(game_id)

        if not game:
            return {"result": "Game not found."}

        if game["turn"] != player:
            return {"result": "Not your turn."}
        
        enemy = [p for p in game["players"] if p != player][0]
        enemy_board = game["boards"][enemy]
        hit_board = game["hits"][player]

        if hit_board[y][x] != "":
            return {"result": "repeat"}

        if enemy_board[y][x] == "S":
            hit_board[y][x] = "X"
            result = "HIT"

            for ship in game["placed_ships"][enemy]:
                if (x, y) in ship["coords"]:
                    if all(hit_board[yy][xx] == "X" for xx, yy in ship["coords"]):
                        result = f"SUNK SHIP: {len(ship["coords"])}"
                        ship["sunk"] = True
                        
                        if all(s["sunk"] for s in game["placed_ships"][enemy]):
                            result = "win"
                    break
        else:
            hit_board[y][x] = "O"
            result = "MISS"

        game["turn"] = enemy

        return {
            "result": result,
            "x": x,
            "y": y,
            "next_turn": game["turn"]
        }
    
    def get_game_state(self, game_id, player):
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
            "ships_left": game["ships_left"][player],
            "ready": game["ready"][player],
            "opponent_ready": game["ready"][enemy],
            "restart": game["restart"],
            "opponent_disconnected": game["full_disconnect"][enemy],
            "turn": game["turn"],
            "winner": game["winner"]
        }
    
    def end_game(self, game_id):
        if game_id in self.games:
            del self.games[game_id]
        
game_engine = GameEngine()