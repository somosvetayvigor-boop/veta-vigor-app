import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { User, Clock, Calendar, X, MessageCircle, FolderOpen, Award, CheckCircle, Crown } from 'lucide-react';
import AdminChatModal from './AdminChatModal';
import AdminExpedienteModal from './AdminExpedienteModal';

export default function AdminAtletas({ session }) {
  const [atletas, setAtletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [chatAtleta, setChatAtleta] = useState(null);
  const [expedienteAtleta, setExpedienteAtleta] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('atletas'); // 'atletas' o 'muro'
  
  const [muroRegistros, setMuroRegistros] = useState([]);
  const [prospectos, setProspectos] = useState([]);

  useEffect(() => {
    fetchAtletas();
  }, []);

  const fetchAtletas = async () => {
    setLoading(true);
    // Asumimos que el usuario ya corrió el script SQL para agregar 'full_name', 'ultimo_ingreso' y 'created_at'
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('ultimo_ingreso', { ascending: false, nullsFirst: false });
      
    if (!error && data) {
      // Traer celulares de la tabla segura
      const { data: privadosData } = await supabase.from('datos_privados').select('user_id, whatsapp');
      
      const mergedAtletas = data.map(atleta => {
        const priv = privadosData?.find(p => p.user_id === atleta.id);
        return { ...atleta, whatsapp: priv?.whatsapp || null };
      });

      setAtletas(mergedAtletas);
      // Calcular prospectos (los que tienen más entrenamientos registrados en checkins, pero para simplificar tomamos los que han ingresado recientemente y no están en el muro este mes)
      const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const potenciales = mergedAtletas.filter(a => a.nivel !== 'RESET' && a.avatar_url).slice(0, 5); // Simplificación: top 5 activos con foto
      setProspectos(potenciales);
    }
    
    // Fetch muro de la fama
    const { data: muroData } = await supabase
      .from('muro_fama')
      .select('*, perfiles(full_name, username, avatar_url)')
      .order('created_at', { ascending: false });
    if (muroData) setMuroRegistros(muroData);

    setLoading(false);
  };

  const nominarMuro = async (atleta) => {
    if (!window.confirm(`¿Nominar a ${atleta.full_name || atleta.username} al Muro de la Fama? Se le enviará una notificación para que acepte.`)) return;
    try {
      const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const { error } = await supabase.from('muro_fama').insert([{
        user_id: atleta.id,
        mes_anio: mesActual,
        estado: 'pendiente'
      }]);
      if (error) throw error;
      alert('¡Nominación enviada con éxito!');
      fetchAtletas();
    } catch (e) {
      alert('Error al nominar: ' + e.message);
    }
  };

  const marcarPremioEntregado = async (muroId) => {
    try {
      const { error } = await supabase.from('muro_fama').update({ premio_entregado: true }).eq('id', muroId);
      if (error) throw error;
      alert('¡Premio marcado como entregado!');
      fetchAtletas();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const cambiarPlanAtleta = async (atletaId, nuevoPlan) => {
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ plan_membresia: nuevoPlan })
        .eq('id', atletaId);
      
      if (error) throw error;
      
      alert('¡Membresía actualizada con éxito!');
      fetchAtletas(); // Refrescar lista
    } catch (error) {
      console.error("Error al actualizar plan:", error);
      alert('Error al actualizar la membresía.');
    }
  };

  const toggleBloqueoChat = async (atletaId, estadoActual) => {
    const nuevoEstado = !estadoActual;
    const mensaje = nuevoEstado 
      ? '¿Estás seguro de bloquear el chat a este usuario? Ya no podrá entrar a la Comunidad VIP.'
      : '¿Desbloquear a este usuario? Recuperará su acceso a la Comunidad.';
      
    if (!window.confirm(mensaje)) return;

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ chat_bloqueado: nuevoEstado })
        .eq('id', atletaId);
      
      if (error) throw error;
      
      alert(nuevoEstado ? 'Usuario bloqueado (Cárcel Digital).' : 'Usuario perdonado.');
      fetchAtletas();
    } catch (error) {
      console.error("Error al bloquear:", error);
      alert('Error al aplicar el castigo.');
    }
  };

  const reiniciarAtleta = async (atletaId) => {
    if (!window.confirm('🚨 PELIGRO: ¿Estás seguro de reiniciar el perfil de este atleta? Perderá su nivel actual y se le obligará a hacer el Cuestionario Inicial la próxima vez que inicie sesión.')) return;

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ nivel: 'RESET', peso_inicial: null, foto_antes: null, foto_despues: null, fuerza_tren_superior: null, fuerza_tren_inferior: null })
        .eq('id', atletaId);
      
      if (error) throw error;
      
      alert('¡Perfil reiniciado con éxito! El usuario empezará desde cero al volver a entrar.');
      fetchAtletas();
    } catch (error) {
      console.error("Error al reiniciar:", error);
      alert('Error al reiniciar el perfil.');
    }
  };

  const lanzarPaywall = async (atletaId) => {
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ force_paywall: true })
        .eq('id', atletaId);
      
      if (error) throw error;
      
      alert('¡Paywall programado! El usuario lo verá la próxima vez que entre.');
      fetchAtletas();
    } catch (error) {
      console.error("Error al lanzar paywall:", error);
      alert('Error al lanzar paywall.');
    }
  };

  const lanzarPruebaPlatinum = async (atletaId) => {
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ force_platinum_trial: true })
        .eq('id', atletaId);
      
      if (error) throw error;
      
      alert('¡Prueba Platinum regalada! El usuario verá la oferta la próxima vez que entre.');
      fetchAtletas();
    } catch (error) {
      console.error("Error al regalar Platinum:", error);
      alert('Error al regalar prueba Platinum.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Desconocida';
    const d = new Date(dateString);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Nunca';
    const diffMs = new Date() - new Date(dateString);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 0) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return 'Hace un momento';
  };

  const getLevelIcon = (nivelName) => {
    if (!nivelName) return '/assets/niveles/semilla.png';
    const n = nivelName.toLowerCase();
    if (n.includes('semilla')) return '/assets/niveles/semilla.png';
    if (n.includes('pino')) return '/assets/niveles/pino.png';
    if (n.includes('tzalam')) return '/assets/niveles/tzalam.png';
    if (n.includes('roble')) return '/assets/niveles/roble.png';
    return '/assets/niveles/semilla.png';
  };

  if (loading) return <p>Cargando atletas...</p>;

  const filteredAtletas = atletas.filter(atleta => {
    const search = searchTerm.toLowerCase();
    return (
      (atleta.full_name && atleta.full_name.toLowerCase().includes(search)) ||
      (atleta.username && atleta.username.toLowerCase().includes(search)) ||
      (atleta.email && atleta.email.toLowerCase().includes(search))
    );
  });

  return (
    <div style={{ padding: '10px 0' }}>
      
      {/* TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('atletas')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'atletas' ? 'linear-gradient(135deg, var(--accent-gold), #b38b22)' : 'rgba(255,255,255,0.05)', color: activeTab === 'atletas' ? '#000' : '#888', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Atletas
        </button>
        <button 
          onClick={() => setActiveTab('muro')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'muro' ? 'linear-gradient(135deg, var(--accent-gold), #b38b22)' : 'rgba(255,255,255,0.05)', color: activeTab === 'muro' ? '#000' : '#888', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
        >
          <Award size={18}/> Muro Fama
        </button>
      </div>

      {activeTab === 'atletas' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Atletas Registrados ({filteredAtletas.length})</h2>
            <input 
              type="text" 
              placeholder="Buscar por nombre, usuario o email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
            />
          </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredAtletas.map(atleta => (
          <div key={atleta.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '15px', display: 'flex', gap: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
            
            {/* FOTO DE PERFIL */}
            <div 
              onClick={() => atleta.avatar_url && setZoomedImage(atleta.avatar_url)}
              style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: atleta.avatar_url ? 'pointer' : 'default' }}
            >
              {atleta.avatar_url ? (
                <img 
                  src={atleta.avatar_url} 
                  alt={atleta.username} 
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div style="color:#666;"><svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>'; }}
                />
              ) : (
                <User size={30} color="#666" />
              )}
            </div>

            {/* INFO DEL ATLETA */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                      {atleta.full_name || atleta.username || 'Atleta Sin Nombre'}
                    </h3>
                    {atleta.whatsapp && (
                      <a href={`https://wa.me/${atleta.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#25D366', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 'bold' }}>
                        <MessageCircle size={14} /> {atleta.whatsapp}
                      </a>
                    )}
                  </div>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#aaa' }}>{atleta.email || 'Correo oculto'}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{atleta.username || 'usuario'}</p>
                </div>
                <span 
                  onClick={() => setZoomedImage(getLevelIcon(atleta.nivel))}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <img src={getLevelIcon(atleta.nivel)} style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                  {atleta.nivel || 'Semilla'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#aaa' }}>
                  <Calendar size={14} /> Registro: {formatDate(atleta.created_at)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#aaa' }}>
                  <Clock size={14} /> Última vez: {formatTimeAgo(atleta.ultimo_ingreso)}
                </div>
              </div>

              {/* GESTOR DE PLANES VIP Y BLOQUEOS */}
              <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 'bold' }}>Membresía:</span>
                  <select 
                    value={atleta.plan_membresia || 'Atleta Base (Gratis)'} 
                    onChange={(e) => cambiarPlanAtleta(atleta.id, e.target.value)}
                    style={{
                      backgroundColor: 'rgba(212, 175, 55, 0.1)',
                      color: 'var(--accent-gold)',
                      border: '1px solid var(--accent-gold)',
                      borderRadius: '20px',
                      padding: '5px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Atleta Base (Gratis)">Atleta Base (Gratis)</option>
                    <option value="Socio Aurum">Socio Aurum (Pago Básico)</option>
                    <option value="Socio Argentum">Socio Argentum</option>
                    <option value="Plan Platinum">Plan Platinum (VIP)</option>
                    <option value="Socio Fundador Vitalicio">Fundador Vitalicio (Élite)</option>
                  </select>
                </div>

                {(!atleta.plan_membresia || atleta.plan_membresia === 'Atleta Base (Gratis)') && (
                  <div style={{ padding: '10px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* PAYWALL */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Estado Paywall:</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: atleta.force_paywall ? '#f1c40f' : (!atleta.last_paywall_shown_date || (new Date() - new Date(atleta.last_paywall_shown_date))/(1000*60*60*24) > 30 ? '#2ecc71' : '#e74c3c') }}>
                          {atleta.force_paywall ? 'Pendiente (Lo verá)' : (!atleta.last_paywall_shown_date ? 'Nunca mostrado' : `Hace ${Math.floor((new Date() - new Date(atleta.last_paywall_shown_date))/(1000*60*60*24))} días`)}
                        </span>
                      </div>
                      {!atleta.force_paywall && (
                        <button 
                          onClick={() => lanzarPaywall(atleta.id)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--accent-gold)', border: 'none', color: '#000', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          Lanzar Paywall Ahora
                        </button>
                      )}
                    </div>

                    {/* REGALO PLATINUM */}
                    <div style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Regalo Platinum:</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: atleta.force_platinum_trial ? '#f1c40f' : '#2ecc71' }}>
                          {atleta.force_platinum_trial ? 'Pendiente' : 'No enviado'}
                        </span>
                      </div>
                      {!atleta.force_platinum_trial && (
                        <button 
                          onClick={() => lanzarPruebaPlatinum(atleta.id)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'linear-gradient(135deg, #1abc9c, #16a085)', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                          <Crown size={14} /> Regalar 7 Días Platinum
                        </button>
                      )}
                    </div>

                  </div>
                )}

                <button 
                  onClick={() => toggleBloqueoChat(atleta.id, atleta.chat_bloqueado)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    border: atleta.chat_bloqueado ? '1px solid var(--accent-gold)' : '1px solid rgba(229, 80, 57, 0.3)', 
                    background: atleta.chat_bloqueado ? 'rgba(212, 175, 55, 0.1)' : 'rgba(229, 80, 57, 0.1)', 
                    color: atleta.chat_bloqueado ? 'var(--accent-gold)' : '#e55039', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  {atleta.chat_bloqueado ? '🔓 Desbloquear de la Comunidad' : '🚨 Bloquear de la Comunidad VIP'}
                </button>

                <button 
                  onClick={() => reiniciarAtleta(atleta.id)}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    background: 'transparent', 
                    color: '#888', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  🔄 Reiniciar Progreso del Usuario
                </button>

                <button 
                  onClick={() => setExpedienteAtleta(atleta)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--accent-gold)', 
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))', 
                    color: 'var(--accent-gold)', 
                    fontSize: '0.9rem', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '5px'
                  }}
                >
                  <FolderOpen size={18} /> Abrir Expediente Completo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      ) : (
      <>
        <h2 style={{ fontSize: '1.4rem', margin: '0 0 20px 0', color: 'var(--accent-gold)' }}>Prospectos a Muro de la Fama</h2>
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>Basado en actividad reciente de atletas con foto de perfil. Selecciona a uno para nominarlo.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
          {prospectos.map(atleta => (
            <div key={atleta.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <img src={atleta.avatar_url || '/assets/niveles/semilla.png'} alt="Avatar" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h4 style={{ margin: '0 0 3px 0', color: '#fff' }}>{atleta.full_name || atleta.username}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>Nivel: {atleta.nivel}</span>
                </div>
              </div>
              <button 
                onClick={() => nominarMuro(atleta)}
                style={{ background: 'linear-gradient(135deg, var(--accent-gold), #b38b22)', border: 'none', padding: '10px 15px', borderRadius: '8px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Nominar
              </button>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>Historial del Muro</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {muroRegistros.length === 0 && <p style={{ color: '#888' }}>No hay registros en el muro.</p>}
          {muroRegistros.map(reg => (
            <div key={reg.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#fff' }}>{reg.perfiles?.full_name || reg.perfiles?.username} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.8rem' }}>({reg.mes_anio})</span></h4>
                <span style={{ 
                  padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold',
                  background: reg.estado === 'publicado' ? 'rgba(46, 204, 113, 0.2)' : reg.estado === 'rechazado' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                  color: reg.estado === 'publicado' ? '#2ecc71' : reg.estado === 'rechazado' ? '#e74c3c' : '#f1c40f'
                }}>
                  {reg.estado.toUpperCase()}
                </span>
              </div>
              {reg.estado === 'publicado' && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Frase: "{reg.frase_motivadora}"</span>
                  {!reg.premio_entregado ? (
                    <button 
                      onClick={() => marcarPremioEntregado(reg.id)}
                      style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}
                    >
                      <CheckCircle size={14} /> Pagar Premio
                    </button>
                  ) : (
                    <span style={{ color: '#2ecc71', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle size={14} /> Pagado
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
      )}

      {/* ZOOM MODAL */}
      {zoomedImage && createPortal(
        <div 
          onClick={() => setZoomedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', cursor: 'zoom-out' }}
        >
          <button onClick={() => setZoomedImage(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
          <img src={zoomedImage} alt="Zoomed" style={{ maxWidth: '90%', maxHeight: '80%', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
        </div>,
        document.body
      )}

      {/* EXPEDIENTE MODAL */}
      {expedienteAtleta && (
        <AdminExpedienteModal 
          atleta={expedienteAtleta}
          onClose={() => setExpedienteAtleta(null)}
          onOpenChat={(atl) => setChatAtleta(atl)}
        />
      )}

      {/* CHAT MODAL */}
      {chatAtleta && (
        <AdminChatModal 
          atleta={chatAtleta} 
          adminSession={session} 
          onClose={() => setChatAtleta(null)} 
        />
      )}
    </div>
  );
}
