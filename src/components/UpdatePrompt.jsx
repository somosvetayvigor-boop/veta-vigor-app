import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Opcional: checar periódicamente por actualizaciones
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // Revisar cada hora
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '20px',
      right: '20px',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--accent-gold)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      boxShadow: '0 5px 20px rgba(0,0,0,0.8)',
      zIndex: 99999,
      animation: 'fadeInUp 0.3s ease-out'
    }}>
      <div style={{ fontSize: '0.9rem' }}>
        ¡Nueva versión lista!
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          style={{ background: 'transparent', color: '#888', padding: '5px 10px' }}
          onClick={() => setNeedRefresh(false)}
        >
          X
        </button>
        <button 
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000', padding: '5px 15px', borderRadius: '15px', fontWeight: 'bold' }}
          onClick={() => updateServiceWorker(true)}
        >
          Actualizar
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
