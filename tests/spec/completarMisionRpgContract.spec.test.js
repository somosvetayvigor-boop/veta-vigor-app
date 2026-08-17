import { describe, it, expect } from 'vitest';

/**
 * Espejo en JS del contrato de negocio de public.completar_mision_rpg, tal
 * como está HOY en VETA_VIGOR_FIX_ZONA_HORARIA_RPG.sql (última versión
 * aplicada sobre esa función, 2026-08-16).
 *
 * ESTO NO PRUEBA LA FUNCIÓN REAL. Vitest corre en Node y no tiene acceso a la
 * base de Supabase (no hay service role key ni proyecto de staging
 * configurado) -- la función de verdad solo se puede probar corriendo SQL
 * contra Postgres. Lo que hay aquí es una traducción manual a JS del mismo
 * árbol de decisiones, para poder fijarlo con tests legibles y detectar
 * cuando alguien cambia una lado sin el otro.
 *
 * SI TOCAS LA FUNCIÓN SQL: actualiza también las funciones de abajo (y
 * viceversa si cambias esto primero). La fuente de verdad real sigue siendo
 * la función en Supabase -- ver pg_get_functiondef('completar_mision_rpg')
 * para el estado en vivo antes de asumir que este archivo sigue vigente.
 */

// Espeja el IF/ELSIF de recompensa por origen (líneas ~94-108 del SQL).
function recompensaPorOrigen(origen, xpSolicitadoPorCliente) {
  if (origen === 'entrenamiento') {
    return { xp: 10, monedas: 5 };
  }
  if (origen === 'descanso_activo') {
    // El cliente propone un XP (15-20 según ProgressionEngine); el servidor
    // solo lo acota a ese rango, no lo reemplaza por un valor fijo.
    const propuesto = xpSolicitadoPorCliente ?? 15;
    const xp = Math.min(Math.max(propuesto, 15), 20);
    return { xp, monedas: 15 };
  }
  if (/^reto_vigor21_dia_/.test(origen)) {
    return { xp: 10, monedas: 5 };
  }
  return null; // 'Origen no reconocido'
}

// Espeja el cálculo de racha (líneas ~144-160 del SQL). Fechas como 'YYYY-MM-DD'.
function calcularRacha({ rachaActual, fechaUltimaMision, hoy }) {
  if (fechaUltimaMision === null) return 1;
  if (fechaUltimaMision === hoy) return Math.max(rachaActual, 1);

  const [y, m, d] = hoy.split('-').map(Number);
  const fechaAyer = new Date(Date.UTC(y, m - 1, d));
  fechaAyer.setUTCDate(fechaAyer.getUTCDate() - 1);
  const ayerStr = fechaAyer.toISOString().slice(0, 10);

  if (fechaUltimaMision === ayerStr) return rachaActual + 1;
  return 1; // se rompió la racha: hoy - fecha_ultima > 1 día
}

// Espeja el namespacing de la idempotency key (línea ~112 del SQL):
// v_key := v_uid::text || ':' || p_idempotency_key
function construirIdempotencyKey(userId, idempotencyKeyCliente) {
  return `${userId}:${idempotencyKeyCliente}`;
}

describe('contrato de recompensa por origen', () => {
  it('entrenamiento normal: 10 XP, 5 monedas, sin importar lo que pida el cliente', () => {
    expect(recompensaPorOrigen('entrenamiento', 999)).toEqual({ xp: 10, monedas: 5 });
  });

  it('descanso_activo: acota lo pedido por el cliente al rango 15-20, nunca lo reemplaza', () => {
    expect(recompensaPorOrigen('descanso_activo', undefined)).toEqual({ xp: 15, monedas: 15 });
    expect(recompensaPorOrigen('descanso_activo', 10)).toEqual({ xp: 15, monedas: 15 }); // se sube al piso
    expect(recompensaPorOrigen('descanso_activo', 18)).toEqual({ xp: 18, monedas: 15 }); // se respeta
    expect(recompensaPorOrigen('descanso_activo', 999)).toEqual({ xp: 20, monedas: 15 }); // se baja al techo
  });

  it('cualquier día del Reto 21: 10 XP, 5 monedas', () => {
    expect(recompensaPorOrigen('reto_vigor21_dia_1', 999)).toEqual({ xp: 10, monedas: 5 });
    expect(recompensaPorOrigen('reto_vigor21_dia_21', 999)).toEqual({ xp: 10, monedas: 5 });
  });

  it('origen no reconocido no da recompensa (la RPC devuelve error)', () => {
    expect(recompensaPorOrigen('lo-que-sea', 10)).toBeNull();
  });
});

describe('contrato de cálculo de racha', () => {
  it('primera misión de la cuenta (nunca entrenó): racha = 1', () => {
    expect(calcularRacha({ rachaActual: 0, fechaUltimaMision: null, hoy: '2026-08-16' })).toBe(1);
  });

  it('segunda misión del mismo día: la racha no sube dos veces, pero tampoco baja de 1', () => {
    expect(calcularRacha({ rachaActual: 3, fechaUltimaMision: '2026-08-16', hoy: '2026-08-16' })).toBe(3);
    expect(calcularRacha({ rachaActual: 0, fechaUltimaMision: '2026-08-16', hoy: '2026-08-16' })).toBe(1);
  });

  it('misión el día siguiente consecutivo: la racha sube en 1', () => {
    expect(calcularRacha({ rachaActual: 3, fechaUltimaMision: '2026-08-15', hoy: '2026-08-16' })).toBe(4);
  });

  it('cruce de mes/año al calcular "ayer": sigue contando como consecutivo', () => {
    expect(calcularRacha({ rachaActual: 5, fechaUltimaMision: '2026-07-31', hoy: '2026-08-01' })).toBe(6);
    expect(calcularRacha({ rachaActual: 1, fechaUltimaMision: '2025-12-31', hoy: '2026-01-01' })).toBe(2);
  });

  it('se saltó uno o más días: la racha se reinicia a 1', () => {
    expect(calcularRacha({ rachaActual: 10, fechaUltimaMision: '2026-08-13', hoy: '2026-08-16' })).toBe(1);
  });
});

describe('contrato de idempotencia', () => {
  it('la clave real que se guarda va namespaced por usuario', () => {
    expect(construirIdempotencyKey('user-1', 'reto_vigor21_dia_5_user-1')).toBe(
      'user-1:reto_vigor21_dia_5_user-1'
    );
  });

  it('dos usuarios distintos con la misma clave de cliente no colisionan', () => {
    const claveA = construirIdempotencyKey('user-A', 'reto_vigor21_dia_1');
    const claveB = construirIdempotencyKey('user-B', 'reto_vigor21_dia_1');
    expect(claveA).not.toBe(claveB);
  });
});
