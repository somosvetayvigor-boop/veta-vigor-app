import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Lock, Clock } from 'lucide-react';

export default function Consultorio({ session }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userLevel, setUserLevel] = useState('Semilla');
  const [preguntasHoy, setPreguntasHoy] = useState(0);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    verificarAccesoYMensajes();
  }, [session]);

  const verificarAccesoYMensajes = async () => {
    setLoading(true);
    // 1. Verificar plan del usuario
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('plan_membresia, nivel')
      .eq('id', session.user.id)
      .single();
    
    const plan = perfil?.plan_membresia || session.user.user_metadata?.plan_membresia || '';
    const nivel = perfil?.nivel || session.user.user_metadata?.nivel || 'Semilla';
    setUserLevel(nivel);

  const isVip = plan === 'Socio Fundador Vitalicio' || plan === 'Plan Platinum' || plan === 'Prueba Gratis (7 Días)' || plan === 'Entrenador Élite' || plan === 'Entrenador Pro' || plan.toLowerCase().includes('administrador');
    setHasAccess(isVip);

    if (!isVip) {
      setLoading(false);
      return;
    }

    // 2. Cargar historial de mensajes del usuario
    await loadMessages();
    setLoading(false);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('consultorio_mensajes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error cargando mensajes", error);
      return;
    }

    const now = new Date();
    const visibleMessages = [];
    let isWaitingForCoach = false;
    let timeToWait = 0;

    let countHoy = 0;
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);

    data.forEach(msg => {
      // Contar preguntas de hoy (solo mensajes del usuario)
      if (msg.role === 'user') {
        const msgDate = new Date(msg.created_at);
        if (msgDate >= startOfToday) {
          countHoy++;
        }
      }

      if (msg.role === 'coach' && msg.deliver_at) {
        const deliverDate = new Date(msg.deliver_at);
        if (deliverDate > now) {
          isWaitingForCoach = true;
          timeToWait = deliverDate.getTime() - now.getTime();
        } else {
          visibleMessages.push(msg);
        }
      } else {
        visibleMessages.push(msg);
      }
    });

    setPreguntasHoy(countHoy);
    
    if (visibleMessages.length === 0) {
      visibleMessages.push({
        id: 'welcome',
        role: 'coach',
        text: `¡Hola ${session.user.user_metadata?.nombre || 'Atleta'}! Soy el Head Coach de Veta & Vigor.\n\nTienes derecho a 2 consultas diarias sobre tu entrenamiento. ¿En qué te ayudo hoy?`
      });
    }

    setMessages(visibleMessages);

    // Si hay un mensaje programado en el futuro, activamos la ilusión de typing y programamos su aparición
    if (isWaitingForCoach) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        loadMessages(); // Recargar para que aparezca
      }, timeToWait);
    }
  };

  const isBusinessHours = () => {
    const hour = new Date().getHours();
    return hour >= 4 && hour <= 23; // 4:00 AM a 11:59 PM
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!isBusinessHours()) {
      alert("El Coach descansa. Horario de atención: 4:00 AM - 11:59 PM.");
      return;
    }

    if (preguntasHoy >= 2) {
      alert("Has alcanzado el límite de 2 consultas diarias. Entrena duro y regresa mañana.");
      return;
    }

    const userText = input.trim();
    setInput('');
    const ta = document.getElementById('consultorio-textarea');
    if (ta) ta.style.height = 'auto';
    
    // Optimistic UI
    const tempUserMsg = { id: Date.now().toString(), role: 'user', text: userText };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsTyping(true);
    setPreguntasHoy(prev => prev + 1);

    try {
      // 1. Guardar mensaje del usuario en DB
      await supabase.from('consultorio_mensajes').insert([{
        user_id: session.user.id,
        role: 'user',
        text: userText,
        deliver_at: new Date().toISOString()
      }]);

      // Preparar historial para Gemini (solo los últimos 6 mensajes visibles para no saturar)
      const historyForGemini = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, text: m.text }));

      // 2. Llamar a la API segura (Cloudflare)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userText, 
          history: historyForGemini,
          nivel: userLevel
        })
      });
      
      const data = await res.json();
      const coachReply = data.reply || `[Error: ${data.error || "Hubo un error al procesar tu plan."}]`;

      // 3. Guardar respuesta del Coach con RETRASO DE 15 MINUTOS
      const deliverTime = new Date(Date.now() + 15 * 60000); // 15 minutos en el futuro
      
      await supabase.from('consultorio_mensajes').insert([{
        user_id: session.user.id,
        role: 'coach',
        text: coachReply,
        deliver_at: deliverTime.toISOString()
      }]);

      // Mantenemos "isTyping = true" y programamos la recarga para dentro de 15 min.
      setTimeout(() => {
        setIsTyping(false);
        loadMessages();
      }, 15 * 60000);

    } catch (error) {
      console.error(error);
      setIsTyping(false);
      alert("Error de conexión. Intenta más tarde.");
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--accent-gold)' }}>Cargando Consultorio VIP...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="container" style={{ padding: '20px', paddingBottom: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(145deg, #15151a 0%, #1a1a24 100%)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <Lock size={40} color="var(--accent-gold)" />
          </div>
          <h2 style={{ color: '#fff', marginBottom: '15px', fontSize: '1.5rem' }}>Acceso Restringido</h2>
          <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '0' }}>
            El Head Coach virtual está reservado exclusivamente para atletas en los planes <strong>Platinum</strong> y <strong>Vitalicios</strong>. 
            Mejora tu plan para tener soporte 1 a 1 en todo momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container chat-container" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Info */}
      <div style={{ padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a24' }}>
        <div>
          <h2 className="gold-gradient-text" style={{ fontSize: '1.2rem', margin: 0 }}>Consultorio V.I.P</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
            <span style={{ fontSize: '0.75rem', color: isBusinessHours() ? '#44bd32' : '#e55039', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {isBusinessHours() ? 'En Línea' : 'Fuera de Horario'}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Consultas de hoy</span>
          <br/>
          <strong style={{ color: preguntasHoy >= 2 ? '#e55039' : 'var(--accent-gold)' }}>{preguntasHoy} / 2</strong>
        </div>
      </div>

      <div className="chat-messages" style={{ flex: 1, paddingBottom: '20px' }}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'var(--accent-gold-dim)' : 'rgba(255,255,255,0.05)',
              borderRight: msg.role === 'user' ? '3px solid var(--accent-gold)' : 'none',
              borderLeft: msg.role === 'coach' ? '3px solid var(--accent-gold)' : 'none',
              padding: '12px 15px',
              borderRadius: '10px',
              maxWidth: '85%'
            }}
          >
            {msg.role === 'coach' && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '5px' }}>Head Coach V&V</div>}
            <p style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: 'white', lineHeight: '1.5' }} dangerouslySetInnerHTML={{__html: msg.text.replace(/\n/g, '<br>')}}></p>
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '12px 15px', borderRadius: '10px', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="typing-indicator" style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-gold)', borderRadius: '50%', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-gold)', borderRadius: '50%', animation: 'pulse 1.5s infinite ease-in-out 0.2s' }}></div>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-gold)', borderRadius: '50%', animation: 'pulse 1.5s infinite ease-in-out 0.4s' }}></div>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-gold)', fontStyle: 'italic' }}>El Coach está revisando tu caso...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-area" style={{ backgroundColor: '#1a1a24', padding: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <textarea 
          id="consultorio-textarea"
          value={input} 
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isTyping && preguntasHoy < 2 && isBusinessHours()) {
                handleSend(e);
              }
            }
          }}
          placeholder={preguntasHoy >= 2 ? "Límite diario alcanzado" : (!isBusinessHours() ? "Horario de 4am a 11:59pm" : "Escribe tu consulta...")}
          disabled={isTyping || preguntasHoy >= 2 || !isBusinessHours()}
          rows={1}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '12px 15px', color: '#fff', resize: 'none', overflowY: 'auto', outline: 'none', fontFamily: 'inherit', lineHeight: '1.4' }}
        />
        <button 
          type="submit" 
          disabled={isTyping || !input.trim() || preguntasHoy >= 2 || !isBusinessHours()}
          style={{ backgroundColor: (input.trim() && !isTyping && preguntasHoy < 2 && isBusinessHours()) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', color: (input.trim() && !isTyping && preguntasHoy < 2 && isBusinessHours()) ? '#000' : '#888', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Send size={18} style={{ marginLeft: '-2px' }} />
        </button>
      </form>
    </div>
  );
}
