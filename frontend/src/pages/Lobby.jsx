import LogoutButton from "../components/LogoutButton";
import { useEffect, useState } from 'react';

function Lobby() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(`${import.meta.env.VITE_WS_API_URL}lobby/`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received:", data);
        if (data.type === "user.list") {
            setUsers(data.users);
        } else if (data.type === "join") {
            setUsers(prev => [...new Set([...prev, data.username])]);
        } else if (data.type === "leave") {
            setUsers(prev => prev.filter(u => u !== data.username));
        }
    };

    return () => {
        ws.close();
    };
  }, []);

  return (
    <div>
        <h2>Lobby - Online Users</h2>
        <ul>
            {users.map(user => <li key={user}>{user}</li>)}
        </ul>
        <LogoutButton />
    </div>
  );
}

export default Lobby