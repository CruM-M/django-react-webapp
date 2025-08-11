import Form from "../components/Form"

/**
 * Login component - Renders the login form.
 *
 * Features:
 * - Uses the shared `Form` component
 * - Handles user authentication
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.setIsAuthenticated - Updates auth state after login
 * @returns {JSX.Element} Rendered Login form
 */
function Login({ setIsAuthenticated }) {
    return <Form
        route="api/login/"
        method="login"
        setIsAuthenticated={setIsAuthenticated}
    />
}

export default Login