import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeDatabaseService } from './fakeDatabaseService';
import { makeOperationAwareThenable } from './supabaseMock';

// Bloque 8 de SyncService.pushData(): el outbox de reto_progreso_pendiente
// (progreso del Reto 21 encolado offline) y su guard de "solo avanzar".

vi.mock('../DatabaseService', () => ({
  default: { query: vi.fn(), execute: vi.fn(), executeBatch: vi.fn() },
}));
vi.mock('../../supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

import DatabaseService from '../DatabaseService';
import { supabase } from '../../supabaseClient';
import SyncService from '../SyncService';

const USER_ID = 'user-1';

function usarBaseLocal(seed) {
  const fake = createFakeDatabaseService(seed);
  DatabaseService.query.mockImplementation(fake.query);
  DatabaseService.execute.mockImplementation(fake.execute);
  DatabaseService.executeBatch.mockImplementation(fake.executeBatch);
  return fake;
}

describe('SyncService.pushData — outbox de progreso pendiente del Reto 21', () => {
  beforeEach(() => {
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    DatabaseService.executeBatch.mockReset();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
  });

  it('el servidor sigue atrás: aplica el progreso encolado y limpia is_dirty', async () => {
    const fake = usarBaseLocal({
      reto_progreso_pendiente: [{
        id: 'pend-1', user_id: USER_ID, dia_numero: 5,
        reto_dia_actual: 5, reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
        reto_completado: 0, reward_row_id: 'reward-1', is_dirty: 1,
      }],
    });
    const perfilBuilder = makeOperationAwareThenable({
      select: { data: { reto_dia_actual: 4, reto_completado: false, retos_completados_count: 0, racha_actual: 3 }, error: null },
      update: { error: null },
    });
    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'perfiles') return perfilBuilder;
      throw new Error(`supabase.from('${tabla}') no esperado en este test`);
    });

    await SyncService.pushData(USER_ID);

    expect(perfilBuilder.update).toHaveBeenCalledWith({
      reto_dia_actual: 5,
      reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
      reto_completado: false,
    });
    expect(fake.tables.reto_progreso_pendiente[0].is_dirty).toBe(0);
  });

  it('el servidor ya está igual o adelante: descarta la fila SIN llamar a .update(), pero limpia is_dirty', async () => {
    const fake = usarBaseLocal({
      reto_progreso_pendiente: [{
        id: 'pend-1', user_id: USER_ID, dia_numero: 5,
        reto_dia_actual: 5, reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
        reto_completado: 0, is_dirty: 1,
      }],
    });
    const perfilBuilder = makeOperationAwareThenable({
      // el servidor ya avanzó al día 8 por otro camino mientras la fila esperaba
      select: { data: { reto_dia_actual: 8, reto_completado: false, retos_completados_count: 0, racha_actual: 8 }, error: null },
    });
    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'perfiles') return perfilBuilder;
      throw new Error(`supabase.from('${tabla}') no esperado en este test`);
    });

    await SyncService.pushData(USER_ID);

    expect(perfilBuilder.update).not.toHaveBeenCalled();
    expect(fake.tables.reto_progreso_pendiente[0].is_dirty).toBe(0);
  });

  it('si falla el update, la fila queda sucia para reintentar', async () => {
    const fake = usarBaseLocal({
      reto_progreso_pendiente: [{
        id: 'pend-1', user_id: USER_ID, dia_numero: 5,
        reto_dia_actual: 5, reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
        reto_completado: 0, is_dirty: 1,
      }],
    });
    const perfilBuilder = makeOperationAwareThenable({
      select: { data: { reto_dia_actual: 4, reto_completado: false, retos_completados_count: 0, racha_actual: 3 }, error: null },
      update: { error: { message: 'network error' } },
    });
    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'perfiles') return perfilBuilder;
      throw new Error(`supabase.from('${tabla}') no esperado en este test`);
    });

    const resultado = await SyncService.pushData(USER_ID);

    expect(fake.tables.reto_progreso_pendiente[0].is_dirty).toBe(1);
    expect(resultado).toBe(false);
  });

  it('si el día pendiente cierra el reto, incrementa retos_completados_count y reclama los bonos que correspondan', async () => {
    const fake = usarBaseLocal({
      reto_progreso_pendiente: [{
        id: 'pend-1', user_id: USER_ID, dia_numero: 21,
        reto_dia_actual: 21, reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
        reto_completado: 1, is_dirty: 1,
      }],
    });
    const perfilBuilder = makeOperationAwareThenable({
      select: { data: { reto_dia_actual: 21, reto_completado: false, retos_completados_count: 2, racha_actual: 21 }, error: null },
      update: { error: null },
    });
    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'perfiles') return perfilBuilder;
      throw new Error(`supabase.from('${tabla}') no esperado en este test`);
    });
    supabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

    await SyncService.pushData(USER_ID);

    expect(perfilBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ reto_completado: true, retos_completados_count: 3 })
    );
    expect(supabase.rpc).toHaveBeenCalledWith('reclamar_bono_reto', expect.objectContaining({ p_bono_tipo: '21_dias' }));
    expect(supabase.rpc).toHaveBeenCalledWith('reclamar_bono_reto', expect.objectContaining({ p_bono_tipo: 'perfecto_21' }));
    expect(fake.tables.reto_progreso_pendiente[0].is_dirty).toBe(0);
  });

  it('si falla la lectura previa del servidor, la fila queda sucia y no intenta escribir', async () => {
    const fake = usarBaseLocal({
      reto_progreso_pendiente: [{
        id: 'pend-1', user_id: USER_ID, dia_numero: 5,
        reto_dia_actual: 5, reto_ultimo_completado: '2026-08-16T10:00:00.000Z',
        reto_completado: 0, is_dirty: 1,
      }],
    });
    const perfilBuilder = makeOperationAwareThenable({
      select: { data: null, error: { message: 'network error' } },
    });
    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'perfiles') return perfilBuilder;
      throw new Error(`supabase.from('${tabla}') no esperado en este test`);
    });

    await SyncService.pushData(USER_ID);

    expect(perfilBuilder.update).not.toHaveBeenCalled();
    expect(fake.tables.reto_progreso_pendiente[0].is_dirty).toBe(1); // sigue sucia, se reintenta
  });
});
