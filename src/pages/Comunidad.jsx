import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { MessageCircle, Send, ShieldAlert, Lock, ArrowRight, User, X, ImagePlus, Heart, Award, Trophy, Loader } from 'lucide-react';

export default function Comunidad({ session }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [planReal, setPlanReal] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Estados nuevos para Moderación y Respuestas
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [muroFama, setMuroFama] = useState(null);
  const [mutedUsers, setMutedUsers] = useState([]);
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';

  const [activeTab, setActiveTab] = useState('feed');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const getBadgeForWorkouts = (count) => {
    if (count >= 100) return { name: 'Titán del Vigor', icon: '💎', color: '#00d2ff' };
    if (count >= 50) return { name: 'Oro Vigoroso', icon: '🥇', color: 'var(--accent-gold)' };
    if (count >= 25) return { name: 'Plata Pura', icon: '🥈', color: '#c0c0c0' };
    if (count >= 10) return { name: 'Acero Templado', icon: '🥉', color: '#cd7f32' };
    return { name: 'Semilla Híbrida', icon: '🍃', color: '#4cd137' };
  };

  useEffect(() => {
    if (activeTab === 'leaderboard' && (!leaderboard || leaderboard.length === 0)) {
      const fetchLeaderboard = async () => {
        setLoadingLeaderboard(true);
        const { data, error } = await supabase.rpc('get_leaderboard');
        if (!error && data) {
          setLeaderboard(data || []);
        }
        setLoadingLeaderboard(false);
      };
      fetchLeaderboard();
    }
  }, [activeTab, leaderboard]);

  // Verificación en Tiempo Real de la Membresía
  useEffect(() => {
    const verificarNivel = async () => {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('plan_membresia, chat_bloqueado, usuarios_silenciados, reto_activo_id, reto_completado')
          .eq('id', session?.user.id)
          .single();
        
        if (error) throw error;
        
        if (data?.usuarios_silenciados) {
          setMutedUsers(data.usuarios_silenciados);
        }
        
        if (data?.chat_bloqueado) {
          setIsBanned(true);
          setLoading(false);
          return;
        }
        
        const planActual = data?.plan_membresia || session?.user.user_metadata?.plan_membresia || 'Socio Aurum';
        setPlanReal(planActual);
        
        const isEntrenador = localStorage.getItem('user_role') === 'entrenador';
        const estaEnReto = data?.reto_activo_id ? true : false;
        const retoTerminado = data?.reto_completado === true;
        const esSuscritoBase = ['Socio Argentum', 'Socio Aurum'].includes(planActual);

        const tieneAcceso = planActual?.includes('Pro') || planActual?.includes('Élite') || planActual === 'Socio Fundador Vitalicio' || planActual === 'Plan Platinum' || planActual === 'Prueba Gratis (7 Días)' || planActual.toLowerCase().includes('administrador') || estaEnReto || isEntrenador || (esSuscritoBase && retoTerminado);
        setIsVip(tieneAcceso);

        if (!tieneAcceso) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error verificando nivel VIP:", err);
        setLoading(false);
      }
    };
    verificarNivel();
  }, [session]);

  // Cargar Muro de la Fama para todos
  useEffect(() => {
    const fetchMuro = async () => {
      const { data: muroData } = await supabase
        .from('muro_fama')
        .select('*, perfiles(full_name, username, avatar_url, plan_membresia)')
        .eq('estado', 'publicado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (muroData) {
        const plan = muroData.perfiles?.plan_membresia || '';
        const isPaidUser = ['Socio Fundador Vitalicio', 'Plan Platinum', 'Prueba Gratis (7 Días)', 'Socio Aurum', 'Socio Argentum'].includes(plan) || plan.toLowerCase().includes('administrador');
        if (isPaidUser) {
          setMuroFama(muroData);
        }
      }
    };
    fetchMuro();
  }, []);

  // Cargar Mensajes y Suscripción si es VIP
  useEffect(() => {
    if (!isVip) return;

    const fetchMensajes = async () => {
      const { data, error } = await supabase
        .from('chat_mensajes')
        .select('*')
        .eq('room_id', 'vip_comunidad')
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setMensajes(data);
      }
      setLoading(false);
    };

    fetchMensajes();

    const canal = supabase.channel('public:chat_mensajes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensajes', filter: "room_id=eq.vip_comunidad" }, payload => {
        if (payload.eventType === 'INSERT') {
          setMensajes(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'DELETE') {
          setMensajes(prev => prev.filter(m => m.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setMensajes(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [isVip]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);

  // Compresión de imagen
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_WIDTH = 1080;
          const MAX_HEIGHT = 1080;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          }, 'image/jpeg', 0.8); // 80% calidad
        };
      };
    });
  };

  const handleImageSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("La imagen es demasiado grande. Máximo 10MB antes de compresión.");
        return;
      }
      setSelectedImage(file);
    }
  };

  const checkDailyImageLimit = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isoDate = today.toISOString();

      const { count, error } = await supabase
        .from('chat_mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', session?.user.id)
        .not('image_url', 'is', null)
        .gte('created_at', isoDate);
        
      if (error) {
        console.error("Error validando límite de fotos:", error);
        return true; // Bloqueamos por seguridad si la red falla
      }
        
      return count >= 4; // true significa que ESTÁ sobre el límite
    } catch (err) {
      console.error("Error catastrófico validando límite:", err);
      return true;
    }
  };

  const toggleLike = async (msg) => {
    const userId = session?.user.id;
    let currentLikes = msg.likes || [];
    
    const hasLiked = currentLikes.includes(userId);
    let newLikes;
    
    if (hasLiked) {
      newLikes = currentLikes.filter(id => id !== userId);
    } else {
      newLikes = [...currentLikes, userId];
    }
    
    // Actualización visual rápida (Optimistic Update)
    setMensajes(prev => prev.map(m => m.id === msg.id ? { ...m, likes: newLikes } : m));

    // Base de datos
    await supabase.from('chat_mensajes').update({ likes: newLikes }).eq('id', msg.id);
  };


  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() && !selectedImage) return;

    if (editingMsg) {
      setIsUploading(true);
      await supabase.from('chat_mensajes').update({ mensaje: nuevoMensaje.trim() }).eq('id', editingMsg.id);
      setEditingMsg(null);
      setNuevoMensaje('');
      const ta = document.getElementById('comunidad-textarea');
      if (ta) ta.style.height = 'auto';
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    let imageUrl = null;

    if (selectedImage) {
      // Validar límite
      const isOverLimit = await checkDailyImageLimit();
      if (isOverLimit) {
        alert("Has alcanzado tu límite de 4 fotos por día. ¡Vuelve a intentarlo mañana!");
        setIsUploading(false);
        setSelectedImage(null);
        return;
      }

      try {
        const compressedFile = await compressImage(selectedImage);
        const fileExt = 'jpg';
        const fileName = `${session?.user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat_images')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat_images')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      } catch (err) {
        alert("Hubo un error subiendo la foto. Asegúrate de que el bucket 'chat_images' existe y es público.");
        setIsUploading(false);
        return;
      }
    }

    const metadata = session?.user.user_metadata || {};
    const username = metadata.username || 'Atleta VIP';
    const avatar = metadata.avatar_url || '';
    const nivel = metadata.nivel || 'Semilla';

    const msgData = {
      room_id: 'vip_comunidad',
      sender_id: session?.user.id,
      sender_name: username,
      sender_avatar: avatar,
      sender_level: nivel,
      mensaje: nuevoMensaje.trim() || '📸 Foto',
      image_url: imageUrl,
      reply_to_id: replyingTo?.id || null,
      reply_to_name: replyingTo?.sender_name || null,
      reply_to_text: replyingTo?.mensaje || null,
    };

    setNuevoMensaje(''); 
    const ta = document.getElementById('comunidad-textarea');
    if (ta) ta.style.height = 'auto';
    setReplyingTo(null);
    setSelectedImage(null);

    await supabase.from('chat_mensajes').insert([msgData]);
    setIsUploading(false);
  };

  const handleReport = async () => {
    if (!selectedMsg) return;
    if (!window.confirm('¿Estás seguro de reportar este mensaje por violar las reglas de la comunidad?')) return;
    
    try {
      await supabase.from('chat_mensajes').update({ is_reported: true }).eq('id', selectedMsg.id);
      alert('Mensaje reportado. Un administrador lo revisará pronto.');
      setSelectedMsg(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMuteUser = async () => {
    if (!selectedMsg) return;
    const userIdToMute = selectedMsg.sender_id;
    const userName = selectedMsg.sender_name;
    
    if (!window.confirm(`¿Estás seguro de silenciar a @${userName}? Se ocultarán todos sus mensajes pasados y futuros en tu cuenta.`)) return;
    
    const newMuted = [...mutedUsers, userIdToMute];
    setMutedUsers(newMuted);
    setSelectedMsg(null);

    try {
      await supabase.from('perfiles').update({ usuarios_silenciados: newMuted }).eq('id', session?.user.id);
      alert(`Has silenciado a @${userName}.`);
    } catch (e) {
      console.error(e);
      alert("Error al silenciar usuario.");
    }
  };

  const handleDelete = async () => {
    if (!selectedMsg) return;
    const isMine = selectedMsg.sender_id === session?.user.id;
    if (!isAdmin && !isMine) return;

    if (window.confirm('¿Borrar mensaje para todos? Esta acción es irreversible.')) {
      const { data, error } = await supabase.from('chat_mensajes').delete().eq('id', selectedMsg.id).select();
      if (error) {
        alert("Error de Supabase: " + error.message);
      } else {
        alert(isAdmin ? "¡PUM! Mensaje borrado con Modo Dios." : "Mensaje borrado exitosamente.");
      }
      setSelectedMsg(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--accent-gold)' }}>Cargando la Tribu...</div>;
  }

  const renderFeedContent = () => {
    if (isBanned) {
      return (
        <div className="container" style={{ padding: '20px', paddingBottom: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(145deg, #1a0505 0%, #2a0808 100%)', border: '1px solid rgba(229, 80, 57, 0.3)', width: '100%' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(229, 80, 57, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <ShieldAlert size={40} color="#e55039" />
            </div>
            <h2 style={{ color: '#e55039', marginBottom: '15px', fontSize: '1.5rem' }}>Acceso Bloqueado</h2>
            <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '0' }}>
              Has sido bloqueado temporalmente de la Tribu V&V debido a múltiples reportes.
            </p>
          </div>
        </div>
      );
    }

    if (!isVip) {
      const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
      const esSuscritoBase = ['Socio Argentum', 'Socio Aurum'].includes(suscripcion);

      return (
        <div className="container" style={{ padding: '20px', paddingBottom: '100px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(145deg, #15151a 0%, #1a1a24 100%)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <MessageCircle size={40} color="var(--accent-gold)" />
            </div>
            
            <h2 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.8rem' }}>La Tribu V&V</h2>
            
            {esSuscritoBase ? (
              <>
                <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '30px' }}>
                  Únete a nuestra comunidad oficial en Telegram.
                </p>
                <a 
                  href="https://t.me/+pGO8UWXImukxZGVh" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: '#0088cc', color: '#fff', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', textDecoration: 'none', marginBottom: '40px', boxShadow: '0 5px 20px rgba(0, 136, 204, 0.4)' }}
                >
                  <i className="fa-brands fa-telegram" style={{ fontSize: '1.4rem' }}></i> Unirme al Grupo
                </a>
              </>
            ) : (
              <div style={{ marginBottom: '40px' }}>
                <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '15px' }}>
                  Conéctate con la Tribu V&V.
                </p>
                <div style={{ padding: '15px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <Lock size={24} color="var(--accent-gold)" />
                  <p style={{ color: 'var(--accent-gold)', margin: 0, fontWeight: 'bold' }}>Acceso Restringido</p>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Adquiere una Membresía VIP para unirte.</span>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                <Lock size={18} color="var(--accent-gold)" />
                <h3 className="gold-gradient-text" style={{ margin: 0, fontSize: '1.2rem' }}>Sala VIP Exclusiva</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', maxWidth: '300px', margin: '0 auto' }}>
                El Chat está reservado para el <strong>Plan Platinum</strong>, <strong>Socios Vitalicios</strong> y Atletas VIP que superaron el Reto Vigor 21.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>

          {/* ÁREA DE MENSAJES */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '140px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {(!mensajes || mensajes.length === 0) && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '50px' }}>
                Sé el primero en hablar en la Tribu VIP.
              </div>
            )}
            
            {mensajes.filter(msg => !mutedUsers.includes(msg.sender_id)).map((msg) => {
              const isMine = msg.sender_id === session?.user.id;
              const currentLikes = msg.likes || [];
              const hasLiked = currentLikes.includes(session?.user.id);
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: currentLikes.length > 0 ? '5px' : '0' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', opacity: 0.9, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                    {msg.sender_avatar ? (
                      <img src={msg.sender_avatar} alt="avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={12} color="#ccc" />
                      </div>
                    )}
                    <span style={{ color: isMine ? 'var(--accent-gold)' : '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>@{msg.sender_name}</span>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', color: '#ccc' }}>{msg.sender_level}</span>
                  </div>

                  <div 
                    onClick={() => setSelectedMsg(msg)}
                    style={{
                      cursor: 'pointer',
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: '16px',
                      borderBottomRightRadius: isMine ? '4px' : '16px',
                      borderBottomLeftRadius: isMine ? '16px' : '4px',
                      backgroundColor: msg.sender_id === 'system' ? 'rgba(76, 209, 55, 0.15)' : (isMine ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                      border: msg.sender_id === 'system' ? '1px solid rgba(76, 209, 55, 0.3)' : (isMine ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'),
                      color: '#fff',
                      fontSize: '0.95rem',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      position: 'relative'
                  }}>
                    {msg.reply_to_text && (
                      <div style={{ padding: '6px 10px', backgroundColor: 'rgba(0,0,0,0.3)', borderLeft: '3px solid var(--accent-gold)', borderRadius: '4px', marginBottom: '8px', fontSize: '0.8rem', opacity: 0.8 }}>
                        <strong style={{ color: 'var(--accent-gold)', display: 'block', marginBottom: '2px' }}>@{msg.reply_to_name}</strong>
                        <p style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.reply_to_text}</p>
                      </div>
                    )}
                    
                    {msg.image_url && (
                      <img 
                        src={msg.image_url} 
                        alt="Upload" 
                        onClick={(e) => { e.stopPropagation(); setFullScreenImage(msg.image_url); }}
                        style={{ width: '100%', borderRadius: '8px', marginBottom: msg.mensaje !== '📸 Foto' ? '10px' : '0', maxHeight: '250px', objectFit: 'cover', cursor: 'zoom-in' }} 
                      />
                    )}
                    
                    {msg.mensaje !== '📸 Foto' && msg.mensaje}

                    {msg.is_reported && isAdmin && (
                      <div style={{ marginTop: '5px', fontSize: '0.7rem', color: '#e55039', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={12} /> Reportado
                      </div>
                    )}
                    
                    {/* Botón de Like interactivo */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleLike(msg); }}
                      style={{ 
                        position: 'absolute', bottom: '-12px', right: isMine ? 'auto' : '-10px', left: isMine ? '-10px' : 'auto',
                        backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.75rem', color: hasLiked ? '#e55039' : '#888', fontWeight: 'bold',
                        cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.4)', transition: 'all 0.2s ease'
                      }}>
                      <Heart size={14} fill={hasLiked ? '#e55039' : 'transparent'} color={hasLiked ? '#e55039' : '#888'} />
                      {currentLikes.length > 0 && <span>{currentLikes.length}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ position: 'fixed', bottom: '60px', left: 0, right: 0, zIndex: 100, backgroundColor: '#1a1a24', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Preview Selected Image */}
            {selectedImage && (
              <div style={{ padding: '10px 15px', backgroundColor: 'rgba(212, 175, 55, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={URL.createObjectURL(selectedImage)} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '5px' }} />
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Imagen seleccionada</span>
                </div>
                <button onClick={() => setSelectedImage(null)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {replyingTo && (
              <div style={{ padding: '10px 15px', backgroundColor: 'rgba(212, 175, 55, 0.1)', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 'bold', display: 'block' }}>Respondiendo a @{replyingTo.sender_name}</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.mensaje}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', padding: '5px' }}>
                  <X size={18} />
                </button>
              </div>
            )}

            {editingMsg && (
              <div style={{ padding: '10px 15px', backgroundColor: 'rgba(76, 209, 55, 0.1)', borderBottom: '1px solid rgba(76, 209, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.75rem', color: '#4cd137', fontWeight: 'bold', display: 'block' }}>Editando tu mensaje</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editingMsg.mensaje}</p>
                </div>
                <button onClick={() => { setEditingMsg(null); setNuevoMensaje(''); }} style={{ background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', padding: '5px' }}>
                  <X size={18} />
                </button>
              </div>
            )}

            <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: '8px', padding: '15px', alignItems: 'center' }}>
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleImageSelect}
                style={{ display: 'none' }} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                disabled={isUploading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-gold)',
                  padding: '10px',
                  cursor: 'pointer'
                }}
              >
                <ImagePlus size={24} />
              </button>

              <textarea
                id="comunidad-textarea"
                value={nuevoMensaje}
                onChange={(e) => {
                  setNuevoMensaje(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((nuevoMensaje.trim() || selectedImage) && !isUploading) {
                      enviarMensaje(e);
                    }
                  }
                }}
                placeholder="Mensaje..."
                disabled={isUploading}
                rows={1}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px',
                  padding: '12px 15px',
                  color: '#fff',
                  fontSize: '1rem',
                  outline: 'none',
                  minWidth: '0',
                  resize: 'none',
                  overflowY: 'auto',
                  fontFamily: 'inherit',
                  lineHeight: '1.4'
                }}
              />
              <button 
                type="submit"
                disabled={(!nuevoMensaje.trim() && !selectedImage) || isUploading}
                style={{
                  backgroundColor: (nuevoMensaje.trim() || selectedImage) && !isUploading ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                  color: (nuevoMensaje.trim() || selectedImage) && !isUploading ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (nuevoMensaje.trim() || selectedImage) && !isUploading ? 'pointer' : 'default',
                  transition: 'all 0.3s',
                  flexShrink: 0
                }}
              >
                {isUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <Send size={20} style={{ marginLeft: '-2px' }} />}
              </button>
            </form>
          </div>
        </>
      );
    };

    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', 
        backgroundColor: 'var(--bg-color)', 
        backgroundImage: 'linear-gradient(rgba(10,10,12,0.85), rgba(10,10,12,0.95)), url(/assets/chat_bg_user.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'relative' 
      }}>
        
        {/* Header Común */}
        <div style={{ padding: '15px 20px', backgroundColor: 'rgba(212, 175, 55, 0.05)', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert color="var(--accent-gold)" size={24} />
          <div>
            <h2 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: 0 }}>Comunidad V&V</h2>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.85rem' }}>La élite que no se rinde.</p>
          </div>
        </div>
  
        {/* Tabs para TODOS */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)' }}>
          <button 
            onClick={() => setActiveTab('feed')}
            style={{ flex: 1, padding: '15px 0', background: 'transparent', border: 'none', borderBottom: activeTab === 'feed' ? '2px solid var(--accent-gold)' : '2px solid transparent', color: activeTab === 'feed' ? 'var(--accent-gold)' : '#888', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s' }}>
            <MessageCircle size={18} /> Tribu VIP
          </button>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            style={{ flex: 1, padding: '15px 0', background: 'transparent', border: 'none', borderBottom: activeTab === 'leaderboard' ? '2px solid var(--accent-gold)' : '2px solid transparent', color: activeTab === 'leaderboard' ? 'var(--accent-gold)' : '#888', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s' }}>
            <Trophy size={18} /> Muro del Vigor
          </button>
        </div>
  
        {/* CONTENIDO FEED */}
        {activeTab === 'feed' && renderFeedContent()}
  
        {/* MURO DEL VIGOR - LEADERBOARD (VISIBLE PARA TODOS) */}
        {activeTab === 'leaderboard' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '100px' }}>
            
            {/* MURO DE LA FAMA BANNER AQUI */}
            {muroFama && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(0,0,0,0.5) 100%)', 
                border: '1px solid var(--accent-gold)', 
                borderRadius: '16px', 
                padding: '15px', 
                marginBottom: '20px', 
                display: 'flex', 
                gap: '15px', 
                alignItems: 'center',
                boxShadow: '0 5px 20px rgba(212, 175, 55, 0.15)'
              }}>
                <div style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
                  <img 
                    src={muroFama.perfiles?.avatar_url || '/assets/niveles/semilla.png'} 
                    alt="Atleta del mes" 
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }} 
                  />
                  <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: 'var(--accent-gold)', borderRadius: '50%', padding: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                    <Award size={14} color="#000" />
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 3px 0', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}>
                    ATLETA VIGOR DEL MES <span style={{ color: '#fff', fontWeight: 'normal', fontSize: '0.8rem' }}>({muroFama.mes_anio})</span>
                  </h4>
                  <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>{muroFama.perfiles?.full_name || muroFama.perfiles?.username}</h3>
                  <p style={{ margin: 0, color: '#ddd', fontSize: '0.85rem', fontStyle: 'italic' }}>"{muroFama.frase_motivadora}"</p>
                </div>
              </div>
            )}
  
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <Trophy size={40} color="var(--accent-gold)" style={{ marginBottom: '10px' }} />
              <h2 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>Muro del Vigor</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Los atletas con mayor constancia histórica.</p>
            </div>

          {loadingLeaderboard ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
              <Loader size={30} className="fa-spin gold-gradient-text" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!leaderboard || leaderboard.length === 0) && (
                <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Aún no hay atletas en el muro.</div>
              )}
              {leaderboard && leaderboard.map((user, idx) => {
                const badge = getBadgeForWorkouts(user.total_workouts ? parseInt(user.total_workouts) : 0);
                const isTop3 = idx < 3;
                return (
                  <div key={user.user_id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '15px', borderRadius: '16px',
                    background: isTop3 ? 'linear-gradient(90deg, rgba(212, 175, 55, 0.15) 0%, rgba(0,0,0,0.4) 100%)' : 'rgba(255,255,255,0.03)',
                    border: isTop3 ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ 
                        width: '30px', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center',
                        color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#666'
                      }}>
                        #{idx + 1}
                      </div>
                      <img 
                        src={user.avatar_url || '/assets/niveles/semilla.png'} 
                        alt="avatar" 
                        style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${badge.color}` }} 
                      />
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', color: '#fff', fontSize: '1rem' }}>{user.nombre_completo || user.username}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem' }}>{badge.icon}</span>
                          <span style={{ fontSize: '0.75rem', color: badge.color, fontWeight: 'bold', textTransform: 'uppercase' }}>{badge.name}</span>
                          
                          {user.retos_completados > 0 && (
                            <span style={{ marginLeft: '5px', backgroundColor: 'rgba(212, 175, 55, 0.2)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(212,175,55,0.4)' }}>
                              <i className="fa-solid fa-fire-flame-curved"></i> {user.retos_completados} Reto{user.retos_completados > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{user.total_workouts}</div>
                      <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Rutinas</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div 
          onClick={() => setFullScreenImage(null)}
          style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <img src={fullScreenImage} alt="Fullscreen" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
      )}

      {/* BOTTOM SHEET / MODAL DE OPCIONES */}
      {selectedMsg && (
        <div 
          onClick={() => setSelectedMsg(null)} 
          style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(3px)' }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ width: '100%', background: '#1a1a24', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '25px 20px 40px 20px', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}
          >
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--accent-gold)', fontSize: '1rem', textAlign: 'center' }}>Opciones del Mensaje</h3>
            
            <button 
              onClick={() => { setReplyingTo(selectedMsg); setSelectedMsg(null); }} 
              style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '1.2rem' }}>↩️</span> Responder
            </button>

            {selectedMsg.sender_id === session?.user.id && selectedMsg.mensaje !== '📸 Foto' && (
              <button 
                onClick={() => { setEditingMsg(selectedMsg); setNuevoMensaje(selectedMsg.mensaje); setSelectedMsg(null); }} 
                style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.2rem' }}>✏️</span> Editar Mensaje
              </button>
            )}

            {selectedMsg.sender_id !== session?.user.id && selectedMsg.sender_id !== 'system' && (
              <button 
                onClick={handleMuteUser} 
                style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.2rem' }}>🔇</span> Silenciar a @{selectedMsg.sender_name}
              </button>
            )}

            <button 
              onClick={handleReport} 
              style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: '#e55039', fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '1.2rem' }}>🚨</span> Reportar a Moderación
            </button>

            {(isAdmin || selectedMsg.sender_id === session?.user.id) && (
              <button 
                onClick={handleDelete} 
                style={{ width: '100%', padding: '15px', background: 'rgba(229, 80, 57, 0.15)', border: '1px solid rgba(229, 80, 57, 0.5)', borderRadius: '12px', color: '#e55039', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.2rem' }}>🗑️</span> {isAdmin && selectedMsg.sender_id !== session?.user.id ? 'Eliminar (Modo Dios)' : 'Eliminar Mensaje'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
