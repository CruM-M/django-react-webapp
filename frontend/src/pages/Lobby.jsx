import LogoutButton from "../components/LogoutButton";
import Chat from "../components/Chat";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";

/**
 * Lobby component - handles real-time communication between users 
 * in the lobby.
 * Features:
 * - Displays list of online users
 * - Handles game invites (send, cancel, accept, decline)
 * - Provides a private chat system between users
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.setIsAuthenticated - Updates auth state after logout
 * @returns {JSX.Element} Rendered Lobby UI
 */
function Lobby({ setIsAuthenticated }) {
    const navigate = useNavigate();

    // State variables
    const [users, setUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [chat, setChat] = useState("");
    const [chatNotify, setChatNotify] = useState([]);
    const [messages, setMessages] = useState([]);
    const [receivedInvites, setReceivedInvites] = useState([]);
    const [sentInvites, setSentInvites] = useState([]);
    const [declined, setDeclined] = useState([]);

    // Refs for preserving values across renders
    const selfUserRef = useRef(null);
    const chatRef = useRef(chat);

    /**
     * Initializes WebSocket connection and sets up event listeners.
     * - Handles incoming messages from server (user list, invites, chat)
     * - Sends heartbeat ping every 15s to keep lobby chat history
     */
    useEffect(() => {
        const ws = new WebSocket(
            `${import.meta.env.VITE_WS_API_URL}lobby/
        `);
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
                case "user_list":
                    setUsers(data.users);
                    if (!selfUserRef.current) {
                        selfUserRef.current = data.self;
                    }
                    break;

                case "invite_state":
                    setReceivedInvites(data.incoming);
                    setSentInvites(data.outgoing);
                    break;

                case "invite_accepted":
                    // Redirect to game screen after invite accepted
                    const [player1, player2] = [
                        selfUserRef.current,
                        data.from
                    ].sort();
                    const gameId = `game-${player1}-${player2}`;
                    navigate(`/game/${gameId}`, { replace: true });
                    break;

                case "invite_declined":
                    // Show temporary "declined" message
                    const user = data.from;
                    setDeclined(prev =>
                        (prev.includes(user) ? prev : [...prev, user])
                    );

                    setTimeout(() => {
                        setDeclined(prev => prev.filter(u => u !== user));
                    }, 10000);
                    break;

                case "chat_history":
                    setMessages(data.history);
                    break;

                case "chat_notify":
                    // Show notification if message is from another chat
                    if (data.from !== chatRef.current) {
                        setChatNotify(prev => (
                            prev.includes(data.from) ? prev : [
                                ...prev,
                                data.from
                            ]
                        ));
                    }
                    break;
            }
        };

        ws.onclose = () => {
            if (intervalRef) {
                clearInterval(intervalRef);
                intervalRef = null;
            }
        };

        // Cleanup on unmount
        return () => {
            isUnmounted = true;
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }};
    }, []);

    /**
     * Send game invite to a user.
     * @param {string} user - Target username
     */
    const sendInvite = (user) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "invite",
                to: user
            }));
        }
        setDeclined(prev => prev.filter(u => u !== user));
    };

    /**
     * Cancel previously sent invite.
     * @param {string} user - Target username
     */
    const cancelInvite = (user) => {
        socket.send(JSON.stringify({
            action: "invite_cancel",
            to: user
        }));
    };

    /**
     * Handle invite response (accept or decline).
     * If accepted, redirects to game screen.
     * @param {string} user - User who sent the invite
     * @param {"accepted"|"declined"} status
     */
    const handleInviteResponse = (user, status) => {
        socket.send(JSON.stringify({
            action: "invite_response",
            from: user,
            status
        }));
        if (status == "accepted") {
            const [player1, player2] = [selfUserRef.current, user].sort();
            const gameId = `game-${player1}-${player2}`;
            navigate(`/game/${gameId}`, { replace: true });
        }
    };

    /**
     * Open chat with a specific user.
     * Clears notifications and fetches chat history.
     * @param {string} user - Username of chat partner
     */
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

    /**
     * Capitalizes the first letter of a given string.
     * @param {string} string - Input string
     * @returns {string} Formatted string with first letter uppercase
     */
    const capitalizeFirstLetter = (string) => {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    return (
        <div className="page-container">
            <h1 className="header-container">{"Lobby"}</h1>

            <div className="main-container">
                <div className="left-container">
                    {/* Logout button - closes WebSocket and resets auth 
                     * state */}
                    <LogoutButton onClick={
                        () => {socket.close();}
                    }
                        setIsAuthenticated={setIsAuthenticated}
                    />

                    {/* Chat component */}
                    <div>
                        <Chat
                            socket={socket}
                            currentUser={selfUserRef.current}
                            messages={messages}
                            chatWith={chat}
                        />
                    </div>

                    {/* Game invites */}
                    <div>
                        {(receivedInvites.length > 0) && (
                            <h3>{"Game Invites"}</h3>
                        )}
                        <ul className="invite-list">
                            {receivedInvites.map(user => (
                                <li key={user} className="invite-row">
                                    <div>
                                        {"User "}
                                        <strong
                                            className="user-name">{
                                                capitalizeFirstLetter(user)
                                            }
                                        </strong>
                                        {" is inviting you to a game:"}
                                    </div>

                                    <div className="invite-buttons">
                                        <button
                                            className="button"
                                            onClick={() =>
                                                handleInviteResponse(
                                                    user,
                                                    "accepted"
                                                )
                                            }>
                                            {"Accept"}
                                        </button>
                                        <button
                                            className="button"
                                            onClick={() =>
                                                handleInviteResponse(
                                                    user,
                                                    "declined"
                                                )
                                            }>
                                            {"Decline"}
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="right-container">
                    <h3>{"Online Users"}</h3>
                    <ul className="user-list">
                        {[
                            ...users.filter(
                                user => user === selfUserRef.current
                            ),
                            ...users.filter(
                                user => user === chat
                            ),
                            ...users
                                .filter(user => chatNotify.includes(user))
                                .sort((a, b) => a.localeCompare(b)),
                            ...users
                                .filter(user => user !== selfUserRef.current)
                                .filter(user => user !== chat)
                                .filter(user => !chatNotify.includes(user))
                                .sort((a, b) => a.localeCompare(b))
                        ].map(user =>
                            <li key={user} className="user-row">
                                <div className="user-main">
                                    <span className="user-name">
                                        {capitalizeFirstLetter(user)}
                                    </span>
                                    {user !== selfUserRef.current && (
                                        <div className="buttons">
                                            {/** Chat button
                                             * with blinking effect for new
                                             * messages */}
                                            <button
                                                onClick={() => openChat(user)}
                                                className={
                                                    chatNotify.includes(user)
                                                    ? "blinking-button"
                                                    : "button"
                                                }
                                                disabled={user === chat}
                                            >
                                                {"Chat"}
                                            </button>

                                            {/* Invite button */}
                                            <button 
                                                className="button"
                                                onClick={
                                                    () =>
                                                        sentInvites
                                                        .includes(user)
                                                    ? cancelInvite(user)
                                                    : sendInvite(user)
                                                }
                                            >
                                                {
                                                    sentInvites.includes(user)
                                                    ? "Cancel"
                                                    : "Invite"
                                                }
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="user-status">
                                    {sentInvites.includes(user) && (
                                        <span>
                                            {"Pending..."}
                                        </span>
                                    )}
                                    {declined.includes(user) && (
                                        <span>
                                            {"Your invite was declined!"}
                                        </span>
                                    )}
                                </div>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Lobby