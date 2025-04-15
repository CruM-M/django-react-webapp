import { useNavigate } from "react-router-dom";

function Game() {
    const navigate = useNavigate();

    return (
        <div>
            Game
            <button onClick={() => navigate("/lobby", { replace: true })}>
                {"Return to Lobby"}
            </button>
        </div>
    )
}

export default Game