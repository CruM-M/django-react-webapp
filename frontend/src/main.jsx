import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter as Router } from 'react-router-dom';

/**
 * Entry point of the React application.
 * 
 * Wraps the entire app with React Router's BrowserRouter for routing.
 */
createRoot(document.getElementById('root')).render(
    <Router>
        <App />
    </Router>,
)
