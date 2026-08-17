// Helper compartido para tests de SyncService. NO es un archivo .test.js a
// propósito (vitest.config.js solo recoge *.test.js), así que vitest nunca
// intenta correrlo como suite.

import { vi } from 'vitest';

/**
 * El SDK de Supabase (postgrest-js) es "thenable": cada método de la cadena
 * (.select().eq().single(), o .upsert() awaited directo) devuelve el mismo
 * builder, y awaitarlo en cualquier punto de la cadena resuelve la consulta.
 * Este helper imita eso: todos los métodos de la cadena devuelven el mismo
 * objeto (así que awaitar en cualquier punto de la cadena funciona), y cada
 * uno es un vi.fn() para poder comprobar con qué se llamó (ej. qué payload
 * exacto le mandó el push a .update()/.upsert()).
 */
export function makeThenable(result) {
  const obj = {};
  ['select', 'eq', 'gte', 'order', 'limit', 'single', 'update', 'upsert', 'insert'].forEach((metodo) => {
    obj[metodo] = vi.fn(() => obj);
  });
  obj.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return obj;
}

/**
 * Como makeThenable, pero para cuando el mismo `supabase.from('tabla')` se
 * usa dos veces en el mismo flujo con operaciones distintas (ej. un
 * .select().single() para leer el estado fresco, seguido de un .update()
 * para escribirlo) y cada una necesita resolver a algo distinto.
 * `resultsByOp` es un mapa { select: {...}, update: {...}, upsert: {...},
 * insert: {...} } -- el resultado se elige según cuál de esos métodos
 * arrancó la cadena más reciente.
 */
export function makeOperationAwareThenable(resultsByOp) {
  const obj = {};
  let operacionActual = null;
  ['select', 'update', 'upsert', 'insert'].forEach((metodo) => {
    obj[metodo] = vi.fn(() => {
      operacionActual = metodo;
      return obj;
    });
  });
  ['eq', 'gte', 'order', 'limit', 'single'].forEach((metodo) => {
    obj[metodo] = vi.fn(() => obj);
  });
  obj.then = (resolve, reject) => Promise.resolve(resultsByOp[operacionActual]).then(resolve, reject);
  return obj;
}
