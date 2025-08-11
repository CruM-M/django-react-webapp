import api from "../api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Form component - Handles user authentication (Login/Register).
 *
 * Features:
 * - Renders a form for login or registration
 * - Sends user credentials to the backend API
 * - Displays error messages for invalid input or failed requests
 * - Navigates to appropriate page after success
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} props.route - API endpoint for form submission
 * @param {"login"|"register"} props.method - Authentication method
 * @param {Function} props.setIsAuthenticated - Updates authentication state
 * after login
 * @returns {JSX.Element} Rendered authentication form
 */
const Form = ({ route, method,  setIsAuthenticated }) => {
    const navigate = useNavigate();

    // State variables
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [requestErrors, setRequestErrors] = useState('');

    const method_name = method === "login" ? "Login" : "Register";

    /**
     * Handles form submission by sending API request.
     * - On success:
     *    - If login → sets authentication state and navigates to lobby
     *    - If register → redirects user to login page
     * - On failure: Displays appropriate error message
     *
     * @async
     * @param {Event} e - Form submit event
     */
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
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
        
                if (status === 401) {
                    setRequestErrors("Login error: " + data.error);
                } else if (status === 400) {
                    setRequestErrors(Object.values(data).flat().join("\n"));
                } else {
                    setRequestErrors("Unexpected error. Try again later.");
                    console.error('Unexpected error:', error);
                }
            } else {
                setRequestErrors("No response from server.");
            }
        }
    };

    return <form onSubmit={handleForm} className="form-container">
        <h1>{method_name}</h1>

         {/* Navigation button to return home */}
        <div>
            <button
                className="form-button"
                type="button"
                onClick={() => navigate("/")}
            >
                {"Home"}
            </button>
        </div>

        {/* Username input */}
        <input 
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
        />

        {/* Password input */}
        <input 
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
        />

        {/* Submit button */}
        <button className="form-button" type="submit">
            {method_name}
        </button>

        {/* Display request errors */}
        {requestErrors && (
            <div>
                <p>{requestErrors}</p>
            </div>
        )}
    </form>
}

export default Form;