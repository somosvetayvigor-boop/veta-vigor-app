import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { Home, Dumbbell, MessageCircle, User, CalendarCheck, Users, Menu, X, Bot, Scale, FlaskConical, Activity, WifiOff, Calculator, RefreshCw, Loader } from 'lucide-react';
import { processOfflineQueue } from './utils/OfflineManager';
import { DatabaseManager } from './utils/DatabaseManager';
import UserChatModal from './components/UserChatModal';
import CreadorRutinas from './pages/CreadorRutinas';
import OneSignal from '@onesignal/capacitor-plugin';
import { setupScheduledNotifications } from './utils/ScheduledNotifications';
import PlatinumTrialModal from './components/PlatinumTrialModal';
// Components
const updateGlobalBadge = () => {
  const c1 = localStorage.getItem('badge_comm') === 'true';
  const c2 = localStorage.getItem('badge_cons') === 'true';
  if (c1 || c2) {
    if (navigator.setAppBadge) navigator.setAppBadge().catch(() => {});
  } else {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  }
};

const TopHeader = ({ session }) => {
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
                
  const esVIP = isAdmin || esPro ||
                ['Socio Argentum', 'Socio Aurum', 'Prueba Gratis (7 Días)'].includes(suscripcion);

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
          onClick={() => window.location.reload()} 
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
};

const BottomNav = () => {
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
      }, (payload) => {
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
};;

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consultorio from './pages/Consultorio';
import Perfil from './pages/Perfil';

const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const PanelEntrenador = React.lazy(() => import('./pages/PanelEntrenador'));
import AsignarRutina from './pages/AsignarRutina';
import AsignarRutinaMasiva from './pages/AsignarRutinaMasiva';
import SistemaDetail from './pages/SistemaDetail';
import RutinaDetail from './pages/RutinaDetail';
import MiRutina from './pages/MiRutina';
import WebTool from './pages/WebTool';
import MisGanancias from './pages/MisGanancias';
import Historial from './pages/Historial';
import Filosofia from './pages/Filosofia';
import CuestionarioModal from './components/CuestionarioModal';
import Paywall from './pages/Paywall';
import PaywallCoach from './pages/PaywallCoach';
import Comunidad from './pages/Comunidad';
import LaPrueba from './pages/LaPrueba';
import Reto21Dias from './pages/Reto21Dias';
import MuroFamaModal from './components/MuroFamaModal';
import OnboardingModal from './components/OnboardingModal';
import ExpedienteModal from './components/ExpedienteModal';
import DescansoActivoModal from './components/DescansoActivoModal';

import UpdatePrompt from './components/UpdatePrompt';
import { App as CapacitorApp } from '@capacitor/app';

