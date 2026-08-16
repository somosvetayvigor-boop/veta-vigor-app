import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Edit2, Link as LinkIcon, Image as ImageIcon, Check } from 'lucide-react';

export default function AdminArticulos() {
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [id, setId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [enlaceUrl, setEnlaceUrl] = useState('');
  const [orden, setOrden] = useState(0);

  useEffect(() => {
    fetchArticulos();
  }, []);

  const fetchArticulos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('articulos_explora')
      .select('*')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setArticulos(data);
    }
    setLoading(false);
  };

  const handleEdit = (art) => {
    setId(art.id);
    setTitulo(art.titulo);
    setImagenUrl(art.imagen_url);
    setEnlaceUrl(art.enlace_url);
    setOrden(art.orden || 0);
    setIsEditing(true);
  };

  const resetForm = () => {
    setId(null);
    setTitulo('');
    setImagenUrl('');
    setEnlaceUrl('');
    setOrden(0);
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo || !imagenUrl || !enlaceUrl) {
      alert("Todos los campos son obligatorios");
      return;
    }

    const payload = {
      titulo,
      imagen_url: imagenUrl,
      enlace_url: enlaceUrl,
      orden: parseInt(orden) || 0
    };

    if (id) {
      const { error } = await supabase.from('articulos_explora').update(payload).eq('id', id);
      if (error) alert(error.message);
      else alert("Artículo actualizado");
    } else {
      const { error } = await supabase.from('articulos_explora').insert([payload]);
      if (error) alert(error.message);
      else alert("Artículo creado");
    }

    resetForm();
    fetchArticulos();
  };

  const handleDelete = async (artId) => {
    if (!window.confirm("¿Seguro que quieres borrar este artículo?")) return;
    const { error } = await supabase.from('articulos_explora').delete().eq('id', artId);
    if (error) alert(error.message);
    else fetchArticulos();
  };

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-gold)' }}>
          {isEditing ? 'Editar Artículo' : 'Nuevo Artículo'}
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '5px' }}>Título del Artículo</label>
            <input 
              type="text" 
              value={titulo} 
              onChange={(e) => setTitulo(e.target.value)} 
              placeholder="Ej: Los Mitos del Cardio"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none' }}
            />
          </div>
          
          <div>
            <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '5px' }}>URL de la Imagen (Portada)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <ImageIcon size={20} color="#888" />
              <input 
                type="text" 
                value={imagenUrl} 
                onChange={(e) => setImagenUrl(e.target.value)} 
                placeholder="https://tupagina.com/imagen.jpg"
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none' }}
              />
            </div>
            {imagenUrl && <img src={imagenUrl} alt="Preview" style={{ marginTop: '10px', width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.3)' }} onError={(e) => e.target.style.display='none'} />}
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '5px' }}>Enlace del Artículo (Destino)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <LinkIcon size={20} color="#888" />
              <input 
                type="text" 
                value={enlaceUrl} 
                onChange={(e) => setEnlaceUrl(e.target.value)} 
                placeholder="https://veta-vigor-app.pages.dev/mi-articulo"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none' }}
              />
            </div>
          </div>
          
          <div>
            <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '5px' }}>Orden (Menor número sale primero)</label>
            <input 
              type="number" 
              value={orden} 
              onChange={(e) => setOrden(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" style={{ flex: 1, background: 'var(--accent-gold)', color: '#000', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              {isEditing ? <><Check size={18} /> Actualizar</> : <><Plus size={18} /> Agregar</>}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} style={{ background: 'transparent', color: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: '1.4rem', margin: '0 0 15px 0' }}>Artículos Publicados</h2>
      {loading ? <p>Cargando...</p> : articulos.length === 0 ? <p style={{ color: '#888' }}>No hay artículos publicados.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {articulos.map(art => (
            <div key={art.id} style={{ display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={art.imagen_url} alt="Portada" style={{ width: '100px', height: '100px', objectFit: 'cover' }} />
              <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#fff' }}>{art.titulo}</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: 'var(--accent-gold)' }}>Orden: {art.orden}</p>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => handleEdit(art)} style={{ background: 'transparent', border: 'none', color: '#fff', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}><Edit2 size={14}/> Editar</button>
                  <button onClick={() => handleDelete(art.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}><Trash2 size={14}/> Borrar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
