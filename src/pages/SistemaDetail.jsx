import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft } from 'lucide-react';

export default function SistemaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sistema, setSistema] = useState(null);
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Get Sistema
      const { data: sysData, error: sysError } = await supabase
        .from('sistemas_entrenamiento')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!sysError) setSistema(sysData);

      // Get Rutinas for this sistema
      const { data: rutData, error: rutError } = await supabase
        .from('rutinas')
        .select('*')
        .eq('sistema_id', id)
        .order('nombre'); // TODO: add better sorting by level/day if needed
      
      if (!rutError) setRutinas(rutData);

      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return <div style={{textAlign: 'center', padding: '40px'}}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>;

  // Group routines by Level (Nivel)
  const rutinasPorNivel = rutinas.reduce((acc, rut) => {
    const nivel = rut.nivel || 'General';
    if (!acc[nivel]) acc[nivel] = [];
    acc[nivel].push(rut);
    return acc;
  }, {});

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver
      </button>

      {sistema && (
        <div style={{ marginBottom: '30px' }}>
          <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '10px' }}>{sistema.nombre}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{sistema.descripcion}</p>
        </div>
      )}

      {Object.entries(rutinasPorNivel).map(([nivel, ruts]) => (
        <div key={nivel} style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Nivel: {nivel}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ruts.map(rut => (
              <div 
                key={rut.id} 
                onClick={() => navigate(`/rutina/${rut.id}`)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{rut.nombre}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enfoque: {rut.enfoque}</p>
                </div>
                <div style={{ color: 'var(--accent-gold)' }}>
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
