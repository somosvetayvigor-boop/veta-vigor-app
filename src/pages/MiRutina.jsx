import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader } from 'lucide-react';

export default function MiRutina({ session }) {
  const [loading, setLoading] = useState(true);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkTodayStatus();
  }, []);

  const checkTodayStatus = async () => {
    try {
      // Get today's date in YYYY-MM-DD format (local time approximation)
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      const { data, error } = await supabase
        .from('checkins')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('fecha', todayStr)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setHasCheckedInToday(true);
      }
    } catch (error) {
      console.error("Error fetching checkin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (nivel) => {
    setSaving(true);
    try {
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      const { error } = await supabase
        .from('checkins')
        .insert([
          { 
            user_id: session.user.id, 
            nivel: nivel,
            fecha: todayStr
          }
        ]);

      if (error) throw error;

      setHasCheckedInToday(true);
    } catch (error) {
      console.error("Error saving checkin:", error);
      alert("Hubo un error al guardar tu disposición diaria.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}><Loader className="fa-spin gold-gradient-text" size={40} /></div>;
  }

  // Si ya hizo check-in, mostramos el contenido de la rutina
  if (hasCheckedInToday) {
    return (
      <div className="container" style={{ paddingBottom: '90px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Tu Rutina de Hoy</h1>
        <p style={{ color: 'var(--text-muted)' }}>Has registrado tu disposición con éxito. ¡A darle con todo!</p>
        
        <div className="card" style={{ marginTop: '20px', padding: '30px', textAlign: 'center' }}>
          <i className="fa-solid fa-person-running" style={{ fontSize: '3rem', color: 'var(--accent-gold)', marginBottom: '15px' }}></i>
          <h3>[Próximamente]</h3>
          <p style={{ color: 'var(--text-muted)' }}>Aquí el sistema desplegará automáticamente la rutina exacta que te toca hoy según tu calendario.</p>
        </div>
      </div>
    );
  }

  // Si NO ha hecho check-in, mostramos el modal gigante que bloquea la pantalla
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-dark)', zIndex: 999, 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      overflowY: 'auto', padding: '20px', paddingTop: '80px' // espacio para el header
    }}>
      
      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '25px 20px', position: 'relative' }}>
        
        {saving && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '16px' }}>
            <Loader className="fa-spin gold-gradient-text" size={40} />
          </div>
        )}

        <h2 className="gold-gradient-text" style={{ margin: '0 0 5px 0', fontSize: '1.5rem', textTransform: 'uppercase' }}>Disposición Diaria</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '25px' }}>¿Cómo te sientes para entrenar hoy?</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div onClick={() => handleCheckin(5)} style={checkinItemStyle('#c5a059')}>
            <div style={numberStyle}>5</div>
            <div style={emojiStyle}>🔥</div>
            <div style={textContainerStyle}>
              <span style={titleStyle}>Excelente</span>
              <span style={descStyle}>Energía al máximo. Listo para récords.</span>
            </div>
          </div>

          <div onClick={() => handleCheckin(4)} style={checkinItemStyle('#78e08f')}>
            <div style={numberStyle}>4</div>
            <div style={emojiStyle}>🔋</div>
            <div style={textContainerStyle}>
              <span style={titleStyle}>Bien</span>
              <span style={descStyle}>Motivado y con buena energía.</span>
            </div>
          </div>

          <div onClick={() => handleCheckin(3)} style={checkinItemStyle('#f6b93b')}>
            <div style={numberStyle}>3</div>
            <div style={emojiStyle}>⚖️</div>
            <div style={textContainerStyle}>
              <span style={titleStyle}>Normal</span>
              <span style={descStyle}>Sensaciones promedio. Cumpliremos.</span>
            </div>
          </div>

          <div onClick={() => handleCheckin(2)} style={checkinItemStyle('#fa983a')}>
            <div style={numberStyle}>2</div>
            <div style={emojiStyle}>🥱</div>
            <div style={textContainerStyle}>
              <span style={titleStyle}>Cansado</span>
              <span style={descStyle}>Poca energía o sueño atrasado.</span>
            </div>
          </div>

          <div onClick={() => handleCheckin(1)} style={checkinItemStyle('#e55039')}>
            <div style={numberStyle}>1</div>
            <div style={emojiStyle}>🤕</div>
            <div style={textContainerStyle}>
              <span style={titleStyle}>Agotado / Dolor</span>
              <span style={descStyle}>Necesito recuperación o descanso.</span>
            </div>
          </div>

        </div>

        <div style={{ marginTop: '25px', fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          👇 Selecciona tu nivel 👇
        </div>
      </div>

    </div>
  );
}

// Estilos extraídos del HTML original
const checkinItemStyle = (color) => ({
  display: 'flex', alignItems: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', padding: '12px 15px',
  cursor: 'pointer', position: 'relative', overflow: 'hidden',
  borderLeft: `4px solid ${color}`
});

const numberStyle = {
  fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)',
  width: '30px', textAlign: 'left', marginLeft: '5px'
};

const emojiStyle = {
  fontSize: '1.8rem', marginRight: '15px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
};

const textContainerStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1
};

const titleStyle = {
  fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '2px'
};

const descStyle = {
  fontSize: '0.75rem', color: '#888', textAlign: 'left'
};
