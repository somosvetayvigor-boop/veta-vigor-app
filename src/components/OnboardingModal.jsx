import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Camera, CheckCircle, Loader } from 'lucide-react';

export default function OnboardingModal({ session, onComplete }) {
  const [username, setUsername] = useState('');
  const [displayPref, setDisplayPref] = useState('real_name');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg("El nombre de usuario es obligatorio.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let avatar_url = null;

      // 1. Upload Avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatar_url = publicUrlData.publicUrl;
      }

      // 2. Insert into perfiles table (this enforces unique username)
      const { error: profileError } = await supabase
        .from('perfiles')
        .insert([
          { 
            id: session.user.id, 
            username: username.toLowerCase().trim(), 
            avatar_url: avatar_url,
            display_preference: displayPref 
          }
        ]);

      if (profileError) {
        if (profileError.code === '23505') { // Unique violation
          throw new Error("Ese nombre de usuario ya está ocupado. Elige otro.");
        }
        throw profileError;
      }

      // 3. Update auth metadata so we know onboarding is done and we have the data
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          onboarding_complete: true,
          username: username.toLowerCase().trim(),
          avatar_url: avatar_url,
          display_preference: displayPref
        }
      });

      if (updateError) throw updateError;

      // Finish
      onComplete();

    } catch (error) {
      setErrorMsg(error.message || "Ocurrió un error al guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '30px',
        width: '100%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
      }}>
        <h2 className="gold-gradient-text" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.8rem' }}>Completa tu Perfil</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.9rem' }}>
          Configura tu identidad en Veta & Vigor.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Avatar Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label htmlFor="avatar-upload" style={{
              width: '100px', height: '100px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.05)', border: '2px dashed var(--accent-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              overflow: 'hidden', position: 'relative'
            }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera size={30} color="var(--accent-gold)" />
              )}
            </label>
            <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Toca para subir foto</span>
          </div>

          {/* Username */}
          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>Nombre de Usuario (Único)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '15px', top: '15px', color: 'var(--text-muted)' }}>@</span>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} // only alphanumeric & underscore
                className="input-field" 
                style={{ paddingLeft: '35px', marginBottom: 0 }}
                placeholder="atleta_vv"
                required
              />
            </div>
          </div>

          {/* Display Preference */}
          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>¿Cómo quieres que te llamen en la App?</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div 
                onClick={() => setDisplayPref('real_name')}
                style={{ 
                  flex: 1, padding: '12px', textAlign: 'center', borderRadius: '10px', cursor: 'pointer',
                  border: displayPref === 'real_name' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                  backgroundColor: displayPref === 'real_name' ? 'var(--accent-gold-dim)' : 'rgba(255,255,255,0.05)'
                }}>
                Nombre Real
              </div>
              <div 
                onClick={() => setDisplayPref('username')}
                style={{ 
                  flex: 1, padding: '12px', textAlign: 'center', borderRadius: '10px', cursor: 'pointer',
                  border: displayPref === 'username' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                  backgroundColor: displayPref === 'username' ? 'var(--accent-gold-dim)' : 'rgba(255,255,255,0.05)'
                }}>
                Usuario (@)
              </div>
            </div>
          </div>

          {errorMsg && <p style={{ color: 'var(--error-red)', fontSize: '0.9rem', textAlign: 'center', margin: 0 }}>{errorMsg}</p>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            {loading ? <Loader className="fa-spin" size={20} /> : <><CheckCircle size={20} /> Entrar al Cuartel</>}
          </button>
        </form>
      </div>
    </div>
  );
}
