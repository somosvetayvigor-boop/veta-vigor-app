import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DatabaseService from '../services/DatabaseService';
import { Lock, Gift } from 'lucide-react';

export default function Dashboard({ session }) {
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freeRoutineId, setFreeRoutineId] = useState(null);
  const [isFreeUser, setIsFreeUser] = useState(false);
  const [activeTab, setActiveTab] = useState('sistemas'); // 'sistemas' | 'rutas'
  
  // Retos State
  const [perfil, setPerfil] = useState(null);
  const [recommendedReto, setRecommendedReto] = useState(null);

  const navigate = useNavigate();
  
  const meta = session?.user.user_metadata || {};

  useEffect(() => {
    async function fetchData() {
      // 0. Fetch Real Subscription from perfiles table (to sync with admin panel)
      const perfilesRows = await DatabaseService.query(`
        SELECT plan_membresia, reto_activo_id, reto_dia_actual, reto_completado, nivel, sistema_activo, retos_completados_count 
        FROM perfiles WHERE id = ?
      `, [session?.user.id]);
      const perfilData = perfilesRows.length > 0 ? perfilesRows[0] : null;
        
      // 1. Fetch Sistemas
      const data = await DatabaseService.query(`SELECT * FROM sistemas_entrenamiento`);
      
      let sisList = [];
      if (!data || data.length === 0) {
        console.error("Error cargando sistemas");
      } else {
        const orderList = ["Vigor Corporal", "Carga de Hierro", "Método Híbrido", "Rutas de Maestría"];
        const sortedData = data.sort((a, b) => {
          const getIndex = (name) => {
            const index = orderList.findIndex(orderName => name.includes(orderName) || orderName.includes(name));
            return index === -1 ? 999 : index;
          };
          return getIndex(a.nombre) - getIndex(b.nombre);
        });
        sisList = sortedData;
        setSistemas(sortedData);
      }
        
      if (perfilData) {
        setPerfil(perfilData);
        // Si no tiene reto activo, y no ha completado uno, buscar el recomendado
        if (!perfilData.reto_activo_id && !perfilData.reto_completado && perfilData.nivel && perfilData.nivel !== 'Roble') {
          // Mapeo simple: Semilla -> Desde Cero, Pino/Tzalam -> Principiante
          let searchNivel = 'Semilla';
          if (perfilData.nivel === 'Pino' || perfilData.nivel === 'Tzalam') {
            searchNivel = 'Pino,Tzalam';
          }
          
          let searchSistema = 'Vigor'; // Default
          if (perfilData.sistema_activo && sisList.length > 0) {
             const sisName = sisList.find(s => s.id === perfilData.sistema_activo)?.nombre || '';
             if (sisName.includes('Carga de Hierro') || sisName.includes('Hierro')) searchSistema = 'Hierro';
             if (sisName.includes('Híbrido')) searchSistema = 'Híbrido';
          }
          
          const matchString = `${searchNivel}|${searchSistema}`;

          const retosFound = await DatabaseService.query(`SELECT * FROM retos WHERE nivel_requerido = ? LIMIT 1`, [matchString]);
            
          if (retosFound && retosFound.length > 0) {
            setRecommendedReto(retosFound[0]);
          }
        }
      }
        
      const suscripcionReal = perfilData?.plan_membresia || meta.suscripcion || meta.plan_membresia;
      const isAdmin = session?.user.email === 'somos.vetayvigor@gmail.com';
      const isPaidPlan = suscripcionReal?.includes('Pro') || suscripcionReal?.includes('Élite') || ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcionReal);
      const freeStatus = !isAdmin && !isPaidPlan;
      setIsFreeUser(freeStatus);
      
      // 2. Fetch Free Routine ID si es usuario gratis
      if (freeStatus) {
        const routineDataRows = await DatabaseService.query(`SELECT id FROM rutinas WHERE nombre LIKE '%Cuerpo Completo%' LIMIT 1`);
        
        if (routineDataRows && routineDataRows.length > 0) {
          setFreeRoutineId(routineDataRows[0].id);
        } else {
          // Fallback a cualquier rutina si no hay una de Cuerpo Completo
          const anyRoutine = await DatabaseService.query(`SELECT id FROM rutinas LIMIT 1`);
          if (anyRoutine && anyRoutine.length > 0) setFreeRoutineId(anyRoutine[0].id);
        }
      }
      
      setLoading(false);
    }
    fetchData();
  }, [session?.user.id, session?.user.email, meta.plan_membresia, meta.suscripcion]);

  const displayName = meta.display_preference === 'username' && meta.username 
    ? `@${meta.username}` 
    : (meta.nombre || session?.user.email?.split('@')[0] || 'Recluta');

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
    (meta.nombre || session?.user.email || 'A')[0]
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

      {/* Retos Completados Badge */}
      {perfil?.retos_completados_count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(0,0,0,0.5) 100%)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--accent-gold)', marginBottom: '20px', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.15)' }}>
          <i className="fa-solid fa-trophy" style={{ color: 'var(--accent-gold)', fontSize: '1.2rem' }}></i>
          <span style={{ color: 'var(--accent-gold)', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>Retos Completados: {perfil.retos_completados_count}</span>
        </div>
      )}

      {/* Reto Banner (Recomendado) */}
      {recommendedReto && (
        <button 
          onClick={() => navigate(`/reto-21-dias?retoId=${recommendedReto.id}`)}
          className="glowing-border-button"
          style={{ width: '100%', marginBottom: '20px', padding: '2px', borderRadius: '16px', display: 'block', textAlign: 'left', border: 'none' }}
        >
          <div className="glowing-border-inner" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(20,20,20,0.9) 100%)', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--accent-gold)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-fire-flame-curved" style={{ fontSize: '24px' }}></i>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 5px 0', fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>VIGOR 21 DÍAS: MADERA {perfil.nivel}</h3>
              <p style={{ color: '#ddd', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>Construye el hábito. Empieza hoy tu transformación física.</p>
            </div>
          </div>
        </button>
      )}

      {/* Reto Banner (Activo) */}
      {perfil?.reto_activo_id && !perfil?.reto_completado && (
        <button 
          onClick={() => navigate(`/reto-21-dias`)}
          className="glowing-border-button"
          style={{ width: '100%', marginBottom: '20px', padding: '2px', borderRadius: '16px', display: 'block', textAlign: 'left', border: 'none' }}
        >
          <div className="glowing-border-inner" style={{ background: 'linear-gradient(135deg, rgba(30,30,30,0.9) 0%, rgba(10,10,10,0.9) 100%)', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 5px 0', fontSize: '1.3rem', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1px' }}>VIGOR 21 DÍAS</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Día {perfil.reto_dia_actual}</span>
                <div style={{ width: '100px', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(perfil.reto_dia_actual / 21) * 100}%`, height: '100%', backgroundColor: 'var(--accent-gold)' }}></div>
                </div>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right" style={{ color: 'var(--accent-gold)' }}></i>
          </div>
        </button>
      )}

      {isFreeUser && freeRoutineId && (
        <div 
          onClick={() => navigate(`/rutina/${freeRoutineId}`)}
          style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(0,0,0,0.8) 100%)', border: '1px solid var(--accent-gold)', padding: '20px', borderRadius: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--accent-gold)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gift size={26} />
          </div>
          <div>
            <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 5px 0', fontSize: '1.1rem' }}>Tu Misión de Regalo</h3>
            <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0 }}>Haz clic aquí para descubrir la Madera de tu entrenamiento VIP.</p>
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '12px' }}>
        <button 
          onClick={() => setActiveTab('sistemas')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: activeTab === 'sistemas' ? 'var(--accent-gold)' : 'transparent', color: activeTab === 'sistemas' ? 'black' : '#888', fontWeight: 'bold', transition: 'all 0.3s' }}
        >
          Sistemas Base
        </button>
        <button 
          onClick={() => setActiveTab('rutas')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: activeTab === 'rutas' ? 'var(--accent-gold)' : 'transparent', color: activeTab === 'rutas' ? 'black' : '#888', fontWeight: 'bold', transition: 'all 0.3s' }}
        >
          Rutas de Maestría
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
          {sistemas.filter(sis => {
            const isRuta = sis.nombre?.toLowerCase().includes('maestría') || sis.nombre?.toLowerCase().includes('ruta');
            return activeTab === 'rutas' ? isRuta : !isRuta;
          }).map(sis => (
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
