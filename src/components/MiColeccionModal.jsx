import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Check } from 'lucide-react';
import AvatarConMarco from './AvatarConMarco';

const BORDES = [
  { id: 'borde_fuego', nombre: 'Borde de Fuego' },
  { id: 'borde_plata', nombre: 'Borde de Plata' },
  { id: 'borde_dorado', nombre: 'Borde Dorado' },
];

const AURAS = [
  { id: 'aura_arcana', nombre: 'Aura Arcana' },
];

function Opcion({ seleccionado, disabled, onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        background: seleccionado ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
        border: seleccionado ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', padding: '12px 8px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1, position: 'relative'
      }}
    >
      {seleccionado && (
        <div style={{ position: 'absolute', top: '6px', right: '6px', color: 'var(--accent-gold)' }}>
          <Check size={16} />
        </div>
      )}
      {children}
      <span style={{ color: '#fff', fontSize: '0.75rem', textAlign: 'center' }}>{label}</span>
    </button>
  );
}

/**
 * Deja elegir, entre los bordes/auras que el usuario ya compró en La
 * Prueba, cuál tener puesto ahora mismo -- se puede cambiar cuantas
 * veces quiera, no queda fijo en el primero que compró. marco_activo y
 * aura_activa son cosméticos sin protección especial (igual que ya
 * documenta VETA_VIGOR_BLINDAJE_PERFILES.sql para marco_activo), así
 * que se escriben directo a perfiles, sin RPC.
 */
export default function MiColeccionModal({ session, inventario, marcoActivo, auraActiva, avatarUrl, onClose, onEquipar }) {
  const [guardando, setGuardando] = useState(false);

  const bordesPoseidos = BORDES.filter(b => inventario.includes(b.id));
  const aurasPoseidas = AURAS.filter(a => inventario.includes(a.id));

  const equipar = async (campo, valor) => {
    if (guardando) return;
    setGuardando(true);
    try {
      const { error } = await supabase.from('perfiles').update({ [campo]: valor }).eq('id', session.user.id);
      if (!error) onEquipar({ [campo]: valor });
    } catch (err) {
      console.error('Error equipando cosmético:', err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '30px',
        width: '100%', maxWidth: '450px', maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(212, 175, 55, 0.1)',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
        >
          <X size={22} />
        </button>

        <h2 className="gold-gradient-text" style={{ fontSize: '1.5rem', marginBottom: '25px', fontWeight: '900', textAlign: 'center' }}>
          Mi Colección
        </h2>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '15px' }}>Bordes</h3>
          {bordesPoseidos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Todavía no tenés ningún borde. Se consiguen en La Prueba (Cámara de la Forja).
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
              <Opcion seleccionado={!marcoActivo} disabled={guardando} onClick={() => equipar('marco_activo', null)} label="Ninguno">
                <AvatarConMarco src={avatarUrl} alt="Sin borde" size={55} marco="ninguno" />
              </Opcion>
              {bordesPoseidos.map(b => (
                <Opcion key={b.id} seleccionado={marcoActivo === b.id} disabled={guardando} onClick={() => equipar('marco_activo', b.id)} label={b.nombre}>
                  <AvatarConMarco src={avatarUrl} alt={b.nombre} size={55} marco={b.id} />
                </Opcion>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '15px' }}>Auras</h3>
          {aurasPoseidas.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Todavía no tenés ninguna aura. Se consiguen en La Prueba (Cámara de la Forja).
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
              <Opcion seleccionado={!auraActiva} disabled={guardando} onClick={() => equipar('aura_activa', null)} label="Ninguna">
                <AvatarConMarco src={avatarUrl} alt="Sin aura" size={55} aura="ninguna" />
              </Opcion>
              {aurasPoseidas.map(a => (
                <Opcion key={a.id} seleccionado={auraActiva === a.id} disabled={guardando} onClick={() => equipar('aura_activa', a.id)} label={a.nombre}>
                  <AvatarConMarco src={avatarUrl} alt={a.nombre} size={55} aura={a.id} />
                </Opcion>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
