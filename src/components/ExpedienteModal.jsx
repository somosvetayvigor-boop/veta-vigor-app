import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { compressImage } from '../utils/imageUtils';
import { Camera, Upload, ChevronRight, LogOut } from 'lucide-react';

export default function ExpedienteModal({ session, onComplete, onSkip }) {
  const meta = session?.user?.user_metadata || {};
  const [form, setForm] = useState({
    peso: meta.peso || meta.peso_inicial || '',
    porcentaje_grasa: meta.porcentaje_grasa || '',
    masa_muscular: meta.masa_muscular || ''
  });
  const [fotoAntes, setFotoAntes] = useState(meta.foto_antes || null);
  const [isUploading, setIsUploading] = useState(false);

  const isFormValid = !!form.peso;

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    try {
      // Se comprime antes de subir: una foto de galería sin tocar son 3-8 MB,
      // y comprimida ronda los 250 KB. Con 1080px y calidad 80 la comparación
      // antes/después se sigue viendo igual de bien.
      const compressedFile = await compressImage(file);
      const fileName = `${session?.user.id}_antes_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('fotos_progreso')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('fotos_progreso').getPublicUrl(fileName);
      setFotoAntes(data.publicUrl);
    } catch (e) {
      console.error(e);
      alert('Error al subir la foto');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!isFormValid) return;
    setIsUploading(true);
    try {
      const updateData = {
        ...form,
        peso_inicial: form.peso, // El peso ingresado por primera vez es también el inicial
        foto_antes: fotoAntes,
        expediente_completado: true
      };
      
      await supabase.auth.updateUser({ data: updateData });
      await supabase.from('perfiles').update(updateData).eq('id', session?.user.id);
      
      onComplete();
    } catch (e) {
      console.error(e);
      alert("Error al guardar datos");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#0a0a0f',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '30px',
        width: '100%', maxWidth: '450px', border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Expediente Físico</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ingresa tus métricas iniciales para que nuestro algoritmo pueda registrar tu progreso real.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* FOTO ANTES (OBLIGATORIA) */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <label style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
              Foto de Estado Físico Actual <span style={{ color: 'var(--accent-gold)' }}><br/>(Altamente Recomendada)</span>
            </label>
            <div style={{
              width: '150px', height: '200px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', 
              border: fotoAntes ? '2px solid var(--accent-gold)' : '2px dashed #555',
              margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden'
            }}>
              {fotoAntes ? (
                <img src={fotoAntes} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera size={40} style={{ opacity: 0.3, color: '#fff' }} />
              )}
              <label style={{
                position: 'absolute', bottom: '10px', right: '10px', background: 'var(--accent-gold)', color: '#000',
                width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
              }}>
                {isUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <Upload size={20} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} disabled={isUploading} />
              </label>
            </div>
          </div>

          {/* METRICAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Peso Actual (kg) *</label>
              <input type="number" required value={form.peso} onChange={e => setForm({...form, peso: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Grasa (%)</label>
              <input type="number" value={form.porcentaje_grasa} onChange={e => setForm({...form, porcentaje_grasa: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Musculatura (kg)</label>
              <input type="number" value={form.masa_muscular} onChange={e => setForm({...form, masa_muscular: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
            </div>
          </div>

          {isFormValid && (!form.porcentaje_grasa || !form.masa_muscular || !fotoAntes) && (
            <div style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', border: '1px dashed var(--accent-gold)', borderRadius: '10px', padding: '12px', marginTop: '5px' }}>
              <p style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', margin: 0, textAlign: 'center', lineHeight: '1.4' }}>
                ⚠️ <strong>Nota:</strong> Es muy sugerible completar todos tus datos y foto inicial para que el algoritmo de la app funcione mejor y midas tu progreso real.
              </p>
            </div>
          )}

          <button 
            onClick={handleSave} 
            disabled={!isFormValid || isUploading}
            className="btn-primary" 
            style={{ 
              marginTop: '10px', 
              padding: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px',
              opacity: isFormValid ? 1 : 0.5,
              transition: 'opacity 0.3s'
            }}
          >
            {isUploading ? 'Guardando...' : 'Comenzar Entrenamiento'} <ChevronRight size={20} />
          </button>

          <button 
            onClick={() => {
              supabase.auth.signOut().catch(console.warn);
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
            }}
            style={{ 
              background: 'transparent', 
              color: 'var(--error-red)', 
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

          {onSkip && (
            <button 
              onClick={onSkip}
              style={{ 
                background: 'transparent', 
                color: 'var(--text-muted)', 
                border: 'none', 
                display: 'block', 
                width: '100%',
                marginTop: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline'
              }}
            >
              Omitir por ahora
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
