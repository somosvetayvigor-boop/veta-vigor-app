import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, Calendar, Loader } from 'lucide-react';

export default function Historial({ session }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('historial_entrenamientos')
          .select(`
            id, created_at, series_log,
            ejercicios_biblioteca:ejercicio_id (nombre, musculos_trabajados)
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

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
  }, [session.user.id]);

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
          <Calendar size={28} /> Mi Historial
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Revisa tus entrenamientos pasados, analiza tus marcas y celebra tu constancia.
        </p>
      </div>

      {dates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🍃</div>
          <h3 style={{ color: '#fff', marginBottom: '10px' }}>Aún no hay registros</h3>
          <p style={{ color: '#888' }}>Tus entrenamientos finalizados aparecerán aquí. ¡Es hora de sembrar la primera semilla!</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px', padding: '10px 20px' }}>
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
    </div>
  );
}
