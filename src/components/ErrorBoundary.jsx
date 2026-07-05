import React from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  async componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    
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
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: 'var(--accent-gold)', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Reiniciar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
