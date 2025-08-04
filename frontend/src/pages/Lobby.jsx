import LogoutButton from "../components/LogoutButton";
import Chat from "../components/Chat";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";

function Lobby({ setIsAuthenticated }) {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [chat, setChat] = useState("");
    const [chatNotify, setChatNotify] = useState([]);
    const [messages, setMessages] = useState([]);
    const [receivedInvites, setReceivedInvites] = useState([]);
    const [sentInvites, setSentInvites] = useState([]);
    const [declined, setDeclined] = useState([]);

    const selfUserRef = useRef(null);
    const chatRef = useRef(chat);

    useEffect(() => {
        const ws = new WebSocket(`${import.meta.env.VITE_WS_API_URL}lobby/`);
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
            if (data.type === "user.list") {
                setUsers(data.users);
                if (!selfUserRef.current) {
                    selfUserRef.current = data.self;
                }
            }
            else if (data.type === "invite.state") {
                setReceivedInvites(data.incoming);
                setSentInvites(data.outgoing);
            }
            else if (data.type === "invite.accepted") {
                const [player1, player2] = [selfUserRef.current, data.from].sort();
                const gameId = `game-${player1}-${player2}`;
                navigate(`/game/${gameId}`, { replace: true });
            }
            else if (data.type === "invite.declined") {
                const user = data.from;
                setDeclined(prev => (prev.includes(user) ? prev : [...prev, user]));

                setTimeout(() => {
                    setDeclined(prev => prev.filter(u => u !== user));
                }, 10000);
            }
            else if (data.type === "chat_history") {
                setMessages(data.history);
            }
            else if (data.type === "chat_notify") {
                if (data.from !== chatRef.current) {
                    setChatNotify(prev => (
                        prev.includes(data.from) ? prev : [...prev, data.from]
                    ));
                }
            }
        };

        ws.onclose = () => {
            if (intervalRef) {
                clearInterval(intervalRef);
                intervalRef = null;
            }
        };

        return () => {
            isUnmounted = true;
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }};
    }, []);

    const sendInvite = (user) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "invite",
                to: user
            }));
        }
        setDeclined(prev => prev.filter(u => u !== user));
    };

    const cancelInvite = (user) => {
        socket.send(JSON.stringify({
            action: "invite.cancel",
            to: user
        }));
    };

    const handleInviteResponse = (user, status) => {
        socket.send(JSON.stringify({
            action: "invite.response",
            from: user,
            status
        }));
        if (status == "accepted") {
            const [player1, player2] = [selfUserRef.current, user].sort();
            const gameId = `game-${player1}-${player2}`;
            navigate(`/game/${gameId}`, { replace: true });
        }
    };

    const openChat = (user) => {
        setMessages([]);
        setChat(user);
        chatRef.current = user; 
        setChatNotify(prev => prev.filter(u => u !== user));
        socket.send(JSON.stringify({
            action: "join_chat",
            chatWith: user
        }));
    };

    return (
        <div>
            <h2>Lobby</h2>
            <LogoutButton onClick={() => {socket.close();}} setIsAuthenticated={setIsAuthenticated}/>
            <div>
                <Chat
                    socket={socket}
                    currentUser={selfUserRef.current}
                    messages={messages}
                    chatWith={chat}
                />
            </div>
            <h3>Online Users:</h3>
            <ul>
                {[
                    ...users.filter(user => user === selfUserRef.current),
                    ...users
                        .filter(user => user !== selfUserRef.current)
                        .sort((a, b) => a.localeCompare(b))
                ].map(user =>
                    <li key={user}>
                        <strong>{user}</strong>
                        {user !== selfUserRef.current && (
                            <>
                                <style>
                                    {`
                                        @keyframes blink {
                                            0%, 100% { background-color: buttonface; }
                                            50%     { background-color: #4CAF50; }
                                        }

                                        .blinking {
                                            animation: blink 1s infinite;
                                            background-color: #e0e0e0;
                                        }
                                    `}
                                </style>
                                <button
                                    style={{ marginLeft: "0.5rem" }}
                                    onClick={() => openChat(user)}
                                    className={chatNotify.includes(user) ? "blinking" : ""}
                                    disabled={user === chat}
                                >
                                    Chat {chatNotify.includes(user)}
                                </button>
                                <button 
                                    style={{ marginLeft: "0.5rem" }}
                                    onClick={() => sentInvites.includes(user) ? cancelInvite(user) : sendInvite(user)}
                                >
                                    {sentInvites.includes(user) ? "Cancel Invite" : "Send Invite"}
                                </button>
                                {declined.includes(user) && (
                                    <span
                                        style={{ color: "blue", marginLeft: "0.5rem" }}
                                    >
                                        Your invite was declined!
                                    </span>
                                )}
                            </>
                        )}
                    </li>)}
            </ul>
            <div className="modal">
                <h3>Game Invites:</h3>
                <ul>
                    {receivedInvites.map(user => (
                        <li key={user}>
                            User <strong>{user}</strong> is inviting you to a game:
                            <button
                                style={{ marginLeft: "0.5rem" }}
                                onClick={() => handleInviteResponse(user, "accepted")}>
                                Accept
                            </button>
                            <button
                                style={{ marginLeft: "0.5rem" }}
                                onClick={() => handleInviteResponse(user, "declined")}>
                                Decline
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default Lobby