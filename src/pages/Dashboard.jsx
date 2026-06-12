import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Dashboard({ session }) {
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchSistemas() {
      const { data, error } = await supabase
        .from('sistemas_entrenamiento')
        .select('*')
        .order('nombre');
      
      if (error) {
        console.error("Error cargando sistemas:", error);
      } else {
        const orderList = ["Vigor Corporal", "Carga de Hierro", "Método Híbrido", "Rutas de Maestría"];
        const sortedData = data.sort((a, b) => {
          const getIndex = (name) => {
            const index = orderList.findIndex(orderName => name.includes(orderName) || orderName.includes(name));
            return index === -1 ? 999 : index;
          };
          return getIndex(a.nombre) - getIndex(b.nombre);
        });
        setSistemas(sortedData);
      }
      
      setLoading(false);
    }
    fetchSistemas();
  }, []);

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', marginTop: '20px' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Bienvenido de vuelta,</p>
          <h1 style={{ fontSize: '1.5rem', textTransform: 'capitalize' }}>{session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || 'Recluta'}</h1>
        </div>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 'bold', textTransform: 'uppercase' }}>
          {(session.user.user_metadata?.nombre || session.user.email || 'A')[0]}
        </div>
      </div>

      <h2 style={{ marginBottom: '20px', fontSize: '1.3rem' }} className="gold-gradient-text">Sistemas Veta&Vigor</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {sistemas.map(sis => (
            <div key={sis.id} className="system-card" onClick={() => navigate(`/sistema/${sis.id}`)}>
              <img src={sis.imagen_url || 'https://via.placeholder.com/400x200?text=Veta+y+Vigor'} alt={sis.nombre} className="system-image" />
              <div className="system-content">
                <h3 className="system-title">{sis.nombre}</h3>
                <p className="system-desc">{sis.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
