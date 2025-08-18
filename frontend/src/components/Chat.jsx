import { useState, useEffect, useRef } from "react";

/**
 * Chat component - Handles in-game or lobby chat functionality.
 *
 * Features:
 * - Displays message history (system and user messages)
 * - Scrolls to the latest message automatically
 * - Allows sending messages to other users
 *
 * @component
 * @param {Object} props - Component props
 * @param {WebSocket} props.socket - Active WebSocket connection
 * @param {string} props.currentUser - Name of the current user
 * @param {Array<Object>} props.messages - List of chat messages
 * @param {string|null} [props.chatWith] - Opponent's username
 * @param {boolean} [props.game] - Indicates if chat is used during a game
 * @returns {JSX.Element} Rendered chat UI
 */
const Chat = ({socket, currentUser, messages, chatWith, game}) => {
    // State variables
    const [input, setInput] = useState("");
    
    const messagesEndRef = useRef(null);

    /**
     * Scrolls the chat to the latest message whenever messages update.
     */
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

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
     * Sends a message via WebSocket to the server.
     * @param {string} msg - Message content
     */
    const sendMessage = (msg) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "send_msg",
                sender: "user",
                msg,
                access: "public",
                chatWith
            }));
        }
    };

    return (
        <div className="chat-container">
            {/* Chat container */}
            <div className="chat-box">
                {/* Display current chat target */}
                {chatWith && (
                    <div className="chat-target">
                        {"Chatting with: "}
                        <span className="user-name">
                            {capitalizeFirstLetter(chatWith)}
                        </span>
                    </div>
                )}

                {/* Message list */}
                <div className="message-list">
                    {messages
                        .filter(m => !(
                            m.from !== currentUser
                            && m.msg_type === "system"
                            && m.access === "private"
                        ))
                        .map((m, i) => (
                            <div key={i} style={{
                                color: m.msg_type === "system"
                                ? "#93a0e7ff"
                                : "#b4f7baff"
                            }}>
                                <span>
                                    {capitalizeFirstLetter(
                                        m.msg_type === "system"
                                        ? m.msg_type
                                        : m.from
                                    )}:
                                </span> {m.msg}
                            </div>
                        ))
                    }
                    {messages.length === 0 && (
                        <div className="chat-box-text">
                            {"Chat box..."}
                        </div>
                    )}
                    <div ref={messagesEndRef} style={{ height: "1px" }}/>
                </div>
            </div>

            <div className="chat-input-row">
                {/* Message input */}
                <input
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter"
                            && (chatWith || game)
                            && ((input || "").trim() !== "")
                        ) {
                            sendMessage(input); setInput("");
                        }
                    }}
                    placeholder="Type your message here..."
                />

                {/* Send button */}
                <button
                    className="button"
                    onClick={() => {sendMessage(input); setInput("");}}
                    disabled={
                        !(chatWith || game)
                        || ((input || "").trim() === "")
                    }
                >
                    {"Send"}
                </button>
            </div>
        </div>
    );
}

export default Chat;