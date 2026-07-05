import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Camera, Upload, ChevronRight } from 'lucide-react';

export default function Onboarding({ session, onComplete }) {
  const [form, setForm] = useState({
    peso_inicial: '',
    peso: '',
    porcentaje_grasa: '',
    masa_muscular: ''
  });
  const [fotoAntes, setFotoAntes] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const isFormValid = 
    form.peso_inicial && 
    form.peso && 
    form.porcentaje_grasa && 
    form.masa_muscular && 
    fotoAntes;

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}_antes_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fotos_progreso')
        .upload(fileName, file);

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
        foto_antes: fotoAntes,
        onboarding_completado: true
      };
      
      await supabase.auth.updateUser({ data: updateData });
      await supabase.from('perfiles').update(updateData).eq('id', session.user.id);
      
      onComplete(updateData);
    } catch (e) {
      console.error(e);
      alert("Error al guardar datos");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '50px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '20px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '10px' }}>Expediente Físico</h1>
        <p style={{ color: 'var(--text-muted)' }}>Para diseñar tu progresión, necesitamos tus métricas iniciales obligatorias.</p>
      </div>

      <div className="card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* FOTO ANTES (OBLIGATORIA) */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <label style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
            Foto de Estado Físico Actual (Obligatoria)
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
            <label style={{ color: '#888', fontSize: '0.85rem' }}>Peso Inicial (kg) *</label>
            <input type="number" required value={form.peso_inicial} onChange={e => setForm({...form, peso_inicial: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: '0.85rem' }}>Peso Actual (kg) *</label>
            <input type="number" required value={form.peso} onChange={e => setForm({...form, peso: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: '0.85rem' }}>Grasa (%) *</label>
            <input type="number" required value={form.porcentaje_grasa} onChange={e => setForm({...form, porcentaje_grasa: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: '0.85rem' }}>Musculatura (kg) *</label>
            <input type="number" required value={form.masa_muscular} onChange={e => setForm({...form, masa_muscular: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginTop: '5px' }} />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={!isFormValid || isUploading}
          className="btn-primary" 
          style={{ 
            marginTop: '20px', 
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

      </div>
    </div>
  );
}
