import localforage from 'localforage';

// REGLA DE PRECEDENCIA (auditoría de persistencia, 2026-08-16):
// esto es una caché de SOLO LECTURA para pintar la UI al instante mientras
// SQLite/Supabase todavía están respondiendo -- nunca la fuente de verdad.
// El patrón correcto en cada pantalla que la usa es: leer de acá primero
// (síncrono a ojos del usuario), y en cuanto llegue el dato fresco de
// SQLite/Supabase, ese manda y se vuelve a guardar acá con saveX(). Nunca al
// revés: si un dato difiere entre esta caché y SQLite/Supabase, SQLite/
// Supabase gana siempre. Ver docs/FUENTES_DE_VERDAD_PERSISTENCIA.md.

// Inicializar la base de datos IndexedDB
const store = localforage.createInstance({
  name: 'VetaVigorDB',
  description: 'Almacenamiento Offline-First para Veta & Vigor'
});

// Helper para evitar que IndexedDB se cuelgue infinitamente cuando el WebView despierta
const withTimeout = (promise, ms = 5000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('IDB timeout')), ms))
  ]);
};

export const DatabaseManager = {
  // ================= PERFILES =================
  saveProfile: async (userId, profileData) => {
    try {
      const existing = await withTimeout(store.getItem(`profile_${userId}`)) || {};
      const merged = { ...existing, ...profileData };
      await withTimeout(store.setItem(`profile_${userId}`, merged));
    } catch (e) {
      console.warn('DatabaseManager: Error saving profile (timeout or idb issue)', e);
    }
  },
  getProfile: async (userId) => {
    try {
      return await withTimeout(store.getItem(`profile_${userId}`));
    } catch (e) {
      console.warn('DatabaseManager: Error getting profile', e);
      return null;
    }
  },

  // ================= RUTINAS =================
  saveRoutines: async (cacheKey, data) => {
    try {
      await withTimeout(store.setItem(`routines_${cacheKey}`, data));
    } catch (e) {
      console.warn('DatabaseManager: Error saving routines', e);
    }
  },
  getRoutines: async (cacheKey) => {
    try {
      return await withTimeout(store.getItem(`routines_${cacheKey}`));
    } catch (e) {
      console.warn('DatabaseManager: Error getting routines', e);
      return null;
    }
  },

  // ================= CHECK-INS =================
  saveCheckin: async (userId, dateStr, status) => {
    try {
      await withTimeout(store.setItem(`checkin_${dateStr}_${userId}`, status));
    } catch (e) {
      console.warn('DatabaseManager: Error saving checkin', e);
    }
  },
  getCheckin: async (userId, dateStr) => {
    try {
      return await withTimeout(store.getItem(`checkin_${dateStr}_${userId}`));
    } catch (e) {
      console.warn('DatabaseManager: Error getting checkin', e);
      return null;
    }
  },

  // ================= ADMIN / ENTRENADOR =================
  saveAdminData: async (key, data) => {
    try {
      await store.setItem(`admin_${key}`, data);
    } catch (e) {
      console.error('DatabaseManager: Error saving admin data', e);
    }
  },
  getAdminData: async (key) => {
    try {
      return await store.getItem(`admin_${key}`);
    } catch (e) {
      console.error('DatabaseManager: Error getting admin data', e);
      return null;
    }
  },

  // ================= BIENESTAR (DÍAS DE DESCANSO) =================
  saveBienestar: async (userId, dateStr, habitos) => {
    try {
      await withTimeout(store.setItem(`bienestar_${dateStr}_${userId}`, habitos));
    } catch (e) {
      console.warn('DatabaseManager: Error saving bienestar', e);
    }
  },
  getBienestar: async (userId, dateStr) => {
    try {
      return await withTimeout(store.getItem(`bienestar_${dateStr}_${userId}`));
    } catch (e) {
      console.warn('DatabaseManager: Error getting bienestar', e);
      return null;
    }
  },

  // ================= GENERAL =================
  clearAll: async () => {
    try {
      await store.clear();
      console.log('DatabaseManager: Almacenamiento limpiado correctamente.');
    } catch (e) {
      console.error('DatabaseManager: Error clearing store', e);
    }
  }
};
