import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/DatabaseService', () => ({
  default: {
    query: vi.fn(),
    execute: vi.fn(),
  },
}));

import DatabaseService from '../../services/DatabaseService';
import { registrarDiaEntrenado } from '../registrarDiaEntrenado';

describe('registrarDiaEntrenado', () => {
  beforeEach(() => {
    // Fecha fija para que hoyStr sea determinista en el test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T15:00:00'));
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin userId no toca la base de datos', async () => {
    const resultado = await registrarDiaEntrenado(null);
    expect(resultado).toBe(false);
    expect(DatabaseService.query).not.toHaveBeenCalled();
    expect(DatabaseService.execute).not.toHaveBeenCalled();
  });

  it('si ya existe un checkin hoy, no lo pisa (respeta el check-in de disposición)', async () => {
    DatabaseService.query.mockResolvedValue([{ id: 'checkin-existente' }]);

    const resultado = await registrarDiaEntrenado('user-1');

    expect(resultado).toBe(false);
    expect(DatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM checkins'),
      ['user-1', '2026-08-16']
    );
    expect(DatabaseService.execute).not.toHaveBeenCalled();
  });

  it('sin checkin previo hoy, inserta uno neutro (nivel 3) y lo marca sucio', async () => {
    DatabaseService.query.mockResolvedValue([]);

    const resultado = await registrarDiaEntrenado('user-1');

    expect(resultado).toBe(true);
    expect(DatabaseService.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = DatabaseService.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO checkins');
    // [id, user_id, fecha, nivel]
    expect(params[1]).toBe('user-1');
    expect(params[2]).toBe('2026-08-16');
    expect(params[3]).toBe(3);
  });

  it('si la consulta falla, no revienta: devuelve false', async () => {
    DatabaseService.query.mockRejectedValue(new Error('SQLite no disponible'));

    const resultado = await registrarDiaEntrenado('user-1');

    expect(resultado).toBe(false);
    expect(DatabaseService.execute).not.toHaveBeenCalled();
  });
});
