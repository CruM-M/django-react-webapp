import api from "../api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Form({route, method}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const method_name = method === "login" ? "Login" : "Register";

    const handleForm = async (e) => {
        e.preventDefault();
        try{
            await api.post(route, {username, password});
            if(method === "login"){
                navigate("/lobby");
            } else {
                navigate("/");
            }
        } catch (error) {
            console.error("Submit error:", error);
            if (error.response) {
                console.error("Response error:", error.response.data);
            }
            alert(error);
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