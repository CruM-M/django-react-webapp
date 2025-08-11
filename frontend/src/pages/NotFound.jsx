/**
 * NotFound component - Displays a 404 error page for unknown routes.
 *
 * Features:
 * - Simple static message for missing pages
 *
 * @component
 * @returns {JSX.Element} Rendered 404 page
 */
function NotFound() {
    return <div>
        <h1>{"404 Not Found"}</h1>
        <p>{"The page you are looking for was not found!"}</p>
    </div>
}

export default NotFound