import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Dumbbell, Scale, FlaskConical, Lock, Gift } from 'lucide-react';

export default function Dashboard({ session }) {
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freeRoutineId, setFreeRoutineId] = useState(null);
  const [isFreeUser, setIsFreeUser] = useState(false);

  const navigate = useNavigate();
  
  const meta = session.user.user_metadata || {};

  useEffect(() => {
    async function fetchData() {
      // 0. Fetch Real Subscription from perfiles table (to sync with admin panel)
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('plan_membresia')
        .eq('id', session.user.id)
        .single();
        
      const suscripcionReal = perfilData?.plan_membresia || meta.suscripcion || meta.plan_membresia;
      const isAdmin = session.user.email === 'somos.vetayvigor@gmail.com';
      const isPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(suscripcionReal);
      const freeStatus = !isAdmin && !isPaidPlan;
      setIsFreeUser(freeStatus);

      // 1. Fetch Sistemas
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
      
      // 2. Fetch Free Routine ID si es usuario gratis
      if (freeStatus) {
        const { data: routineData } = await supabase
          .from('rutinas')
          .select('id')
          .ilike('nombre', '%Cuerpo Completo%')
          .limit(1)
          .maybeSingle();
        
        if (routineData) {
          setFreeRoutineId(routineData.id);
        } else {
          // Fallback a cualquier rutina si no hay una de Cuerpo Completo
          const { data: anyRoutine } = await supabase.from('rutinas').select('id').limit(1).maybeSingle();
          if (anyRoutine) setFreeRoutineId(anyRoutine.id);
        }
      }
      
      setLoading(false);
    }
    fetchData();
  }, [session.user.id, session.user.email]);

  const displayName = meta.display_preference === 'username' && meta.username 
    ? `@${meta.username}` 
    : (meta.nombre || session.user.email?.split('@')[0] || 'Recluta');

  const [imgError, setImgError] = useState(false);

  const avatarContent = (meta.avatar_url && !imgError) ? (
    <img 
      src={meta.avatar_url} 
      alt="Avatar" 
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
    />
  ) : (
    (meta.nombre || session.user.email || 'A')[0]
  );

  const handleSystemClick = (sis) => {
    const isMaestria = sis.nombre?.toLowerCase().includes('maestría');
    
    if (isFreeUser && !isMaestria) {
      navigate('/premium');
    } else {
      navigate(`/sistema/${sis.id}`);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '20px' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Bienvenido de vuelta,</p>
          <h1 style={{ fontSize: '1.5rem', textTransform: meta.display_preference === 'username' ? 'none' : 'capitalize' }}>
            {displayName}
          </h1>
        </div>
        <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 'bold', textTransform: 'uppercase', overflow: 'hidden', border: '2px solid var(--accent-gold)' }}>
          {avatarContent}
        </div>
      </div>

      {isFreeUser && freeRoutineId && (
        <div 
          onClick={() => navigate(`/rutina/${freeRoutineId}`)}
          style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(0,0,0,0.8) 100%)', border: '1px solid var(--accent-gold)', padding: '20px', borderRadius: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--accent-gold)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gift size={26} />
          </div>
          <div>
            <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 5px 0', fontSize: '1.1rem' }}>Tu Rutina de Regalo</h3>
            <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0 }}>Haz clic aquí para probar el nivel del entrenamiento VIP.</p>
          </div>
        </div>
      )}

      {isFreeUser && (
        <div 
          onClick={() => navigate('/premium')}
          style={{ background: 'linear-gradient(135deg, #111 0%, #222 100%)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px 20px', borderRadius: '16px', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-crown" style={{ fontSize: '18px' }}></i>
            </div>
            <div>
              <h3 style={{ color: 'white', margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 'bold' }}>Desbloquea Veta&Vigor</h3>
              <p style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', margin: 0 }}>Ver planes Premium</p>
            </div>
          </div>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>
      )}

      <h2 style={{ marginBottom: '20px', fontSize: '1.3rem' }} className="gold-gradient-text">Sistemas Veta&Vigor</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
          {sistemas.map(sis => (
            <div key={sis.id} className="system-card" onClick={() => handleSystemClick(sis)} style={{ position: 'relative' }}>
              <img src={sis.imagen_url || 'https://via.placeholder.com/400x200?text=Veta+y+Vigor'} alt={sis.nombre} className="system-image" style={{ opacity: isFreeUser ? 0.6 : 1 }} />
              
              {isFreeUser && !sis.nombre?.toLowerCase().includes('maestría') && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '50%', border: '1px solid rgba(212,175,55,0.5)', zIndex: 2 }}>
                  <Lock size={20} color="var(--accent-gold)" />
                </div>
              )}

              <div className="system-content">
                <h3 className="system-title" style={{ color: isFreeUser ? '#ccc' : '#fff' }}>{sis.nombre}</h3>
                <p className="system-desc">{sis.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
