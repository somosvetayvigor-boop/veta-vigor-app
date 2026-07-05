import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Trash2, CheckCircle, MessageSquare, Image as ImageIcon } from 'lucide-react';

export default function AdminReportes() {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_mensajes')
      .select('*')
      .eq('is_reported', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReportes(data);
    }
    setLoading(false);
  };

  const descartarReporte = async (id) => {
    if (!window.confirm("¿Seguro que este mensaje cumple las normas y quieres quitarle el reporte?")) return;
    
    const { error } = await supabase
      .from('chat_mensajes')
      .update({ is_reported: false })
      .eq('id', id);

    if (!error) {
      setReportes(prev => prev.filter(r => r.id !== id));
      alert("Reporte descartado con éxito.");
    } else {
      alert("Error al descartar: " + error.message);
    }
  };

  const borrarMensaje = async (id) => {
    if (!window.confirm("¿BORRAR el mensaje (y la foto si tiene) definitivamente para todos los usuarios?")) return;

    const { error } = await supabase
      .from('chat_mensajes')
      .delete()
      .eq('id', id);

    if (!error) {
      setReportes(prev => prev.filter(r => r.id !== id));
      alert("Mensaje eliminado de la faz de la tierra.");
    } else {
      alert("Error al borrar: " + error.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-gold)' }}><i className="fa-solid fa-spinner fa-spin fa-2x"></i></div>;
  }

  if (reportes.length === 0) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <CheckCircle size={50} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', opacity: 0.5 }} />
        <h3 style={{ color: '#fff' }}>Bandeja Limpia</h3>
        <p style={{ color: 'var(--text-muted)' }}>No hay mensajes ni fotos reportadas en este momento.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ padding: '15px', background: 'rgba(229, 80, 57, 0.1)', border: '1px solid rgba(229, 80, 57, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldAlert color="#e55039" size={24} />
        <div>
          <h3 style={{ margin: 0, color: '#e55039', fontSize: '1.1rem' }}>Moderación Requerida</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>Tienes {reportes.length} mensaje(s) reportado(s) por la comunidad.</p>
        </div>
      </div>

      {reportes.map((reporte) => (
        <div key={reporte.id} className="card" style={{ padding: '20px', borderLeft: '4px solid #e55039' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Autor:</span>
              <h4 style={{ margin: '2px 0 0 0', color: 'var(--accent-gold)' }}>@{reporte.sender_name}</h4>
              <span style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(reporte.created_at).toLocaleString()}</span>
            </div>
            <span style={{ background: 'rgba(229, 80, 57, 0.2)', color: '#e55039', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              REPORTADO
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
            {reporte.image_url ? (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-gold)', marginBottom: '5px', fontSize: '0.85rem' }}>
                  <ImageIcon size={14} /> Foto adjunta
                </div>
                <img src={reporte.image_url} alt="Reportada" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #444', objectFit: 'contain', backgroundColor: '#000' }} />
              </div>
            ) : null}
            
            {reporte.mensaje !== '📸 Foto' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <MessageSquare size={16} color="#888" style={{ marginTop: '3px', flexShrink: 0 }} />
                <p style={{ margin: 0, color: '#fff', fontSize: '0.95rem', wordBreak: 'break-word' }}>"{reporte.mensaje}"</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => descartarReporte(reporte.id)}
              style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <CheckCircle size={16} color="#4cd137" /> Descartar Reporte
            </button>
            <button 
              onClick={() => borrarMensaje(reporte.id)}
              style={{ flex: 1, padding: '10px', background: 'rgba(229, 80, 57, 0.1)', border: '1px solid rgba(229, 80, 57, 0.5)', color: '#e55039', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <Trash2 size={16} /> Borrar Definitivo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
