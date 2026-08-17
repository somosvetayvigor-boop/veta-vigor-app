import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Dumbbell, MessageCircle, User, Users, Activity } from 'lucide-react';
import { updateGlobalBadge } from '../utils/appBadge';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasUnread, setHasUnread] = useState(false);
  const userRole = localStorage.getItem('user_role') || 'atleta_normal';

  useEffect(() => {
    const checkUnread = async () => {
      const lastSeen = localStorage.getItem('last_seen_community');

      if (!lastSeen) {
        setHasUnread(true);
        localStorage.setItem('badge_comm', 'true');
        updateGlobalBadge();
        return;
      }

      const { data } = await supabase
        .from('chat_mensajes')
        .select('created_at')
        .eq('room_id', 'vip_comunidad')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && new Date(data.created_at) > new Date(lastSeen)) {
        setHasUnread(true);
        localStorage.setItem('badge_comm', 'true');
        updateGlobalBadge();
      }
    };

    checkUnread();

    const channel = supabase.channel('public:chat_mensajes:unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mensajes',
        filter: 'room_id=eq.vip_comunidad'
      }, () => {
        if (window.location.pathname !== '/comunidad') {
          setHasUnread(true);
          localStorage.setItem('badge_comm', 'true');
          updateGlobalBadge();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/comunidad') {
      setHasUnread(false);
      localStorage.setItem('last_seen_community', new Date().toISOString());
      localStorage.setItem('badge_comm', 'false');
      updateGlobalBadge();
    }
  }, [location.pathname]);

  // Don't show nav on login screen
  if (location.pathname === '/login') return null;

  return (
    <div className="bottom-nav">
      <button
        className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <Dumbbell size={24} />
        <span>Mi Misión</span>
      </button>
      {userRole !== 'alumno_entrenador' && (
        <button
          className={`nav-item ${location.pathname === '/sistemas' ? 'active' : ''}`}
          onClick={() => navigate('/sistemas')}
        >
          <Activity size={24} />
          <span style={{ fontSize: '0.7rem' }}>Retos y Sistemas</span>
        </button>
      )}

      <button
        className={`nav-item ${location.pathname === '/comunidad' ? 'active' : ''}`}
        onClick={() => navigate('/comunidad')}
        style={{ position: 'relative' }}
      >
        <MessageCircle size={24} />
        {hasUnread && <span className="notification-dot" style={{ position: 'absolute', top: 5, right: '28%', width: 10, height: 10, backgroundColor: '#e55039', borderRadius: '50%', border: '2px solid var(--bg-card)' }}></span>}
        <span>Comunidad</span>
      </button>

      {userRole === 'entrenador' && (
        <button
          className={`nav-item ${location.pathname === '/panel-entrenador' ? 'active' : ''}`}
          onClick={() => navigate('/panel-entrenador')}
        >
          <Users size={24} />
          <span>Alumnos</span>
        </button>
      )}

      <button
        className={`nav-item ${location.pathname === '/perfil' ? 'active' : ''}`}
        onClick={() => navigate('/perfil')}
      >
        <User size={24} />
        <span>Perfil</span>
      </button>
    </div>
  );
}
