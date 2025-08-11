import { Link } from 'react-router-dom';

/**
 * Home component - Displays the main landing page with navigation options.
 *
 * Features:
 * - Provides navigation links to the Login and Register pages
 *
 * @component
 * @returns {JSX.Element} Rendered Home page UI
 */
function Home() {
    return (
        <div>
            <h1>Home</h1>
            <div>
                <Link to="/login">
                    <button>Login</button>
                </Link>
                <Link to="/register">
                    <button>Register</button>
                </Link>
            </div>
        </div>
    )
}

export default Home