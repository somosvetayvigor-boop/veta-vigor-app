import localforage from 'localforage';

// Inicializar la base de datos IndexedDB
const store = localforage.createInstance({
  name: 'VetaVigorDB',
  description: 'Almacenamiento Offline-First para Veta & Vigor'
});

// Helper para evitar que IndexedDB se cuelgue infinitamente cuando el WebView despierta
const withTimeout = (promise, ms = 2000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('IDB timeout')), ms))
  ]);
};

export const DatabaseManager = {
  // ================= PERFILES =================
  saveProfile: async (userId, profileData) => {
    try {
      await withTimeout(store.setItem(`profile_${userId}`, profileData));
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
