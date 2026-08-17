import { describe, it, expect } from 'vitest';
import {
  getXpForLevel,
  calculateLevel,
  getLevelProgress,
  getRpgTitle,
  getMaderaForLevel,
  calculateWorkoutRewards,
  calculateBienestarRewards,
  getGolpesTotales,
  getGolpesDisponibles,
} from '../ProgressionEngine';

describe('getXpForLevel', () => {
  it('nivel 1 o menor no requiere XP', () => {
    expect(getXpForLevel(1)).toBe(0);
    expect(getXpForLevel(0)).toBe(0);
  });

  it('sube 100 XP por nivel de forma lineal', () => {
    expect(getXpForLevel(2)).toBe(100);
    expect(getXpForLevel(5)).toBe(400);
  });
});

describe('calculateLevel', () => {
  it('trata XP nula/indefinida como 0 -> nivel 1', () => {
    expect(calculateLevel(undefined)).toBe(1);
    expect(calculateLevel(null)).toBe(1);
    expect(calculateLevel(0)).toBe(1);
  });

  it('sube de nivel cada 100 XP', () => {
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(250)).toBe(3);
  });
});

describe('getLevelProgress', () => {
  it('nivel 99+ siempre muestra 100%', () => {
    expect(getLevelProgress(0, 99)).toBe(100);
    expect(getLevelProgress(999999, 150)).toBe(100);
  });

  it('calcula el porcentaje dentro del nivel actual', () => {
    // Nivel 2 va de 100 a 200 XP; 150 XP = 50% de avance
    expect(getLevelProgress(150, 2)).toBe(50);
  });

  it('no baja de 0 ni sube de 100 aunque el dato de entrada sea inconsistente', () => {
    expect(getLevelProgress(0, 2)).toBe(0); // por debajo del piso del nivel
    expect(getLevelProgress(500, 2)).toBe(100); // por encima del techo del nivel
  });
});

describe('getRpgTitle', () => {
  it('sin nivel es Iniciado', () => {
    expect(getRpgTitle(null)).toBe('Iniciado');
    expect(getRpgTitle(0)).toBe('Iniciado');
  });

  it('respeta los cortes de rango', () => {
    expect(getRpgTitle(10)).toBe('Iniciado');
    expect(getRpgTitle(11)).toBe('Forjador');
    expect(getRpgTitle(30)).toBe('Forjador');
    expect(getRpgTitle(31)).toBe('Maestro del Hierro');
    expect(getRpgTitle(49)).toBe('Maestro del Hierro');
    expect(getRpgTitle(50)).toBe('Leyenda');
  });
});

describe('getMaderaForLevel', () => {
  it('respeta los mismos cortes que los rangos', () => {
    expect(getMaderaForLevel(1).nombre).toBe('Semilla');
    expect(getMaderaForLevel(10).nombre).toBe('Semilla');
    expect(getMaderaForLevel(11).nombre).toBe('Pino');
    expect(getMaderaForLevel(30).nombre).toBe('Pino');
    expect(getMaderaForLevel(31).nombre).toBe('Tzalam');
    expect(getMaderaForLevel(49).nombre).toBe('Tzalam');
    expect(getMaderaForLevel(50).nombre).toBe('Roble');
  });
});

describe('calculateWorkoutRewards', () => {
  it('siempre da la misma recompensa fija', () => {
    expect(calculateWorkoutRewards()).toEqual({
      xp: 10,
      puntosForja: 5,
      statsBonus: { fuerza: 0, agilidad: 0, resistencia: 0 },
    });
  });
});

describe('calculateBienestarRewards', () => {
  it('sin al menos 2 hábitos no da nada', () => {
    expect(calculateBienestarRewards(0)).toEqual({ xp: 0, puntosForja: 0 });
    expect(calculateBienestarRewards(1)).toEqual({ xp: 0, puntosForja: 0 });
  });

  it('con exactamente 2 hábitos da la base sin bono', () => {
    expect(calculateBienestarRewards(2)).toEqual({ xp: 15, puntosForja: 15 });
  });

  it('con más de 2 hábitos suma el bono, tope 20 XP', () => {
    expect(calculateBienestarRewards(3)).toEqual({ xp: 20, puntosForja: 15 });
    expect(calculateBienestarRewards(4)).toEqual({ xp: 20, puntosForja: 15 });
  });
});

describe('getGolpesTotales / getGolpesDisponibles (Gólem)', () => {
  it('un golpe cada 25 XP, redondeando hacia abajo', () => {
    expect(getGolpesTotales(undefined)).toBe(0);
    expect(getGolpesTotales(24)).toBe(0);
    expect(getGolpesTotales(25)).toBe(1);
    expect(getGolpesTotales(74)).toBe(2);
  });

  it('los disponibles descuentan los ya usados, sin bajar de 0', () => {
    expect(getGolpesDisponibles(100, undefined)).toBe(4);
    expect(getGolpesDisponibles(100, 4)).toBe(0);
    expect(getGolpesDisponibles(100, 10)).toBe(0); // más usados que totales no da negativo
  });
});
