import LogoutButton from "../components/LogoutButton";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";

function Lobby({ setIsAuthenticated }) {
    const navigate = useNavigate();
    const selfUserRef = useRef(null);

    const [users, setUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [inviteUser, setInviteUser] = useState(null);

    useEffect(() => {
        const ws = new WebSocket(`${import.meta.env.VITE_WS_API_URL}lobby/`);
        setSocket(ws);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "user.list") {
                setUsers(data.users);
                selfUserRef.current = data.self;
            } else if (data.type === "join") {
                setUsers(prev => [...new Set([...prev, data.username])]);
            } else if (data.type === "leave") {
                setUsers(prev => prev.filter(u => u !== data.username));
            } else if (data.type === "invite") {
                setInviteUser(data.from);
            } else if (data.type === "invite.accepted") {
                if (data.status === "accepted") {
                    const [player1, player2] = [selfUserRef.current, data.from].sort();
                    const gameId = `game-${player1}-${player2}`;
                    navigate(`/game/${gameId}`, { replace: true });
                }
            }
        };

        return () => {
            if (ws.readyState === 1) {
                ws.close();
            }};
    }, []);

    const sendInvite = (toUsername) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "invite",
                to: toUsername
            }));
        }
    };

    const handleInviteResponse = (status) => {
        socket.send(JSON.stringify({
            type: "invite.accept",
            from: inviteUser,
            status
        }));
        if (status == "accepted") {
            const [player1, player2] = [selfUserRef.current, inviteUser].sort();
            const gameId = `game-${player1}-${player2}`;
            navigate(`/game/${gameId}`, { replace: true });
        } else {
            setInviteUser(null);
        }
    };

    return (
        <div>
            <h2>Lobby - Online Users</h2>
            <ul>
                {[
                    ...users.filter(user => user === selfUserRef.current),
                    ...users
                        .filter(user => user !== selfUserRef.current)
                        .sort((a, b) => a.localeCompare(b))
                ].map(user =>
                    <li key={user}>
                        {user}
                        {user !== selfUserRef.current && (
                            <button onClick={() => sendInvite(user)}>Invite</button>
                        )}
                    </li>)}
            </ul>
            <LogoutButton setIsAuthenticated={setIsAuthenticated}/>
            {inviteUser && (
                <div className="modal">
                    <p>User {inviteUser.toUpperCase()} is inviting you to a game!</p>
                    <button onClick={() => handleInviteResponse("accepted")}>Accept</button>
                    <button onClick={() => handleInviteResponse("declined")}>Decline</button>
                </div>
            )}
        </div>
    );
}

export default Lobby