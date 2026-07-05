import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { createPortal } from 'react-dom';
import { X, Send, Lock, ImagePlus } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

export default function AdminChatModal({ onClose, atleta, adminSession }) {
  const [chat, setChat] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchOrCreateChat();
  }, [atleta.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const fetchOrCreateChat = async () => {
    setLoading(true);
    // Buscar si ya existe un chat
    const { data: chats, error } = await supabase
      .from('chats_coaching')
      .select('*')
      .eq('atleta_id', atleta.id)
      .eq('admin_id', adminSession.user.id)
      .limit(1);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (chats && chats.length > 0) {
      setChat(chats[0]);
      await fetchMensajes(chats[0].id);
    } else {
      // Si no existe, crearlo, pero solo si enviamos un mensaje, así que por ahora no hacemos nada
      setChat(null);
    }
    setLoading(false);
  };

  const fetchMensajes = async (chatId) => {
    const { data, error } = await supabase
      .from('mensajes_coaching')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensajes(data);
    }
  };

  useEffect(() => {
    if (!chat?.id) return;

    const channel = supabase.channel('public:mensajes_coaching_admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes_coaching',
        filter: `chat_id=eq.${chat.id}`
      }, (payload) => {
        setMensajes(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats_coaching',
        filter: `id=eq.${chat.id}`
      }, (payload) => {
        setChat(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat?.id]);

  const handleImageSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("La imagen es demasiado grande. Máximo 10MB antes de compresión.");
        return;
      }
      setSelectedImage(file);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() && !selectedImage) return;
    setIsUploading(true);

    let currentChatId = chat?.id;

    // Si no hay chat, crearlo primero
    if (!currentChatId) {
      const { data: newChat, error: chatError } = await supabase
        .from('chats_coaching')
        .insert([{ atleta_id: atleta.id, admin_id: adminSession.user.id, estado: 'activo' }])
        .select()
        .single();
      
      if (chatError) {
        console.error("Error creando chat:", chatError);
        return;
      }
      setChat(newChat);
      currentChatId = newChat.id;
    } else if (chat.estado === 'cerrado') {
      // Reabrir el chat si estaba cerrado y el coach manda mensaje nuevo
      const { error } = await supabase
        .from('chats_coaching')
        .update({ estado: 'activo', updated_at: new Date() })
        .eq('id', currentChatId);
      if (!error) setChat({ ...chat, estado: 'activo' });
    }

    let imageUrl = null;
    if (selectedImage) {
      try {
        const compressedFile = await compressImage(selectedImage);
        const fileName = `coaching_${currentChatId}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('chat_images')
          .upload(fileName, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat_images')
          .getPublicUrl(fileName);
          
        imageUrl = publicUrl;
      } catch (err) {
        alert("Error subiendo foto: Asegúrate de que la cubeta 'chat_images' es pública.");
        setIsUploading(false);
        return;
      }
    }

    const { error: msgError } = await supabase
      .from('mensajes_coaching')
      .insert([{
        chat_id: currentChatId,
        emisor_id: adminSession.user.id,
        mensaje: nuevoMensaje.trim() || '📸 Foto',
        imagen_url: imageUrl
      }]);

    if (!msgError) {
      setNuevoMensaje('');
      setSelectedImage(null);
      const ta = document.getElementById('adminchat-textarea');
      if (ta) ta.style.height = 'auto';
      fetchMensajes(currentChatId);
    }
    setIsUploading(false);
  };

  const handleCerrarConversacion = async () => {
    if (!chat || chat.estado === 'cerrado') return;
    if (!window.confirm('¿Estás seguro de cerrar el chat? El usuario ya no podrá responder.')) return;

    const { error } = await supabase
      .from('chats_coaching')
      .update({ estado: 'cerrado', updated_at: new Date() })
      .eq('id', chat.id);

    if (!error) {
      setChat({ ...chat, estado: 'cerrado' });
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex',
      justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
    }}>
      <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', width: '100%', maxWidth: '500px', height: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 5px 0' }}>Chat con {atleta.full_name || atleta.username}</h3>
            {chat?.estado === 'cerrado' ? (
              <span style={{ color: '#e55039', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Lock size={12}/> Conversación Cerrada</span>
            ) : (
              <span style={{ color: '#78e08f', fontSize: '0.8rem' }}>🟢 Activo</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Action Bar (Close Chat) */}
        {chat?.estado === 'activo' && (
          <div style={{ padding: '10px 20px', background: 'rgba(229, 80, 57, 0.1)', borderBottom: '1px solid rgba(229, 80, 57, 0.2)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleCerrarConversacion} style={{ marginTop: '15px', background: 'rgba(229, 80, 57, 0.1)', color: '#e55039', border: '1px solid rgba(229, 80, 57, 0.3)', padding: '15px', borderRadius: '12px', width: '100%', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              🛑 Finalizar Conversación
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {loading && <p style={{ textAlign: 'center', color: '#888' }}>Cargando historial...</p>}
          {!loading && mensajes.length === 0 && (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>
              <p>Aún no hay mensajes con este atleta.</p>
              <p style={{ fontSize: '0.8rem' }}>Envía un mensaje para abrir el canal de comunicación.</p>
            </div>
          )}
          {mensajes.map(msg => {
            const isMe = msg.emisor_id === adminSession.user.id;
            return (
              <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  background: isMe ? 'linear-gradient(135deg, var(--accent-gold), #b38b22)' : 'rgba(255,255,255,0.1)',
                  color: isMe ? '#000' : '#fff',
                  padding: '12px 18px',
                  borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}>
                  {msg.imagen_url && (
                    <img 
                      src={msg.imagen_url} 
                      alt="Adjunto" 
                      onClick={() => setFullScreenImage(msg.imagen_url)}
                      style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', display: 'block' }} 
                    />
                  )}
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>{msg.mensaje}</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '5px', textAlign: isMe ? 'right' : 'left' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '15px 20px', background: '#0a0a0c', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {selectedImage && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
              <img src={URL.createObjectURL(selectedImage)} alt="Preview" style={{ height: '60px', borderRadius: '8px', border: '1px solid var(--accent-gold)' }} />
              <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: -5, right: -5, background: '#e55039', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', padding: '2px' }}>
                <X size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '0 15px', borderRadius: '25px' }}>
              <ImagePlus size={20} />
              <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            </label>
            <textarea 
              id="adminchat-textarea"
              value={nuevoMensaje}
              onChange={(e) => {
                setNuevoMensaje(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isUploading && (nuevoMensaje.trim() || selectedImage)) {
                    handleSend(e);
                  }
                }
              }}
              placeholder="Escribe un mensaje al atleta..." 
              disabled={isUploading}
              rows={1}
              style={{ flex: 1, padding: '12px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: '#1a1a1f', color: '#fff', fontSize: '0.95rem', outline: 'none', resize: 'none', overflowY: 'hidden', minHeight: '45px', maxHeight: '120px', display: 'flex', alignItems: 'center' }}
            />
            <button type="submit" disabled={isUploading || (!nuevoMensaje.trim() && !selectedImage)} style={{ background: 'linear-gradient(135deg, var(--accent-gold), #b38b22)', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'black', cursor: (isUploading || (!nuevoMensaje.trim() && !selectedImage)) ? 'not-allowed' : 'pointer', opacity: (isUploading || (!nuevoMensaje.trim() && !selectedImage)) ? 0.5 : 1 }}>
              {isUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <Send size={20} style={{ marginLeft: '3px' }} />}
            </button>
          </form>
        </div>

      </div>

      {/* FULLSCREEN IMAGE MODAL */}
      {fullScreenImage && createPortal(
        <div 
          onClick={() => setFullScreenImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'zoom-out' }}
        >
          <img src={fullScreenImage} alt="Zoomed" style={{ maxWidth: '95%', maxHeight: '90%', borderRadius: '16px', objectFit: 'contain' }} />
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
