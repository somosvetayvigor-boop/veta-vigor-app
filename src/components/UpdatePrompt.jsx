import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWAUpdatePromptInner = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          try {
            r.update().catch(() => {});
          } catch (_) {}
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration info:', error);
    },
  });

  const isUpdating = useRef(false);
  const [updateText, setUpdateText] = useState('Actualizar');

  if (!needRefresh) return null;

  const handleUpdate = async () => {
    if (isUpdating.current) return;
    isUpdating.current = true;
    setUpdateText('Actualizando...');

    try {
      // Step 1: Try the standard approach first
      await updateServiceWorker(true);
      
      // Step 2: Brave fallback — if controllerchange didn't fire within 1.5s,
      // do a hard nuclear reset: unregister ALL SWs, clear ALL caches, then reload
      setTimeout(async () => {
        try {
          // Unregister all service workers so Brave doesn't serve stale content
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
          
          // Delete all caches
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        } catch (e) {
          console.log('Brave fallback cleanup error (non-critical):', e);
        }
        
        // Force a full reload bypassing any remaining cache
        // The SW will re-register automatically on next load via vite-plugin-pwa
        window.location.href = window.location.origin + window.location.pathname + '?_sw_update=' + Date.now();
      }, 1500);
    } catch (e) {
      console.log('SW update error, forcing hard reload:', e);
      // Last resort: just nuke everything
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (_) {}
      window.location.href = window.location.origin + window.location.pathname + '?_sw_update=' + Date.now();
    }
  };

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
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000', padding: '5px 15px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}
          onClick={handleUpdate}
          disabled={isUpdating.current}
        >
          {updateText}
        </button>
      </div>
    </div>
  );
};

const UpdatePrompt = () => {
  // En apps móviles nativas (Capacitor), los recursos ya están en el APK.
  // No se debe registrar un ServiceWorker de PWA para evitar InvalidStateError en WebView.
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  return <PWAUpdatePromptInner />;
};

export default UpdatePrompt;
