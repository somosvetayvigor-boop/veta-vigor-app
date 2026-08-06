import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, Calendar, Loader, Flame, Heart, Activity } from 'lucide-react';
import GaleriaReto from '../components/GaleriaReto';

const HABITOS_MAP = {
  agua: { label: '2L+ de Agua', emoji: '💧' },
  sueno: { label: 'Dormir 7h+', emoji: '🛌' },
  comida: { label: 'Comida Sana', emoji: '🥗' },
  lectura: { label: 'Leer 10 pág', emoji: '📖' },
  meditacion: { label: 'Meditar 10m', emoji: '🧘' },
  caminata: { label: 'Caminar 30m', emoji: '🚶' },
  bicicleta: { label: 'Bicicleta', emoji: '🚴' },
  natacion: { label: 'Natación', emoji: '🏊' },
  saltar_cuerda: { label: 'Saltar Cuerda', emoji: '🪢' }
};

export default function Historial({ session }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState({});
  const [bienestarHistory, setBienestarHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});
  const [activeTab, setActiveTab] = useState('rutinas'); // 'rutinas', 'reto' or 'bienestar'

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [historyRes, bienestarRes] = await Promise.all([
          supabase
            .from('historial_entrenamientos')
            .select(`
              id, created_at, series_log,
              ejercicios_biblioteca:ejercicio_id (nombre, musculos_trabajados)
            `)
            .eq('user_id', session?.user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('checkins_bienestar')
            .select('fecha, habitos, created_at')
            .eq('user_id', session?.user.id)
            .order('fecha', { ascending: false })
        ]);

        if (historyRes.error) throw historyRes.error;
        if (bienestarRes.error) throw bienestarRes.error;

        const data = historyRes.data;
        const bData = bienestarRes.data;

        // Group by date
        const grouped = {};
        if (data) {
          data.forEach(item => {
            // Convert to local date string to group
            const dateObj = new Date(item.created_at);
            const dateStr = dateObj.toLocaleDateString('es-MX', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            });
            const key = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

            if (!grouped[key]) {
              grouped[key] = [];
            }
            grouped[key].push(item);
          });
        }
        
        setHistory(grouped);
        
        if (bData) {
          setBienestarHistory(bData);
        }

        // Expand the first date by default
        const firstDate = Object.keys(grouped)[0];
        if (firstDate) {
          setExpandedDates({ [firstDate]: true });
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [session?.user.id]);

  const toggleDate = (dateKey) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingBottom: '90px', display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <Loader className="fa-spin gold-gradient-text" size={40} />
      </div>
    );
  }

  const dates = Object.keys(history);

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver
      </button>

      <div style={{ marginBottom: '30px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '2rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={28} /> Mi Progreso
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Revisa tus entrenamientos pasados y tu progreso en el Reto Vigor 21.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('rutinas')}
          style={{ flex: 1, minWidth: '100px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', background: activeTab === 'rutinas' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === 'rutinas' ? 'var(--accent-gold)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}>
          <Calendar size={16} /> Rutinas
        </button>
        <button 
          onClick={() => setActiveTab('reto')}
          style={{ flex: 1, minWidth: '100px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', background: activeTab === 'reto' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === 'reto' ? 'var(--accent-gold)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}>
          <Flame size={16} /> Reto
        </button>
        <button 
          onClick={() => setActiveTab('bienestar')}
          style={{ flex: 1, minWidth: '100px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', background: activeTab === 'bienestar' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === 'bienestar' ? 'var(--accent-gold)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}>
          <Heart size={16} /> Bienestar
        </button>
      </div>

      {activeTab === 'reto' ? (
        <GaleriaReto userId={session?.user.id} />
      ) : activeTab === 'bienestar' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Bienestar Stats UI */}
          <div style={{ background: 'rgba(20, 20, 20, 0.6)', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-gold)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} /> Resumen Histórico
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>{bienestarHistory.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Días de Recuperación</div>
              </div>
              <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                {(() => {
                  const habitCounts = {};
                  bienestarHistory.forEach(b => {
                    (b.habitos || []).forEach(h => {
                      habitCounts[h] = (habitCounts[h] || 0) + 1;
                    });
                  });
                  const top = Object.entries(habitCounts).sort((a, b) => b[1] - a[1])[0];
                  
                  return top ? (
                    <>
                      <div style={{ fontSize: '2rem' }}>{HABITOS_MAP[top[0]]?.emoji || '✨'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hábito Favorito</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem' }}>-</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin hábitos aún</div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa', textAlign: 'center', fontStyle: 'italic' }}>
              Tus días de recuperación nutren tu Llama Viva y te preparan para entrenar más fuerte.
            </p>
          </div>

          <h3 style={{ margin: '15px 0 5px 0', fontSize: '1.1rem', color: '#fff' }}>Tus Días de Descanso Activo</h3>
          
          {bienestarHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧘</div>
              <p style={{ color: '#888' }}>Aún no has registrado días de bienestar.</p>
            </div>
          ) : (
            bienestarHistory.map((item, idx) => {
              const dateObj = new Date(item.created_at || item.fecha);
              const dateStr = dateObj.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
              
              return (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '15px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '10px', borderRadius: '10px', textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.1rem' }}>{dateObj.getDate()}</div>
                    <div style={{ color: '#aaa', fontSize: '0.75rem', textTransform: 'uppercase' }}>{dateObj.toLocaleDateString('es-MX', { month: 'short' })}</div>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' }}>Recuperación Exitosa</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {(item.habitos || []).map(h => (
                        <span key={h} style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '20px', fontSize: '0.75rem', color: '#ddd' }}>
                          {HABITOS_MAP[h]?.emoji} {HABITOS_MAP[h]?.label || h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {dates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💪</div>
              <h3 style={{ color: '#fff', marginBottom: '10px' }}>Aún no hay registros</h3>
              <p style={{ color: '#888' }}>Tus entrenamientos finalizados aparecerán aquí. ¡Es hora de sembrar la primera semilla!</p>
              <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '20px', padding: '10px 20px' }}>
                Ir a Entrenar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dates.map((dateKey) => {
                const isExpanded = !!expandedDates[dateKey];
                const exercises = history[dateKey];

                return (
                  <div key={dateKey} style={{ 
                    background: 'rgba(20, 20, 20, 0.6)', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden'
                  }}>
                {/* Cabecera del Acordeón */}
                <div 
                  onClick={() => toggleDate(dateKey)}
                  style={{ 
                    padding: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(212, 175, 55, 0.05)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid rgba(212, 175, 55, 0.2)' : 'none',
                    transition: 'background 0.3s'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: isExpanded ? 'var(--accent-gold)' : '#fff', fontWeight: 'bold' }}>
                      {dateKey}
                    </h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                      {exercises.length} {exercises.length === 1 ? 'ejercicio registrado' : 'ejercicios registrados'}
                    </p>
                  </div>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', 
                    background: isExpanded ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                    color: isExpanded ? '#000' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s'
                  }}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </div>

                {/* Contenido (Ejercicios de ese día) */}
                {isExpanded && (
                  <div style={{ padding: '5px 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ height: '15px' }}></div> {/* Spacer */}
                    
                    {exercises.map((ejItem, idx) => {
                      const nombre = ejItem.ejercicios_biblioteca?.nombre || 'Ejercicio Desconocido';
                      const musculos = ejItem.ejercicios_biblioteca?.musculos_trabajados || 'Varios';
                      const series = Array.isArray(ejItem.series_log) ? ejItem.series_log : [];

                      return (
                        <div key={ejItem.id || idx} style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          borderRadius: '12px', 
                          padding: '15px',
                          borderLeft: '3px solid var(--accent-gold)'
                        }}>
                          <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1rem' }}>{nombre}</h4>
                          <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '0.8rem' }}>{musculos}</p>

                          {series.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                              <div style={{ color: '#888', fontWeight: 'bold', textAlign: 'center' }}>Serie</div>
                              <div style={{ color: '#888', fontWeight: 'bold', textAlign: 'center' }}>Peso (kg)</div>
                              <div style={{ color: '#888', fontWeight: 'bold', textAlign: 'center' }}>Reps / Segs</div>
                              
                              {series.map((s, sIdx) => (
                                <React.Fragment key={sIdx}>
                                  <div style={{ textAlign: 'center', color: '#ccc', padding: '5px 0' }}>{s.serie}</div>
                                  <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontWeight: 'bold', padding: '5px 0' }}>{s.peso !== '-' ? s.peso : '--'}</div>
                                  <div style={{ textAlign: 'center', color: '#fff', padding: '5px 0' }}>{s.reps !== '-' ? s.reps : '--'}</div>
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>Sin detalles de series.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
        </>
      )}
    </div>
  );
}
