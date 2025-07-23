import { Navigate } from "react-router-dom";
const PublicRoute = ({ isAuthenticated, children }) => {
    return !isAuthenticated ? children : <Navigate to="/lobby" replace />;
}

export default PublicRoute