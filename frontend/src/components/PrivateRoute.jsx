import { Navigate } from "react-router-dom";

/**
 * PrivateRoute component - Restricts access to authenticated users.
 *
 * Features:
 * - Renders the given children if user is authenticated
 * - Redirects to home page if not authenticated
 *
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isAuthenticated - User authentication state
 * @param {JSX.Element} props.children - Component to render if authenticated
 * @returns {JSX.Element} Children or redirect to home
 */
const PrivateRoute = ({ isAuthenticated, children }) => {
    return isAuthenticated ? children : <Navigate to="/" replace />;
}

export default PrivateRoute