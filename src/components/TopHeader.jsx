import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MessageCircle, Menu, X, Bot, Scale, FlaskConical, Calculator, RefreshCw } from 'lucide-react';
import SyncService from '../services/SyncService';
import UserChatModal from './UserChatModal';
import { updateGlobalBadge } from '../utils/appBadge';

export default function TopHeader({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnreadConsultorio, setHasUnreadConsultorio] = useState(false);
  const [coachingChatId, setCoachingChatId] = useState(null);
  const [hasUnreadCoaching, setHasUnreadCoaching] = useState(false);
  const [showCoachingChat, setShowCoachingChat] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;

  const userRole = localStorage.getItem('user_role') || 'atleta_normal';

  const isAlumnoEntrenador = userRole === 'alumno_entrenador';
  const esPro = isAdmin || isAlumnoEntrenador ||
                ['Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcion) ||
                suscripcion?.includes('Pro') || suscripcion?.includes('Élite');

  useEffect(() => {
    if (!esPro) return;

    const checkUnread = async () => {
      const lastSeen = localStorage.getItem('last_seen_consultorio');

      if (!lastSeen) {
        const { count } = await supabase
          .from('consultorio_mensajes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session?.user?.id)
          .eq('role', 'coach');
        if (count && count > 1) { // 1 is welcome msg
          setHasUnreadConsultorio(true);
          localStorage.setItem('badge_cons', 'true');
          updateGlobalBadge();
        }
        return;
      }

      const { data } = await supabase
        .from('consultorio_mensajes')
        .select('created_at')
        .eq('user_id', session?.user?.id)
        .eq('role', 'coach')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && new Date(data.created_at) > new Date(lastSeen)) {
        setHasUnreadConsultorio(true);
        localStorage.setItem('badge_cons', 'true');
        updateGlobalBadge();
      }
    };

    checkUnread();

    const channel = supabase.channel('public:consultorio_mensajes:unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'consultorio_mensajes',
        filter: `user_id=eq.${session?.user?.id}`
      }, (payload) => {
        if (payload.new.role === 'coach' && window.location.pathname !== '/coach') {
          setHasUnreadConsultorio(true);
          localStorage.setItem('badge_cons', 'true');
          updateGlobalBadge();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [esPro, session?.user?.id]);

  useEffect(() => {
    if (location.pathname === '/coach') {
      setHasUnreadConsultorio(false);
      localStorage.setItem('last_seen_consultorio', new Date().toISOString());
      localStorage.setItem('badge_cons', 'false');
      updateGlobalBadge();
    }
  }, [location.pathname]);

  // Check for Coaching Chats
  useEffect(() => {
    if (!session?.user?.id) return;

    const checkCoachingChat = async () => {
      // Fetch active chat
      const { data: chats } = await supabase
        .from('chats_coaching')
        .select('id, estado')
        .eq('atleta_id', session?.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (chats && chats.length > 0) {
        setCoachingChatId(chats[0].id);

        // Fetch unread
        const { count } = await supabase
          .from('mensajes_coaching')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chats[0].id)
          .eq('visto', false)
          .neq('emisor_id', session?.user.id);

        setHasUnreadCoaching(count > 0);
      }
    };

    checkCoachingChat();

    const channel = supabase.channel('public:mensajes_coaching')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes_coaching'
      }, (payload) => {
        if (payload.new.emisor_id !== session?.user?.id) {
          checkCoachingChat(); // re-check to update badges
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats_coaching',
        filter: `atleta_id=eq.${session?.user?.id}`
      }, () => {
        checkCoachingChat();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  if (location.pathname === '/login') return null;

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'calc(60px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)', backgroundColor: '#0f0f11', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '20px', paddingRight: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <h1 className="gold-gradient-text" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '1px' }}>V&V</h1>

        {/* RETO 21 BUTTON */}
        <button
          onClick={() => navigate('/reto-21-dias')}
          style={{
            background: 'linear-gradient(135deg, #f9f0b1 0%, #D4AF37 50%, #aa8b2c 100%)',
            color: '#000',
            fontWeight: '900',
            fontSize: '0.75rem',
            padding: '4px 12px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            border: 'none',
            animation: 'pulseGold 2s infinite'
          }}
        >
          🔥 VIGOR 21
        </button>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>

        {/* Coaching Chat Button */}
        {coachingChatId && (
          <button
            onClick={() => { setShowCoachingChat(true); setHasUnreadCoaching(false); }}
            style={{ background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', padding: 0, position: 'relative' }}
          >
            <MessageCircle size={22} />
            {hasUnreadCoaching && <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, backgroundColor: '#ff3b30', borderRadius: '50%', border: '2px solid #0f0f11', boxShadow: '0 0 8px 2px rgba(255, 59, 48, 0.7)', animation: 'badgePulse 1s infinite' }}></div>}
          </button>
        )}

        <button
          onClick={() => {
            // Invalidar los catálogos para que la recarga los vuelva a bajar:
            // si no, el throttle de 6h los daría por frescos y el refresco no traería
            // el contenido nuevo publicado desde el panel de administración.
            SyncService.invalidarCatalogos()
              .catch(() => {})
              .finally(() => window.location.reload());
          }}
          style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <RefreshCw size={20} />
        </button>

        <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', position: 'relative', padding: 0 }}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
          {hasUnreadConsultorio && !isOpen && <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, backgroundColor: '#e55039', borderRadius: '50%', border: '2px solid #0f0f11' }}></div>}
        </button>

        {isOpen && (
          <div style={{ position: 'absolute', top: '40px', right: '0', backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px', minWidth: '180px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>

            {esPro && (
              <>
                <div
                  onClick={() => { navigate('/coach'); setIsOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'white', marginBottom: '5px' }}
                >
                  <Bot size={20} color="var(--accent-gold)" /> Consultorio VIP
                  {hasUnreadConsultorio && <div style={{ width: 8, height: 8, backgroundColor: '#e55039', borderRadius: '50%', marginLeft: 'auto' }}></div>}
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
              </>
            )}

            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Centro de Desarrollo</div>

            <div
              onClick={() => { navigate('/tool/fuerza'); setIsOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'white' }}
            >
              <Calculator size={18} color="var(--accent-gold)" /> Calc. Fuerza
            </div>

            {esPro ? (
              <>
                <div
                  onClick={() => { navigate('/tool/composicion'); setIsOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'white' }}
                >
                  <Scale size={18} color="var(--accent-gold)" /> Comp. Corporal
                </div>
                <div
                  onClick={() => { navigate('/tool/laboratorio'); setIsOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: '#e55039' }}
                >
                  <FlaskConical size={18} color="#e55039" /> Laboratorio VIP
                </div>
              </>
            ) : !isAlumnoEntrenador ? (
              <>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
                <div
                  onClick={() => { navigate('/premium'); setIsOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'var(--accent-gold)', fontWeight: 'bold' }}
                >
                  <i className="fa-solid fa-gem" style={{ fontSize: '18px' }}></i> ¡Mejora a Pro!
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* User Coaching Chat Modal */}
      {showCoachingChat && coachingChatId && (
        <UserChatModal
          chatId={coachingChatId}
          session={session}
          onClose={() => setShowCoachingChat(false)}
        />
      )}
    </header>
  );
}
