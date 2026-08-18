import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras el componente que lo llama está
 * montado -- para no tener que estar tocando el celular cada rato durante
 * un entrenamiento. Usa la Wake Lock API del navegador: el WebView de
 * Capacitor en Android la soporta desde hace años, así que no hace falta
 * ningún plugin nativo nuevo ni tocar el proyecto de Android. Si el
 * dispositivo no la soporta, no hace nada (silencioso, sin romper nada).
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let wakeLockSentinel = null;

    const solicitar = async () => {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      } catch (e) {
        console.warn('No se pudo mantener la pantalla encendida:', e);
      }
    };

    solicitar();

    // El navegador libera el wake lock solo apenas la app pasa a segundo
    // plano (se bloquea el celular, se cambia de app) -- hay que volver a
    // pedirlo cuando vuelve a primer plano, si no se queda apagado desde ahí.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') solicitar();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLockSentinel?.release().catch(() => {});
    };
  }, []);
}
