import DatabaseService from '../services/DatabaseService';
import { supabase } from '../supabaseClient';

// Protocolos de Descanso Activo (DescansoActivoModal.jsx) cuyo id coincide
// con un hábito seleccionable en el check-in de Bienestar (MiRutina.jsx).
// Se usa para saber cuáles necesitan cruzar estado entre los dos sistemas
// para no pagar XP/monedas dos veces por lo mismo el mismo día.
export const PROTOCOLOS_COMPARTIDOS_CON_BIENESTAR = ['caminata', 'bicicleta', 'natacion'];

export function hoyStrLocal() {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
    + '-' + String(hoy.getDate()).padStart(2, '0');
}

function safeParseHabitos(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

/**
 * Lee (sin crear) la fila de checkins_bienestar de HOY para userId. Local
 * primero, respaldo a Supabase si local está vacío y hay red -- mismo
 * patrón que checkTodayStatus/recalcularRachaEnFondo en MiRutina.jsx. Si no
 * existe en ningún lado, devuelve un id nuevo SIN persistir nada -- quien
 * llama decide si hace falta guardar algo.
 */
export async function getOrCreateTodayBienestarRow(userId) {
  const fecha = hoyStrLocal();
  if (!userId) return { id: crypto.randomUUID(), habitos: [], fecha, isNew: true };

  const local = await DatabaseService.query(
    `SELECT id, habitos FROM checkins_bienestar WHERE user_id = ? AND fecha = ?`,
    [userId, fecha]
  );
  if (local && local.length > 0) {
    return { id: local[0].id, habitos: safeParseHabitos(local[0].habitos), fecha, isNew: false };
  }

  if (navigator.onLine) {
    try {
      const { data } = await supabase.from('checkins_bienestar')
        .select('id, habitos').eq('user_id', userId).eq('fecha', fecha);
      if (data && data.length > 0) {
        const habitos = safeParseHabitos(data[0].habitos);
        await DatabaseService.execute(
          `INSERT OR REPLACE INTO checkins_bienestar (id, user_id, fecha, habitos, is_dirty) VALUES (?, ?, ?, ?, 0)`,
          [data[0].id, userId, fecha, JSON.stringify(habitos)]
        );
        return { id: data[0].id, habitos, fecha, isNew: false };
      }
    } catch (e) {
      console.warn('getOrCreateTodayBienestarRow: fallback a Supabase falló:', e);
    }
  }

  return { id: crypto.randomUUID(), habitos: [], fecha, isNew: true };
}

/**
 * Marca un protocolo/hábito como hecho HOY, compartiendo la MISMA fila que
 * usa el check-in de Bienestar (mismo id reutilizado siempre) -- así
 * ninguno de los dos paga dos veces por el mismo protocolo el mismo día,
 * sin importar cuál de los dos lo complete primero.
 * @returns {Promise<{ yaHecho: boolean, habitos: string[] }>}
 */
export async function marcarProtocoloHecho(userId, protocoloId) {
  const row = await getOrCreateTodayBienestarRow(userId);
  if (row.habitos.includes(protocoloId)) {
    return { yaHecho: true, habitos: row.habitos };
  }

  const nuevosHabitos = [...row.habitos, protocoloId];
  await DatabaseService.execute(
    `INSERT OR REPLACE INTO checkins_bienestar (id, user_id, fecha, habitos, is_dirty) VALUES (?, ?, ?, ?, 1)`,
    [row.id, userId, row.fecha, JSON.stringify(nuevosHabitos)]
  );

  if (navigator.onLine) {
    supabase.from('checkins_bienestar').upsert({
      id: row.id, user_id: userId, fecha: row.fecha, habitos: nuevosHabitos
    }).then(({ error }) => {
      if (!error) DatabaseService.execute(`UPDATE checkins_bienestar SET is_dirty = 0 WHERE id = ?`, [row.id]);
    });
  }

  return { yaHecho: false, habitos: nuevosHabitos };
}
