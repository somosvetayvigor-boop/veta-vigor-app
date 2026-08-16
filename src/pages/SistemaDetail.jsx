import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import DatabaseService from '../services/DatabaseService';
import { ChevronLeft, Lock } from 'lucide-react';

export default function SistemaDetail({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sistema, setSistema] = useState(null);
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [isFreeUser, setIsFreeUser] = useState(false);

  const isActive = session?.user?.user_metadata?.sistema_activo === id;

  useEffect(() => {
    async function fetchData() {
      // 0. Fetch Real Subscription
      const perfilesRows = await DatabaseService.query(`SELECT plan_membresia FROM perfiles WHERE id = ?`, [session?.user.id]);
      const perfilData = perfilesRows.length > 0 ? perfilesRows[0] : null;
        
      const suscripcionReal = perfilData?.plan_membresia || session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
      const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
      const hasPaidPlan = suscripcionReal?.includes('Pro') || suscripcionReal?.includes('Élite') || ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcionReal);
      const freeStatus = !isAdmin && !hasPaidPlan;
      setIsFreeUser(freeStatus);

      // Get Sistema
      const sysDataRows = await DatabaseService.query(`SELECT * FROM sistemas_entrenamiento WHERE id = ?`, [id]);
      if (sysDataRows && sysDataRows.length > 0) setSistema(sysDataRows[0]);

      // Get Rutinas for this sistema
      const rutDataRows = await DatabaseService.query(`SELECT * FROM rutinas WHERE sistema_id = ? ORDER BY nombre`, [id]);
      if (rutDataRows) setRutinas(rutDataRows);

      setLoading(false);
    }
    fetchData();
  }, [id, session]);

  const activateSystem = async () => {
    setActivating(true);
    try {
      const { error: dbError } = await supabase
        .from('perfiles')
        .update({ sistema_activo: id })
        .eq('id', session?.user.id);
      if (dbError) throw dbError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { sistema_activo: id }
      });
      if (authError) throw authError;

      await DatabaseService.execute(`UPDATE perfiles SET sistema_activo = ?, is_dirty = 1 WHERE id = ?`, [id, session?.user.id]);

      navigate('/mirutina');
    } catch (err) {
      console.error(err);
      alert('Error al activar sistema');
    }
    setActivating(false);
  };

  if (loading) return <div style={{textAlign: 'center', padding: '40px'}}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{fontSize: '2rem'}}></i></div>;

  const isMaestria = sistema?.nombre?.toLowerCase().includes('maestría');
  const rutinasSuperadas = session?.user?.user_metadata?.rutinas_superadas || [];

  let sortedGroups = [];

  if (isMaestria) {
    const grupos = rutinas.reduce((acc, rut) => {
      const parts = rut.nombre.split(' - Semana ');
      const baseName = parts[0];
      if (!acc[baseName]) acc[baseName] = [];
      acc[baseName].push(rut);
      return acc;
    }, {});

    Object.keys(grupos).forEach(baseName => {
      grupos[baseName].sort((a, b) => {
        const getWeek = name => parseInt(name.split(' - Semana ')[1]) || 0;
        return getWeek(a.nombre) - getWeek(b.nombre);
      });
    });

    sortedGroups = Object.entries(grupos).map(([baseName, ruts]) => {
      const rutsWithLock = ruts.map((rut, index) => {
        const isPrimeraDominadaS1 = baseName.toLowerCase().includes('dominada') && index === 0;
        
        if (isFreeUser && !isPrimeraDominadaS1) {
          return { ...rut, isLocked: true, lockReason: 'premium' };
        }

        if (index === 0) return { ...rut, isLocked: false };
        const prevRutina = ruts[index - 1];
        const isLocked = !rutinasSuperadas.includes(prevRutina.id);
        return { ...rut, isLocked, lockReason: isLocked ? 'progression' : null };
      });
      return [baseName, rutsWithLock];
    });

  } else {
    const rutinasPorNivel = rutinas.reduce((acc, rut) => {
      let rawNivel = rut.nivel ? rut.nivel.trim() : 'General';
      const nivel = rawNivel.charAt(0).toUpperCase() + rawNivel.slice(1).toLowerCase();
      if (!acc[nivel]) acc[nivel] = [];
      acc[nivel].push(rut);
      return acc;
    }, {});

    sortedGroups = Object.entries(rutinasPorNivel).sort(([nivelA], [nivelB]) => {
      const order = { 'Semilla': 1, 'Pino': 2, 'Tzalam': 3, 'Roble': 4, 'General': 5 };
      const valA = order[nivelA] || 99;
      const valB = order[nivelB] || 99;
      return valA - valB;
    });
  }

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver
      </button>

      {sistema && (
        <div style={{ marginBottom: '30px' }}>
          <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '10px' }}>{sistema.nombre}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{sistema.descripcion}</p>
          
          {!isMaestria && (
            <button 
              onClick={activateSystem}
              disabled={isActive || activating}
              className={isActive ? 'btn-secondary' : 'btn-primary'}
              style={{ width: '100%', padding: '15px', fontWeight: 'bold', fontSize: '1.1rem', opacity: isActive ? 0.5 : 1 }}
            >
              {activating ? 'ACTIVANDO...' : isActive ? 'SISTEMA ACTUALMENTE ACTIVO' : 'ACTIVAR ESTE SISTEMA'}
            </button>
          )}
        </div>
      )}

      {sortedGroups.map(([grupoNombre, ruts]) => (
        <div key={grupoNombre} style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
            {isMaestria ? `Habilidad: ${grupoNombre}` : `Nivel: ${grupoNombre}`}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ruts.map(rut => {
              const isLocked = rut.isLocked;
              return (
                <div 
                  key={rut.id} 
                  onClick={() => {
                    if (isLocked) {
                      if (rut.lockReason === 'premium') {
                        navigate('/premium');
                      } else {
                        alert('🔒 Debes superar exitosamente la semana anterior para desbloquear esta rutina.');
                      }
                    } else {
                      navigate(`/rutina/${rut.id}`);
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    padding: '15px',
                    borderRadius: '12px',
                    border: isLocked ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.4 : 1
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{rut.nombre}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enfoque: {rut.enfoque || 'Tren Superior'}</p>
                  </div>
                  <div style={{ color: isLocked ? (rut.lockReason === 'premium' ? 'var(--accent-gold)' : '#999') : 'var(--accent-gold)' }}>
                    {isLocked ? (rut.lockReason === 'premium' ? <i className="fa-solid fa-star"></i> : <Lock size={20} />) : <i className="fa-solid fa-chevron-right"></i>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
