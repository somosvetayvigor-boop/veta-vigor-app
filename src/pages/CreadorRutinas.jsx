import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, Plus, Search, X, Loader2, Save, ArrowLeft, AlertCircle } from 'lucide-react';

export default function CreadorMisións({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alumnoId = searchParams.get('alumno_id');

  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [enfoque, setEnfoque] = useState('Hipertrofia');
  const [ejercicios, setEjercicios] = useState([]);
  
  // Modal de búsqueda
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [biblioteca, setBiblioteca] = useState([]);

  // Modal de creación de ejercicio personalizado
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExercise, setNewExercise] = useState({ nombre: '', musculo: 'Pecho', instrucciones: '', imagen_url: '', video_url: '' });
  const [creatingExercise, setCreatingExercise] = useState(false);

  useEffect(() => {
    fetchBiblioteca();
  }, []);

  const fetchBiblioteca = async () => {
    const { data } = await supabase
      .from('ejercicios_biblioteca')
      .select('id, nombre, musculos_trabajados, imagen_url')
      .or(`is_custom.eq.false,created_by.eq.${session?.user.id}`)
      .order('nombre');
    if (data) setBiblioteca(data);
  };

  const handleSaveRoutine = async () => {
    if (!nombre) return alert('Ponle un nombre a tu misión');
    if (ejercicios.length === 0) return alert('Agrega al menos un ejercicio');

    setLoading(true);
    try {
      // 1. Guardar la misión
      const { data: misión, error: misiónError } = await supabase
        .from('misións')
        .insert({
          nombre: nombre,
          enfoque: enfoque,
          nivel: alumnoId ? 'Entrenador' : 'Personalizado',
          user_id: session?.user.id,
          sistema_id: null,
          is_custom: true
        })
        .select()
        .single();

      if (misiónError) throw misiónError;

      // 2. Guardar los ejercicios
      const misiónEjercicios = ejercicios.map((ej, index) => ({
        misión_id: misión.id,
        ejercicio_id: ej.id,
        orden_ejercicio: index + 1,
        repeticiones_objetivo: ej.series // Reutilizamos este campo para guardar el formato "4x10"
      }));

      const { error: ejerciciosError } = await supabase
        .from('misión_ejercicios')
        .insert(misiónEjercicios);

      if (ejerciciosError) throw ejerciciosError;

      alert('¡Misión creada con éxito!');
      navigate(alumnoId ? `/coach/asignar/${alumnoId}` : '/');
    } catch (error) {
      console.error(error);
      alert('Error al guardar la misión: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomExercise = async () => {
    if (!newExercise.nombre || !newExercise.instrucciones) return alert('Completa el nombre y la descripción');
    
    setCreatingExercise(true);
    const newId = `custom_${Date.now()}`;
    try {
      const { data, error } = await supabase
        .from('ejercicios_biblioteca')
        .insert({
          id: newId,
          nombre: newExercise.nombre,
          musculos_trabajados: newExercise.musculo,
          instrucciones: newExercise.instrucciones,
          imagen_url: newExercise.imagen_url || null,
          video_url: newExercise.video_url || null,
          is_custom: true,
          created_by: session?.user.id,
          status: 'pendiente'
        })
        .select()
        .single();

      if (error) throw error;
      
      setBiblioteca([...biblioteca, data]);
      setEjercicios([...ejercicios, { ...data, series: '4x10' }]);
      setShowCreateModal(false);
      setShowSearchModal(false);
      setNewExercise({ nombre: '', musculo: 'Pecho', instrucciones: '', imagen_url: '', video_url: '' });
    } catch (error) {
      console.error(error);
      alert('Error al crear ejercicio: ' + error.message);
    } finally {
      setCreatingExercise(false);
    }
  };

  const filteredBiblioteca = biblioteca.filter(ej => 
    ej.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', paddingBottom: '100px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 className="gold-gradient-text" style={{ margin: 0, fontSize: '1.5rem' }}>Crear Misión</h2>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Nombre de la Misión (ej. Día de Pecho pesado)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="input-field"
          style={{ marginBottom: '15px', fontSize: '1.1rem', fontWeight: 'bold' }}
        />
        <select 
          value={enfoque}
          onChange={(e) => setEnfoque(e.target.value)}
          className="input-field"
        >
          <option value="Hipertrofia">Hipertrofia</option>
          <option value="Fuerza">Fuerza</option>
          <option value="Resistencia">Resistencia</option>
        </select>
      </div>

      <h3 style={{ color: 'white', marginBottom: '15px' }}>Ejercicios</h3>
      
      <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
        {ejercicios.map((ej, index) => (
          <div key={index} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gold)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {index + 1}
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', color: 'white', fontSize: '1rem' }}>{ej.nombre}</h4>
              <input 
                type="text" 
                value={ej.series}
                onChange={(e) => {
                  const newEjs = [...ejercicios];
                  newEjs[index].series = e.target.value;
                  setEjercicios(newEjs);
                }}
                placeholder="Ej: 4x10 o 3x12-15"
                className="input-field"
                style={{ padding: '8px', fontSize: '0.9rem', width: '120px' }}
              />
            </div>
            <button onClick={() => setEjercicios(ejercicios.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: '#e55039' }}>
              <X size={20} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => setShowSearchModal(true)} className="btn-secondary" style={{ width: '100%', marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <Plus size={20} /> Agregar Ejercicio
      </button>

      <button onClick={handleSaveRoutine} className="btn-primary" disabled={loading} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        {loading ? <Loader2 size={20} className="spin" /> : <Save size={20} />} 
        Registrar Misión
      </button>

      {/* Modal Buscador de Ejercicios */}
      {showSearchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#111', zIndex: 1000, overflowY: 'auto' }}>
          <div style={{ padding: '20px', position: 'sticky', top: 0, backgroundColor: '#111', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'white' }}>Seleccionar Ejercicio</h3>
              <button onClick={() => setShowSearchModal(false)} style={{ background: 'none', border: 'none', color: 'white' }}><X size={24} /></button>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
              <input 
                type="text" 
                placeholder="Buscar en la biblioteca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '45px' }}
              />
            </div>
          </div>
          
          <div style={{ padding: '20px', display: 'grid', gap: '10px' }}>
            {filteredBiblioteca.map(ej => (
              <div 
                key={ej.id} 
                onClick={() => {
                  setEjercicios([...ejercicios, { ...ej, series: '4x10' }]);
                  setShowSearchModal(false);
                }}
                style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}
              >
                {ej.imagen_url ? (
                  <img src={ej.imagen_url} alt={ej.nombre} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Dumbbell size={20} color="#888" />
                  </div>
                )}
                <div>
                  <h4 style={{ margin: '0 0 5px 0' }}>{ej.nombre}</h4>
                  <small style={{ color: '#888' }}>{ej.musculos_trabajados}</small>
                </div>
              </div>
            ))}

            {searchTerm && filteredBiblioteca.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: '1px dashed var(--accent-gold)' }}>
                <p style={{ color: '#ccc', marginBottom: '15px' }}>¿No encuentras "{searchTerm}"?</p>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                  Crear Ejercicio Personalizado
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Crear Ejercicio */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1a1a1a', padding: '25px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-gold)' }}>Nuevo Ejercicio</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'white' }}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>Nombre del Ejercicio</label>
                <input 
                  type="text" 
                  value={newExercise.nombre} 
                  onChange={(e) => setNewExercise({...newExercise, nombre: e.target.value})}
                  className="input-field" 
                  placeholder="Ej. Press Militar invertido"
                />
              </div>
              
              <div>
                <label style={{ color: '#888', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>Músculo Principal</label>
                <select 
                  value={newExercise.musculo} 
                  onChange={(e) => setNewExercise({...newExercise, musculo: e.target.value})}
                  className="input-field"
                >
                  <option value="Pecho">Pecho</option>
                  <option value="Espalda">Espalda</option>
                  <option value="Piernas">Piernas</option>
                  <option value="Hombros">Hombros</option>
                  <option value="Brazos">Brazos</option>
                  <option value="Core/Abdomen">Core/Abdomen</option>
                  <option value="Full Body">Full Body</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#888', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>URL de Imagen (Opcional)</label>
                <input 
                  type="url" 
                  value={newExercise.imagen_url} 
                  onChange={(e) => setNewExercise({...newExercise, imagen_url: e.target.value})}
                  className="input-field" 
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>

              <div>
                <label style={{ color: '#888', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>URL de Video (Opcional)</label>
                <input 
                  type="url" 
                  value={newExercise.video_url} 
                  onChange={(e) => setNewExercise({...newExercise, video_url: e.target.value})}
                  className="input-field" 
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label style={{ color: '#888', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>Breve Descripción (Obligatorio)</label>
                <textarea 
                  value={newExercise.instrucciones} 
                  onChange={(e) => setNewExercise({...newExercise, instrucciones: e.target.value})}
                  className="input-field" 
                  rows="3"
                  placeholder="Explica brevemente cómo se hace para que los entrenadores lo puedan revisar."
                />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>
                  Este ejercicio se guardará en tu perfil. Un administrador lo revisará y podría mejorarlo con un video profesional más adelante.
                </p>
              </div>

              <button onClick={handleCreateCustomExercise} className="btn-primary" disabled={creatingExercise} style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
                {creatingExercise ? <Loader2 size={20} className="spin" /> : <Save size={20} />} 
                Crear y Agregar a Misión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
