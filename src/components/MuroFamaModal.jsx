import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Trophy, Gift, X, Check, ArrowRight } from 'lucide-react';

export default function MuroFamaModal({ nominacion, onClose, onAccept }) {
  const [frase, setFrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAceptar = async () => {
    if (!frase.trim()) {
      alert("Por favor escribe una frase motivadora breve.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('muro_fama')
        .update({ estado: 'publicado', frase_motivadora: frase })
        .eq('id', nominacion.id);
        
      if (error) throw error;
      
      alert("¡Felicidades! Ya estás en el Muro de la Fama y tu Coach se pondrá en contacto pronto para tu premio.");
      if (onAccept) onAccept();
      if (onClose) onClose();
    } catch (error) {
      alert("Hubo un error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!window.confirm("¿Seguro que quieres rechazar esta nominación y el premio de reembolso?")) return;
    
    try {
      await supabase.from('muro_fama').update({ estado: 'rechazado' }).eq('id', nominacion.id);
      if (onClose) onClose();
    } catch (error) {
      alert("Hubo un error: " + error.message);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex',
      justifyContent: 'center', alignItems: 'center', padding: '20px',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{ 
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)', 
        border: '2px solid var(--accent-gold)', 
        borderRadius: '24px', 
        padding: '30px', 
        width: '100%', 
        maxWidth: '400px', 
        position: 'relative',
        boxShadow: '0 0 40px rgba(212, 175, 55, 0.3)',
        textAlign: 'center'
      }}>
        <div style={{
          position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
          width: '80px', height: '80px', borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
        }}>
          <Trophy size={40} color="#000" />
        </div>

        <h2 style={{ color: 'var(--accent-gold)', marginTop: '40px', marginBottom: '10px', fontSize: '1.8rem' }}>
          ¡Felicidades!
        </h2>
        
        <p style={{ color: '#ddd', fontSize: '1rem', lineHeight: '1.5', marginBottom: '20px' }}>
          Tu constancia, progreso y disciplina te han llevado a destacar. 
          Has sido nominado para formar parte del <strong>Muro de la Fama</strong> de Veta & Vigor.
        </p>

        <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', marginBottom: '25px', display: 'flex', alignItems: 'flex-start', gap: '15px', textAlign: 'left' }}>
          <Gift size={28} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--accent-gold)' }}>Recompensa por tu Esfuerzo</h4>
            <p style={{ margin: 0, color: '#ccc', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Como premio por tu disciplina, si aceptas publicar tu logro, recibirás un <strong>reembolso equivalente a 1 mes de tu membresía</strong>. Tu Coach se comunicará contigo por el Chat Privado para coordinar el depósito.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'left', marginBottom: '25px' }}>
          <label style={{ color: '#aaa', fontSize: '0.85rem', fontWeight: 'bold' }}>Tu Frase Motivadora para el Muro:</label>
          <p style={{ margin: '3px 0 10px 0', fontSize: '0.75rem', color: '#666' }}>Ej: "La disciplina siempre vence al talento."</p>
          <textarea 
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder="Escribe algo inspirador..."
            maxLength={100}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', outline: 'none', resize: 'none', minHeight: '80px', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={handleAceptar}
            disabled={isSubmitting}
            style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)', color: '#000', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            {isSubmitting ? 'Guardando...' : <><Check size={20} /> Aceptar y Publicar</>}
          </button>
          
          <button 
            onClick={handleRechazar}
            style={{ background: 'transparent', color: '#888', border: 'none', padding: '10px', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Rechazar e ignorar premio
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
