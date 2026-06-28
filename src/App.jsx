import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { Home, Dumbbell, MessageCircle, User, CalendarCheck, Users, Menu, X, Bot, Scale, FlaskConical, Activity, WifiOff, Calculator, RefreshCw } from 'lucide-react';
import { processOfflineQueue } from './utils/OfflineManager';
import UserChatModal from './components/UserChatModal';

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
  
  const esPro = isAdmin ||
                ['Plan Platinum', 'Socio Fundador Vitalicio'].includes(suscripcion);
                
  const esVIP = isAdmin || esPro ||
                ['Socio Argentum', 'Socio Aurum'].includes(suscripcion);

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
        .eq('atleta_id', session.user.id)
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
          .neq('emisor_id', session.user.id);
          
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
      <h1 className="gold-gradient-text" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '1px' }}>V&V</h1>
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
        
        {/* Coaching Chat Button */}
        {coachingChatId && (
          <button 
            onClick={() => { setShowCoachingChat(true); setHasUnreadCoaching(false); }} 
            style={{ background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', padding: 0, position: 'relative' }}
          >
            <MessageCircle size={22} />
            {hasUnreadCoaching && <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, backgroundColor: '#e55039', borderRadius: '50%', border: '2px solid #0f0f11', animation: 'pulse 2s infinite' }}></div>}
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
            ) : (
              <>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
                <div 
                  onClick={() => { navigate('/premium'); setIsOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer', borderRadius: '8px', color: 'var(--accent-gold)', fontWeight: 'bold' }}
                >
                  <i className="fa-solid fa-crown" style={{ fontSize: '18px' }}></i> Suscríbete a Premium
                </div>
              </>
            )}
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

  useEffect(() => {
    const checkUnread = async () => {
      const lastSeen = localStorage.getItem('last_seen_community');
      if (!lastSeen) {
        setHasUnread(true);
        return;
      }
      
      const { data } = await supabase
        .from('chat_mensajes')
        .select('created_at')
        .eq('room_id', 'vip_comunidad')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
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
      <div className={`nav-item ${location.pathname === '/perfil' ? 'active' : ''}`} onClick={() => navigate('/perfil')}>
        <User />
        <span>Perfil V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/sistemas' ? 'active' : ''}`} onClick={() => navigate('/sistemas')}>
        <Dumbbell />
        <span>Sistemas V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
        <CalendarCheck />
        <span>Mi Rutina V&V</span>
      </div>
      <div className={`nav-item ${location.pathname === '/comunidad' ? 'active' : ''}`} onClick={() => navigate('/comunidad')} style={{ position: 'relative' }}>
        <Users />
        {hasUnread && <div style={{ position: 'absolute', top: 5, right: '28%', width: 10, height: 10, backgroundColor: '#e55039', borderRadius: '50%', border: '2px solid var(--bg-card)' }}></div>}
        <span>Comunidad V&V</span>
      </div>
    </div>
  );
};

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consultorio from './pages/Consultorio';
import Perfil from './pages/Perfil';
import AdminPanel from './pages/AdminPanel';
import SistemaDetail from './pages/SistemaDetail';
import RutinaDetail from './pages/RutinaDetail';
import MiRutina from './pages/MiRutina';
import WebTool from './pages/WebTool';
import MisGanancias from './pages/MisGanancias';
import Historial from './pages/Historial';
import Paywall from './pages/Paywall';
import Comunidad from './pages/Comunidad';
import MuroFamaModal from './components/MuroFamaModal';
import OnboardingModal from './components/OnboardingModal';
import CuestionarioModal from './components/CuestionarioModal';
import ExpedienteModal from './components/ExpedienteModal';
import DescansoActivoModal from './components/DescansoActivoModal';
import PullToRefresh from './components/PullToRefresh';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCuestionario, setShowCuestionario] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [hasSkippedExpediente, setHasSkippedExpediente] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPw, setIsResettingPw] = useState(false);
  const [pendingNominacion, setPendingNominacion] = useState(null);

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    setIsResettingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('¡Contraseña actualizada con éxito!');
      setShowPasswordReset(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsResettingPw(false);
    }
  };

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
        const { data, error } = await supabase
          .from('compras_pendientes')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (data) {
          const plan = data.plan_membresia;
          await supabase.from('perfiles').update({ plan_membresia: plan }).eq('id', session.user.id);
          await supabase.auth.updateUser({ data: { suscripcion: plan } });
          await supabase.from('compras_pendientes').delete().eq('id', data.id);
          alert(`¡Felicidades! Hemos detectado y aplicado exitosamente tu compra de: ${plan}. ¡Bienvenido!`);
          window.location.reload();
        }
      } catch (err) {
        console.error("Error checking pending purchases", err);
      }
    };

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session || null;
      setSession(session);
      setLoading(false);
      
      // Inicializar RevenueCat con el ID del usuario si está logueado
      if (session?.user) {
        try {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
          
          if (Capacitor.isNativePlatform()) {
             // Solo inicializamos RevenueCat si estamos corriendo nativo (Android)
             await Purchases.configure({ 
               apiKey: 'goog_ksbcOecVHSqMAxOFCxsNKGmmRuU', 
               appUserID: session.user.id 
             });
             console.log("RevenueCat configurado exitosamente");
             
             // --- VERIFICACIÓN AUTOMÁTICA DE SUSCRIPCIÓN ACTIVA ---
             // Preguntamos a RevenueCat si el usuario tiene compras/suscripciones activas
             const customerInfo = await Purchases.getCustomerInfo();
             const activeEntitlements = Object.keys(customerInfo.entitlements.active);
             
             // Si no hay pagos activos en RevenueCat, y no es el administrador:
             if (activeEntitlements.length === 0 && session.user.email !== 'somos.vetayvigor@gmail.com') {
                const currentPlan = session.user.user_metadata?.suscripcion || session.user.user_metadata?.plan_membresia;
                const isPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(currentPlan);
                
                // Si la BD piensa que es VIP, pero RevenueCat dice que no, lo regresamos a Gratis
                if (isPaidPlan) {
                    console.log("Suscripción expirada en RevenueCat. Regresando a Gratis automáticamente.");
                    await supabase.from('perfiles').update({ plan_membresia: 'Atleta Base (Gratis)' }).eq('id', session.user.id);
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
        
        // Verificar Muro de Fama
        supabase.from('muro_fama').select('*').eq('user_id', session.user.id).eq('estado', 'pendiente').maybeSingle().then(({ data }) => {
          if (data) setPendingNominacion(data);
        });

        // Track ultimo ingreso y revisar si hay un RESET forzado por el admin
        supabase.from('perfiles').select('nivel, plan_membresia, foto_antes').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.nivel === 'RESET') {
            // Borrar el progreso local del usuario (onboarding)
            supabase.auth.updateUser({ data: { onboarding_complete: false, cuestionario_complete: false, expediente_completado: false } }).then(() => {
              // Limpiar la bandera en la base de datos
              supabase.from('perfiles').update({ nivel: 'Semilla' }).eq('id', session.user.id).then(() => {
                window.location.reload();
              });
            });
            return;
          }
          
          let updates = {};
          
          // Sincronizar el plan de membresía de la BD con los metadatos de Auth si cambió
          const currentSub = session.user.user_metadata?.suscripcion || session.user.user_metadata?.plan_membresia;
          if (data?.plan_membresia && data.plan_membresia !== currentSub) {
            updates.suscripcion = data.plan_membresia;
          }
          
          // Sincronizar expediente_completado si ya subieron foto en el pasado y no lo tienen en auth
          if (data?.foto_antes && !session.user.user_metadata?.expediente_completado) {
            updates.expediente_completado = true;
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
        
        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session.user.id).then();

        // OneSignal Prompt
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(function(OneSignal) {
          OneSignal.login(session.user.id); // Asociar el usuario de OneSignal con nuestro ID de Supabase
          OneSignal.Slidedown.promptPush();
        });

        const metadata = session.user.user_metadata || {};
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
          await Purchases.logIn({ appUserID: session.user.id });
        } catch (e) {
          console.error("Error al loguear usuario en RC:", e);
        }
      } else if (!session && Capacitor.isNativePlatform()) {
        try {
          await Purchases.logOut();
        } catch (e) {}
      }

      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
      }

      if (session) {
        checkPendingPurchases(session);
        // Track ultimo ingreso
        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session.user.id).then();

        // OneSignal Prompt
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(function(OneSignal) {
          OneSignal.login(session.user.id);
          OneSignal.Slidedown.promptPush();
        });

        const metadata = session.user.user_metadata || {};
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

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{ fontSize: '3rem' }}></i></div>;
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
      <PullToRefresh onRefresh={() => window.location.reload()}>
        <div id="main-scroll-container" style={{ minHeight: '100%', paddingTop: isOffline ? 'calc(90px + env(safe-area-inset-top, 0px))' : 'calc(60px + env(safe-area-inset-top, 0px))' }}>
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            <Route path="/sistemas" element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
            <Route path="/" element={session ? <MiRutina session={session} /> : <Navigate to="/login" />} />
            <Route path="/sistema/:id" element={session ? <SistemaDetail session={session} /> : <Navigate to="/login" />} />
            <Route path="/rutina/:id" element={session ? <RutinaDetail session={session} /> : <Navigate to="/login" />} />
            <Route path="/descanso" element={session ? <DescansoActivoModal onClose={() => window.history.back()} /> : <Navigate to="/login" />} />
            <Route path="/comunidad" element={session ? <Comunidad session={session} /> : <Navigate to="/login" />} />
            <Route path="/coach" element={session ? <Consultorio session={session} /> : <Navigate to="/login" />} />
            <Route path="/tool/:toolName" element={session ? <WebTool /> : <Navigate to="/login" />} />
            <Route path="/perfil" element={session ? <Perfil session={session} /> : <Navigate to="/login" />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/premium" element={<Paywall />} />
            <Route path="/ganancias" element={session ? <MisGanancias session={session} /> : <Navigate to="/login" />} />
            <Route path="/admin" element={session ? <AdminPanel session={session} /> : <Navigate to="/login" />} />
          </Routes>
        </div>
      </PullToRefresh>
      <UpdatePrompt />
      <BottomNav />
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
            if (!session.user.user_metadata?.cuestionario_complete) {
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
            if (!session.user.user_metadata?.expediente_completado) {
              setShowExpediente(true);
            }
          }}
        />
      )}
      {showExpediente && session && !showOnboarding && !showCuestionario && !hasSkippedExpediente && (
        <ExpedienteModal
          session={session}
          onComplete={() => setShowExpediente(false)}
          onSkip={() => {
            setHasSkippedExpediente(true);
            setShowExpediente(false);
          }}
        />
      )}
      
      {showPasswordReset && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', border: '1px solid var(--accent-gold)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>Establecer Nueva Contraseña</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>Ingresa tu nueva contraseña para acceder a la plataforma.</p>
            <form onSubmit={handlePasswordResetSubmit}>
              <input 
                type="password" 
                placeholder="Nueva Contraseña" 
                className="input-field" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                style={{ marginBottom: '20px' }}
              />
              <button type="submit" className="btn-primary" disabled={isResettingPw} style={{ opacity: isResettingPw ? 0.5 : 1 }}>
                {isResettingPw ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Router>
  );
}

export default App;
