import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Home, Dumbbell, MessageCircle, User, CalendarCheck, Users, Menu, X, Bot } from 'lucide-react';

// Components
const TopHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/login') return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '60px', backgroundColor: 'rgba(15, 15, 17, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 1000, maxWidth: '800px', margin: '0 auto' }}>
      <div className="gold-gradient-text" style={{ fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'Outfit' }}>V&V</div>
      
      <div style={{ position: 'relative' }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {isOpen && (
          <div style={{ position: 'absolute', top: '40px', right: '0', backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px', minWidth: '180px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
            <div 
              onClick={() => { navigate('/coach'); setIsOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'white' }}
            >
              <Bot size={20} color="var(--accent-gold)" /> Consultorio VIP
            </div>
            {/* Can add more menu items here later */}
          </div>
        )}
      </div>
    </div>
  );
};

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
import OnboardingModal from './components/OnboardingModal';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && !session.user.user_metadata?.onboarding_complete) {
        setShowOnboarding(true);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && !session.user.user_metadata?.onboarding_complete) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center'}}><div className="gold-gradient-text"><h1>Cargando...</h1></div></div>;

  return (
    <Router>
      <TopHeader />
      <div style={{ paddingTop: '60px' }}>
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
      </div>
      <BottomNav />
      {showOnboarding && session && (
        <OnboardingModal 
          session={session} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}
    </Router>
  );
}

export default App;
