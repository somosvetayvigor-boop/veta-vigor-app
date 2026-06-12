import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
// Importamos supabase aunque en este caso la IA va por endpoint directo, pero podemos validarlo
import { supabase } from '../supabaseClient';

export default function Consultorio({ session }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'coach',
      text: `¡Hola ${session.user.user_metadata?.nombre || 'Atleta'}! Soy el Head Coach de Veta & Vigor. ¿En qué te puedo ayudar hoy con tu entrenamiento?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    try {
      // Usaremos el mismo endpoint de CF Pages que teníamos en V1
      // Necesitaremos mover el functions/api/chat.js a este nuevo proyecto
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'coach',
        text: data.reply || "Hubo un error al procesar la respuesta."
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'error',
        text: "Error de conexión. Intenta más tarde."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="container chat-container">
      <div style={{ textAlign: 'center', marginBottom: '10px', marginTop: '10px' }}>
        <h2 className="gold-gradient-text" style={{ fontSize: '1.4rem' }}>Consultorio V.I.P</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Asistencia con IA en tiempo real</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'var(--accent-gold-dim)' : 'rgba(255,255,255,0.05)',
              borderRight: msg.role === 'user' ? '3px solid var(--accent-gold)' : 'none',
              borderLeft: msg.role === 'coach' ? '3px solid var(--accent-gold)' : (msg.role === 'error' ? '3px solid var(--error-red)' : 'none'),
              padding: '12px 15px',
              borderRadius: '10px',
              maxWidth: '85%'
            }}
          >
            {msg.role === 'coach' && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '5px' }}>Head Coach V&V</div>}
            <p style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: msg.role === 'error' ? 'var(--error-red)' : 'white' }} dangerouslySetInnerHTML={{__html: msg.text.replace(/\n/g, '<br>')}}></p>
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '12px 15px', borderRadius: '10px', maxWidth: '85%' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Coach escribiendo...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-area">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Escribe tu consulta aquí..." 
          disabled={isTyping}
        />
        <button type="submit" disabled={isTyping || !input.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
