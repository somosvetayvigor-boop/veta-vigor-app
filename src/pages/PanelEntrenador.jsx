import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Plus, ChevronRight, CheckCircle, XCircle, TrendingUp, Calendar, FileText, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PanelEntrenador({ session }) {
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [precioMensual, setPrecioMensual] = useState(session?.user?.user_metadata?.precio_por_alumno || '');
  const [alumnosInfo, setAlumnosInfo] = useState(session?.user?.user_metadata?.alumnos_info || {});
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [activeTabAlumno, setActiveTabAlumno] = useState({});

  const navigate = useNavigate();

  const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia || '';
  
  let planLimit = 2; // Plan Base Freemium
  if (suscripcion.includes('Entrenador Pro')) planLimit = 20;
  if (suscripcion.includes('Entrenador Élite')) planLimit = 100;
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAlumnos, setSelectedAlumnos] = useState([]);
  const isElite = planLimit === 100;
  const activeCount = alumnos.filter(a => a.estado === 'activo').length;
  
  useEffect(() => {
    fetchAlumnos();
  }, [session?.user?.id]);

  const fetchAlumnos = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    
    try {
      // 1. Obtener relaciones (select * para máxima compatibilidad)
      const { data: relaciones, error: relError } = await supabase
        .from('relacion_entrenador_alumno')
        .select('*')
        .eq('entrenador_id', session.user.id);

      console.log('Relaciones encontradas:', relaciones?.length, 'Error:', relError);

      if (relError || !relaciones) {
        console.error("Error fetching relaciones:", relError);
        setLoading(false);
        return;
      }

      // 2. Obtener perfiles de esos alumnos por separado
      const alumnoIds = relaciones.map(r => r.alumno_id).filter(Boolean);
      let perfilesMap = {};
      
      if (alumnoIds.length > 0) {
        const { data: perfilesData } = await supabase
          .from('perfiles')
          .select('id, full_name, email, avatar_url, nivel')
          .in('id', alumnoIds);
        
        if (perfilesData) {
          perfilesData.forEach(p => { perfilesMap[p.id] = p; });
        }
      }

      // 3. Buscar métricas de actividad
      const activeStudentIds = relaciones.filter(r => r.estado === 'activo').map(r => r.alumno_id);
      let ultimasRutinas = {};
      let rutinasMensuales = {};
      
      if (activeStudentIds.length > 0) {
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

        const { data: historialData } = await supabase
          .from('historial_rutinas')
          .select('user_id, created_at')
          .in('user_id', activeStudentIds)
          .eq('completado', true);
          
        if (historialData) {
          historialData.forEach(h => {
            const hDate = new Date(h.created_at);
            if (!ultimasRutinas[h.user_id] || hDate > new Date(ultimasRutinas[h.user_id])) {
              ultimasRutinas[h.user_id] = h.created_at;
            }
            if (hDate >= treintaDiasAtras) {
              rutinasMensuales[h.user_id] = (rutinasMensuales[h.user_id] || 0) + 1;
            }
          });
        }
      }
      
      // 4. Combinar todo
      const alumnosCompletos = relaciones.map(rel => {
        let diasInactivo = 0;
        let completadosMes = rutinasMensuales[rel.alumno_id] || 0;
        if (rel.estado === 'activo') {
          const ultimaR = ultimasRutinas[rel.alumno_id];
          if (ultimaR) {
            const diffTime = Math.abs(new Date() - new Date(ultimaR));
            diasInactivo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } else {
            const diffTime = Math.abs(new Date() - new Date(rel.fecha_vinculacion));
            diasInactivo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
        return { 
          ...rel, 
          perfiles: perfilesMap[rel.alumno_id] || null,
          diasInactivo, 
          completadosMes, 
          ultimaRutina: ultimasRutinas[rel.alumno_id] 
        };
      });
      
      setAlumnos(alumnosCompletos);
    } catch (err) {
      console.error("Error general fetchAlumnos:", err);
    }
    setLoading(false);
  };

  const guardarPrecio = async () => {
    setGuardandoPrecio(true);
    await supabase.auth.updateUser({ data: { precio_por_alumno: precioMensual } });
    setGuardandoPrecio(false);
    alert('Precio mensual actualizado.');
  };

  const updateAlumnoInfo = async (alumnoId, field, value) => {
    const newInfo = { ...alumnosInfo };
    if (!newInfo[alumnoId]) newInfo[alumnoId] = {};
    newInfo[alumnoId][field] = value;
    setAlumnosInfo(newInfo);
    
    // Guardar en metadatos para que el coach lo recupere después
    await supabase.auth.updateUser({ data: { alumnos_info: newInfo } });
  };

  const eliminarDefinitivamente = async (relacionId) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro permanentemente de tu lista?")) return;
    await supabase.from('relacion_entrenador_alumno').delete().eq('id', relacionId);
    fetchAlumnos();
  };

  const handleExportCSV = () => {
    if (!isElite) {
      alert('Esta es una función exclusiva del plan Élite.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nombre,Email,Estado,Dias Inactivo,Rutinas Mes,Precio Mensual\n";
    alumnos.forEach(rel => {
      const nombre = rel.perfiles?.full_name || 'Alumno';
      const email = rel.perfiles?.email || 'N/A';
      const estado = rel.estado;
      const dias = rel.diasInactivo;
      const rutinas = rel.completadosMes;
      const precio = alumnosInfo[rel.alumno_id]?.precio || 0;
      csvContent += `${nombre},${email},${estado},${dias},${rutinas},${precio}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mis_alumnos_veta_vigor.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const agregarAlumno = async (e) => {
    e.preventDefault();
    if (!nuevoCorreo.trim()) return;
    
    // Validar limites del plan
    if (activeCount >= planLimit) {
      alert(`Has alcanzado el límite de ${planLimit} alumnos de tu plan actual. Para agregar más, mejora tu plan en la pantalla de Suscripción para Entrenadores.`);
      navigate('/paywall-coach');
      return;
    }
    
    setAgregando(true);

    // 1. Buscar si existe el perfil con ese correo
    const targetEmail = nuevoCorreo.trim().toLowerCase();
    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, rol_usuario')
      .eq('email', targetEmail)
      .maybeSingle();

    if (!perfilData) {
      const { error: inviteError } = await supabase.from('invitaciones_entrenador').insert({
        entrenador_id: session.user.id,
        email_alumno: targetEmail
      });
      if (inviteError) {
        alert("Error al guardar la invitación.");
      } else {
        alert("El alumno aún no tiene cuenta. La invitación está en espera. Cuando descargue la app y se registre con este correo (" + targetEmail + "), se vinculará automáticamente.");
        setNuevoCorreo('');
      }
      setAgregando(false);
      return;
    }

    if (perfilData.rol_usuario === 'entrenador') {
      alert("No puedes agregar a otro entrenador como tu alumno.");
      setAgregando(false);
      return;
    }

    // 2. Verificar si ya es alumno tuyo
    const { data: relacionExistente } = await supabase
      .from('relacion_entrenador_alumno')
      .select('id, estado')
      .eq('entrenador_id', session.user.id)
      .eq('alumno_id', perfilData.id)
      .maybeSingle();

    if (relacionExistente) {
      if (relacionExistente.estado === 'inactivo') {
        // Reactivarlo como pendiente para que el alumno deba aceptar
        await supabase
          .from('relacion_entrenador_alumno')
          .update({ estado: 'pendiente' })
          .eq('id', relacionExistente.id);
        
        alert("¡Solicitud de reactivación enviada! El alumno recibirá una notificación en su app para aceptar la vinculación de nuevo.");
        setNuevoCorreo('');
        fetchAlumnos();
      } else if (relacionExistente.estado === 'pendiente') {
        alert("Ya le habías enviado una solicitud a este alumno. Está pendiente de que él la acepte.");
      } else {
        alert("Este usuario ya es tu alumno activo.");
      }
      setAgregando(false);
      return;
    }

    // 3. Crear nueva vinculación
    const { error: insertError } = await supabase
      .from('relacion_entrenador_alumno')
      .insert([{
        entrenador_id: session.user.id,
        alumno_id: perfilData.id,
        estado: 'pendiente'
      }]);

    if (!insertError) {
      alert("¡Solicitud enviada! El alumno recibirá una notificación en su app para aceptar la vinculación.");
      setNuevoCorreo('');
      fetchAlumnos();
    } else {
      alert("Error al vincular: " + insertError.message);
    }
    
    setAgregando(false);
  };

  const cambiarEstado = async (relacionId, alumnoId, nuevoEstado) => {
    // Si están reactivando, el estado debe ser 'pendiente' para que el alumno acepte
    const estadoFinal = nuevoEstado === 'activo' ? 'pendiente' : nuevoEstado;
    
    const confirmMsg = estadoFinal === 'inactivo' 
      ? "¿Dar de baja a este alumno? Perderá acceso a tus rutinas y se le ofrecerá suscribirse a la app completa."
      : "Se enviará una solicitud al alumno para que acepte la reactivación en su app. ¿Continuar?";
      
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase
      .from('relacion_entrenador_alumno')
      .update({ estado: estadoFinal })
      .eq('id', relacionId);

    if (!error) {
      if (estadoFinal === 'inactivo') {
         // Al dar de baja, se quita el rol de alumno_entrenador
         // (Aunque el propio alumno se autogestionará en su App.jsx, es buena práctica hacerlo)
         await supabase.from('perfiles').update({ rol_usuario: 'atleta_normal' }).eq('id', alumnoId);
      }
      // Si es 'pendiente', NO cambiamos el rol. El rol cambiará cuando el alumno acepte.
      fetchAlumnos();
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '90px', paddingTop: '20px' }}>
      <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '5px' }}>Mis Alumnos</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
        Gestiona tus clientes y observa tus analíticas.
      </p>

      {/* Analíticas de Ganancias - Solo resumen */}
      <div style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)', padding: '15px', borderRadius: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}><TrendingUp size={14} style={{ verticalAlign: 'middle' }} /> Activos</p>
            <h2 style={{ margin: '5px 0 0 0', fontSize: '1.4rem' }}>{alumnos.filter(a => a.estado === 'activo').length}</h2>
          </div>
          <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}><i className="fa-solid fa-coins" style={{ fontSize: '12px' }}></i> Ganancia/mes</p>
            <h2 style={{ margin: '5px 0 0 0', fontSize: '1.4rem', color: 'var(--accent-gold)' }}>
              ${alumnos.filter(a => a.estado === 'activo').reduce((sum, a) => sum + (parseFloat(alumnosInfo[a.alumno_id]?.precio) || 0), 0).toLocaleString()}
            </h2>
          </div>
        </div>
      </div>

      {!suscripcion.includes('Entrenador Pro') && !suscripcion.includes('Entrenador Élite') && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Alumnos (Plan Freemium)</span>
            <span style={{ fontSize: '0.9rem', color: activeCount >= planLimit ? '#e55039' : 'var(--accent-gold)', fontWeight: 'bold' }}>{activeCount} / {planLimit}</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(activeCount / planLimit) * 100}%`, height: '100%', background: activeCount >= planLimit ? '#e55039' : 'var(--accent-gold)' }}></div>
          </div>
          {activeCount >= planLimit && (
            <button onClick={() => navigate('/paywall-coach')} style={{ background: 'var(--accent-gold)', color: 'black', border: 'none', padding: '8px', width: '100%', borderRadius: '8px', marginTop: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              Mejorar Plan
            </button>
          )}
        </div>
      )}

      {/* Formulario Agregar Alumno */}
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', marginBottom: '30px', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Ganancias Estimadas (Mes)</h3>
          <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>${alumnos.filter(a => a.estado === 'activo').reduce((sum, a) => sum + (parseFloat(alumnosInfo[a.alumno_id]?.precio) || 0), 0).toLocaleString()}</span>
          {isElite && (
            <button onClick={handleExportCSV} style={{ marginTop: '15px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-file-csv"></i> Exportar Datos (CSV)
            </button>
          )}
        </div>
      {/* Formulario Agregar Alumno */}
      <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', marginBottom: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="var(--accent-gold)" /> Vincular Alumno
        </h3>
        <form onSubmit={agregarAlumno} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="email" 
            placeholder="Correo del alumno registrado en la app" 
            className="input-field"
            value={nuevoCorreo}
            onChange={(e) => setNuevoCorreo(e.target.value)}
            style={{ margin: 0, width: '100%' }}
          />
          <button type="submit" className="btn-primary" disabled={agregando} style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
            {agregando ? <i className="fa-solid fa-spinner fa-spin"></i> : <Plus size={20} />} 
            Dar de Alta
          </button>
        </form>
      </div>

      {/* Lista de Alumnos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Tus Alumnos Activos ({alumnos.filter(a => a.estado === 'activo').length})</h3>
        {isElite && alumnos.filter(a => a.estado === 'activo').length > 0 && (
          <button 
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            style={{ background: isSelectionMode ? 'var(--accent-gold)' : 'transparent', color: isSelectionMode ? 'black' : 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isSelectionMode ? 'Cancelar Múltiple' : 'Selección Múltiple'}
          </button>
        )}
      </div>

      {isSelectionMode && selectedAlumnos.length > 0 && (
        <div style={{ background: 'rgba(212,175,55,0.15)', padding: '15px', borderRadius: '12px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-gold)' }}>{selectedAlumnos.length} alumnos seleccionados</span>
          <button 
            onClick={() => {
              localStorage.setItem('veta_masivo_ids', JSON.stringify(selectedAlumnos));
              navigate('/asignar-rutina-masiva');
            }}
            style={{ background: 'var(--accent-gold)', color: 'black', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Asignar Rutina Masiva
          </button>
        </div>
      )}

      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text"></i></div>
      ) : alumnos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Todavía no tienes alumnos vinculados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {alumnos.map(rel => {
            const perfil = rel.perfiles || {};
            const activo = rel.estado === 'activo';
            
            return (
              <div key={rel.id} style={{ 
                background: 'var(--bg-card)', 
                padding: '20px', 
                borderRadius: '16px',
                borderLeft: `4px solid ${activo ? 'var(--accent-gold)' : '#e55039'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {isSelectionMode && activo && (
                    <input 
                      type="checkbox" 
                      checked={selectedAlumnos.includes(rel.alumno_id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedAlumnos([...selectedAlumnos, rel.alumno_id]);
                        else setSelectedAlumnos(selectedAlumnos.filter(id => id !== rel.alumno_id));
                      }}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--accent-gold)' }}
                    />
                  )}
                  <img 
                    src={perfil.avatar_url || 'https://ui-avatars.com/api/?name=A&background=d4af37&color=000&size=60'} 
                    alt="avatar" 
                    style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', filter: activo ? 'none' : 'grayscale(100%)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: activo ? 'white' : '#888' }}>
                      {perfil.full_name || 'Alumno'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{perfil.email || rel.alumno_id?.substring(0, 8) + '...'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', fontSize: '0.75rem', color: rel.estado === 'pendiente' ? '#f6b93b' : activo ? '#4cd137' : '#e55039' }}>
                      {rel.estado === 'pendiente' ? <i className="fa-solid fa-clock" style={{fontSize: '12px'}}></i> : activo ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {rel.estado === 'pendiente' ? 'Pendiente de aceptación' : rel.estado === 'desvinculado' ? 'Se ha desvinculado' : activo ? 'Activo y Entrenando' : 'Dado de baja'}
                    </div>
                  </div>
                </div>

                {/* Precio por alumno */}
                {activo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(212,175,55,0.08)', padding: '8px 12px', borderRadius: '10px' }}>
                    <i className="fa-solid fa-dollar-sign" style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}></i>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap' }}>Cobro mensual:</span>
                    <input 
                      type="number" 
                      value={alumnosInfo[rel.alumno_id]?.precio || ''}
                      onChange={(e) => updateAlumnoInfo(rel.alumno_id, 'precio', e.target.value)}
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)', color: 'var(--accent-gold)', padding: '4px', width: '80px', fontSize: '1rem', outline: 'none', fontWeight: 'bold', textAlign: 'right' }}
                      placeholder="0"
                    />
                  </div>
                )}
                
                {rel.estado === 'desvinculado' && (
                  <div style={{ background: 'rgba(229, 80, 57, 0.1)', border: '1px solid #e55039', color: '#e55039', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {rel.mensaje_desvinculacion || "El alumno decidió no continuar con su entrenamiento."}
                  </div>
                )}
                
                {activo && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px', marginTop: '5px' }}>
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                      <button 
                        onClick={() => setActiveTabAlumno({...activeTabAlumno, [rel.alumno_id]: 'metricas'})}
                        style={{ padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', background: (activeTabAlumno[rel.alumno_id] || 'metricas') === 'metricas' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)', color: (activeTabAlumno[rel.alumno_id] || 'metricas') === 'metricas' ? 'black' : 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        <Activity size={14} /> Expediente
                      </button>
                      <button 
                        onClick={() => setActiveTabAlumno({...activeTabAlumno, [rel.alumno_id]: 'cita'})}
                        style={{ padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', background: activeTabAlumno[rel.alumno_id] === 'cita' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)', color: activeTabAlumno[rel.alumno_id] === 'cita' ? 'black' : 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        <Calendar size={14} /> Cita
                      </button>
                      <button 
                        onClick={() => setActiveTabAlumno({...activeTabAlumno, [rel.alumno_id]: 'notas'})}
                        style={{ padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', background: activeTabAlumno[rel.alumno_id] === 'notas' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)', color: activeTabAlumno[rel.alumno_id] === 'notas' ? 'black' : 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        <FileText size={14} /> Notas
                      </button>
                    </div>

                    {(activeTabAlumno[rel.alumno_id] || 'metricas') === 'metricas' && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', color: '#888' }}>Consistencia</p>
                            <span style={{ fontSize: '0.9rem', color: rel.diasInactivo <= 7 ? '#4cd137' : rel.diasInactivo <= 14 ? '#e1b12c' : '#e55039', fontWeight: 'bold' }}>
                              {rel.diasInactivo === 0 ? "Hoy entrenó" : rel.diasInactivo <= 7 ? "Alta (Activo)" : rel.diasInactivo <= 14 ? "Regular" : "En Riesgo"}
                            </span>
                            {isElite && rel.diasInactivo > 7 && activo && (
                              <div style={{ marginTop: '5px' }}>
                                <a href={`mailto:${perfil.email}?subject=¿Todo bien con tu entrenamiento?&body=Hola ${perfil.full_name}, he notado que llevas unos días sin registrar entrenamientos. ¿Todo bien? Estoy aquí para ayudarte a retomar el ritmo.`} style={{ background: '#e55039', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                                  <i className="fa-solid fa-triangle-exclamation"></i> Alerta: Contactar
                                </a>
                              </div>
                            )}
                          </div>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', color: '#888' }}>Rutinas (Mes)</p>
                            <span style={{ fontSize: '0.9rem', color: 'white', fontWeight: 'bold' }}>{rel.completadosMes} terminadas</span>
                          </div>
                        </div>
                        <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Última sesión: {rel.ultimaRutina ? new Date(rel.ultimaRutina).toLocaleDateString() : 'Ninguna'}
                        </p>
                      </div>
                    )}

                    {activeTabAlumno[rel.alumno_id] === 'cita' && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
                        <label style={{ fontSize: '0.85rem', color: '#888', display: 'block', marginBottom: '8px' }}>Programar reunión (Presencial/Video)</label>
                        <input 
                          type="datetime-local" 
                          value={alumnosInfo[rel.alumno_id]?.proxima_cita || ''}
                          onChange={(e) => updateAlumnoInfo(rel.alumno_id, 'proxima_cita', e.target.value)}
                          className="input-field"
                          style={{ margin: 0, width: '100%', fontSize: '0.9rem' }}
                        />
                        {alumnosInfo[rel.alumno_id]?.proxima_cita && (
                          <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                            <i className="fa-solid fa-bell"></i> Cita agendada para el {new Date(alumnosInfo[rel.alumno_id].proxima_cita).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {activeTabAlumno[rel.alumno_id] === 'notas' && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
                        <textarea 
                          value={alumnosInfo[rel.alumno_id]?.notas || ''}
                          onChange={(e) => updateAlumnoInfo(rel.alumno_id, 'notas', e.target.value)}
                          className="input-field"
                          placeholder="Lesiones, progreso, objetivos, recordatorios..."
                          rows="3"
                          style={{ margin: 0, width: '100%', fontSize: '0.9rem', resize: 'vertical' }}
                        ></textarea>
                      </div>
                    )}
                  </div>
                )}
                
                {rel.diasInactivo > 32 && activo && (
                  <div style={{ background: 'rgba(229, 80, 57, 0.1)', border: '1px solid #e55039', color: '#e55039', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i> Este alumno lleva inactivo {rel.diasInactivo} días. Favor de eliminar de la lista si ya no es su alumno.
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  {activo && (
                    <button 
                      onClick={() => navigate(`/coach/asignar/${rel.alumno_id}`)}
                      className="btn-primary"
                      style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <i className="fa-solid fa-calendar-days"></i> Programar Rutina
                    </button>
                  )}
                  
                  {rel.estado !== 'desvinculado' && (
                    <button 
                      onClick={() => cambiarEstado(rel.id, rel.alumno_id, activo ? 'inactivo' : 'activo')}
                      style={{ 
                        flex: activo ? 0.3 : 1,
                        padding: '10px', 
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: activo ? '#e55039' : '#4cd137',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {activo ? 'Baja' : 'Reactivar Alumno'}
                    </button>
                  )}
                  
                  {!activo && (
                    <button 
                      onClick={() => eliminarDefinitivamente(rel.id)}
                      style={{ 
                        flex: 1,
                        padding: '10px', 
                        background: 'rgba(229, 80, 57, 0.2)',
                        border: '1px solid rgba(229, 80, 57, 0.5)',
                        color: '#e55039',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <i className="fa-solid fa-trash-can" style={{marginRight: '5px'}}></i> Eliminar de la lista
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
