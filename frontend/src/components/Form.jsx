import api from "../api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Form({ route, method,  setIsAuthenticated }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const method_name = method === "login" ? "Login" : "Register";

    const handleForm = async (e) => {
        e.preventDefault();
        try{
            await api.post(route, {username, password});
            if(method === "login"){
                setIsAuthenticated(true);
                navigate("/lobby", { replace: true });
            } else {
                navigate("/login");
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                alert("Login error: " + error.response.data.error);
            } else {
                alert("Unexpected error. Try again later.");
                console.error('Unexpected error:', error);
            }
        }
    };

    return <form onSubmit={handleForm} className="form-container">
        <h1>{method_name}</h1>
        <input 
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
        />
        <input 
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
        />
        <button className="form-button" type="submit">
            {method_name}
        </button>
    </form>
}

export default Form;