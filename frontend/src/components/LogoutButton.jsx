import api from "../api";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
    try {
      await api.post("api/logout/");
      navigate("/");
    } catch (error) {
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