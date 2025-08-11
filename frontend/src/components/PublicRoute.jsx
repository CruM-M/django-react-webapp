import { Navigate } from "react-router-dom";

/**
 * PublicRoute component - Restricts access to unauthenticated users.
 *
 * Features:
 * - Renders the given children if user is NOT authenticated
 * - Redirects to lobby page if authenticated
 *
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isAuthenticated - User authentication state
 * @param {JSX.Element} props.children - Component to render if unauthenticated
 * @returns {JSX.Element} Children or redirect to lobby
 */
const PublicRoute = ({ isAuthenticated, children }) => {
    return !isAuthenticated ? children : <Navigate to="/lobby" replace />;
}

export default PublicRoute