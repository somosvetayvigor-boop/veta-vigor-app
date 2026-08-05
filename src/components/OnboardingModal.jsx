import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Camera, CheckCircle, Loader, LogOut } from 'lucide-react';

export default function OnboardingModal({ session, onComplete }) {
  const [username, setUsername] = useState('');
  const [displayPref, setDisplayPref] = useState('real_name');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [step, setStep] = useState(1); // 1 = Datos basicos, 2 = Rol

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setShowPhotoPrompt(false);
    }
  };

  const handlePhotoTap = (e) => {
    e.preventDefault();
    setShowPhotoPrompt(true);
  };

  const confirmarSubirFoto = () => {
    setShowPhotoPrompt(false);
    const input = document.getElementById('avatar-upload');
    if (input) {
      input.click();
      // Detectar si el picker falló (timeout de seguridad)
      setTimeout(() => {
        if (!avatarFile && !document.querySelector('input[type=file]:focus')) {
          // No hacemos nada extra, el usuario puede continuar sin foto
        }
      }, 1000);
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
        const fileName = `${session?.user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('fotos_progreso')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('fotos_progreso')
          .getPublicUrl(filePath);
          
        avatar_url = publicUrlData.publicUrl;
      }

      // 2. Upsert into perfiles table (this enforces unique username but allows updating existing profile)
      const { error: profileError } = await supabase
        .from('perfiles')
        .upsert([
          { 
            id: session?.user.id, 
            username: username.toLowerCase().trim(), 
            avatar_url: avatar_url,
            display_preference: displayPref,
            email: session?.user.email,
            full_name: session?.user.user_metadata?.nombre || session?.user.user_metadata?.nombre_completo || ''
          }
        ], { onConflict: 'id' });

      if (profileError) {
        if (profileError.code === '23505') { // Unique violation
          throw new Error("Ese nombre de usuario ya está ocupado. Elige otro.");
        }
        throw profileError;
      }

      // 3. Instead of completing onboarding, move to step 2
      setStep(2);
    } catch (error) {
      console.error(error);
      setErrorMsg("Ocurrió un error al guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = async (role) => {
    setLoading(true);
    try {
      // Set role in perfiles table
      await supabase.from('perfiles').update({ rol_usuario: role }).eq('id', session?.user.id);
      
      // Update local storage
      localStorage.setItem('user_role', role);

      // Finish onboarding
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          onboarding_complete: true,
          username: username.toLowerCase().trim(),
          display_preference: displayPref
        }
      });

      if (updateError) throw updateError;
      
      // Llamamos a onComplete para que el componente padre cierre el modal o siga con el cuestionario
      if (onComplete) {
        onComplete();
      } else {
        // Fallback: recargar la pagina
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Ocurrió un error al guardar tu rol.");
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

        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Avatar Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div 
              onClick={handlePhotoTap}
              style={{
                width: '100px', height: '100px', borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.05)', border: '2px dashed var(--accent-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                overflow: 'hidden', position: 'relative'
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : session?.user?.user_metadata?.avatar_url ? (
                <img src={session?.user.user_metadata.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera size={30} color="var(--accent-gold)" />
              )}
            </div>
            <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Toca para subir foto <span style={{color:'var(--text-muted)'}}>(Opcional)</span></span>
          </div>

          {/* Modal de permiso de foto */}
          {showPhotoPrompt && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}>
              <div style={{
                backgroundColor: '#1e1e22', borderRadius: '16px', padding: '25px',
                maxWidth: '340px', width: '100%', border: '1px solid rgba(212,175,55,0.3)',
                textAlign: 'center'
              }}>
                <Camera size={40} color="var(--accent-gold)" style={{ marginBottom: '15px' }} />
                <h3 style={{ marginBottom: '10px', fontSize: '1.1rem' }}>Acceso a tu Galería</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
                  Para subir tu foto de perfil, la app necesita acceso a tus fotos. 
                  Si tu celular no abre la galería, ve a <strong style={{color:'#fff'}}>Ajustes → Aplicaciones → Veta y Vigor → Permisos</strong> y activa "Fotos".
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => setShowPhotoPrompt(false)} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={confirmarSubirFoto} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--accent-gold)', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}
                  >
                    Abrir Galería
                  </button>
                </div>
              </div>
            </div>
          )}

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
            {loading ? <Loader className="fa-spin" size={20} /> : <><CheckCircle size={20} /> Siguiente Paso</>}
          </button>
          
          <button 
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{ 
              background: 'transparent', 
              color: 'var(--text-muted)', 
              border: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              marginTop: '5px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            <LogOut size={16} /> Cerrar Sesión
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '5px' }}>¿Cuál es tu objetivo en la app?</h3>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '10px' }}>
              Elige cómo usarás Veta & Vigor. Podrás cambiar esto más adelante en tu perfil.
            </p>

            <button 
              onClick={() => handleRoleSelection('atleta_normal')}
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(0,0,0,0.5) 100%)', border: '1px solid var(--accent-gold)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--accent-gold)' }}></div>
              <div style={{ background: 'rgba(212, 175, 55, 0.2)', padding: '15px', borderRadius: '50%' }}>
                <i className="fa-solid fa-dumbbell" style={{ fontSize: '24px', color: 'var(--accent-gold)' }}></i>
              </div>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-gold)' }}>Quiero Entrenar</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc', textAlign: 'center' }}>
                Busco mejorar mi físico, cumplir misiones y participar en la comunidad.
              </p>
              <div style={{ background: 'var(--accent-gold)', color: 'black', padding: '3px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' }}>Opción Recomendada</div>
            </button>

            <button 
              onClick={() => handleRoleSelection('entrenador')}
              disabled={loading}
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '50%' }}>
                <i className="fa-solid fa-users" style={{ fontSize: '24px', color: 'white' }}></i>
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>Soy Entrenador</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Quiero usar el Panel de Coach para profesionalizar y gestionar a mis propios alumnos.
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
