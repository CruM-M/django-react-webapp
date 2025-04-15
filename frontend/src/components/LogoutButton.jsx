import api from "../api";
import { useNavigate } from "react-router-dom";

const LogoutButton = ({ setIsAuthenticated }) => {
    const navigate = useNavigate();

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
            <button onClick={handleLogout}>
                {"Logout"}
            </button>
        </div>
    );
};

export default LogoutButton;