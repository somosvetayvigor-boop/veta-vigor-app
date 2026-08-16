import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createPortal } from 'react-dom';
import { X, MessageCircle, TrendingUp, Scale, Zap, Activity, Calendar, Trophy, Image as ImageIcon, User } from 'lucide-react';

export default function AdminExpedienteModal({ atleta, onClose, onOpenChat }) {
  const [sistemaNombre, setSistemaNombre] = useState('Ninguno');
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    const fetchSistema = async () => {
      if (atleta.sistema_activo) {
        const { data } = await supabase
          .from('sistemas_entrenamiento')
          .select('nombre')
          .eq('id', atleta.sistema_activo)
          .single();
        if (data) setSistemaNombre(data.nombre);
      }
      setLoading(false);
    };
    fetchSistema();
  }, [atleta.sistema_activo]);

  const getLevelIcon = (nivelName) => {
    if (!nivelName) return '/assets/niveles/semilla.png';
    const n = nivelName.toLowerCase();
    if (n.includes('semilla')) return '/assets/niveles/semilla.png';
    if (n.includes('pino')) return '/assets/niveles/pino.png';
    if (n.includes('tzalam')) return '/assets/niveles/tzalam.png';
    if (n.includes('roble')) return '/assets/niveles/roble.png';
    return '/assets/niveles/semilla.png';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Desconocida';
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
      justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
    }}>
      <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Header Action Bar */}
        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--accent-gold)"/> Expediente
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          
          {/* Profile Section */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '25px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
              style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0 }}
              onClick={() => atleta.avatar_url && setZoomedImage(atleta.avatar_url)}
            >
              {atleta.avatar_url ? (
                <img src={atleta.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <User size={40} />
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 5px 0', color: 'var(--accent-gold)' }}>{atleta.full_name || atleta.username || 'Sin Nombre'}</h2>
              <p style={{ margin: '0 0 3px 0', color: '#aaa', fontSize: '0.9rem' }}>@{atleta.username}</p>
              <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>{atleta.email}</p>
              <div style={{ display: 'inline-block', marginTop: '8px', padding: '3px 8px', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {atleta.plan_membresia || 'Atleta Base (Gratis)'}
              </div>
            </div>
          </div>

          {/* Training Info */}
          <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Estatus de Entrenamiento</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><Trophy size={14}/> Nivel Actual</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={getLevelIcon(atleta.nivel)} alt="Nivel" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{atleta.nivel || 'Semilla'}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={14}/> Días Semanales</p>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{atleta.dias_entrenamiento || 0} días</span>
            </div>
            <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><Zap size={14}/> Sistema Activo</p>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-gold)' }}>{loading ? '...' : sistemaNombre}</span>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#aaa' }}>Ciclo Actual: Día {atleta.ciclo_actual || 1}</p>
            </div>
          </div>

          {/* Body Metrics */}
          <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Métricas Corporales</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><Scale size={14}/> Peso Inicial</p>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{atleta.peso_inicial ? `${atleta.peso_inicial} kg` : 'N/A'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><Scale size={14} color="var(--accent-gold)"/> Peso Actual</p>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-gold)' }}>{atleta.peso ? `${atleta.peso} kg` : 'N/A'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={14}/> Grasa Corporal</p>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{atleta.porcentaje_grasa ? `${atleta.porcentaje_grasa}%` : 'N/A'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={14} color="#78e08f"/> Masa Muscular</p>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#78e08f' }}>{atleta.masa_muscular ? `${atleta.masa_muscular} kg` : 'N/A'}</span>
            </div>
          </div>

          {/* Progress Photos */}
          <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Transformación</h4>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>Día 1 (Antes)</p>
              {atleta.foto_antes ? (
                <img 
                  src={atleta.foto_antes} 
                  alt="Antes" 
                  onClick={() => setZoomedImage(atleta.foto_antes)}
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                  <ImageIcon size={30} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, background: 'rgba(212, 175, 55, 0.05)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--accent-gold)', textAlign: 'center', fontWeight: 'bold' }}>Hoy (Después)</p>
              {atleta.foto_despues ? (
                <img 
                  src={atleta.foto_despues} 
                  alt="Después" 
                  onClick={() => setZoomedImage(atleta.foto_despues)}
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                  <ImageIcon size={30} />
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', marginTop: '20px' }}>
            Registrado: {formatDate(atleta.created_at)} • Último Ingreso: {formatDate(atleta.ultimo_ingreso)}
          </p>

        </div>

        {/* Footer Actions */}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)' }}>
          <button 
            onClick={() => {
              onClose();
              onOpenChat(atleta);
            }}
            style={{ 
              width: '100%', 
              padding: '15px', 
              borderRadius: '12px', 
              border: 'none', 
              background: 'linear-gradient(135deg, var(--accent-gold), #b38b22)', 
              color: 'black', 
              fontSize: '1rem', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
            }}
          >
            <MessageCircle size={20} /> Abrir Chat de Intervención
          </button>
        </div>

      </div>

      {/* ZOOM MODAL */}
      {zoomedImage && createPortal(
        <div 
          onClick={() => setZoomedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'zoom-out' }}
        >
          <img src={zoomedImage} alt="Zoomed" style={{ maxWidth: '95%', maxHeight: '90%', borderRadius: '16px', objectFit: 'contain' }} />
        </div>,
        document.body
      )}

    </div>,
    document.body
  );
}
