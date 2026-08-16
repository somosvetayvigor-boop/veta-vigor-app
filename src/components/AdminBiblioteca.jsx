import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { compressImage } from '../utils/imageUtils';
import { ImagePlus, Search, Edit2, Loader2, Check, Link } from 'lucide-react';

export default function AdminBiblioteca() {
  const [activeTab, setActiveTab] = useState('ejercicios'); // 'ejercicios', 'sistemas', 'pendientes'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    
    if (activeTab === 'pendientes') {
      const { data, error } = await supabase
        .from('ejercicios_biblioteca')
        .select('*')
        .eq('is_custom', true)
        .eq('status', 'pendiente')
        .order('nombre');
      if (!error && data) setItems(data);
    } else {
      let tableName = activeTab === 'ejercicios' ? 'ejercicios_biblioteca' : 'sistemas_entrenamiento';
      
      const selectQuery = activeTab === 'ejercicios' 
        ? 'id, nombre, imagen_url, instrucciones, musculos_trabajados, equipo_necesario' 
        : 'id, nombre, imagen_url';

      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
        .order('nombre');
        
      if (!error && data) {
        setItems(data);
      }
    }
    setLoading(false);
  };

  const handleImageUpload = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(id);
    const tableName = activeTab === 'ejercicios' ? 'ejercicios_biblioteca' : 'sistemas_entrenamiento';
    const folder = activeTab === 'ejercicios' ? 'ejercicios' : 'sistemas';
    const fileName = `${folder}/${id}_${Date.now()}.jpg`;

    try {
      // Comprimir antes de subir: ver el comentario en ExpedienteModal. Estas
      // imágenes las ve toda la base de usuarios, así que además de ocupar menos
      // se sirven más rápido.
      const compressedFile = await compressImage(file);
      const { error: uploadError } = await supabase.storage
        .from('imagenes')
        .upload(fileName, compressedFile, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('imagenes')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from(tableName)
        .update({ imagen_url: publicUrl })
        .eq('id', id);

      if (dbError) throw dbError;

      setItems(items.map(item => item.id === id ? { ...item, imagen_url: publicUrl } : item));
      alert('¡Imagen actualizada con éxito!');

    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Error al subir imagen: ${error.message}.`);
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const aprobarEjercicio = async (id) => {
    try {
      const { error } = await supabase
        .from('ejercicios_biblioteca')
        .update({ status: 'aprobado', is_custom: false })
        .eq('id', id);
      
      if (error) throw error;
      setItems(items.filter(item => item.id !== id));
      alert('Ejercicio aprobado y añadido a la biblioteca global.');
    } catch (err) {
      alert('Error al aprobar: ' + err.message);
    }
  };

  const fusionarEjercicio = async (id_temporal) => {
    const id_oficial = prompt("Ingresa el ID del ejercicio oficial (ej. 'press-banca'):");
    if (!id_oficial) return;

    try {
      // 1. Actualizar rutinas que usan el temporal
      const { error: errorUpdate } = await supabase
        .from('rutina_ejercicios')
        .update({ ejercicio_id: id_oficial })
        .eq('ejercicio_id', id_temporal);
        
      if (errorUpdate) throw errorUpdate;

      // 2. Eliminar el temporal
      const { error: errorDelete } = await supabase
        .from('ejercicios_biblioteca')
        .delete()
        .eq('id', id_temporal);
        
      if (errorDelete) throw errorDelete;

      setItems(items.filter(item => item.id !== id_temporal));
      alert('Ejercicio fusionado con éxito.');
    } catch (err) {
      alert('Error al fusionar: ' + err.message);
    }
  };

  const filteredItems = items.filter(item => 
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '12px' }}>
      <h2 className="gold-gradient-text" style={{ margin: '0 0 20px 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ImagePlus size={24} /> Gestor de Biblioteca
      </h2>

      {/* Selector de Pestañas Interno */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('ejercicios')}
          className={activeTab === 'ejercicios' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1 }}
        >
          Ejercicios
        </button>
        <button 
          onClick={() => setActiveTab('sistemas')}
          className={activeTab === 'sistemas' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1 }}
        >
          Sistemas
        </button>
        <button 
          onClick={() => setActiveTab('pendientes')}
          className={activeTab === 'pendientes' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, backgroundColor: activeTab === 'pendientes' ? '#e55039' : undefined }}
        >
          Pendientes
        </button>
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
        <input 
          type="text" 
          placeholder={`Buscar ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '12px 15px 12px 40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
        />
      </div>

      {/* Lista de Items */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={30} className="spin" color="var(--accent-gold)" /></div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {filteredItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              
              {/* Miniatura de Imagen */}
              <div style={{ width: '70px', height: '70px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.imagen_url ? (
                  <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImagePlus size={24} color="#555" />
                )}
              </div>

              {/* Info y Botón Subir */}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'white' }}>{item.nombre}</h4>
                
                {activeTab !== 'sistemas' && (
                  <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>
                    <strong>Músculo:</strong> {item.musculos_trabajados || 'N/A'} 
                    {item.equipo_necesario && <span> | <strong>Equipo:</strong> {item.equipo_necesario}</span>}
                    <br/>
                    <strong>Desc:</strong> {item.instrucciones || 'Sin descripción'}
                  </p>
                )}
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {activeTab !== 'pendientes' ? (
                    <>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                        {uploadingId === item.id ? <Loader2 size={14} className="spin" /> : <Edit2 size={14} />}
                        {uploadingId === item.id ? 'Subiendo...' : 'Cambiar Foto'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, item.id)} 
                          style={{ display: 'none' }} 
                          disabled={uploadingId === item.id}
                        />
                      </label>

                      {item.imagen_url && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm("¿Seguro que quieres quitar esta imagen?")) return;
                            setUploadingId(item.id);
                            const tableName = activeTab === 'ejercicios' ? 'ejercicios_biblioteca' : 'sistemas_entrenamiento';
                            const { error } = await supabase.from(tableName).update({ imagen_url: null }).eq('id', item.id);
                            if (!error) {
                              setItems(items.map(i => i.id === item.id ? { ...i, imagen_url: null } : i));
                            }
                            setUploadingId(null);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(229, 80, 57, 0.1)', color: '#e55039', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid rgba(229, 80, 57, 0.3)' }}
                          disabled={uploadingId === item.id}
                        >
                          Quitar Imagen
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => aprobarEjercicio(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid #2ecc71' }}
                      >
                        <Check size={14} /> Aprobar Global
                      </button>
                      
                      <button 
                        onClick={() => fusionarEjercicio(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid #3498db' }}
                      >
                        <Link size={14} /> Fusionar/Reemplazar
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          ))}

          {filteredItems.length === 0 && (
            <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>No se encontraron resultados.</p>
          )}
        </div>
      )}
    </div>
  );
}
