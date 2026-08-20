import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff, Loader } from 'lucide-react';
import { processOfflineQueue } from './utils/OfflineManager';
import SyncService from './services/SyncService';
import CreadorRutinas from './pages/CreadorRutinas';
import { useAppSession } from './hooks/useAppSession';
import PlatinumTrialModal from './components/PlatinumTrialModal';
import TopHeader from './components/TopHeader';
import BottomNav from './components/BottomNav';
import BackButtonHandler from './components/BackButtonHandler';
import SolicitudEntrenadorModal from './components/SolicitudEntrenadorModal';
import AlumnoDadoDeBajaModal from './components/AlumnoDadoDeBajaModal';
import PruebaPlatinoPorTerminarModal from './components/PruebaPlatinoPorTerminarModal';

// TopHeader y BottomNav se extrajeron a src/components/ (16/08).

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

function App() {
  const {
    session,
    loading,
    showPaywall, setShowPaywall,
    showOnboarding, setShowOnboarding,
    showCuestionario, setShowCuestionario,
    showExpediente, setShowExpediente,
    hasSkippedExpediente, skipExpediente,
    pendingNominacion, setPendingNominacion,
    pendingVinculacion, setPendingVinculacion,
    showDroppedStudentModal, setShowDroppedStudentModal,
    showTrialWarningModal, setShowTrialWarningModal,
    showPlatinumTrialModal, setShowPlatinumTrialModal,
    userRoleState,
  } = useAppSession();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      const procesados = await processOfflineQueue();
      if (procesados > 0) {
        alert(`¡Conexión recuperada! Se han sincronizado ${procesados} registros guardados offline.`);
      }

      // processOfflineQueue solo vacía la cola de OfflineManager (localStorage).
      // Lo que se entrenó sin conexión vive en SQLite y lo sube SyncService, que
      // antes no se disparaba aquí: si volvía el internet sin cerrar la app, ese
      // trabajo se quedaba esperando al siguiente arranque.
      const userId = session?.user?.id;
      if (userId) {
        SyncService.syncAll(userId).catch(e => console.warn("Sync al recuperar conexión:", e));
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // session va en las dependencias a propósito: con [] el handler capturaba la
    // sesión inicial (null) para siempre y nunca habría sabido a quién sincronizar.
  }, [session]);

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
        <img 
          src="/VV_emblema_dorado_sobre_negro_2048.png" 
          alt="Veta & Vigor" 
          style={{ width: '80%', maxWidth: '300px', height: 'auto', animation: 'pulseGold 2s infinite' }} 
        />
        <p style={{ 
          color: 'var(--accent-gold)', 
          marginTop: '40px', 
          fontSize: '0.9rem', 
          opacity: 0.8, 
          letterSpacing: '3px', 
          textTransform: 'uppercase',
          animation: 'pulse 2s infinite',
          textAlign: 'center',
          maxWidth: '80%'
        }}>
          Iniciando App...
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
        <SolicitudEntrenadorModal
          vinculacion={pendingVinculacion}
          onClose={() => setPendingVinculacion(null)}
        />
      )}
      {showDroppedStudentModal && (
        <AlumnoDadoDeBajaModal
          session={session}
          onClose={() => setShowDroppedStudentModal(false)}
        />
      )}

      {showPlatinumTrialModal && (
        <PlatinumTrialModal
          session={session}
          onClose={() => setShowPlatinumTrialModal(false)}
        />
      )}

      {showTrialWarningModal && (
        <PruebaPlatinoPorTerminarModal onClose={() => setShowTrialWarningModal(false)} />
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
            skipExpediente();
            setShowExpediente(false);
          }}
        />
      )}
    </Router>
  );
}

export default App;
