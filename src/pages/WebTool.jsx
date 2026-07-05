import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function WebTool() {
  const { toolName } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = React.useState(false);
  
  const tools = {
    'fuerza': {
      url: '/calculadora.html',
      title: 'Calculadora de Fuerza'
    },
    'composicion': {
      url: '/composicion.html',
      title: 'Composición Corporal'
    },
    'laboratorio': {
      url: '/laboratorio-vip.html',
      title: 'Laboratorio VIP'
    }
  };

  const tool = tools[toolName];

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    }

    const handleMessage = async (event) => {
      if (event.data && event.data.type === 'UPDATE_BODY_METRICS') {
        const { peso, grasa, masaMuscular } = event.data.payload;
        try {
          await supabase.auth.updateUser({
            data: {
              peso: peso,
              porcentaje_grasa: grasa,
              masa_muscular: masaMuscular
            }
          });
          setToast(true);
          setTimeout(() => setToast(false), 3000);
        } catch (err) {
          console.error("Error saving metrics:", err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toolName]);

  if (!tool) return <div style={{ color: '#fff', textAlign: 'center', marginTop: '50px' }}>Herramienta no encontrada</div>;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
      <div style={{ 
        padding: '15px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px', 
        backgroundColor: '#0c0d10', 
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-gold)' }}>{tool.title}</h2>
      </div>
      
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe 
          src={tool.url} 
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 'none',
            backgroundColor: '#000'
          }}
          title={tool.title}
        />

        {/* Toast Notificación */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(46, 204, 113, 0.9)', color: '#000', padding: '12px 20px',
            borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px',
            fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.3s ease-out', zIndex: 100
          }}>
            <CheckCircle size={18} /> Métricas guardadas en tu perfil
          </div>
        )}
      </div>
    </div>
  );
}

const styles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
