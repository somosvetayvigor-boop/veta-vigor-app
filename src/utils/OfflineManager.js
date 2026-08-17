import { supabase } from '../supabaseClient';

const QUEUE_KEY = 'veta_vigor_offline_queue';

// Función para añadir a la cola
export const addToOfflineQueue = (actionType, payload) => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ actionType, payload, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

/**
 * Actualiza user_metadata y, si falla (offline o error de red), la encola
 * para reintentar en el próximo processOfflineQueue() en vez de perderse en
 * silencio. Nunca lanza -- user_metadata es siempre una copia rápida/caché,
 * nunca la fuente de verdad (esa es la tabla `perfiles`), así que un fallo
 * acá no debe abortar el flujo que la llama.
 */
export const actualizarAuthMetaConReintento = async (data) => {
  try {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
  } catch (e) {
    console.warn('No se pudo actualizar user_metadata, se reintentará offline:', e);
    addToOfflineQueue('UPDATE_AUTH_META', data);
  }
};

// Función para procesar la cola cuando haya internet
export const processOfflineQueue = async () => {
  if (!navigator.onLine) return;

  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  console.log(`Procesando ${queue.length} acciones offline...`);
  let successfulIndices = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      if (item.actionType === 'UPDATE_PERFIL') {
        await supabase.from('perfiles').update(item.payload.data).eq('id', item.payload.userId);
        successfulIndices.push(i);
      } 
      else if (item.actionType === 'INSERT_CHECKIN') {
        await supabase.from('checkins').insert([item.payload]);
        successfulIndices.push(i);
      }
      else if (item.actionType === 'UPDATE_AUTH_META') {
        await supabase.auth.updateUser({ data: item.payload });
        successfulIndices.push(i);
      }
      else if (item.actionType === 'INSERT_HISTORIAL') {
        await supabase.from('historial_entrenamientos').insert([item.payload]);
        successfulIndices.push(i);
      }
      // Agregar más tipos de acciones aquí (ej. records de rutina)
    } catch (e) {
      console.error('Error sincronizando item:', item, e);
      // No lo agregamos a successfulIndices para que se reintente la próxima vez
    }
  }

  // Filtrar los que se procesaron bien y conservar los que fallaron
  const remainingQueue = queue.filter((_, index) => !successfulIndices.includes(index));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
  
  return successfulIndices.length; // Retorna cuántos se sincronizaron
};
