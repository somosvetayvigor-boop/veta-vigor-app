import React from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(error) {
    if (error && error.message && error.message.includes('Failed to fetch dynamically imported module')) {
      return { hasError: true, isViteChunkError: true };
    }
    return { hasError: true, isViteChunkError: false };
  }

  async componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    
    // Si es un error de Vite por caché (versión nueva), intentamos recargar 1 vez
    if (this.state.isViteChunkError) {
      if (!sessionStorage.getItem('vite-reload-error-boundary')) {
        sessionStorage.setItem('vite-reload-error-boundary', 'true');
        window.location.reload(true);
        return;
      } else {
        sessionStorage.removeItem('vite-reload-error-boundary');
        // Si ya falló, permitimos que continúe y muestre la pantalla de error normal
      }
    }
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || null;

      const errorData = {
        error_message: error.toString(),
        component_stack: errorInfo.componentStack,
        user_agent: navigator.userAgent,
        user_id: userId
      };
      
      const { data, error: sbError } = await supabase
        .from('frontend_errors')
        .insert([errorData])
        .select()
        .single();
        
      if (data) {
        this.setState({ errorId: data.id });
      }
    } catch (e) {
      console.error("Failed to log error to Supabase", e);
    }
  }

  render() {
    if (this.state.isViteChunkError && !sessionStorage.getItem('vite-reload-error-boundary')) {
      return null; // Evita mostrar la pantalla roja la primera vez; la página se recargará
    }

    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', textAlign: 'center', color: 'white', backgroundColor: '#0f0f11', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={60} color="#e55039" style={{ marginBottom: '20px' }} />
          <h1 style={{ color: '#e55039', marginBottom: '10px', fontSize: '1.5rem' }}>Ocurrió un Fallo</h1>
          <p style={{ color: '#ccc', marginBottom: '20px', lineHeight: '1.5' }}>
            La aplicación detectó un problema en tu dispositivo. Hemos enviado un reporte silencioso a la base de datos para que el equipo lo solucione.
          </p>
          {this.state.errorId && (
            <p style={{ color: '#888', fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', wordBreak: 'break-all' }}>
              Código de rastreo: {this.state.errorId}
            </p>
          )}
          <button 
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  for (let registration of registrations) {
                    await registration.unregister();
                  }
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  for (let key of keys) {
                    await caches.delete(key);
                  }
                }
              } catch (e) {
                console.error('Error clearing cache', e);
              }
              window.location.reload(true);
            }}
            style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: 'var(--accent-gold)', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Limpiar Caché y Reiniciar
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
