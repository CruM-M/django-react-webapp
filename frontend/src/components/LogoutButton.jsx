import api from "../api";
import { useNavigate } from "react-router-dom";

/**
 * LogoutButton component - Handles user logout functionality.
 *
 * Features:
 * - Sends logout request to the API
 * - Updates authentication state
 * - Redirects user to home page after logout
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.setIsAuthenticated - Updates authentication state
 * @returns {JSX.Element} Logout button UI
 */
const LogoutButton = ({ setIsAuthenticated }) => {
    const navigate = useNavigate();

    /**
     * Handles the logout process:
     * - Sends logout request to API
     * - Updates authentication state
     * - Redirects to homepage
     */
    const handleLogout = async () => {
    try {
        await api.post("api/logout/");
        setIsAuthenticated(false);
        navigate("/", { replace: true });
    } catch (error) {
        alert("Logout error:", error);
        console.error("Error logging out:", error);
    }
  };

    return (
        <div>
            <button
                className="button"
                onClick={handleLogout}
            >
                {"Logout"}
            </button>
        </div>
    );
};

export default LogoutButton;