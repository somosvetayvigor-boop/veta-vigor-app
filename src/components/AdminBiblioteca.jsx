import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ImagePlus, Search, Edit2, Loader2, Save } from 'lucide-react';

export default function AdminBiblioteca() {
  const [activeTab, setActiveTab] = useState('ejercicios'); // 'ejercicios' or 'sistemas'
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
    let tableName = activeTab === 'ejercicios' ? 'ejercicios_biblioteca' : 'sistemas_entrenamiento';
    
    const { data, error } = await supabase
      .from(tableName)
      .select('id, nombre, imagen_url')
      .order('nombre');
      
    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(id);
    const tableName = activeTab === 'ejercicios' ? 'ejercicios_biblioteca' : 'sistemas_entrenamiento';
    const folder = activeTab === 'ejercicios' ? 'ejercicios' : 'sistemas';
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${id}_${Date.now()}.${fileExt}`;

    try {
      // 1. Subir a Supabase Storage (bucket: imagenes)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('imagenes')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('imagenes')
        .getPublicUrl(fileName);

      // 3. Actualizar la base de datos
      const { error: dbError } = await supabase
        .from(tableName)
        .update({ imagen_url: publicUrl })
        .eq('id', id);

      if (dbError) throw dbError;

      // 4. Actualizar el estado local
      setItems(items.map(item => item.id === id ? { ...item, imagen_url: publicUrl } : item));
      alert('¡Imagen actualizada con éxito!');

    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Error al subir imagen: ${error.message}. Asegúrate de haber creado el bucket "imagenes" público en Supabase.`);
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredItems = items.filter(item => 
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '12px' }}>
      <h2 className="gold-gradient-text" style={{ margin: '0 0 20px 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ImagePlus size={24} /> Gestor de Imágenes
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
