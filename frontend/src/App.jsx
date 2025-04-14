import { Routes, Route, useNavigate  } from 'react-router-dom';
import { useEffect, useState  } from 'react';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import NotFound from './pages/NotFound';
import api from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const navigate = useNavigate()
  
  useEffect(() => {
    api.get("api/csrf/");

    const checkLoginStatus = async () => {
      try {
        const response = await api.get('api/check-auth/');

        if (response.data.isAuthenticated) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
        navigate('/');
      }
    };

    checkLoginStatus();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      {isAuthenticated && <Route path="/lobby" element={<Lobby />} />}
      {isAuthenticated && <Route path="/game" element={<Game />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
