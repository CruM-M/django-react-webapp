import Board from "../components/Board";
import Chat from "../components/Chat";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";

/**
 * Game component - Handles the main game logic and UI.
 * 
 * Features:
 * - WebSocket connection for real-time game updates
 * - Board management (placing/removing ships)
 * - Game state synchronization with the server
 * - Chat functionality between players
 * - Game restart and leave logic
 *
 * @component
 * @returns {JSX.Element} Rendered Game UI
 */
function Game() {
    const navigate = useNavigate();
    const { gameId } = useParams();

    /**
     * @constant {number[]} shipLengths - List of ship lengths available
     * for placement
     */
    const shipLengths = [5, 4, 3, 3, 2];

    // State variables
    const [socket, setSocket] = useState(null);
    const [state, setState] = useState(null);
    const [selectedShip, setSelectedShip] = useState(null);
    const [gameOver, setGameOver] = useState(false);
    const [voteRestart, setVoteRestart] = useState(false);
    const [opponentLeft, setOpponentLeft] = useState(false);
    const [bothReady, setBothReady] = useState(false);
    const [placeMode, setPlaceMode] = useState("place");
    const [orientation, setOrientation] = useState("horizontal");
    const [messages, setMessages] = useState([]);

    /**
     * Initializes WebSocket connection and sets up event listeners.
     * Handles incoming messages from server (game state, chat, new game)
     *  - Sends heartbeat ping every 15s to keep lobby chat history
     */
    useEffect(() => {
        const ws = new WebSocket(
            `${import.meta.env.VITE_WS_API_URL}game/${gameId}/`
        );
        setSocket(ws);

        let isUnmounted = false;
        let intervalRef = null;

        ws.onopen = () => {
            if (isUnmounted) return;

            // Heartbeat every 15s
            intervalRef = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: "ping" }));
                }
            }, 15000);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch(data.type) {
                case "game_state":
                    setState(data.state);
                    setOpponentLeft(data.opponent_left);
                    if (data.state.ready && data.state.opponent_ready) {
                        setBothReady(true);
                    }
                    if (data.state.winner !== null) {
                        setGameOver(true);
                    }
                    break;

                case "chat_history":
                    setMessages(data.history);
                    break;

                case "new_game":
                    setGameOver(false);
                    setVoteRestart(false);
                    setBothReady(false);
                    break;

                case "error":
                    alert(data.message);
                    break;
            }
        };

        ws.onclose = (event) => {
            isUnmounted = true;
            if (intervalRef) {
                clearInterval(intervalRef);
                intervalRef = null;
            }

            // If game ended or connection dropped, redirect to lobby
            if (event.code === 4000 || event.code === 1006) {
                navigate("/lobby", { replace: true });
            }
        };

        ws.onerror = () => {
            navigate("/lobby", { replace: true });
        };

        return () => {
            isUnmounted = true;

            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }};
    }, []);

    /**
     * Capitalizes the first letter of a given string.
     * @param {string} string - Input string
     * @returns {string} Formatted string with first letter uppercase
     */
    const capitalizeFirstLetter = (string) => {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Sends an action through the WebSocket connection.
     * @param {Object} data - The data to send
     */
    const send = (data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }
    };

    /**
     * Handles clicks on the game board cells during ship placement.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    const handleCellClick = (x, y) => {
        if (state.ready) return;

        const hasShip = state.placed_ships?.some(ship =>
            ship.coords.some(([sx, sy]) => sx === x && sy === y)
        );
        if (hasShip && placeMode === "remove") removeShip(x, y);
        else if (placeMode === "place") placeShip(x, y);
    };

    /**
     * Sends a request to place a ship at given coordinates.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    const placeShip = (x, y) => {
        if (selectedShip) {
            send({
                action: "place_ship",
                x,
                y,
                length: selectedShip,
                orientation
            });
            setSelectedShip(null);
        }
    };

    /**
     * Sends a request to remove a ship at given coordinates.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    const removeShip = (x, y) => {
        send({ action: "remove_ship", x, y });
    };

    /** Marks the player as ready when all ships are placed */
    const setReady = () => {
        send({ action: "set_ready" });
    };

    /**
     * Sends a move action when attacking opponent's board.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    const makeMove = (x, y) => {
        send({ action: "make_move", x, y });
    };

    /** Leaves the game and redirects back to the lobby */
    const leaveGame = () => {
        send({ action: "leave_game"});
        socket.close();

        navigate("/lobby", { replace: true });
    };

    /**
     * Checks if all ships have been placed.
     * @returns {boolean} True if all ships are placed
     */
    const allShipsPlaced = () => {
        const shipsLeft = state.ships_left;
        return Object.values(shipsLeft).every(count => count === 0);
    };

    /** Initiates game restart vote */
    const restartGame = () => {
        setVoteRestart(true);
        send({ action: "restart_game"});
    };

    // If game state is not loaded yet, show loading text
    if (!state) return <div>{"Loading game..."}</div>;
    const isPlayerTurn = state.turn === state.self;
    const opponent = state.players.find(p => p !== state.self);

    return (
        <div>
            <h2>
                {"Game: "}
                {capitalizeFirstLetter(state.self)}
                {" vs "}
                {capitalizeFirstLetter(opponent)}
            </h2>

            <button onClick={leaveGame}>
                Return to Lobby
            </button>

            {/* Chat component */}
            <div>
                <Chat
                    socket={socket}
                    currentUser={state.self}
                    messages={messages}
                    chatWith={null}
                    game={true}
                />
            </div>

            {/* Restart button if game over */}
            {gameOver && !opponentLeft && (
                <button
                    onClick={restartGame}
                    disabled={voteRestart}
                >
                    {voteRestart ? "Voted for rematch" : "Play Again"}
                </button>
            )}

            {/* Turn indicator */}
            {bothReady && !gameOver && !opponentLeft && (
                <p>
                    {"It's "}
                    {
                        capitalizeFirstLetter(
                            isPlayerTurn ? "your" : opponent + "'s"
                        )
                    }
                    {" turn"}
                </p>
            )}

            {/* Ship placement section */}
            {!state.ready && !opponentLeft && (
                <div>
                    <h3>{"Place your ships"}</h3>
                    {Array.from(new Set(shipLengths)).map(length => (
                        <button
                            key={length}
                            onClick={() => {
                                setSelectedShip(length);
                                setPlaceMode("place");
                            }}
                            disabled={state.ships_left[length] === 0}
                        >
                            {length}{"-long "}
                            {state.ships_left[length] || 0}{" left"}
                        </button>
                    ))}
                    <button onClick={() => setOrientation(o =>
                        o === "horizontal"
                        ? "vertical"
                        : "horizontal"
                    )}>
                        {"Rotate: "}{orientation}
                    </button>
                    <button onClick={() => {
                        setPlaceMode(p =>
                            p === "place"
                            ? "remove"
                            : "place"
                        );
                        setSelectedShip(null);
                    }}>
                        {"Swap Mode: "}{placeMode}
                    </button>
                </div>
            )}

            {/* Player board */}
            {!opponentLeft && (
                <div>
                    <h3>{"Your Board"}</h3>
                    <Board
                        board={state.own_board}
                        placedShips={state.placed_ships}
                        onCellClick={bothReady ? null : handleCellClick}
                        canPlace={!bothReady}
                        selectedShip={selectedShip}
                        orientation={orientation}
                    />
                </div>
            )}

            {/* Opponent board */}
            {bothReady && !opponentLeft && (
                <div>
                    <h3>{"Opponent Board"}</h3>
                    <Board
                        board={state.opponent_board}
                        hits={state.hits}
                        onCellClick={
                            !gameOver
                            ? (isPlayerTurn ? makeMove : null)
                            : null
                        }
                        canPlace={false}
                    />
                </div>
            )}

            {/* Ready button */}
            {!bothReady && !opponentLeft && (
                <button 
                    onClick={() => {setReady(); setSelectedShip(null);}} 
                    disabled={!allShipsPlaced() || state.ready}
                >
                    {"I'm Ready"}
                </button>
            )}
        </div>
    );
}

export default Game