/**
 * Qué bonos de racha corresponde reclamar dado el estado actual del Reto 21.
 *
 * Espeja las condiciones que reclamar_bono_reto acepta en el servidor
 * (racha_actual >= mínimo de cada bono). Antes RutinaRetoPlayer.jsx comparaba
 * con === 7 / === 14: si la racha llegaba a esos números por un entrenamiento
 * normal (no un día del reto) o por una sincronización offline en vez de por
 * ESTA llamada síncrona, el bono se perdía para siempre porque la racha ya
 * nunca vuelve a valer exactamente 7 u 14 más adelante.
 *
 * Los cuatro bonos son independientes entre sí (cada uno con su propia
 * idempotency_key fija por usuario), así que se evalúan todos, no en
 * cascada: si la racha saltó de 5 a 15 de una vez, corresponde reclamar
 * el de 7 y el de 14 en la misma pasada.
 */
export function bonosAReclamar(rachaActual, retoFinalizado, perfilId) {
  const bonos = [];
  if (rachaActual >= 7) bonos.push({ tipo: '7_dias', key: `bono_7_${perfilId}` });
  if (rachaActual >= 14) bonos.push({ tipo: '14_dias', key: `bono_14_${perfilId}` });
  if (retoFinalizado) {
    bonos.push({ tipo: '21_dias', key: `bono_21_${perfilId}` });
    if (rachaActual >= 21) bonos.push({ tipo: 'perfecto_21', key: `bono_perf_21_${perfilId}` });
  }
  return bonos;
}
