import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Home, Dumbbell, MessageCircle, User } from 'lucide-react';

// Components
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show nav on login screen
  if (location.pathname === '/login') return null;

  return (
    <div className="bottom-nav">
      <div className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
        <Home />
        <span>Inicio</span>
      </div>
      <div className={`nav-item ${location.pathname === '/rutinas' ? 'active' : ''}`} onClick={() => navigate('/rutinas')}>
        <Dumbbell />
        <span>Rutinas</span>
      </div>
      <div className={`nav-item ${location.pathname === '/coach' ? 'active' : ''}`} onClick={() => navigate('/coach')}>
        <MessageCircle />
        <span>Coach V.I.P</span>
      </div>
      <div className={`nav-item ${location.pathname === '/perfil' ? 'active' : ''}`} onClick={() => navigate('/perfil')}>
        <User />
        <span>Perfil</span>
      </div>
    </div>
  );
};

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consultorio from './pages/Consultorio';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center'}}><div className="gold-gradient-text"><h1>Cargando...</h1></div></div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
        <Route path="/rutinas" element={session ? <div className="container"><h2>Próximamente: Rutinas</h2></div> : <Navigate to="/login" />} />
        <Route path="/coach" element={session ? <Consultorio session={session} /> : <Navigate to="/login" />} />
        <Route path="/perfil" element={session ? <div className="container"><h2>Próximamente: Perfil</h2><button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button></div> : <Navigate to="/login" />} />
      </Routes>
      <BottomNav />
    </Router>
  );
}

export default App;
