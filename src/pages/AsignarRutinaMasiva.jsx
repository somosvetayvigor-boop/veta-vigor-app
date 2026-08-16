import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Plus, Save, ArrowLeft, CalendarDays, Loader2, Trash2 } from 'lucide-react';

export default function AsignarRutinaMasiva({ session }) {
  const navigate = useNavigate();
  // PanelEntrenador.jsx guarda los ids seleccionados aqui antes de navegar
  // (no hay :alumnoId en la ruta -- son varios). Faltaba leerlos de vuelta:
  // sin esto la pantalla truena al montar (alumnoIds nunca declarado).
  const [alumnoIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('veta_masivo_ids') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alumnos, setAlumnos] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [calendario, setCalendario] = useState({
    Lunes: '',
    Martes: '',
    Miércoles: '',
    Jueves: '',
    Viernes: '',
    Sábado: '',
    Domingo: ''
  });

  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (alumnoIds.length === 0) {
      alert("No hay alumnos seleccionados.");
      navigate('/panel-entrenador');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Obtener datos de los alumnos. perfiles_publico, no perfiles: la
    // tabla base ya no deja leer filas ajenas completas (blindaje 16/08);
    // la vista da email/calendario aqui porque quien llama es el
    // entrenador de estos alumnos.
    const { data: perfilesData } = await supabase
      .from('perfiles_publico')
      .select('id, full_name, email, avatar_url, calendario_personalizado')
      .in('id', alumnoIds);

    if (perfilesData) {
      setAlumnos(perfilesData);
    }

    // 2. Obtener rutinas (creadas por el entrenador)
    const { data: rutinasData, error: rutinasError } = await supabase
      .from('rutinas')
      .select('id, nombre, enfoque')
      .eq('user_id', session?.user.id)
      .eq('is_custom', true);

    if (rutinasError) {
      alert('Error al cargar rutinas: ' + rutinasError.message);
    }

    if (rutinasData) {
      setRutinas(rutinasData);
    }
    
    setLoading(false);
  };

  const handleSelectRutina = (dia, rutinaId) => {
    setCalendario(prev => ({
      ...prev,
      [dia]: rutinaId
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Loop over all selected students to update their calendars
      for (const id of alumnoIds) {
        const { data: perfil } = await supabase
          .from('perfiles_publico')
          .select('calendario_personalizado')
          .eq('id', id)
          .single();
          
        const calCompleto = perfil?.calendario_personalizado || {};
        calCompleto['entrenador'] = calendario; // Asignar al slot del entrenador

        const { error } = await supabase
          .from('perfiles')
          .update({ calendario_personalizado: calCompleto })
          .eq('id', id);

        if (error) throw error;
      }
      
      alert('¡Calendario masivo actualizado con éxito!');
      navigate('/panel-entrenador');
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRutina = async (rutinaId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta rutina? Se quitará también del calendario si está asignada.")) return;
    
    try {
      const { error } = await supabase
        .from('rutinas')
        .delete()
        .eq('id', rutinaId);

      if (error) throw error;

      setRutinas(prev => prev.filter(r => r.id !== rutinaId));
      
      let newCal = { ...calendario };
      let changed = false;
      Object.keys(newCal).forEach(dia => {
        if (newCal[dia] === rutinaId) {
          newCal[dia] = '';
          changed = true;
        }
      });
      
      if (changed) {
        setCalendario(newCal);
        // Note: For bulk assignment, we don't auto-save deletes to all students immediately, 
        // they must click Save.
      }
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><Loader2 className="fa-spin" size={40} color="var(--accent-gold)" /></div>;
  }

  return (
    <div className="container" style={{ paddingBottom: '90px', paddingTop: '20px' }}>
      <button 
        onClick={() => navigate('/panel-entrenador')} 
        style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px', cursor: 'pointer' }}
      >
        <ArrowLeft size={20} /> Volver a Mis Alumnos
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '1.5rem', margin: 0 }}>Asignación Masiva</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Se aplicará a {alumnos.length} alumnos seleccionados.</p>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
          {alumnos.map(a => (
            <img 
              key={a.id}
              src={a.avatar_url || 'https://via.placeholder.com/60'} 
              style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent-gold)' }} 
              alt={a.full_name}
              title={a.full_name}
            />
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Dumbbell size={20} color="var(--accent-gold)" /> Rutinas del Alumno
        </h3>
        
        {rutinas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Aún no has creado rutinas para este alumno.</p>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
            {rutinas.map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 25px 10px 15px', borderRadius: '8px', minWidth: '150px', position: 'relative' }}>
                <button 
                  onClick={() => handleDeleteRutina(r.id)}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', padding: '5px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={18} />
                </button>
                <div style={{ fontWeight: 'bold', paddingRight: '15px' }}>{r.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.enfoque}</div>
              </div>
            ))}
          </div>
        )}
        
        <button 
          onClick={() => navigate(`/crear-rutina`)}
          className="btn-primary" 
          style={{ width: '100%', padding: '15px', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <Plus size={20} /> Crear Nueva Rutina
        </button>
      </div>

      <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CalendarDays size={20} color="var(--accent-gold)" /> Calendario Semanal
      </h3>
      
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
        Asigna rutinas a los días de la semana. Los días en blanco aparecerán como descanso.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        {dias.map(dia => (
          <div key={dia} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '15px', borderRadius: '12px' }}>
            <div style={{ width: '100px', fontWeight: 'bold', color: calendario[dia] ? 'var(--accent-gold)' : 'white' }}>{dia}</div>
            <select 
              value={calendario[dia] || ''} 
              onChange={(e) => handleSelectRutina(dia, e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', outline: 'none' }}
            >
              <option value="">Descanso</option>
              {rutinas.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '15px',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          {saving ? <Loader2 className="spin" size={24} /> : <Save size={24} />}
          {saving ? 'Registrando...' : 'Registrar y Asignar Calendario'}
        </button>

    </div>
  );
}
