import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, ChevronRight, ChevronLeft, Save, Search } from 'lucide-react';

export default function AdminGestorSistemas() {
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSistema, setSelectedSistema] = useState(null);
  const [rutinas, setRutinas] = useState([]);
  const [loadingRutinas, setLoadingRutinas] = useState(false);

  const [selectedRutina, setSelectedRutina] = useState(null);
  const [rutinaEjercicios, setRutinaEjercicios] = useState([]);
  const [loadingEjercicios, setLoadingEjercicios] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchSistemas();
  }, []);

  const fetchSistemas = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sistemas_entrenamiento').select('*').order('nombre');
    if (!error && data) setSistemas(data);
    setLoading(false);
  };

  const fetchRutinas = async (sistemaId) => {
    setLoadingRutinas(true);
    const { data, error } = await supabase
      .from('rutinas')
      .select('*')
      .eq('sistema_id', sistemaId)
      .order('nivel');
    if (!error && data) setRutinas(data);
    setLoadingRutinas(false);
  };

  const fetchRutinaEjercicios = async (rutinaId) => {
    setLoadingEjercicios(true);
    const { data, error } = await supabase
      .from('rutina_ejercicios')
      .select(`
        id, orden_ejercicio, repeticiones_objetivo,
        ejercicios_biblioteca (id, nombre, musculos_trabajados, imagen_url, instrucciones, consejos_pro, equipo_necesario)
      `)
      .eq('rutina_id', rutinaId)
      .order('orden_ejercicio');
    
    if (!error && data) setRutinaEjercicios(data);
    setLoadingEjercicios(false);
  };

  const handleSelectSistema = (sis) => {
    setSelectedSistema(sis);
    setSelectedRutina(null);
    fetchRutinas(sis.id);
  };

  const handleSelectRutina = (rut) => {
    setSelectedRutina(rut);
    fetchRutinaEjercicios(rut.id);
  };

  const crearSistema = async () => {
    const nombre = prompt("Nombre del nuevo sistema:");
    if (!nombre) return;
    const desc = prompt("Breve descripción:");
    
    const { data, error } = await supabase.from('sistemas_entrenamiento').insert([{ nombre, descripcion: desc }]).select();
    if (!error && data) {
      setSistemas([...sistemas, data[0]]);
    } else {
      alert("Error al crear sistema");
    }
  };

  const crearRutina = async () => {
    if (!selectedSistema) return;
    const nombre = prompt("Nombre de la nueva rutina (Ej: Semilla - Pecho):");
    if (!nombre) return;
    const nivel = prompt("Nivel (Semilla, Pino, Tzalam, Roble):");
    
    const { data, error } = await supabase.from('rutinas').insert([{ 
      nombre, 
      nivel, 
      sistema_id: selectedSistema.id,
    }]).select();
    
    if (!error && data) {
      setRutinas([...rutinas, data[0]]);
    } else {
      alert("Error al crear rutina");
    }
  };

  const buscarEjercicios = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const { data, error } = await supabase
      .from('ejercicios_biblioteca')
      .select('id, nombre, musculos_trabajados, imagen_url')
      .ilike('nombre', `%${q}%`)
      .limit(10);
      
    if (!error && data) setSearchResults(data);
    setIsSearching(false);
  };

  const addEjercicioToRutina = async (ejercicio) => {
    const reps = prompt(`Series y Repeticiones recomendadas para ${ejercicio.nombre} (ej: 4x10-12):`, "4x10-12");
    if (!reps) return;

    const nextOrden = rutinaEjercicios.length + 1;
    
    const { data, error } = await supabase.from('rutina_ejercicios').insert([{
      rutina_id: selectedRutina.id,
      ejercicio_id: ejercicio.id,
      orden_ejercicio: nextOrden,
      repeticiones_objetivo: reps
    }]).select(`
        id, orden_ejercicio, repeticiones_objetivo,
        ejercicios_biblioteca (id, nombre, musculos_trabajados, imagen_url, instrucciones, consejos_pro, equipo_necesario)
    `);

    if (!error && data) {
      setRutinaEjercicios([...rutinaEjercicios, data[0]]);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      alert("Error agregando ejercicio");
    }
  };

  const removeEjercicio = async (id) => {
    if (!window.confirm("¿Seguro que quieres quitar este ejercicio?")) return;
    const { error } = await supabase.from('rutina_ejercicios').delete().eq('id', id);
    if (!error) {
      setRutinaEjercicios(rutinaEjercicios.filter(e => e.id !== id));
    }
  };

  const openEditModal = (re) => {
    setEditingEjercicio(re);
    setEditForm({
      repeticiones_objetivo: re.repeticiones_objetivo || '',
      nombre: re.ejercicios_biblioteca.nombre || '',
      instrucciones: re.ejercicios_biblioteca.instrucciones || '',
      consejos_pro: re.ejercicios_biblioteca.consejos_pro || '',
      musculos_trabajados: re.ejercicios_biblioteca.musculos_trabajados || '',
      equipo_necesario: re.ejercicios_biblioteca.equipo_necesario || '',
      imagen_url: re.ejercicios_biblioteca.imagen_url || ''
    });
  };

  const saveEditModal = async () => {
    // 1. Update rutina_ejercicios
    await supabase.from('rutina_ejercicios')
      .update({ repeticiones_objetivo: editForm.repeticiones_objetivo })
      .eq('id', editingEjercicio.id);
      
    // 2. Update ejercicios_biblioteca globally
    await supabase.from('ejercicios_biblioteca')
      .update({
        nombre: editForm.nombre,
        instrucciones: editForm.instrucciones,
        consejos_pro: editForm.consejos_pro,
        musculos_trabajados: editForm.musculos_trabajados,
        equipo_necesario: editForm.equipo_necesario,
        imagen_url: editForm.imagen_url
      })
      .eq('id', editingEjercicio.ejercicios_biblioteca.id);
      
    alert("Ejercicio guardado exitosamente.");
    setEditingEjercicio(null);
    fetchRutinaEjercicios(selectedRutina.id);
  };

  if (loading) return <p>Cargando sistemas...</p>;

  return (
    <div style={{ position: 'relative' }}>
      {/* CAPA 1: LISTA DE SISTEMAS */}
      {!selectedSistema && !selectedRutina && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Sistemas V&V</h2>
            <button onClick={crearSistema} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.9rem', display: 'flex', gap: '5px', alignItems: 'center' }}>
              <Plus size={16} /> Nuevo
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sistemas.map(sis => (
              <div 
                key={sis.id} 
                onClick={() => handleSelectSistema(sis)}
                style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{sis.nombre}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sis.descripcion}</p>
                </div>
                <ChevronRight color="var(--accent-gold)" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* CAPA 2: LISTA DE RUTINAS DEL SISTEMA */}
      {selectedSistema && !selectedRutina && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <button onClick={() => setSelectedSistema(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', padding: 0, marginBottom: '5px', cursor: 'pointer' }}>
                ← Volver a Sistemas
              </button>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{selectedSistema.nombre}</h2>
            </div>
            <button onClick={crearRutina} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.9rem', display: 'flex', gap: '5px', alignItems: 'center' }}>
              <Plus size={16} /> Nueva Rutina
            </button>
          </div>

          {loadingRutinas ? <p>Cargando rutinas...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rutinas.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay rutinas en este sistema aún.</p> : null}
              {rutinas.map(rut => (
                <div 
                  key={rut.id} 
                  onClick={() => handleSelectRutina(rut)}
                  style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid var(--accent-gold)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{rut.nombre}</h3>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,215,0,0.1)', color: 'var(--accent-gold)', padding: '3px 8px', borderRadius: '12px' }}>
                      Nivel: {rut.nivel || 'General'}
                    </span>
                  </div>
                  <ChevronRight color="var(--accent-gold)" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CAPA 3: CONSTRUCTOR DE LA MISIÓN */}
      {selectedRutina && !editingEjercicio && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <button onClick={() => setSelectedRutina(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', padding: 0, marginBottom: '5px', cursor: 'pointer' }}>
                ← Volver a Misiones
              </button>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{selectedRutina.nombre}</h2>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px solid var(--accent-gold)', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Search size={16} /> Buscar y Agregar Ejercicio
            </h3>
            <input 
              type="text" 
              placeholder="Ej: Press de banca, Dominadas..." 
              value={searchQuery}
              onChange={buscarEjercicios}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: '10px', background: '#222', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {searchResults.map(res => (
                  <div 
                    key={res.id} 
                    onClick={() => addEjercicioToRutina(res)}
                    style={{ padding: '10px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>{res.nombre}</p>
                    </div>
                    <button style={{ background: 'var(--accent-gold)', color: 'black', border: 'none', borderRadius: '4px', padding: '4px 8px', fontWeight: 'bold' }}>Añadir</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Ejercicios en esta Misión</h3>
          
          {loadingEjercicios ? <p>Cargando ejercicios...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rutinaEjercicios.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Misión vacía. Agrega ejercicios arriba.</p> : null}
              {rutinaEjercicios.map((re, i) => (
                <div 
                  key={re.id} 
                  onClick={() => openEditModal(re)}
                  style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-gold)', fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>
                    {i + 1}
                  </div>
                  <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#333' }}>
                    {re.ejercicios_biblioteca?.imagen_url && <img src={re.ejercicios_biblioteca.imagen_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '1rem' }}>{re.ejercicios_biblioteca?.nombre}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>{re.repeticiones_objetivo}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeEjercicio(re.id); }} 
                    style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: '5px' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CAPA 4: EDICIÓN PROFUNDA DEL EJERCICIO */}
      {editingEjercicio && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', minHeight: '100%', background: 'var(--bg-color)', zIndex: 100, paddingBottom: '120px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button onClick={() => setEditingEjercicio(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ChevronLeft size={20} /> Volver
            </button>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--accent-gold)' }}>Editar Ejercicio</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Nombre del Ejercicio (Global)</label>
              <input 
                value={editForm.nombre} 
                onChange={e => setEditForm({...editForm, nombre: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>
            
            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Repeticiones (Solo esta Misión)</label>
              <input 
                value={editForm.repeticiones_objetivo} 
                onChange={e => setEditForm({...editForm, repeticiones_objetivo: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>

            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Instrucciones paso a paso</label>
              <textarea 
                value={editForm.instrucciones} 
                onChange={e => setEditForm({...editForm, instrucciones: e.target.value})}
                rows="4"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>

            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Consejo Pro</label>
              <textarea 
                value={editForm.consejos_pro} 
                onChange={e => setEditForm({...editForm, consejos_pro: e.target.value})}
                rows="3"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>
            
            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Equipo Necesario</label>
              <input 
                value={editForm.equipo_necesario} 
                onChange={e => setEditForm({...editForm, equipo_necesario: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>

            <div>
              <label style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>URL de Imagen / GIF</label>
              <input 
                value={editForm.imagen_url} 
                onChange={e => setEditForm({...editForm, imagen_url: e.target.value})}
                placeholder="https://.../imagen.jpg"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: 'white', marginTop: '5px' }}
              />
            </div>

            <button onClick={saveEditModal} className="btn-primary" style={{ padding: '15px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
              <Save size={20} /> Registrar Cambios
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-5px' }}>
              Los cambios (excepto repeticiones) afectarán a todas las misiones que usen este ejercicio.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
