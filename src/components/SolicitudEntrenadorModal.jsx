import { supabase } from '../supabaseClient';
import { Users } from 'lucide-react';

export default function SolicitudEntrenadorModal({ vinculacion, onClose }) {
  const handleAceptar = async () => {
    try {
      // Una sola RPC: activa la relación y asigna el rol, tras comprobar que esa
      // vinculación es realmente tuya.
      const { data: aceptada } = await supabase.rpc('aceptar_vinculacion', {
        p_relacion_id: vinculacion.relacionId
      });

      if (!aceptada?.ok) {
        alert('No pudimos aceptar la vinculación. Intenta de nuevo.');
        return;
      }

      localStorage.setItem('user_role', 'alumno_entrenador');
      onClose();
      alert('¡Vinculación aceptada! Ahora verás las rutinas que te asigne tu entrenador.');
      window.location.reload();
    } catch (err) {
      console.error('Error accepting vinculacion:', err);
      alert('Hubo un error. Intenta de nuevo.');
    }
  };

  const handleRechazar = async () => {
    try {
      await supabase
        .from('relacion_entrenador_alumno')
        .delete()
        .eq('id', vinculacion.relacionId);

      onClose();
    } catch (err) {
      console.error('Error rejecting vinculacion:', err);
      alert('Hubo un error. Intenta de nuevo.');
    }
  };

  return (
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
          {vinculacion.nombre}
        </p>
        <p style={{ color: '#888', marginBottom: '20px', fontSize: '0.85rem' }}>
          {vinculacion.email}
        </p>
        <p style={{ color: '#bbb', marginBottom: '25px', fontSize: '0.9rem', lineHeight: '1.6' }}>
          Te ha agregado como su alumno. Al aceptar, verás las rutinas personalizadas que te asigne y tendrás acceso a funciones VIP.
        </p>
        <p style={{ color: '#666', marginBottom: '25px', fontSize: '0.8rem' }}>
          Si no reconoces a esta persona, puedes rechazar la solicitud.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleRechazar} style={{
            flex: 1, padding: '14px', border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)', color: '#ccc', borderRadius: '12px',
            fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold'
          }}>
            No vincularme
          </button>
          <button onClick={handleAceptar} style={{
            flex: 1, padding: '14px', border: 'none',
            background: 'var(--accent-gold)', color: 'black', borderRadius: '12px',
            fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold'
          }}>
            ✓ Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
