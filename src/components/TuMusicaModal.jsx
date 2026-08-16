import { useState } from 'react';
import { X, Save, Music } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function TuMusicaModal({ session, onClose, onSaved }) {
  const [link, setLink] = useState(session?.user?.user_metadata?.custom_music_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { custom_music_link: link }
      });
      if (updateError) throw updateError;
      
      // Llamar callback para actualizar UI y caché
      if (onSaved) {
        onSaved(link);
      }
      onClose();
    } catch (err) {
      console.error('Error saving custom music link:', err);
      setError('Error al guardar el enlace. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 10000, padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a20', padding: '25px', borderRadius: '16px',
        width: '100%', maxWidth: '400px', border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', margin: 0, color: 'white' }}>
            <Music color="var(--accent-gold)" /> Tu Música
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '20px' }}>
          Pega aquí el enlace de tu Playlist favorita (Spotify, YouTube, Apple Music, etc.) para tenerla siempre a la mano durante tus entrenamientos.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.85rem' }}>
              Enlace de tu Playlist:
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #444', backgroundColor: '#0f0f11', color: 'white'
              }}
            />
          </div>
          
          {error && <p style={{ color: '#ff4757', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px', borderRadius: '8px', backgroundColor: 'var(--accent-gold)',
              color: 'black', fontWeight: 'bold', border: 'none', display: 'flex',
              justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px'
            }}
          >
            {saving ? 'Guardando...' : <><Save size={18} /> Guardar Enlace</>}
          </button>
        </form>
      </div>
    </div>
  );
}
