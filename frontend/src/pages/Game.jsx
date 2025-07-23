import Board from "../components/Board";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";

function Game() {
    const navigate = useNavigate();
    const { gameId } = useParams();

    const shipLengths = [5, 4, 3, 3, 2];
    const [socket, setSocket] = useState(null);
    const [state, setState] = useState(null);
    const [message, setMessage] = useState(null);
    const [selectedShip, setSelectedShip] = useState(null);
    const [gameOver, setGameOver] = useState(false);
    const [voteRestart, setVoteRestart] = useState(false);
    const [opponentLeft, setOpponentLeft] = useState(false);
    const [bothReady, setBothReady] = useState(false);
    const [placeMode, setPlaceMode] = useState("place");
    const [orientation, setOrientation] = useState("horizontal");

    useEffect(() => {
        
        const ws = new WebSocket(`${import.meta.env.VITE_WS_API_URL}game/${gameId}/`);
        setSocket(ws);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "game_state") {
                setState(data.state);
                if (data.state.ready && data.state.opponent_ready) {
                    setBothReady(true);
                }
                if (data.state.opponent_disconnected) {
                    setOpponentLeft(true);
                    const enemy = data.state.players.find(p => p !== data.state.self);
                    setMessage(`${capitalizeFirstLetter(enemy)} has LEFT the game!`);
                }
                if (Object.values(data.state.restart).every(player => player === true)) {
                    setGameOver(false);
                    setVoteRestart(false);
                    setBothReady(false);
                }
                if (data.state.winner !== null) {
                    setGameOver(true);
                    if (data.state.winner === data.state.self) {
                        setMessage("YOU WON!");
                    } else {
                        setMessage("YOU LOST");
                    }
                }
            } else if (data.error) {
                setMessage(data.error);
            } else if (data.result === "repeat") {
                makeMove;
            } else if (data.result) {
                setMessage(data.result);
            }
        };

        return () => {
            if (ws.readyState === 1) {
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
            <h2>Game: {state.self} vs {opponent}</h2>

            <button onClick={() => {navigate("/lobby", { replace: true }); leaveGame();}}>
                Return to Lobby
            </button>

            {gameOver && !opponentLeft && (
                <button 
                    onClick={() => {restartGame(); setMessage(null);}}
                    disabled={voteRestart}
                >
                    {voteRestart ? "Voted for rematch" : "Play Again"}
                </button>
            )}

            {bothReady && !gameOver && !opponentLeft && (
                <p>It's {capitalizeFirstLetter(isPlayerTurn ? "your" : opponent + "'s")} turn</p>
            )}

            {gameOver && (
                <p>GAME OVER</p>
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

            {message && <div>{message}</div>}
            
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