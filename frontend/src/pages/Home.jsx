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
        <div className="page-container">
            <h1 className="header-container">{"Home"}</h1>
            <div className="home-container">
                <Link to="/login">
                    <button className="button">{"Login"}</button>
                </Link>
                <Link to="/register">
                    <button className="button">{"Register"}</button>
                </Link>
            </div>
        </div>
    )
}

export default Home