import { useState, useEffect, useRef } from "react";

const Chat = ({socket, currentUser, messages, chatWith, game}) => {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const capitalizeFirstLetter = (string) => {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const sendMessage = (msg) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "send_msg",
                msg,
                chatWith
            }));
        }
    };

    return (
        <div>
            <div style={{ 
                height: "120px",
                maxHeight: "120px",
                maxWidth: "600px",
                overflowY: "auto",
                border: "1px solid #000",
                position: "relative"
            }}>
                {chatWith && (
                    <div style={{
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 1,
                        padding: "5px",
                        borderBottom: "1px solid"
                    }}>
                        Chatting with: <strong>{capitalizeFirstLetter(chatWith)}</strong>
                    </div>
                )}
                <div style={{ padding: "5px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {messages
                    .filter(m => !(m.from !== currentUser && m.msg_type === "system" && m.access === "private"))
                    .map((m, i) => (
                        <div key={i} style={{ color: m.msg_type === "system" ? "blue" : "green" }}>
                            <strong>
                                {capitalizeFirstLetter(m.msg_type === "system" ? m.msg_type : m.from)}:
                            </strong> {m.msg}
                        </div>
                    ))
                    }
                    <div ref={messagesEndRef} style={{ height: "1px" }}/>
                </div>
                
            </div>
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {if (e.key === "Enter" && (chatWith || game)) {sendMessage(input); setInput("");}}}
                placeholder="Type your message here..."
            />
            <button
                onClick={() => {sendMessage(input); setInput("");}}
                disabled={!(chatWith || game)}
            >
                Send
            </button>
        </div>
    );
}

export default Chat;