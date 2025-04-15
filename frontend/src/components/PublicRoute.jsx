import { Navigate } from "react-router-dom";

export default function PublicRoute({ isAuthenticated, children }) {
    return !isAuthenticated ? children : <Navigate to="/lobby" replace />;
}