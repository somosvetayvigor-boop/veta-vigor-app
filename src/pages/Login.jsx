import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre: name,
              nivel: 'Semilla'
            }
          }
        });
        if (error) throw error;
        alert('Revisa tu correo para confirmar tu cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>VETA & VIGOR</h1>
        <p style={{ color: 'var(--text-muted)' }}>Plataforma Oficial de Entrenamiento</p>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
        
        <form onSubmit={handleAuth}>
          {isSignUp && (
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
          <input 
            type="password" 
            placeholder="Contraseña" 
            className="input-field" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : (isSignUp ? 'Crear Cuenta' : 'Entrar al Cuartel')}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'underline' }}
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Nuevo recluta? Regístrate gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}
