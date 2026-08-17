// Helper compartido para tests de SyncService. NO es un archivo .test.js a
// propósito (vitest.config.js solo recoge *.test.js), así que vitest nunca
// intenta correrlo como suite.

/**
 * Fake en memoria de DatabaseService, con estado real (a diferencia de un
 * mock estático por-SQL) para que las pruebas de push/pull puedan comprobar
 * el ciclo completo: leer filas sucias -> escribir -> volver a comprobar si
 * queda algo sucio, y que las tres lecturas vean el mismo estado.
 *
 * Solo entiende las formas de SQL que SyncService.js realmente genera hoy
 * (ver ese archivo): no es un motor SQL genérico, es a propósito angosto.
 *
 * @param {Record<string, object[]>} seed filas iniciales por tabla
 */
export function createFakeDatabaseService(seed = {}) {
  const tables = {};
  for (const [nombre, filas] of Object.entries(seed)) {
    tables[nombre] = filas.map((f) => ({ ...f }));
  }
  const getTabla = (nombre) => (tables[nombre] ??= []);

  function extraerTabla(sql) {
    const m = sql.match(/FROM\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i);
    return m ? m[1] : null;
  }

  return {
    tables,

    query: async (sql, params = []) => {
      const tabla = extraerTabla(sql);
      const filas = getTabla(tabla);

      // ej: SELECT is_dirty FROM perfiles WHERE id = ?  (pullData, chequeo del perfil)
      if (sql.startsWith('SELECT is_dirty FROM')) {
        const fila = filas.find((f) => f.id === params[0]);
        return fila ? [fila] : [];
      }

      if (sql.includes('is_dirty = 1')) {
        let coincidencias = filas.filter((f) => f.is_dirty === 1);
        const colMatch = sql.match(/AND (\w+) = \?/);
        if (colMatch) {
          const valorUsuario = params[params.length - 1];
          coincidencias = coincidencias.filter((f) => f[colMatch[1]] === valorUsuario);
        }
        // ej: SELECT 1 AS x FROM tabla WHERE is_dirty = 1 AND col = ? LIMIT 1  (_quedanCambiosSinSubir)
        if (sql.startsWith('SELECT 1 AS x')) {
          return coincidencias.length ? [{ x: 1 }] : [];
        }
        return coincidencias;
      }

      return filas;
    },

    execute: async (sql, params = []) => {
      if (sql.includes('SET is_dirty = 0 WHERE id = ?')) {
        const tabla = extraerTabla(sql);
        const filas = getTabla(tabla);
        const fila = filas.find((f) => f.id === params[0]);
        if (fila) fila.is_dirty = 0;
        return 1;
      }
      return null;
    },

    executeBatch: async () => null,
  };
}
