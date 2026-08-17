import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AlumnoDadoDeBajaModal({ session, onClose }) {
  const [whatsapp, setWhatsapp] = useState('');

  const handleActivar = async () => {
    const justNumbers = whatsapp.replace(/[^0-9]/g, '');
    if (justNumbers.length < 10) {
      alert("Por favor, ingresa un número de WhatsApp válido (mínimo 10 dígitos).");
      return;
    }

    onClose();
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
  };

  return (
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
          onClick={handleActivar}
          className="btn-primary"
          style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
        >
          Activar mis 7 Días Gratis
        </button>
      </div>
    </div>
  );
}
