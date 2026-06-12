import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Home, Dumbbell, MessageCircle, User, CalendarCheck, Users } from 'lucide-react';

// Components
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show nav on login screen
  if (location.pathname === '/login') return null;

  return (
    <div className="bottom-nav">
      <div className={`nav-item ${location.pathname === '/perfil' ? 'active' : ''}`} onClick={() => navigate('/perfil')}>
        <User />
        <span>Perfil V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
        <Dumbbell />
        <span>Sistemas V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/mirutina' ? 'active' : ''}`} onClick={() => navigate('/mirutina')}>
        <CalendarCheck />
        <span>Mi Rutina V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/comunidad' ? 'active' : ''}`} onClick={() => navigate('/comunidad')}>
        <Users />
        <span>Comunidad V&V</span>
      </div>
    </div>
  );
};

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consultorio from './pages/Consultorio';
import SistemaDetail from './pages/SistemaDetail';
import RutinaDetail from './pages/RutinaDetail';

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
        <Route path="/sistema/:id" element={session ? <SistemaDetail session={session} /> : <Navigate to="/login" />} />
        <Route path="/rutina/:id" element={session ? <RutinaDetail session={session} /> : <Navigate to="/login" />} />
        <Route path="/mirutina" element={session ? <div className="container"><h2>Próximamente: Tu Rutina Personalizada</h2></div> : <Navigate to="/login" />} />
        <Route path="/comunidad" element={session ? <div className="container"><h2>Próximamente: Comunidad V&V</h2></div> : <Navigate to="/login" />} />
        <Route path="/coach" element={session ? <Consultorio session={session} /> : <Navigate to="/login" />} />
        <Route path="/perfil" element={session ? <div className="container"><h2>Perfil V&V</h2><button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button></div> : <Navigate to="/login" />} />
      </Routes>
      <BottomNav />
    </Router>
  );
}

export default App;
