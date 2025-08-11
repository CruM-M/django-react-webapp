import Form from "../components/Form"

/**
 * Register component - Renders the registration form.
 *
 * Features:
 * - Uses the shared `Form` component
 * - Handles new user registration
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.setIsAuthenticated - Updates auth state
 * after registration
 * @returns {JSX.Element} Rendered Register form
 */
function Register({ setIsAuthenticated }) {
    return <Form
        route="api/register/"
        method="register"
        setIsAuthenticated={setIsAuthenticated}
    />
}

export default Register