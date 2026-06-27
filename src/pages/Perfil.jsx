import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import LegalModals from '../components/LegalModals';
import { User, LogOut, Settings, X, Camera, Edit2, Upload, Activity, Flame, Bell, Calendar } from 'lucide-react';

export default function Perfil({ session }) {
  const navigate = useNavigate();
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const [zoomedImage, setZoomedImage] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // 'privacy' or 'terms'
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);
  
  const [editNameModal, setEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  
  const [adminPinModal, setAdminPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  
  const [meta, setMeta] = useState(session?.user?.user_metadata || {});
  const [checkinHoy, setCheckinHoy] = useState(null);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setIsUpdatingName(true);
    try {
      const updates = { 
        nombre_completo: newName, 
        username: newUsername 
      };
      
      const { data, error } = await supabase.auth.updateUser({ data: updates });
      if (error) throw error;
      
      await supabase.from('perfiles').update({
        nombre_completo: newName,
        username: newUsername
      }).eq('id', session.user.id);
      
      if (data?.user) setMeta(data.user.user_metadata);
      setEditNameModal(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsUpdatingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('¡Tu contraseña se ha cambiado correctamente!');
      setChangePasswordModal(false);
      setNewPassword('');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUpdatingPw(false);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPin === '2805') {
      setAdminPinModal(false);
      setAdminPin('');
      navigate('/admin');
    } else {
      alert('PIN Incorrecto');
      setAdminPin('');
    }
  };

  React.useEffect(() => {
    const fetchUser = async () => {
      // 1. Intentar leer de caché inmediatamente
      const cachedMeta = localStorage.getItem('veta_vigor_perfil_meta');
      if (cachedMeta) setMeta(JSON.parse(cachedMeta));

      if (navigator.onLine) {
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user;
        if (user) {
          // Obtener los datos más recientes desde la tabla perfiles
          const { data: perfilData } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle();
          
          const combinedMeta = { 
            ...user.user_metadata, 
            ...perfilData, 
            suscripcion: perfilData?.plan_membresia || user.user_metadata.suscripcion 
          };
          
          setMeta(combinedMeta);
          localStorage.setItem('veta_vigor_perfil_meta', JSON.stringify(combinedMeta));
        }
      }

      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      const { data: checkinData } = await supabase
        .from('checkins')
        .select('nivel')
        .eq('user_id', session.user.id)
        .eq('fecha', todayStr)
        .maybeSingle();
        
      if (checkinData) setCheckinHoy(checkinData.nivel);
    };
    fetchUser();
  }, [session.user.id]);
  
  const [formMetrics, setFormMetrics] = useState({
    peso_inicial: meta.peso_inicial || '',
    peso: meta.peso || '',
    porcentaje_grasa: meta.porcentaje_grasa || '',
    masa_muscular: meta.masa_muscular || ''
  });
  const nivel = meta.nivel || 'Desconocido';
  const nombreReal = meta.nombre_completo || meta.nombre || session?.user?.email;
  const displayName = meta.display_preference === 'username' && meta.username 
    ? `@${meta.username}` 
    : nombreReal;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveMetrics = async () => {
    try {
      if (!navigator.onLine) {
        const { addToOfflineQueue } = await import('../utils/OfflineManager');
        addToOfflineQueue('UPDATE_AUTH_META', formMetrics);
        addToOfflineQueue('UPDATE_PERFIL', { userId: session.user.id, data: formMetrics });
        setMeta({ ...meta, ...formMetrics });
        setEditModal(false);
        alert('Sin conexión: Métricas guardadas localmente. Se sincronizarán automáticamente.');
        return;
      }

      const { data } = await supabase.auth.updateUser({ data: formMetrics });
      if (data?.user) setMeta(data.user.user_metadata);
      await supabase.from('perfiles').update(formMetrics).eq('id', session.user.id);
      setEditModal(false);
    } catch (e) {
      console.error(e);
      alert("Error al guardar métricas");
    }
  };

  const handleSelfReset = async () => {
    if (!window.confirm('🚨 ADVERTENCIA IRREVERSIBLE: ¿Estás completamente seguro? Perderás tu nivel asignado, tus récords actuales de fuerza, tus fotos de progreso y tu historial. Tendrás que volver a hacer el cuestionario inicial. Esta acción no se puede deshacer.')) return;
    try {
      // 1. Borrar metadata local de auth para forzar el cuestionario
      await supabase.auth.updateUser({ data: { cuestionario_complete: false, expediente_completado: false } });
      
      // 2. Borrar datos en la base de datos para este usuario
      await supabase.from('perfiles').update({ 
        nivel: 'Semilla', 
        peso_inicial: null, 
        foto_antes: null, 
        foto_despues: null, 
        fuerza_tren_superior: null, 
        fuerza_tren_inferior: null 
      }).eq('id', session.user.id);
      
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Hubo un error al intentar reiniciar tu perfil.");
    }
  };

  const uploadPhoto = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(type);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}_${type}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fotos_progreso')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('fotos_progreso').getPublicUrl(fileName);
      
      let key = '';
      if (type === 'antes') key = 'foto_antes';
      else if (type === 'despues') key = 'foto_despues';
      else if (type === 'avatar') key = 'avatar_url';

      const { data: userData } = await supabase.auth.updateUser({ data: { [key]: data.publicUrl } });
      if (userData?.user) setMeta(userData.user.user_metadata);

      // Sincronizar también con la tabla de perfiles para el Panel de Creador
      await supabase.from('perfiles').update({ [key]: data.publicUrl }).eq('id', session.user.id);

    } catch (error) {
      console.error(error);
      alert('Asegúrate de haber creado el bucket "fotos_progreso" público en Supabase. Error: ' + error.message);
    } finally {
      setIsUploading(false);
    }
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

  const suscripcion = meta.suscripcion || 'Fundador';
  const displaySuscripcion = suscripcion
    .replace(/Socio Fundador Vitalicio/i, 'Vitalicio')
    .replace(/Plan /i, '')
    .replace(/Socio /i, '');

  const hasPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(suscripcion);
  const isFreeUser = !isAdmin && !hasPaidPlan;

  const getSubIcon = (subName) => {
    const s = subName.toLowerCase();
    if (s.includes('argentum')) return '/assets/suscripciones/argentum.png';
    if (s.includes('aurum')) return '/assets/suscripciones/aurum.png';
    if (s.includes('platinum')) return '/assets/suscripciones/platinum.png';
    return '/assets/suscripciones/fundador.png';
  };

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '20px', marginTop: '20px' }}>Tu Perfil</h1>
      
      <div className="card" style={{ padding: '30px 20px', textAlign: 'center', marginBottom: '20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '20px', marginBottom: '15px' }}>
          
          {/* Insignia de Suscripción */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
            <div 
              onClick={() => setZoomedImage(getSubIcon(suscripcion))}
              style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.1)', background: '#111', cursor: 'pointer' }}
            >
              <img src={getSubIcon(suscripcion)} alt="Suscripción" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', lineHeight: '1.2' }}>{displaySuscripcion}</span>
          </div>

          {/* Foto de Perfil Central */}
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => (meta.avatar_url && !imgError) && setZoomedImage(meta.avatar_url)}
              style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '2.5rem', fontWeight: 'bold', overflow: 'hidden', border: '3px solid var(--accent-gold)', boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)', cursor: meta.avatar_url ? 'pointer' : 'default' }}
            >
              {(meta.avatar_url && !imgError) ? <img src={meta.avatar_url} referrerPolicy="no-referrer" onError={() => setImgError(true)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : nombreReal[0].toUpperCase()}
            </div>
            
            <label style={{
              position: 'absolute', bottom: '-5px', right: '-5px', background: 'var(--bg-card)', color: '#fff',
              width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}>
              {isUploading === 'avatar' ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '12px' }}></i> : <Camera size={14} />}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadPhoto(e, 'avatar')} disabled={isUploading} />
            </label>
          </div>

          {/* Insignia de Nivel */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
            <div 
              onClick={() => setZoomedImage(getLevelIcon(nivel))}
              style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.1)', background: '#111', cursor: 'pointer' }}
            >
              <img src={getLevelIcon(nivel)} alt={nivel} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', lineHeight: '1.2' }}>{nivel}</span>
          </div>

        </div>

        <div 
          onClick={() => {
            setNewName(nombreReal);
            setNewUsername(meta.username || '');
            setEditNameModal(true);
          }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative', marginTop: '15px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: '0', fontSize: '1.5rem' }}>{nombreReal}</h2>
            <Edit2 size={16} color="var(--text-muted)" />
          </div>
          {meta.username && (
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '5px 0 0 0' }}>@{meta.username}</p>
          )}
          <p style={{ color: '#666', fontSize: '0.75rem', margin: '5px 0 0 0', letterSpacing: '0.3px' }}>{session?.user?.email}</p>
        </div>

        {/* Tarjeta de Disposición de Hoy */}
        {!isFreeUser && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            {checkinHoy !== null ? (() => {
              let label = ""; let desc = ""; let color = ""; let icon = "";
              if (checkinHoy === 5) { label = "Excelente"; desc = "Energía al máximo. Listo para récords."; color = "#c5a059"; icon = "🔥"; }
              else if (checkinHoy === 4) { label = "Bien"; desc = "Motivado y buena energía."; color = "#78e08f"; icon = "🔋"; }
              else if (checkinHoy === 3) { label = "Normal"; desc = "Sensaciones promedio."; color = "#f6b93b"; icon = "⚖️"; }
              else if (checkinHoy === 2) { label = "Cansado"; desc = "Poca energía o sueño atrasado."; color = "#fa983a"; icon = "🥱"; }
              else if (checkinHoy === 1) { label = "Agotado / Dolor"; desc = "Necesito recuperación."; color = "#e55039"; icon = "🤕"; }
              
              return (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '12px 15px',
                  position: 'relative', overflow: 'hidden',
                  borderLeft: `4px solid ${color}`,
                  width: '100%', maxWidth: '350px'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', width: '30px', textAlign: 'left', marginLeft: '5px' }}>
                    {checkinHoy}
                  </div>
                  <div style={{ fontSize: '1.8rem', marginRight: '15px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    {icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{label}</span>
                    <span style={{ fontSize: '0.75rem', color: '#888', textAlign: 'left' }}>{desc}</span>
                  </div>
                </div>
              );
            })() : (
               <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                  <span>Aún no entrenas hoy</span>
               </div>
            )}
          </div>
        )}

      </div>

      {/* Récords de Fuerza */}
      {!isFreeUser && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-gold)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-trophy"></i> Récords de Fuerza Máxima
          </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Tren Superior</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff' }}>
              {meta.fuerza_tren_superior ? `${meta.fuerza_tren_superior} ` : '-- '}
              <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 'normal' }}>kg</span>
            </div>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Tren Inferior</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff' }}>
              {meta.fuerza_tren_inferior ? `${meta.fuerza_tren_inferior} ` : '-- '}
              <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 'normal' }}>kg</span>
            </div>
          </div>
        </div>
          <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '15px', textAlign: 'center', fontStyle: 'italic' }}>Tus récords se actualizan automáticamente al usar la Calculadora de 1RM durante tus rutinas.</p>
        </div>
      )}

      {/* MÉTRICAS CORPORALES */}
      {!isFreeUser && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} /> Composición Corporal
            </h3>
            <button onClick={() => setEditModal(true)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Edit2 size={14} /> Editar
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Peso Inicial</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{meta.peso_inicial || '-- '} <span style={{fontSize: '0.8rem', color: '#888'}}>kg</span></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Peso Actual</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{meta.peso || '-- '} <span style={{fontSize: '0.8rem', color: '#888'}}>kg</span></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Grasa Corporal</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e55039' }}>{meta.porcentaje_grasa || '-- '} <span style={{fontSize: '0.8rem', color: '#888'}}>%</span></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Masa Muscular</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#78e08f' }}>{meta.masa_muscular || '-- '} <span style={{fontSize: '0.8rem', color: '#888'}}>kg</span></div>
            </div>
          </div>
          <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '15px', textAlign: 'center', fontStyle: 'italic' }}>Usa la Calculadora de Composición en el Centro de Desarrollo para actualizar Grasa y Masa automáticamente.</p>
        </div>
      )}

      {/* FOTOS DE PROGRESO */}
      {!isFreeUser && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-gold)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} /> Transformación Visual
          </h3>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            
            {/* FOTO ANTES */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem', fontWeight: 'bold' }}>ANTES</div>
              <div style={{ 
                aspectRatio: '3/4', backgroundColor: '#111', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
              }}>
                {meta.foto_antes ? (
                  <img src={meta.foto_antes} onClick={() => setZoomedImage(meta.foto_antes)} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                ) : (
                  <div style={{ color: '#555', textAlign: 'center' }}>
                    <User size={40} style={{ opacity: 0.3, marginBottom: '5px' }} />
                  </div>
                )}
                <label style={{
                  position: 'absolute', bottom: '10px', right: '10px', background: 'var(--accent-gold)', color: '#000',
                  width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                }}>
                  {isUploading === 'antes' ? <i className="fa-solid fa-spinner fa-spin"></i> : <Upload size={18} />}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadPhoto(e, 'antes')} disabled={isUploading} />
                </label>
              </div>
            </div>

            {/* FOTO DESPUÉS */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 'bold' }}>DESPUÉS</div>
              <div style={{ 
                aspectRatio: '3/4', backgroundColor: '#111', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
              }}>
                {meta.foto_despues ? (
                  <img src={meta.foto_despues} onClick={() => setZoomedImage(meta.foto_despues)} alt="Después" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                ) : (
                  <div style={{ color: '#555', textAlign: 'center' }}>
                    <Flame size={40} style={{ opacity: 0.3, marginBottom: '5px' }} />
                  </div>
                )}
                <label style={{
                  position: 'absolute', bottom: '10px', right: '10px', background: 'var(--accent-gold)', color: '#000',
                  width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                }}>
                  {isUploading === 'despues' ? <i className="fa-solid fa-spinner fa-spin"></i> : <Upload size={18} />}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadPhoto(e, 'despues')} disabled={isUploading} />
                </label>
              </div>
            </div>

          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {isFreeUser && (
          <button 
            onClick={() => navigate('/premium')}
            style={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)', 
              color: 'black', 
              padding: '15px', 
              borderRadius: '12px', 
              border: 'none', 
              fontWeight: '900', 
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 5px 15px rgba(212, 175, 55, 0.4)'
            }}
          >
            <i className="fa-solid fa-crown"></i> ¡Hazte Premium Hoy!
          </button>
        )}

        <button 
          onClick={() => navigate('/historial')}
          className="btn-primary"
          style={{ 
            padding: '15px', 
            borderRadius: '12px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '1.1rem'
          }}
        >
          <Calendar size={20} /> Mi Historial
        </button>
        
        {isAdmin && (
          <button 
            onClick={() => setAdminPinModal(true)}
            style={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)', 
              color: 'black', 
              padding: '15px', 
              borderRadius: '8px', 
              border: 'none', 
              fontWeight: 'bold', 
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <Settings size={20} /> Entrar al Panel de Creador
          </button>
        )}

        {(meta.es_vitalicio || meta.suscripcion === 'Socio Fundador Vitalicio' || isAdmin) && (
          <button 
            onClick={() => navigate('/ganancias')}
            style={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)', 
              color: 'black', 
              padding: '15px', 
              borderRadius: '12px', 
              border: 'none', 
              fontWeight: 'bold', 
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 5px 15px rgba(212, 175, 55, 0.3)'
            }}
          >
            Mis Ganancias 💰
          </button>
        )}

        {!isFreeUser && (
          <div className="card" style={{ marginTop: '20px', textAlign: 'center', padding: '20px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '15px' }}>Preferencias y Ajustes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  if (!('Notification' in window)) {
                    alert("Tu navegador no soporta notificaciones.");
                    return;
                  }
                  Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                      alert("¡Sincronizando con la nube de OneSignal...");
                      if (window.OneSignalDeferred) {
                        window.OneSignalDeferred.push(function(OneSignal) {
                          OneSignal.User.PushSubscription.optIn();
                        });
                      }
                    } else {
                      alert("Las notificaciones están bloqueadas. Toca el icono de 'Candado' junto a la dirección web en tu navegador y selecciona 'Permitir Notificaciones'.");
                    }
                  });
                }}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <Bell size={20} />
                Activar Notificaciones
              </button>
              
              <button 
                onClick={() => setChangePasswordModal(true)} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  color: '#fff', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <i className="fa-solid fa-key"></i> Cambiar Contraseña
              </button>
  
              <button 
                onClick={handleSelfReset} 
                style={{ 
                  background: 'rgba(229, 80, 57, 0.1)', 
                  border: '1px solid rgba(229, 80, 57, 0.3)', 
                  color: '#e55039', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <i className="fa-solid fa-rotate-left"></i> Recalcular mi Nivel
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: '20px', textAlign: 'center', padding: '20px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '15px' }}>Soporte y Legal</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a 
              href="mailto:somos.vetayvigor@gmail.com"
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                color: '#fff', 
                padding: '12px', 
                borderRadius: '12px', 
                fontWeight: 'bold', 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <i className="fa-regular fa-envelope"></i> Contactar a Soporte
            </a>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setLegalModal('privacy')}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#888', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Aviso de Privacidad
              </button>
              <button 
                onClick={() => setLegalModal('terms')}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#888', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Términos y Condiciones
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px' }}
        >
          <LogOut size={20} /> Cerrar Sesión
        </button>

        <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px', color: '#555', fontSize: '0.75rem' }}>
          <p>© {new Date().getFullYear()} Veta & Vigor. Todos los derechos reservados.</p>
        </div>
      </div>
      
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

      {/* EDIT MODAL */}
      {editModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
          justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
        }}>
          <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '350px', position: 'relative' }}>
            <button onClick={() => setEditModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '20px' }}>Actualizar Métricas</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ color: '#888', fontSize: '0.85rem' }}>Peso Inicial (kg)</label>
                <input type="number" value={formMetrics.peso_inicial} onChange={e => setFormMetrics({...formMetrics, peso_inicial: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} />
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.85rem' }}>Peso Actual (kg)</label>
                <input type="number" value={formMetrics.peso} onChange={e => setFormMetrics({...formMetrics, peso: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.85rem' }}>Grasa (%)</label>
                  <input type="number" value={formMetrics.porcentaje_grasa} onChange={e => setFormMetrics({...formMetrics, porcentaje_grasa: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.85rem' }}>Masa Muscular (kg)</label>
                  <input type="number" value={formMetrics.masa_muscular} onChange={e => setFormMetrics({...formMetrics, masa_muscular: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} />
                </div>
              </div>
              <button onClick={handleSaveMetrics} className="btn-primary" style={{ marginTop: '10px', padding: '15px', fontWeight: 'bold' }}>Guardar Cambios</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CAMBIAR CONTRASEÑA MODAL */}
      {changePasswordModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
          justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
        }}>
          <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '350px', position: 'relative' }}>
            <button onClick={() => setChangePasswordModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '20px' }}>Cambiar Contraseña</h3>
            
            <form onSubmit={handleChangePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ color: '#888', fontSize: '0.85rem' }}>Nueva Contraseña</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} 
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" disabled={isUpdatingPw} className="btn-primary" style={{ marginTop: '10px', padding: '15px', fontWeight: 'bold', opacity: isUpdatingPw ? 0.5 : 1 }}>
                  {isUpdatingPw ? 'Guardando...' : 'Guardar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ADMIN PIN MODAL */}
      {adminPinModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
          justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
        }}>
          <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '350px', position: 'relative' }}>
            <button onClick={() => setAdminPinModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '20px' }}>Seguridad del Panel</h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '15px' }}>Ingresa el PIN de seguridad para acceder al Panel de Creador.</p>
            
            <form onSubmit={handleAdminLogin}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <input 
                    type="password" 
                    placeholder="****"
                    value={adminPin} 
                    onChange={e => setAdminPin(e.target.value)} 
                    style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '5px' }} 
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '15px', fontWeight: 'bold' }}>
                  Verificar PIN
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDITAR NOMBRE MODAL */}
      {editNameModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
          justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
        }}>
          <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '350px', position: 'relative' }}>
            <button onClick={() => setEditNameModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '20px' }}>Editar Perfil</h3>
            
            <form onSubmit={handleUpdateName}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ color: '#888', fontSize: '0.85rem' }}>Nombre Completo</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} 
                    required
                  />
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: '0.85rem' }}>Nombre de Usuario (Username)</label>
                  <input 
                    type="text" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', marginTop: '5px' }} 
                  />
                </div>
                <button type="submit" disabled={isUpdatingName} className="btn-primary" style={{ marginTop: '10px', padding: '15px', fontWeight: 'bold', opacity: isUpdatingName ? 0.5 : 1 }}>
                  {isUpdatingName ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* LEGAL MODAL */}
      <LegalModals type={legalModal} onClose={() => setLegalModal(null)} />

    </div>
  );
}
