import { describe, it, expect } from 'vitest';
import { debeAplicarProgresoPendiente, calcularRetosCompletadosCount } from '../retoProgresoGuard';

describe('debeAplicarProgresoPendiente', () => {
  it('el servidor sigue atrás: sí se aplica el progreso encolado', () => {
    const pendiente = { reto_dia_actual: 5, reto_completado: false };
    const servidor = { reto_dia_actual: 4, reto_completado: false };
    expect(debeAplicarProgresoPendiente(pendiente, servidor)).toBe(true);
  });

  it('el servidor ya está exactamente igual: NO se reaplica (evita duplicar)', () => {
    const pendiente = { reto_dia_actual: 5, reto_completado: false };
    const servidor = { reto_dia_actual: 5, reto_completado: false };
    expect(debeAplicarProgresoPendiente(pendiente, servidor)).toBe(false);
  });

  it('el servidor ya avanzó más allá (otro dispositivo, u online mientras tanto): se descarta', () => {
    const pendiente = { reto_dia_actual: 5, reto_completado: false };
    const servidor = { reto_dia_actual: 8, reto_completado: false };
    expect(debeAplicarProgresoPendiente(pendiente, servidor)).toBe(false);
  });

  it('caso borde día 20->21: servidor ya en día 21 pero reto_completado aún false -- SÍ se aplica el cierre pendiente', () => {
    const pendiente = { reto_dia_actual: 21, reto_completado: true };
    const servidor = { reto_dia_actual: 21, reto_completado: false };
    expect(debeAplicarProgresoPendiente(pendiente, servidor)).toBe(true);
  });

  it('el servidor no tiene reto_dia_actual todavía (null/undefined): se trata como 0, se aplica', () => {
    const pendiente = { reto_dia_actual: 1, reto_completado: false };
    const servidor = { reto_dia_actual: null, reto_completado: false };
    expect(debeAplicarProgresoPendiente(pendiente, servidor)).toBe(true);
  });
});

describe('calcularRetosCompletadosCount', () => {
  it('si el servidor ya tenía el reto marcado completado, no vuelve a sumar', () => {
    const servidor = { reto_completado: true, retos_completados_count: 3 };
    expect(calcularRetosCompletadosCount(servidor, true)).toBe(3);
  });

  it('si el servidor no lo tenía completado y la fila pendiente sí lo cierra, suma 1', () => {
    const servidor = { reto_completado: false, retos_completados_count: 3 };
    expect(calcularRetosCompletadosCount(servidor, true)).toBe(4);
  });

  it('si la fila pendiente no cierra el reto, no cambia el contador', () => {
    const servidor = { reto_completado: false, retos_completados_count: 3 };
    expect(calcularRetosCompletadosCount(servidor, false)).toBe(3);
  });

  it('contador ausente en el servidor se trata como 0', () => {
    const servidor = { reto_completado: false, retos_completados_count: null };
    expect(calcularRetosCompletadosCount(servidor, true)).toBe(1);
  });
});