function BackButtonHandler() {
  useEffect(() => {
    const handleBackButton = async (event) => {
      if (event.canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    };
    
    CapacitorApp.addListener('backButton', handleBackButton);
    return () => CapacitorApp.removeAllListeners();
  }, []);

  return null;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCuestionario, setShowCuestionario] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [hasSkippedExpediente, setHasSkippedExpediente] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingNominacion, setPendingNominacion] = useState(null);
  const [pendingVinculacion, setPendingVinculacion] = useState(null);
  const [showDroppedStudentModal, setShowDroppedStudentModal] = useState(false);
  const [showTrialWarningModal, setShowTrialWarningModal] = useState(false);
  const [showPlatinumTrialModal, setShowPlatinumTrialModal] = useState(false);
  const [userRoleState, setUserRoleState] = useState(localStorage.getItem('user_role') || 'atleta_normal');

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      const procesados = await processOfflineQueue();
      if (procesados > 0) {
        alert(`¡Conexión recuperada! Se han sincronizado ${procesados} registros guardados offline.`);
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkPendingPurchases = async (session) => {
      if (!session?.user?.email) return;
      try {
        if (session?.user?.id) {
          // También traemos el rol_usuario para el menú
          const { data: perfilData } = await supabase
            .from('perfiles')
            .select('rol_usuario, plan_membresia')
            .eq('id', session.user.id)
            .single();
          if (perfilData && perfilData.rol_usuario) {
            localStorage.setItem('user_role', perfilData.rol_usuario);
          }
        }
        
        const { data, error } = await supabase
          .from('compras_pendientes')
          .select('*')
          .eq('email', session?.user.email)
          .maybeSingle();
          
        if (data) {
          const plan = data.plan_membresia;
          await supabase.from('perfiles').update({ plan_membresia: plan }).eq('id', session?.user.id);
          await supabase.auth.updateUser({ data: { suscripcion: plan } });
          await supabase.from('compras_pendientes').delete().eq('id', data.id);
          alert(`¡Felicidades! Hemos detectado y aplicado exitosamente tu compra de: ${plan}. ¡Bienvenido!`);
          window.location.reload();
        }
      } catch (err) {
        console.error("Error checking pending purchases", err);
      }
    };

    const checkUserRoleAndPaywall = async (user) => {
      if (!user?.id) return;
      
      // 1. Carga instantánea desde IndexedDB (localforage)
      const localProfile = await DatabaseManager.getProfile(user.id);
      if (localProfile) {
        if (localProfile.rol_usuario) {
          localStorage.setItem('user_role', localProfile.rol_usuario);
          setUserRoleState(localProfile.rol_usuario);
        }
      }

      // 2. Sincronización en segundo plano con Supabase
      const { data: rolData, error } = await supabase
        .from('perfiles')
        .select('rol_usuario, plan_membresia, force_paywall, force_platinum_trial, platinum_trial_ends_at')
        .eq('id', user.id)
        .maybeSingle();

      // Si no hay internet o error en Supabase, abortar la sincronización pero ya cargamos lo local
      if (error) {
        console.warn("Error sincronizando perfil, usando caché local", error);
        return;
      }

      if (rolData) {
        // Guardar copia fresca en la base local
        await DatabaseManager.saveProfile(user.id, rolData);
      }

      let finalRole = rolData?.rol_usuario || null;
      let forcePlatinumModal = false;

      // Logic for Platinum Trial Expiration
      if (rolData?.platinum_trial_ends_at && rolData?.plan_membresia === 'Platinum') {
        const expirationDate = new Date(rolData.platinum_trial_ends_at);
        if (new Date() > expirationDate) {
          await supabase.from('perfiles').update({
            plan_membresia: 'Atleta Base (Gratis)',
            platinum_trial_ends_at: null
          }).eq('id', user.id);
          rolData.plan_membresia = 'Atleta Base (Gratis)';
          rolData.platinum_trial_ends_at = null;
        }
      }

      if (rolData?.force_platinum_trial) {
        forcePlatinumModal = true;
      }

      // Check Invitaciones de Entrenador (Para usuarios nuevos)
      if (user.email) {
        const { data: invitacion } = await supabase
          .from('invitaciones_entrenador')
          .select('*')
          .eq('email_alumno', user.email.toLowerCase())
          .maybeSingle();

        if (invitacion) {
          // Auto-Vincular
          await supabase.from('relacion_entrenador_alumno').insert({
            entrenador_id: invitacion.entrenador_id,
            alumno_id: user.id,
            estado: 'activo'
          });
          
          await supabase.from('perfiles').update({ rol_usuario: 'alumno_entrenador' }).eq('id', user.id);
          finalRole = 'alumno_entrenador';
          
          await supabase.from('invitaciones_entrenador').delete().eq('id', invitacion.id);
        }
      }

      if (finalRole) {
        if (finalRole === 'alumno_entrenador') {
          const { data: rel } = await supabase
            .from('relacion_entrenador_alumno')
            .select('id')
            .eq('alumno_id', user.id)
            .in('estado', ['activo', 'pendiente'])
            .maybeSingle();
            
          if (!rel) {
            finalRole = 'atleta_normal';
            const now = new Date().toISOString();
            
            await supabase.from('perfiles').update({ 
              rol_usuario: 'atleta_normal',
              plan_membresia: 'Prueba Gratis (7 Días)'
            }).eq('id', user.id);
            
            await supabase.auth.updateUser({
              data: { trial_start_date: now }
            });
            
            setShowDroppedStudentModal(true);
          }
        }
        
        if (rolData?.plan_membresia === 'Prueba Gratis (7 Días)' && finalRole !== 'alumno_entrenador') {
          const trialStart = user.user_metadata?.trial_start_date;
          if (trialStart) {
            const startDate = new Date(trialStart);
            const now = new Date();
            const diffTime = Math.abs(now - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 7) {
               await supabase.from('perfiles').update({ plan_membresia: 'Atleta Base (Gratis)' }).eq('id', user.id);
               setShowTrialWarningModal(true);
            } else if (diffDays >= 5 && diffDays < 7) {
               setShowTrialWarningModal(true);
            } else if (!user.user_metadata?.trial_accepted) {
               setShowDroppedStudentModal(true);
            }
          }
        }
        
        localStorage.setItem('user_role', finalRole);
        setUserRoleState(finalRole);
      }

      if (rolData?.force_paywall) {
        if (finalRole === 'entrenador') {
          const trainerPaidPlans = ['Entrenador Pro', 'Entrenador Élite', 'Entrenador Elite'];
          const hasTrainerPlan = trainerPaidPlans.some(p => (rolData.plan_membresia || '').includes(p));
          setShowPaywall(!hasTrainerPlan);
        } else {
          const athletePaidPlans = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'];
          const hasAthletePlan = athletePaidPlans.some(p => (rolData.plan_membresia || '').includes(p));
          setShowPaywall(!hasAthletePlan);
        }
      } else {
        setShowPaywall(false);
      }

      setShowPlatinumTrialModal(forcePlatinumModal);
    };

    const checkSession = async () => {
      try {
        const startTime = Date.now();
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
        const session = data?.session || null;
        setSession(session);
        
        if (session?.user) {
          // Await background sync with a 2-second max timeout so it finishes before hiding splash
          await Promise.race([
            checkUserRoleAndPaywall(session.user),
            new Promise(r => setTimeout(r, 2000))
          ]).catch(console.error);
        }

        // Asegurar que el Splash Screen se vea al menos 4.0 segundos para la animación y cargar imágenes
        const elapsed = Date.now() - startTime;
        if (elapsed < 4000) {
          await new Promise(r => setTimeout(r, 4000 - elapsed));
        }
      } catch (err) {
        console.warn("Network timeout or session error, defaulting to local cache:", err);
      } finally {
        setLoading(false);
      }
      
      // Inicializar OneSignal Nativo (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          OneSignal.initialize("f0e7f7a8-6da8-4592-92a7-542f731a91f0");
          OneSignal.Notifications.requestPermission(true);
          
          if (session?.user?.id) {
            OneSignal.login(session.user.id);
          }
          
          // Prevenir que la notificación push brinque si el usuario está con la app abierta
          OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
            event.preventDefault();
          });
        } catch (e) {
          console.error("Error inicializando OneSignal nativo:", e);
        }
      }

      // Programar notificaciones locales (8 AM frase del día, 6 PM recordatorio entrenamiento)
      if (session?.user) {
        setupScheduledNotifications(session, supabase);
      }
      
      // Inicializar RevenueCat con el ID del usuario si está logueado
      if (session?.user) {
        try {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
          
          if (Capacitor.isNativePlatform()) {
             // Solo inicializamos RevenueCat si estamos corriendo nativo (Android)
             await Purchases.configure({ 
               apiKey: 'goog_ksbcOecVHSqMAxOFCxsNKGmmRuU', 
               appUserID: session?.user.id 
             });
             console.log("RevenueCat configurado exitosamente");
             
             // --- VERIFICACIÓN AUTOMÁTICA DE SUSCRIPCIÓN ACTIVA ---
             // Preguntamos a RevenueCat si el usuario tiene compras/suscripciones activas
             const customerInfo = await Purchases.getCustomerInfo();
             const activeEntitlements = Object.keys(customerInfo.entitlements.active);
             
             // Si no hay pagos activos en RevenueCat, y no es el administrador:
             if (activeEntitlements.length === 0 && session?.user.email !== 'somos.vetayvigor@gmail.com') {
                const currentPlan = session?.user.user_metadata?.suscripcion || session?.user.user_metadata?.plan_membresia;
                const isPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(currentPlan);
                
                // Si la BD piensa que es VIP, pero RevenueCat dice que no, lo regresamos a Gratis
                if (isPaidPlan) {
                    console.log("Suscripción expirada en RevenueCat. Regresando a Gratis automáticamente.");
                    await supabase.from('perfiles').update({ plan_membresia: 'Atleta Base (Gratis)' }).eq('id', session?.user.id);
                    await supabase.auth.updateUser({ data: { suscripcion: 'Atleta Base (Gratis)' } });
                    // Recargamos para que la app aplique el bloqueo inmediatamente
                    window.location.reload();
                }
             }
             // -----------------------------------------------------
          }
        } catch (e) {
          console.error("Error al configurar RevenueCat:", e);
        }
      }

      if (session) {
        checkPendingPurchases(session);
        
        // Verificar solicitud pendiente de entrenador
        (async () => {
          try {
            const { data: pending } = await supabase
              .from('relacion_entrenador_alumno')
              .select('id, entrenador_id')
              .eq('alumno_id', session?.user?.id)
              .eq('estado', 'pendiente')
              .maybeSingle();
            
            if (pending) {
              const { data: trainerProfile } = await supabase
                .from('perfiles')
                .select('full_name, email')
                .eq('id', pending.entrenador_id)
                .single();
              
              if (trainerProfile) {
                setPendingVinculacion({
                  relacionId: pending.id,
                  entrenadorId: pending.entrenador_id,
                  nombre: trainerProfile.full_name,
                  email: trainerProfile.email
                });
              }
            }
          } catch (err) {
            console.error('Error checking pending vinculacion:', err);
          }
        })();

        // Verificar Muro de Fama
        supabase.from('muro_fama').select('*').eq('user_id', session?.user.id).eq('estado', 'pendiente').maybeSingle().then(({ data }) => {
          if (data) setPendingNominacion(data);
        });

        // Track ultimo ingreso y revisar si hay un RESET forzado por el admin
        supabase.from('perfiles').select('nivel, plan_membresia, foto_antes, foto_despues, avatar_url').eq('id', session?.user.id).single().then(({ data }) => {
          if (data?.nivel === 'RESET') {
            // Borrar el progreso local del usuario (onboarding)
            supabase.auth.updateUser({ data: { onboarding_complete: false, cuestionario_complete: false, expediente_completado: false } }).then(() => {
              // Limpiar la bandera en la base de datos
              supabase.from('perfiles').update({ nivel: 'Semilla' }).eq('id', session?.user.id).then(() => {
                window.location.reload();
              });
            });
            return;
          }
          
          let updates = {};
          
          // Sincronizar el plan de membresía de la BD con los metadatos de Auth si cambió
          const currentSub = session?.user.user_metadata?.suscripcion || session?.user.user_metadata?.plan_membresia;
          if (data?.plan_membresia && data.plan_membresia !== currentSub) {
            updates.suscripcion = data.plan_membresia;
          }
          
          // Sincronizar expediente_completado si ya subieron foto en el pasado y no lo tienen en auth
          if (data?.foto_antes && !session?.user.user_metadata?.expediente_completado) {
            updates.expediente_completado = true;
          }

          // Sincronizar fotos entre dispositivos
          if (data?.foto_antes && data.foto_antes !== session?.user.user_metadata?.foto_antes) {
            updates.foto_antes = data.foto_antes;
          }
          if (data?.foto_despues && data.foto_despues !== session?.user.user_metadata?.foto_despues) {
            updates.foto_despues = data.foto_despues;
          }
          if (data?.avatar_url && data.avatar_url !== session?.user.user_metadata?.avatar_url) {
            updates.avatar_url = data.avatar_url;
          }

          if (Object.keys(updates).length > 0) {
            supabase.auth.updateUser({ data: updates });
            setSession(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                user: {
                  ...prev.user,
                  user_metadata: { ...prev.user.user_metadata, ...updates }
                }
              };
            });
          }
        });
        
        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session?.user.id).then();

        // OneSignal Web Prompt (solo para PWA en navegador, no en app nativa)
        if (!Capacitor.isNativePlatform()) {
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(function(OneSignal) {
            OneSignal.login(session?.user.id);
            OneSignal.Slidedown.promptPush();
          });
        }

        const metadata = session?.user.user_metadata || {};
        if (!metadata.onboarding_complete) {
          setShowOnboarding(true);
          setShowCuestionario(false);
        } else if (!metadata.cuestionario_complete) {
          setShowOnboarding(false);
          setShowCuestionario(true);
        } else {
          setShowOnboarding(false);
          setShowCuestionario(false);
        }
      }
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      if (session?.user && Capacitor.isNativePlatform()) {
        try {
          await Purchases.logIn({ appUserID: session?.user.id });
          OneSignal.login(session.user.id);
        } catch (e) {
          console.error("Error al loguear usuario en RC/OneSignal:", e);
        }
      } else if (!session && Capacitor.isNativePlatform()) {
        try {
          await Purchases.logOut();
          OneSignal.logout();
        } catch (e) {}
      }

      if (session) {
        await checkUserRoleAndPaywall(session.user);
        
        checkPendingPurchases(session);
        // Track ultimo ingreso
        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session?.user.id).then();

        // OneSignal Web Prompt (solo para PWA en navegador, no en app nativa)
        if (!Capacitor.isNativePlatform()) {
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(function(OneSignal) {
            OneSignal.login(session?.user.id);
            OneSignal.Slidedown.promptPush();
          });
        }

        const metadata = session?.user.user_metadata || {};
        if (!metadata.onboarding_complete) {
          setShowOnboarding(true);
          setShowCuestionario(false);
          setShowExpediente(false);
        } else if (!metadata.cuestionario_complete) {
          setShowOnboarding(false);
          setShowCuestionario(true);
          setShowExpediente(false);
        } else if (!metadata.expediente_completado && !hasSkippedExpediente) {
          setShowOnboarding(false);
          setShowCuestionario(false);
          setShowExpediente(true);
        } else {
          setShowOnboarding(false);
          setShowCuestionario(false);
          setShowExpediente(false);
        }
      } else {
        setShowOnboarding(false);
        setShowCuestionario(false);
        setShowExpediente(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAceptarVinculacion = async () => {
    if (!pendingVinculacion) return;
    try {
      await supabase
        .from('relacion_entrenador_alumno')
        .update({ estado: 'activo' })
        .eq('id', pendingVinculacion.relacionId);
      
      await supabase
        .from('perfiles')
        .update({ rol_usuario: 'alumno_entrenador' })
        .eq('id', session?.user?.id);
      
      localStorage.setItem('user_role', 'alumno_entrenador');
      setPendingVinculacion(null);
      alert('¡Vinculación aceptada! Ahora verás las rutinas que te asigne tu entrenador.');
      window.location.reload();
    } catch (err) {
      console.error('Error accepting vinculacion:', err);
      alert('Hubo un error. Intenta de nuevo.');
    }
  };

  const handleRechazarVinculacion = async () => {
    if (!pendingVinculacion) return;
    try {
      await supabase
        .from('relacion_entrenador_alumno')
        .delete()
        .eq('id', pendingVinculacion.relacionId);
      
      setPendingVinculacion(null);
    } catch (err) {
      console.error('Error rejecting vinculacion:', err);
      alert('Hubo un error. Intenta de nuevo.');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f11',
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999
      }}>
        <h1 className="gold-gradient-text" style={{ 
          fontSize: '4.5rem', 
          fontWeight: '900', 
          letterSpacing: '4px',
          animation: 'pulseGold 2s infinite',
          margin: 0
        }}>
          V&V
        </h1>
        <p style={{ 
          color: 'var(--accent-gold)', 
          marginTop: '30px', 
          fontSize: '0.85rem', 
          opacity: 0.7, 
          letterSpacing: '3px', 
          textTransform: 'uppercase',
          animation: 'pulse 2s infinite'
        }}>
          Forjando...
        </p>
      </div>
    );
  }

  if (showPaywall) {
    return (
      <Router>
        {userRoleState === 'entrenador' ? (
          <PaywallCoach forced={true} onDismiss={() => setShowPaywall(false)} />
        ) : (
          <Paywall forced={true} onDismiss={() => setShowPaywall(false)} />
        )}
      </Router>
    );
  }

  return (
    <Router>
      <BackButtonHandler />
      <TopHeader session={session} />
      {isOffline && (
        <div style={{ position: 'fixed', top: 'calc(60px + env(safe-area-inset-top, 0px))', left: 0, right: 0, backgroundColor: '#e55039', color: 'white', textAlign: 'center', padding: '5px', fontSize: '0.8rem', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
          <WifiOff size={14} /> Estás sin conexión. Los cambios se guardarán localmente.
        </div>
      )}
      <div id="main-scroll-container" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: isOffline ? 'calc(90px + env(safe-area-inset-top, 0px))' : 'calc(60px + env(safe-area-inset-top, 0px))' }}>
        <React.Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader className="gold-gradient-text" style={{ animation: 'rotate 1s linear infinite' }} size={48} /></div>}>
          <Routes>
            <Route path="/login" element={!session?.user ? <Login /> : <Navigate to="/" />} />
            <Route path="/sistemas" element={session?.user ? <Dashboard session={session} /> : <Navigate to="/login" />} />
            <Route path="/" element={session?.user ? <MiRutina session={session} /> : <Navigate to="/login" />} />
            <Route path="/sistema/:id" element={session?.user ? <SistemaDetail session={session} /> : <Navigate to="/login" />} />
            <Route path="/rutina/:id" element={session?.user ? <RutinaDetail session={session} /> : <Navigate to="/login" />} />
            <Route path="/descanso" element={session?.user ? <DescansoActivoModal onClose={() => window.history.back()} /> : <Navigate to="/login" />} />
            <Route path="/comunidad" element={session?.user ? <Comunidad session={session} /> : <Navigate to="/login" />} />
            <Route path="/coach" element={session?.user ? <Consultorio session={session} /> : <Navigate to="/login" />} />
            <Route path="/panel-entrenador" element={session?.user ? <PanelEntrenador session={session} /> : <Navigate to="/login" />} />
            <Route path="/coach/asignar/:alumnoId" element={session?.user ? <AsignarRutina session={session} /> : <Navigate to="/login" />} />
            <Route path="/asignar-rutina-masiva" element={session?.user ? <AsignarRutinaMasiva session={session} /> : <Navigate to="/login" />} />
            <Route path="/reto-21-dias" element={session?.user ? <Reto21Dias session={session} /> : <Navigate to="/login" />} />
            <Route path="/tool/:toolName" element={session?.user ? <WebTool /> : <Navigate to="/login" />} />
            <Route path="/perfil" element={session?.user ? <Perfil session={session} /> : <Navigate to="/login" />} />
            <Route path="/crear-rutina" element={session?.user ? <CreadorRutinas session={session} /> : <Navigate to="/login" />} />
            <Route path="/historial" element={session?.user ? <Historial session={session} /> : <Navigate to="/login" />} />
            <Route path="/filosofia" element={<Filosofia />} />
            <Route path="/premium" element={<Paywall />} />
            <Route path="/paywall-coach" element={session?.user ? <PaywallCoach /> : <Navigate to="/login" />} />
            <Route path="/la-prueba" element={session?.user ? <LaPrueba session={session} /> : <Navigate to="/login" />} />
            <Route path="/ganancias" element={session?.user ? <MisGanancias session={session} /> : <Navigate to="/login" />} />
            <Route path="/admin" element={session?.user ? <AdminPanel session={session} /> : <Navigate to="/login" />} />
          </Routes>
        </React.Suspense>
      </div>
      <UpdatePrompt />
      <BottomNav />
      {pendingVinculacion && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1a1a24, #111118)',
            borderRadius: '20px', padding: '30px', maxWidth: '400px', width: '100%',
            border: '1px solid rgba(212,175,55,0.3)', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
              <Users size={30} color="var(--accent-gold)" />
            </div>
            <h2 style={{ color: 'var(--accent-gold)', margin: '0 0 15px 0', fontSize: '1.3rem' }}>
              Solicitud de Entrenador
            </h2>
            <p style={{ color: '#fff', marginBottom: '5px', fontSize: '1.1rem', fontWeight: 'bold' }}>
              {pendingVinculacion.nombre}
            </p>
            <p style={{ color: '#888', marginBottom: '20px', fontSize: '0.85rem' }}>
              {pendingVinculacion.email}
            </p>
            <p style={{ color: '#bbb', marginBottom: '25px', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Te ha agregado como su alumno. Al aceptar, verás las rutinas personalizadas que te asigne y tendrás acceso a funciones VIP.
            </p>
            <p style={{ color: '#666', marginBottom: '25px', fontSize: '0.8rem' }}>
              Si no reconoces a esta persona, puedes rechazar la solicitud.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleRechazarVinculacion} style={{
                flex: 1, padding: '14px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)', color: '#ccc', borderRadius: '12px',
                fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold'
              }}>
                No vincularme
              </button>
              <button onClick={handleAceptarVinculacion} style={{
                flex: 1, padding: '14px', border: 'none',
                background: 'var(--accent-gold)', color: 'black', borderRadius: '12px',
                fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold'
              }}>
                ✓ Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Alumno Dado de Baja (Inicio 7 Días) */}
      {showDroppedStudentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(10px)',
          zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '30px 20px', border: '1px solid var(--accent-gold)' }}>
            <h2 className="gold-gradient-text" style={{ fontSize: '1.6rem', marginBottom: '15px' }}>
              Ya no tienes entrenador
            </h2>
            <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '15px' }}>
              No te preocupes, <strong>tu historial sigue intacto</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '15px' }}>
              Como regalo por ser parte de Veta & Vigor, te hemos dado acceso a una <strong>Prueba Platino de 7 Días</strong>. Sigue entrenando con todas las funciones VIP y rutinas premium.
            </p>
            
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>
                Tu número de WhatsApp (Obligatorio)
              </label>
              <input 
                type="tel"
                placeholder="Ej. +52 55 1234 5678"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9+\- ]/g, ''))}
                className="input-field"
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box' }}
              />
              <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '8px', lineHeight: '1.4' }}>
                Solo será para fines internos de Veta & Vigor (avisos y/o promociones). Al continuar, aceptas nuestro <a href="https://vetayvigor.com/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Aviso de Privacidad</a>.
              </p>
            </div>
            
            <button 
              onClick={async () => {
                const justNumbers = whatsapp.replace(/[^0-9]/g, '');
                if (justNumbers.length < 10) {
                  alert("Por favor, ingresa un número de WhatsApp válido (mínimo 10 dígitos).");
                  return;
                }
                
                setShowDroppedStudentModal(false);
                // Registrar que ya lo aceptó y reiniciar cuestionario/sistema para que vuelva a elegir
                await supabase.auth.updateUser({ 
                  data: { 
                    whatsapp: whatsapp,
                    trial_accepted: true,
                    cuestionario_complete: false,
                    sistema_activo: null 
                  } 
                });
                
                // Guardar también en la tabla segura para el panel de admin
                if (session?.user?.id) {
                  await supabase.from('datos_privados').upsert({
                    user_id: session.user.id,
                    whatsapp: justNumbers
                  }, { onConflict: 'user_id' });
                }

                window.location.href = '/sistemas';
              }} 
              className="btn-primary" 
              style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
            >
              Activar mis 7 Días Gratis
            </button>
          </div>
        </div>
      )}

      {showPlatinumTrialModal && (
        <PlatinumTrialModal
          session={session}
          onClose={() => setShowPlatinumTrialModal(false)}
        />
      )}

      {/* Modal de Advertencia o Caducidad de Prueba Gratis */}
      {showTrialWarningModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(10px)',
          zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '30px 20px', border: '1px solid #fa8231' }}>
            <h2 style={{ color: '#fa8231', fontSize: '1.6rem', marginBottom: '15px' }}>
              Prueba Platino por terminar
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '25px' }}>
              Tu periodo de prueba de 7 días está a punto de caducar (o ya ha caducado). ¡No pierdas tu progreso! Elige un plan para continuar entrenando como un profesional.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  setShowTrialWarningModal(false);
                  window.location.href = '/sistemas';
                }} 
                className="btn-primary" 
                style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
              >
                Ver Planes de Suscripción
              </button>
              <button 
                onClick={() => setShowTrialWarningModal(false)} 
                style={{ background: 'none', border: 'none', color: '#888', padding: '10px', textDecoration: 'underline' }}
              >
                Continuar con versión gratis
              </button>
            </div>
          </div>
        </div>
      )}
      
      {pendingNominacion && (
        <MuroFamaModal 
          nominacion={pendingNominacion}
          onClose={() => setPendingNominacion(null)}
          onAccept={() => setPendingNominacion(null)}
        />
      )}
      {showOnboarding && session && (
        <OnboardingModal 
          session={session} 
          onComplete={() => {
            setShowOnboarding(false);
            if (!session?.user.user_metadata?.cuestionario_complete) {
              setShowCuestionario(true);
            }
          }} 
        />
      )}
      {showCuestionario && session && !showOnboarding && (
        <CuestionarioModal
          session={session}
          onComplete={() => {
            setShowCuestionario(false);
            if (!session?.user.user_metadata?.expediente_completado) {
              setShowExpediente(true);
            } else {
              window.location.href = '/';
            }
          }}
        />
      )}
      {showExpediente && session && !showOnboarding && !showCuestionario && !hasSkippedExpediente && (
        <ExpedienteModal
          session={session}
          onComplete={() => {
            setShowExpediente(false);
            window.location.href = '/';
          }}
          onSkip={() => {
            setHasSkippedExpediente(true);
            setShowExpediente(false);
          }}
        />
      )}
      <UpdatePrompt />
    </Router>
  );
}

export default App;
