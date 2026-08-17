import localforage from 'localforage';

// REGLA DE PRECEDENCIA (auditoría de persistencia, 2026-08-16):
// esto NO es una caché general de rutinas -- es el almacén de rutinas que el
// usuario descargó a propósito con el botón "Descargar para offline"
// (RutinaDetail.jsx). Es una instancia de localforage separada de
// DatabaseManager.js (nombre de base distinto, así que no colisionan), con
// un propósito distinto: disponibilidad sin conexión, no velocidad de
// pintado. SQLite/Supabase siguen siendo la fuente de verdad de la rutina en
// sí; esto es una copia congelada al momento de la descarga. Ver
// docs/FUENTES_DE_VERDAD_PERSISTENCIA.md.

// Configure localforage store
localforage.config({
  name: 'VetaVigorApp',
  storeName: 'rutinas_offline'
});

/**
 * Guarda la información completa de una rutina en caché local
 * @param {string} rutinaId - ID de la rutina
 * @param {object} rutinaData - Datos de la rutina incluyendo ejercicios
 */
export const guardarRutinaLocal = async (rutinaId, rutinaData) => {
  try {
    await localforage.setItem(`rutina_${rutinaId}`, {
      ...rutinaData,
      cachedAt: new Date().toISOString()
    });
    console.log('Rutina guardada localmente para modo offline');
    return true;
  } catch (error) {
    console.error('Error guardando rutina en LocalDB:', error);
    return false;
  }
};

/**
 * Obtiene la información de una rutina desde caché local
 * @param {string} rutinaId - ID de la rutina
 */
export const obtenerRutinaLocal = async (rutinaId) => {
  try {
    const data = await localforage.getItem(`rutina_${rutinaId}`);
    return data;
  } catch (error) {
    console.error('Error obteniendo rutina de LocalDB:', error);
    return null;
  }
};

/**
 * Guarda las rutinas asignadas al usuario para mostrar en MiRutina.jsx
 */
export const guardarMisRutinasLocal = async (userId, misRutinas) => {
  try {
    await localforage.setItem(`mis_rutinas_${userId}`, misRutinas);
    return true;
  } catch {
    return false;
  }
};

/**
 * Obtiene las rutinas asignadas al usuario desde caché local
 */
export const obtenerMisRutinasLocal = async (userId) => {
  try {
    return await localforage.getItem(`mis_rutinas_${userId}`);
  } catch {
    return null;
  }
};
