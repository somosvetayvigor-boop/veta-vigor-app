import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Interceptar errores de Vite al cargar módulos dinámicos
window.addEventListener('vite:preloadError', async (event) => {
  
  if (!sessionStorage.getItem('vite-reload')) {
    event.preventDefault(); // Solo prevenimos si vamos a intentar recargar
    sessionStorage.setItem('vite-reload', 'true');
    
    // Limpiar Service Workers que puedan estar causando el ciclo
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      } catch(e) {}
    }
    
    window.location.reload(true);
  } else {
    // Si ya falló una vez, dejamos que el error fluya para que el ErrorBoundary lo atrape correctamente
    sessionStorage.removeItem('vite-reload');
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
