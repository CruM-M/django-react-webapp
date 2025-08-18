import { Routes, Route, } from "react-router-dom";
import { useEffect, useState  } from "react";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import NotFound from "./pages/NotFound";
import api from "./api";
import PublicRoute from "./components/PublicRoute"
import PrivateRoute from "./components/PrivateRoute"
import "./styles/style.css"

/**
 * App component - Main application entry point.
 *
 * Features:
 * - Handles authentication state (check user session)
 * - Configures application routes with access control
 * - Displays a loading screen until authentication status is resolved
 *
 * Routes:
 * - "/" (Public) → Home page
 * - "/register" (Public) → Register page
 * - "/login" (Public) → Login page
 * - "/lobby" (Private) → Lobby for authenticated users
 * - "/game/:gameId" (Private) → Game session
 * - "*" → Not Found page
 *
 * @component
 * @returns {JSX.Element} Application routes
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  
  /**
   * useEffect hook:
   * - Fetches CSRF token
   * - Checks user authentication status via API
   */
  useEffect(() => {
    // Initialize CSRF protection
    api.get("api/csrf/");

    // Verify if user is authenticated
    const checkLoginStatus = async () => {
      try {
        const response = await api.get('api/check-auth/');

        if (response.data.isAuthenticated) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      }
    };

    checkLoginStatus();
  }, []);

  // Show loader until authentication state is known
  if (isAuthenticated === null) {
    return <div>{"Loading..."}</div>;
  }

  return (
    <Routes>
        <Route path="/" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
                <Home />
            </PublicRoute>
        } />
        <Route path="/register" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
                <Register setIsAuthenticated={setIsAuthenticated}/>
            </PublicRoute>
        } />
        <Route path="/login" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
                <Login setIsAuthenticated={setIsAuthenticated}/>
            </PublicRoute>
        } />
        <Route path="/lobby" element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
                <Lobby setIsAuthenticated={setIsAuthenticated}/>
            </PrivateRoute>
        } />
        <Route path="/game/:gameId" element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
                <Game />
            </PrivateRoute>
        } />
        <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
