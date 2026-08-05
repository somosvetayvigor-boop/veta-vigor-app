import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader, Droplet, Moon, Camera, ShieldCheck, Clock } from 'lucide-react';

const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export default function GaleriaReto({ userId }) {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHabits = async () => {
      try {
        const { data, error } = await supabase
          .from('habitos_diarios')
          .select('*')
          .eq('user_id', userId)
          .order('dia_reto', { ascending: false });

        if (error) throw error;
        setHabits(data || []);
      } catch (err) {
        console.error("Error fetching habitos_diarios:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHabits();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader className="fa-spin gold-gradient-text" size={30} />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Camera size={40} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', opacity: 0.5 }} />
        <h3 style={{ color: '#fff', marginBottom: '10px' }}>Aún no hay hábitos registrados</h3>
        <p style={{ color: '#888' }}>Completa tu primer día del reto de 21 días para ver tu progreso aquí.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
      {habits.map((habit) => (
        <div key={habit.id} style={{
          background: 'rgba(20, 20, 20, 0.6)',
          borderRadius: '16px',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {habit.foto_url ? (
            <div style={{ width: '100%', height: '150px', background: '#000', position: 'relative' }}>
              <img src={habit.foto_url} alt={`Día ${habit.dia_reto}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '10px', color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid var(--accent-gold)' }}>
                DÍA {habit.dia_reto}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '150px', background: 'linear-gradient(135deg, rgba(30,30,30,1) 0%, rgba(15,15,15,1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Camera size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '10px', color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid var(--accent-gold)' }}>
                DÍA {habit.dia_reto}
              </div>
            </div>
          )}
          
          <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.9rem' }}>
              <Droplet size={16} color="#3498db" /> 
              {habit.agua >= 3 ? <span style={{ color: '#2ecc71' }}>{habit.agua}L</span> : <span>{habit.agua}L</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.9rem' }}>
              <Moon size={16} color="#9b59b6" /> 
              {habit.sueno >= 7 ? <span style={{ color: '#2ecc71' }}>{habit.sueno}h</span> : <span>{habit.sueno}h</span>}
            </div>
            {habit.comida_sana && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', fontSize: '0.9rem', marginTop: '5px' }}>
                <ShieldCheck size={16} /> Dieta Cumplida
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', fontSize: '0.8rem', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Clock size={14} /> Terminó a las {formatTime(habit.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
