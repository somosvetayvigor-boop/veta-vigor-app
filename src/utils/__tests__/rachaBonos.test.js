import { describe, it, expect } from 'vitest';
import { bonosAReclamar } from '../rachaBonos';

describe('bonosAReclamar', () => {
  it('sin racha suficiente y reto sin terminar, no hay nada que reclamar', () => {
    expect(bonosAReclamar(3, false, 'user-1')).toEqual([]);
  });

  it('racha exactamente en el umbral reclama ese bono', () => {
    expect(bonosAReclamar(7, false, 'user-1')).toEqual([
      { tipo: '7_dias', key: 'bono_7_user-1' },
    ]);
  });

  it('BUG ORIGINAL: una racha que salta el número exacto (ej. 9, por un entrenamiento normal) igual debe reclamar el bono de 7 días', () => {
    expect(bonosAReclamar(9, false, 'user-1')).toEqual([
      { tipo: '7_dias', key: 'bono_7_user-1' },
    ]);
  });

  it('racha que ya pasó ambos umbrales (7 y 14) reclama los dos en la misma pasada, no solo el más alto', () => {
    expect(bonosAReclamar(15, false, 'user-1')).toEqual([
      { tipo: '7_dias', key: 'bono_7_user-1' },
      { tipo: '14_dias', key: 'bono_14_user-1' },
    ]);
  });

  it('terminar el reto (día 21) siempre reclama el bono de 21 días, sin importar la racha', () => {
    expect(bonosAReclamar(3, true, 'user-1')).toEqual([
      { tipo: '21_dias', key: 'bono_21_user-1' },
    ]);
  });

  it('terminar el reto con racha perfecta (>=21) reclama también el bono perfecto', () => {
    expect(bonosAReclamar(21, true, 'user-1')).toEqual([
      { tipo: '7_dias', key: 'bono_7_user-1' },
      { tipo: '14_dias', key: 'bono_14_user-1' },
      { tipo: '21_dias', key: 'bono_21_user-1' },
      { tipo: 'perfecto_21', key: 'bono_perf_21_user-1' },
    ]);
  });

  it('las claves de idempotencia son fijas por usuario y tipo de bono (no dependen del día)', () => {
    const bonos = bonosAReclamar(7, false, 'user-xyz');
    expect(bonos[0].key).toBe('bono_7_user-xyz');
  });
});
