import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft, PlayCircle } from 'lucide-react';

export default function RutinaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rutina, setRutina] = useState(null);
  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Get Rutina details
      const { data: rutData, error: rutError } = await supabase
        .from('rutinas')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!rutError) setRutina(rutData);

      // Get Ejercicios from bridge table
      const { data: ejData, error: ejError } = await supabase
        .from('rutina_ejercicios')
        .select(`
          orden_ejercicio,
          repeticiones_objetivo,
          ejercicios_biblioteca (
            id,
            nombre,
            equipo_necesario,
            instrucciones,
            consejos_pro,
            musculos_trabajados,
            imagen_url
          )
        `)
        .eq('rutina_id', id)
        .order('orden_ejercicio');
      
      if (!ejError) setEjercicios(ejData);

      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return <div style={{textAlign: 'center', padding: '40px'}}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>;

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver a Rutinas
      </button>

      {rutina && (
        <div style={{ marginBottom: '30px' }}>
          <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '5px' }}>{rutina.nombre}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Enfoque: {rutina.enfoque} | Nivel: {rutina.nivel}</p>
        </div>
      )}

      <button className="btn-primary" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
        <PlayCircle /> INICIAR ENTRENAMIENTO
      </button>

      <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Ejercicios ({ejercicios.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {ejercicios.map((item, index) => {
          const ej = item.ejercicios_biblioteca;
          return (
            <div key={index} style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {ej.imagen_url && (
                <div style={{ height: '200px', width: '100%', overflow: 'hidden' }}>
                  <img src={ej.imagen_url} alt={ej.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.2rem' }}>{item.orden_ejercicio}. {ej.nombre}</h3>
                </div>
                
                <div style={{ backgroundColor: 'var(--accent-gold-dim)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                  <p style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.1rem', margin: 0, textAlign: 'center' }}>
                    {item.repeticiones_objetivo}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                  <p><strong style={{color: 'var(--text-muted)'}}>Equipo:</strong> {ej.equipo_necesario || 'Ninguno'}</p>
                  <p><strong style={{color: 'var(--text-muted)'}}>Instrucciones:</strong> {ej.instrucciones}</p>
                  {ej.consejos_pro && <p><strong style={{color: 'var(--accent-gold)'}}>⚡ Pro Tip:</strong> {ej.consejos_pro}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
