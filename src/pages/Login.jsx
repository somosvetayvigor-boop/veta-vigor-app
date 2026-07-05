import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import LegalModals from '../components/LegalModals';
import { Eye, EyeOff, Smartphone, Share, PlusSquare } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [name, setName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOSPrompt, setIsIOSPrompt] = useState(false);

  useEffect(() => {
    // Android/Chrome logic
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS/Safari logic
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !isStandalone) {
      setIsIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isResetting) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        alert('Se ha enviado un enlace de recuperación a tu correo.');
        setIsResetting(false);
      } else {
        const timestamp = new Date().toISOString();

        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                nombre: name,
                nivel: 'Semilla',
                terminos_aceptados_en: timestamp
              }
            }
          });
          if (error) throw error;
          if (!data.session) {
            alert('Revisa tu correo para confirmar tu cuenta.');
          } else {
            // Automatically logged in, no alert needed
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          
          // Update terms acceptance timestamp on login as well
          await supabase.auth.updateUser({
            data: { terminos_aceptados_en: timestamp }
          });
        }
      }
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ 
      display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: '20px',
      backgroundImage: 'linear-gradient(rgba(10,10,12,0.4), rgba(10,10,12,0.85)), url(/assets/epic_login_bg.png)',
      backgroundSize: 'auto 115vh',
      backgroundPosition: 'center bottom',
      backgroundAttachment: 'fixed',
      margin: '-20px', /* To offset any container padding if present, though minHeight handles full screen */
      padding: '40px 20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>VETA & VIGOR</h1>
        <p style={{ color: 'var(--text-muted)' }}>Plataforma Oficial de Entrenamiento</p>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
          {isResetting ? 'Recuperar Contraseña' : (isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión')}
        </h2>
        
        <form onSubmit={handleAuth}>
          {!isResetting && isSignUp && (
            <input 
              type="text" 
              placeholder="Tu Nombre Completo" 
              className="input-field" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          )}
          <input 
            type="email" 
            placeholder="Correo Electrónico" 
            className="input-field" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          {!isResetting && (
            <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Contraseña" 
                className="input-field" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                style={{ width: '100%', paddingRight: '45px', marginBottom: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          )}

          {!isResetting && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '10px', marginBottom: '20px' }}>
              <input 
                type="checkbox" 
                id="terms" 
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: '4px', transform: 'scale(1.2)', accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
              />
              <label htmlFor="terms" style={{ fontSize: '0.8rem', color: '#ccc', lineHeight: '1.4', cursor: 'pointer' }}>
                He leído y acepto el{' '}
                <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalModal('privacy'); }} style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Aviso de Privacidad</span> 
                {' '}y los{' '}
                <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalModal('terms'); }} style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Términos y Condiciones</span>.
              </label>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading || (!isResetting && !acceptedTerms)} style={{ opacity: ((!isResetting && !acceptedTerms) || loading) ? 0.5 : 1 }}>
            {loading ? 'Cargando...' : (isResetting ? 'Enviar Enlace' : (isSignUp ? 'Crear Cuenta' : 'Entrar al Cuartel'))}
          </button>
        </form>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          {!isResetting && !isSignUp && (
            <button 
              type="button"
              onClick={() => setIsResetting(true)}
              style={{ background: 'transparent', color: 'var(--accent-gold)', fontSize: '0.85rem', textDecoration: 'none', border: 'none', cursor: 'pointer' }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <button 
            type="button"
            onClick={() => {
              if (isResetting) {
                setIsResetting(false);
              } else {
                setIsSignUp(!isSignUp);
              }
            }}
            style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'underline', border: 'none', cursor: 'pointer' }}
          >
            {isResetting ? 'Volver a Iniciar Sesión' : (isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Nuevo recluta? Regístrate gratis')}
          </button>
        </div>
      </div>

      {deferredPrompt && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={handleInstallClick}
            className="btn-primary"
            style={{
              background: 'rgba(197, 160, 89, 0.15)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold)',
              padding: '12px 24px',
              borderRadius: '25px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 0 15px rgba(197, 160, 89, 0.2)'
            }}
          >
            <Smartphone size={20} /> Instalar V&V App en tu Celular
          </button>
        </div>
      )}

      {isIOSPrompt && !deferredPrompt && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: 'rgba(255,255,255,0.05)', 
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          color: '#e5e5e7',
          fontSize: '0.85rem',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Instalar App en tu iPhone:</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <span>1. Toca Compartir</span> <Share size={16} color="var(--accent-gold)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <span>2. Desliza hacia abajo o toca "Ver más"</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>3. Elige Agregar a Inicio</span> <PlusSquare size={16} color="var(--accent-gold)" />
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '40px', color: '#555', fontSize: '0.75rem' }}>
        <p>© {new Date().getFullYear()} Veta & Vigor. Todos los derechos reservados.</p>
      </div>

      <LegalModals type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
