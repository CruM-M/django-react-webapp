import Board from "../components/Board";
import Chat from "../components/Chat";
import { useEffect, useState } from 'react';
import { data, useNavigate, useParams } from "react-router-dom";

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
    const shipLengths = [2, 3, 3, 4, 5];

    // State variables
    const [socket, setSocket] = useState(null);
    const [state, setState] = useState(null);
    const [opponent, setOpponent] = useState(null)
    const [selectedShip, setSelectedShip] = useState(null);
    const [gameOver, setGameOver] = useState(false);
    const [voteRestart, setVoteRestart] = useState(false);
    const [opponentLeft, setOpponentLeft] = useState(false);
    const [bothReady, setBothReady] = useState(false);
    const [placeMode, setPlaceMode] = useState("place");
    const [orientation, setOrientation] = useState("horizontal");
    const [messages, setMessages] = useState([]);
    const [pendingAction, setPendingAction] = useState(null);

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
                    const opponent = data.state.players.find(
                        p => p !== data.state.self
                    );
                    setOpponent(opponent);
                    if (data.players_disconnect[data.state.self]) {
                        navigate("/lobby", { replace: true });
                    }  else if (data.players_disconnect[opponent]) {
                        setOpponentLeft(true);
                    }
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
     * Handles clicks on the game board cells during ship placement or removal.
     * - If in remove mode, checks if the clicked cell contains a ship
     *   and marks it for removal.
     * - If in place mode, validates placement at the clicked cell
     *   and marks it as a pending action.
     * @param {number} x - X coordinate of the clicked cell
     * @param {number} y - Y coordinate of the clicked cell
     */
    const handleCellClick = (x, y) => {
        if (state.ready) return;

        const hasShip = state.placed_ships?.some(ship =>
            ship.coords.some(([sx, sy]) => sx === x && sy === y)
        );
        if (hasShip && placeMode === "remove") {
            setPendingAction({type: placeMode, x, y});
        }
        else if (selectedShip && placeMode === "place") {
            if (validatePlacement(x, y)) {
                setPendingAction({type: placeMode, x, y});
            }
        }
    };

    /**
     * Confirms a pending action (ship placement or removal).
     * - If placement: calls `placeShip` with stored coordinates.
     * - If removal: calls `removeShip` with stored coordinates.
     * - Resets pending action after execution.
     */
    const handleActionConfirm = () => {
        if (!pendingAction) return;
        const type = pendingAction.type;
        const x = pendingAction.x;
        const y = pendingAction.y;

        if (type === "place") {
            placeShip(x, y);
        }
        else if (type === "remove") {
            removeShip(x, y);
        }
        setPendingAction(null);
    };

    /**
     * Validates whether a ship can be placed starting at given coordinates.
     * - Ensures ship stays within board boundaries.
     * - Ensures ship does not overlap with existing ships.
     * 
     * @param {number} x_start - Starting X coordinate
     * @param {number} y_start - Starting Y coordinate
     * @returns {boolean} True if placement is valid, false otherwise
     */
    const validatePlacement = (x_start, y_start) => {
        for (let i = 0; i < selectedShip; i++) {
            const x = orientation === "horizontal" ? x_start + i : x_start;
            const y = orientation === "horizontal" ? y_start : y_start + i;

            if (!(x >= 0 && x < 10 && y >= 0 && y < 10)) {
                sendMessage("SHIP OUT OF BOUNDS")
                return false;
            }

            if (state["own_board"][y][x] === "S") {
                sendMessage("SHIP OVERLAPS WITH ANOTHER")
                return false;
            }
        }

        return true;
    };

    /**
     * Sends a private system message to the chat via WebSocket.
     * @param {string} msg - Message content
     */
    const sendMessage = (msg) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "send_msg",
                sender: "system",
                msg,
                access: "private",
                chatWith: null
            }));
        }
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

    return (
        <div className="page-container">
            <h1 className="header-container">
                <span className="user-name">
                    {capitalizeFirstLetter(state.self)}
                </span>
                {" vs "}
                <span className="user-name">
                    {capitalizeFirstLetter(opponent)}
                </span>
            </h1>

            <div className="main-container">
                <div className="left-container">
                    <div>
                        <button
                            className="button"
                            onClick={leaveGame}
                        >
                            {"Leave"}
                        </button>

                        {/* Chat component */}
                        <Chat
                            socket={socket}
                            currentUser={state.self}
                            messages={messages}
                            chatWith={null}
                            game={true}
                        />
                    </div>

                    {/* Ship placement section */}
                    {!state.ready && !opponentLeft && (
                        <div>
                            <h3>{"Place your ships"}</h3>
                            <div className="ship-button-container">
                                {Array.from(
                                    new Set(shipLengths)).map(length => (
                                    <button
                                        className={`ship-button ${
                                            selectedShip === length
                                            ? "selected"
                                            : ""
                                        }`}
                                        key={length}
                                        onClick={() => {
                                            setSelectedShip(length);
                                            setPlaceMode("place");
                                        }}
                                        disabled={
                                            selectedShip === length
                                            || state.ships_left[length] === 0
                                            || pendingAction
                                        }
                                    >
                                        {length}{"-long: "}
                                        {state.ships_left[length] || 0}{""}
                                    </button>
                                ))}
                                <button
                                    className="ship-button"
                                    onClick={() => setOrientation(o =>
                                        o === "horizontal"
                                        ? "vertical"
                                        : "horizontal",
                                    )}
                                    disabled={pendingAction}
                                >
                                    {orientation.toUpperCase()}
                                </button>
                                <button
                                    className="ship-button"
                                    onClick={() => {
                                        setPlaceMode(p =>
                                            p === "place"
                                            ? "remove"
                                            : "place"
                                        );
                                        setSelectedShip(null);
                                    }}
                                    disabled={pendingAction}
                                >
                                    {placeMode.toUpperCase()}
                                </button>
                            </div>
                        </div>
                    )}

                    {bothReady && !opponentLeft && (
                        <div className="small-board-container">
                            {/* Player board */}
                            {bothReady && !opponentLeft && (
                                <div>
                                    <h3>{"Your Board"}</h3>
                                    <Board
                                        board={state.own_board}
                                        boardType={"small"}
                                        hits={state.opponent_hits}
                                        placedShips={state.placed_ships}
                                        onCellClick={bothReady
                                            ? null
                                            : handleCellClick
                                        }
                                        canClick={!bothReady}
                                        selectedShip={selectedShip}
                                        orientation={orientation}
                                        placeMode={placeMode}
                                        pendingAction={pendingAction}
                                    />
                                </div>
                            )}
                            <div className="turn-container">
                                {/* Turn indicator */}
                                {bothReady && !gameOver && !opponentLeft && (
                                    <p className="turn-state">
                                        <span>
                                            {
                                                isPlayerTurn
                                                ? "YOUR"
                                                : "ENEMY"
                                            }
                                        </span>
                                        <span>{"TURN"}</span>
                                    </p>
                                )}
                                {/* Winner indicator */}
                                {bothReady && gameOver && !opponentLeft && (
                                    <p className="turn-state">
                                        <span>{"YOU"}</span>
                                        <span>
                                            {
                                                state.winner === state.self
                                                ? "WON!"
                                                : "LOST!"
                                            }
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="right-container">
                    {/* Player board */}
                    {!bothReady && !opponentLeft && (
                        <div>
                            <h3>{"Your Board"}</h3>
                            <Board
                                board={state.own_board}
                                boardType={"big"}
                                hits={state.opponent_hits}
                                placedShips={state.placed_ships}
                                onCellClick={bothReady
                                    ? null
                                    : handleCellClick
                                }
                                canClick={!bothReady}
                                selectedShip={selectedShip}
                                orientation={orientation}
                                placeMode={placeMode}
                                pendingAction={pendingAction}
                            />
                        </div>
                    )}

                    {/* Opponent board */}
                    {bothReady && !opponentLeft && (
                        <div>
                            <h3>{"Opponent Board"}</h3>
                            <Board
                                board={state.opponent_board}
                                boardType={"opponent"}
                                hits={state.hits}
                                opponentPlacedShips={
                                    state.opponent_placed_ships
                                }
                                onCellClick={
                                    !gameOver
                                    ? (isPlayerTurn ? makeMove : null)
                                    : null
                                }
                                canClick={!gameOver}
                            />
                        </div>
                    )}

                    {(!state.ready
                        || pendingAction
                        || (gameOver && !opponentLeft)
                    ) && (
                        <div className="action-button-container">
                            {/* Ready button */}
                            {!state.ready
                                && !opponentLeft
                                && allShipsPlaced()
                                && !pendingAction
                                && (
                                <button
                                    className="button"
                                    onClick={() => {
                                        setReady();
                                        setSelectedShip(null);
                                    }}
                                >
                                    {"I'm Ready"}
                                </button>
                            )}

                            {pendingAction && !opponentLeft &&(
                                <div className="board-button-container">
                                    <button
                                        className="button"
                                        onClick={() => handleActionConfirm()}
                                    >
                                        {"Confirm"}
                                    </button>
                                    <button
                                        className="button"
                                        onClick={() => {
                                            setPendingAction(null);
                                            setSelectedShip(null);
                                        }}
                                    >
                                        {"Cancel"}
                                    </button>
                                </div>
                            )}

                            {/* Restart button if game over */}
                            {gameOver && !opponentLeft && (
                                <button
                                    className="button"
                                    onClick={restartGame}
                                    disabled={voteRestart}
                                >
                                    {voteRestart
                                        ? "Voted for rematch"
                                        : "Play Again"
                                    }
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Game