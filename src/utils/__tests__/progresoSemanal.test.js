import { describe, it, expect } from 'vitest';
import { contarDiasEntrenadosSemana, META_DIAS_SEMANA } from '../progresoSemanal';

describe('META_DIAS_SEMANA', () => {
  it('es 7 (la semana completa)', () => {
    expect(META_DIAS_SEMANA).toBe(7);
  });
});

describe('contarDiasEntrenadosSemana', () => {
  it('sin ninguna fuente, devuelve 0', () => {
    expect(contarDiasEntrenadosSemana({})).toBe(0);
  });

  it('cuenta días únicos dentro de una sola fuente', () => {
    expect(contarDiasEntrenadosSemana({
      historialFechas: ['2026-08-17', '2026-08-18'],
    })).toBe(2);
  });

  it('une las tres fuentes sin duplicar fechas repetidas entre ellas', () => {
    const resultado = contarDiasEntrenadosSemana({
      historialFechas: ['2026-08-17', '2026-08-18'],
      checkinsFechas: ['2026-08-18', '2026-08-19'], // 18 se repite con historial
      bienestarFechas: ['2026-08-19', '2026-08-20'], // 19 se repite con checkins
    });
    // días únicos: 17, 18, 19, 20 = 4
    expect(resultado).toBe(4);
  });

  it('ignora valores nulos/undefined dentro de los arrays', () => {
    expect(contarDiasEntrenadosSemana({
      historialFechas: ['2026-08-17', null, undefined],
      checkinsFechas: [],
      bienestarFechas: undefined,
    })).toBe(1);
  });

  it('un mismo día en las tres fuentes cuenta una sola vez', () => {
    expect(contarDiasEntrenadosSemana({
      historialFechas: ['2026-08-20'],
      checkinsFechas: ['2026-08-20'],
      bienestarFechas: ['2026-08-20'],
    })).toBe(1);
  });
});
