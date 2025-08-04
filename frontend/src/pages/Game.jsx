import Board from "../components/Board";
import Chat from "../components/Chat";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";

function Game() {
    const navigate = useNavigate();
    const { gameId } = useParams();

    const shipLengths = [5, 4, 3, 3, 2];
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

    useEffect(() => {
        const ws = new WebSocket(`${import.meta.env.VITE_WS_API_URL}game/${gameId}/`);
        setSocket(ws);

        let isUnmounted = false;
        let intervalRef = null;

        ws.onopen = () => {
            if (isUnmounted) return;

            intervalRef = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: "ping" }));
                }
            }, 15000);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "game_state") {
                setState(data.state);
                setOpponentLeft(data.opponent_left);
                if (data.state.ready && data.state.opponent_ready) {
                    setBothReady(true);
                }
                if (data.state.winner !== null) {
                    setGameOver(true);
                }
            }
            else if (data.type === "chat_history") {
                setMessages(data.history);
            }
            else if (data.type === "new_game") {
                setGameOver(false);
                setVoteRestart(false);
                setBothReady(false);
            }
        };

        ws.onclose = (event) => {
            isUnmounted = true;
            if (intervalRef) {
                clearInterval(intervalRef);
                intervalRef = null;
            }

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

    const capitalizeFirstLetter = (string) => {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const send = (data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }
    };

    const handleCellClick = (x, y) => {
        if (state.ready) return;

        const hasShip = state.placed_ships?.some(ship =>
            ship.coords.some(([sx, sy]) => sx === x && sy === y)
        );
        if (hasShip && placeMode === "remove") removeShip(x, y);
        else if (placeMode === "place") placeShip(x, y);
    };

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

    const removeShip = (x, y) => {
        send({ action: "remove_ship", x, y });
    };

    const setReady = () => {
        send({ action: "set_ready" });
    };

    const makeMove = (x, y) => {
        send({ action: "make_move", x, y });
    };

    const leaveGame = () => {
        send({ action: "leave_game"});
        socket.close();

        navigate("/lobby", { replace: true });
    };

    const allShipsPlaced = () => {
        const shipsLeft = state.ships_left;
        return Object.values(shipsLeft).every(count => count === 0);
    };

    const restartGame = () => {
        setVoteRestart(true);
        send({ action: "restart_game"});
    };

    if (!state) return <div>Loading game...</div>;
    const isPlayerTurn = state.turn === state.self;
    const opponent = state.players.find(p => p !== state.self);

    return (
        <div>
            <h2>Game: {capitalizeFirstLetter(state.self)} vs {capitalizeFirstLetter(opponent)}</h2>

            <button onClick={leaveGame}>
                Return to Lobby
            </button>

            <div>
                <Chat
                    socket={socket}
                    currentUser={state.self}
                    messages={messages}
                    chatWith={null}
                    game={true}
                />
            </div>

            {gameOver && !opponentLeft && (
                <button
                    onClick={restartGame}
                    disabled={voteRestart}
                >
                    {voteRestart ? "Voted for rematch" : "Play Again"}
                </button>
            )}

            {bothReady && !gameOver && !opponentLeft && (
                <p>It's {capitalizeFirstLetter(isPlayerTurn ? "your" : opponent + "'s")} turn</p>
            )}

            {!state.ready && !opponentLeft && (
                <div>
                    <h3>Place your ships</h3>
                    {Array.from(new Set(shipLengths)).map(length => (
                        <button
                            key={length}
                            onClick={() => {setSelectedShip(length); setPlaceMode("place");}}
                            disabled={state.ships_left[length] === 0}
                        >
                            {length}-long ({state.ships_left[length] || 0} left)
                        </button>
                    ))}
                    <button onClick={() => setOrientation(o => o === "horizontal" ? "vertical" : "horizontal")}>
                        Rotate: {orientation}
                    </button>
                    <button onClick={() => {
                        setPlaceMode(p => p === "place" ? "remove" : "place");
                        setSelectedShip(null);
                    }}>
                        Swap Mode: {placeMode}
                    </button>
                </div>
            )}

            {!opponentLeft && (
                <div>
                    <h3>Your Board</h3>
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

            {bothReady && !opponentLeft && (
                <div>
                    <h3>Opponent Board</h3>
                    <Board
                        board={state.opponent_board}
                        hits={state.hits}
                        onCellClick={!gameOver ? (isPlayerTurn ? makeMove : null) : null}
                        canPlace={false}
                    />
                </div>
            )}

            {!bothReady && !opponentLeft && (
                <button 
                    onClick={() => {setReady(); setSelectedShip(null);}} 
                    disabled={!allShipsPlaced() || state.ready}
                >
                    I'm Ready
                </button>
            )}
        </div>
    );
}

export default Game