import localforage from 'localforage';

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
