import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, UserPlus, ShieldOff, Users } from 'lucide-react';

export default function AdminEntrenadores() {
  const [entrenadores, setEntrenadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchEntrenadores();
  }, []);

  const fetchEntrenadores = async () => {
    setLoading(true);
    // Obtener perfiles que son entrenadores
    const { data: entrenadoresData, error } = await supabase
      .from('perfiles')
      .select('id, username, full_name, avatar_url, email, plan_membresia, force_paywall, last_paywall_shown_date')
      .eq('rol_usuario', 'entrenador');

    if (error) {
      console.error("Error fetching entrenadores:", error);
      setLoading(false);
      return;
    }

    // Para cada entrenador, obtener el conteo de alumnos
    const entrenadoresConAlumnos = await Promise.all(entrenadoresData.map(async (entrenador) => {
      const { count } = await supabase
        .from('relacion_entrenador_alumno')
        .select('*', { count: 'exact', head: true })
        .eq('entrenador_id', entrenador.id)
        .eq('estado', 'activo');
      return { ...entrenador, alumnosCount: count || 0 };
    }));

    setEntrenadores(entrenadoresConAlumnos);
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    
    // Buscar usuarios que NO sean entrenadores para promoverlos
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, username, full_name, email, rol_usuario')
      .ilike('email', `%${searchTerm}%`)
      .neq('rol_usuario', 'entrenador')
      .limit(5);
      
    if (!error && data) {
      setSearchResults(data);
    }
    setSearching(false);
  };

  const promoverAEntrenador = async (userId, email) => {
    if (!window.confirm(`¿Dar privilegios de Entrenador a ${email}? Tendrá su propio panel.`)) return;
    
    const { error } = await supabase.rpc('admin_set_rol', {
      p_user_id: userId,
      p_rol: 'entrenador'
    });

    if (!error) {
      alert("¡Usuario promovido a Entrenador exitosamente!");
      setSearchTerm('');
      setSearchResults([]);
      fetchEntrenadores();
    } else {
      alert("Error al promover: " + error.message);
    }
  };

  const updatePlan = async (entrenadorId, planName, nombre) => {
    if (!window.confirm(`¿Cambiar el plan de ${nombre || 'este entrenador'} a ${planName || 'Freemium'}?`)) return;
    
    const { error } = await supabase.rpc('admin_set_plan', {
      p_user_id: entrenadorId,
      p_plan: planName
    });

    if (!error) {
      alert(`Plan actualizado exitosamente.`);
      fetchEntrenadores();
    } else {
      alert("Error al cambiar de plan: " + error.message);
    }
  };

  const quitarPoderes = async (entrenadorId, nombre) => {
    if (!window.confirm(`¿Quitar rol de Entrenador a ${nombre}? Sus alumnos pasarán a inactivos automáticamente.`)) return;
    
    // 1. Quitar rol
    const { error: errorRol } = await supabase.rpc('admin_set_rol', {
      p_user_id: entrenadorId,
      p_rol: 'atleta_normal'
    });

    // 2. Desactivar a sus alumnos
    if (!errorRol) {
      await supabase
        .from('relacion_entrenador_alumno')
        .update({ estado: 'inactivo' })
        .eq('entrenador_id', entrenadorId);
        
      alert("¡Privilegios retirados!");
      fetchEntrenadores();
    } else {
      alert("Error: " + errorRol.message);
    }
  };

  const lanzarPaywall = async (entrenadorId) => {
    try {
      const { error } = await supabase.rpc('admin_enviar_paywall', {
        p_user_id: entrenadorId,
        p_activar: true
      });

      if (error) throw error;
      
      alert('¡Paywall programado! El usuario lo verá la próxima vez que entre.');
      fetchEntrenadores();
    } catch (error) {
      console.error("Error al lanzar paywall:", error);
      alert('Error al lanzar paywall.');
    }
  };

  const cancelarPaywall = async (entrenadorId) => {
    try {
      const { error } = await supabase.rpc('admin_enviar_paywall', {
        p_user_id: entrenadorId,
        p_activar: false
      });

      if (error) throw error;
      
      alert('Paywall cancelado. Ya no se le forzará a verlo.');
      fetchEntrenadores();
    } catch (error) {
      console.error("Error al cancelar paywall:", error);
      alert('Error al cancelar paywall.');
    }
  };

  return (
    <div className="admin-section" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <Users color="var(--accent-gold)" /> Gestión de Entrenadores
      </h2>
      
      {/* Buscador para agregar nuevo entrenador */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Agregar Nuevo Entrenador</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="email" 
            placeholder="Escribe el correo aquí..." 
            className="input-field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ margin: 0, width: '100%' }}
          />
          <button type="submit" className="btn-primary" disabled={searching} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
            <Search size={20} /> Buscar Usuario
          </button>
        </form>
        
        {searchResults.length > 0 && (
          <div style={{ marginTop: '15px', background: 'var(--bg-dark)', borderRadius: '8px', padding: '10px' }}>
            {searchResults.map(user => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <strong>{user.full_name || user.username || 'Sin nombre'}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email} - Rol actual: {user.rol_usuario}</div>
                </div>
                <button 
                  onClick={() => promoverAEntrenador(user.id, user.email)}
                  className="btn-primary" 
                  style={{ padding: '8px 15px', fontSize: '0.9rem', display: 'flex', gap: '5px' }}
                >
                  <UserPlus size={16} /> Promover a Entrenador
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Entrenadores */}
      <h3 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Entrenadores Activos ({entrenadores.length})</h3>
      {loading ? (
        <p>Cargando entrenadores...</p>
      ) : entrenadores.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No hay entrenadores en la plataforma todavía.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {entrenadores.map(coach => (
            <div key={coach.id} style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img 
                  src={coach.avatar_url || 'https://via.placeholder.com/50/111111/FFFFFF?text=V%26V'} 
                  alt="avatar" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/50/111111/FFFFFF?text=V%26V'; }}
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <h4 style={{ margin: 0 }}>{coach.full_name || coach.username || 'Entrenador'}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{coach.email}</p>
                </div>
              </div>
              
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', textAlign: 'center', marginTop: '10px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{coach.alumnosCount}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alumnos Activos</div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Plan Actual:</label>
                <select 
                  value={coach.plan_membresia || ''} 
                  onChange={(e) => updatePlan(coach.id, e.target.value, coach.full_name || coach.username)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <option value="">Freemium (2 alumnos)</option>
                  <option value="Entrenador Pro">Entrenador Pro (20 alumnos)</option>
                  <option value="Entrenador Élite">Entrenador Élite (100 alumnos)</option>
                </select>
              </div>

              {(!coach.plan_membresia || (!coach.plan_membresia.includes('Pro') && !coach.plan_membresia.includes('Élite'))) && (
                <div style={{ padding: '10px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.2)', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Estado Paywall:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: coach.force_paywall ? '#f1c40f' : (!coach.last_paywall_shown_date || (new Date() - new Date(coach.last_paywall_shown_date))/(1000*60*60*24) > 30 ? '#2ecc71' : '#e74c3c') }}>
                      {coach.force_paywall ? 'Pendiente (Lo verá)' : (!coach.last_paywall_shown_date ? 'Nunca mostrado' : `Hace ${Math.floor((new Date() - new Date(coach.last_paywall_shown_date))/(1000*60*60*24))} días`)}
                    </span>
                  </div>
                  {!coach.force_paywall ? (
                    <button 
                      onClick={() => lanzarPaywall(coach.id)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--accent-gold)', border: 'none', color: '#000', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Lanzar Paywall Ahora
                    </button>
                  ) : (
                    <button 
                      onClick={() => cancelarPaywall(coach.id)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Desactivar Paywall
                    </button>
                  )}
                </div>
              )}

              <button 
                onClick={() => quitarPoderes(coach.id, coach.full_name || coach.username)}
                className="btn-secondary" 
                style={{ marginTop: '10px', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)', display: 'flex', justifyContent: 'center', gap: '8px' }}
              >
                <ShieldOff size={18} /> Quitar Privilegios
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
