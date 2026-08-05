import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Crown, CheckCircle, Smartphone } from 'lucide-react';

export default function PlatinumTrialModal({ session, onComplete }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {

      // 2. Calcular expiración (7 días a partir de ahora)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      // 3. Actualizar perfiles con el nuevo plan y apagar la bandera
      const { error } = await supabase.from('perfiles').update({
        plan_membresia: 'Platinum',
        force_platinum_trial: false,
        platinum_trial_ends_at: expirationDate.toISOString()
      }).eq('id', session.user.id);

      if (error) throw error;

      alert("¡Felicidades! Tu Plan Platinum de 7 días está activo.");
      
      if (onComplete) onComplete();
      else window.location.reload();

    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al activar tu plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '35px',
        width: '100%', maxWidth: '450px', border: '1px solid rgba(212, 175, 55, 0.4)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(212, 175, 55, 0.1)',
        textAlign: 'center'
      }}>
        <Crown size={50} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.6))' }} />
        
        <h2 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '10px', fontWeight: '900' }}>
          ¡REGALO DESBLOQUEADO!
        </h2>
        <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '20px' }}>
          Tienes 7 Días de Acceso PLATINUM
        </h3>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
          Disfruta de todos los beneficios VIP, rutinas premium y acceso total a la plataforma durante 7 días, totalmente gratis.
        </p>

        <div style={{ marginBottom: '25px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: '#fff', fontSize: '1rem', lineHeight: '1.5', margin: 0, textAlign: 'center' }}>
            Para activar tu semana de regalo, haz clic en el botón de abajo. No te pediremos tarjeta de crédito ni renovación automática.
          </p>
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className="btn-primary" 
          style={{ 
            width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            opacity: loading ? 0.5 : 1, transition: 'all 0.3s',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Activando...' : <><CheckCircle size={20} /> ACTIVAR MI PLAN PLATINUM</>}
        </button>

        <button 
          onClick={async () => {
            if (window.confirm("¿Seguro que quieres rechazar tus 7 Días Premium Gratis? Esta oferta no volverá a aparecer.")) {
              setLoading(true);
              await supabase.from('perfiles').update({ force_platinum_trial: false }).eq('id', session.user.id);
              if (onComplete) onComplete();
              else window.location.reload();
            }
          }}
          disabled={loading}
          style={{ 
            background: 'transparent', color: 'var(--text-muted)', border: 'none', 
            fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' 
          }}
        >
          No, gracias. Prefiero seguir en la versión gratuita.
        </button>
      </div>
    </div>
  );
}
