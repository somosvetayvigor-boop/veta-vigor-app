import { describe, it, expect, vi, beforeEach } from 'vitest';

// SyncService.pushData toca muchas tablas, pero estos tests se enfocan solo en
// el bloque 7 (outbox de recompensas RPG -> completar_mision_rpg): es la pieza
// de idempotencia que de verdad importa antes de tocar las 5 capas de
// persistencia, y la única que llama a completar_mision_rpg.
//
// Para que los demás bloques (perfil, hábitos, historial, checkins, checkins
// bienestar, inventario) se salten solos sin necesitar mockear supabase.from,
// DatabaseService.query devuelve [] para cualquier tabla que no sea
// rpg_historial_recompensas: sin filas sucias, esos bloques nunca se ejecutan.
// Si algún día alguno de ellos SÍ llegara a llamar a supabase.from en estos
// tests, el mock de abajo lo hace fallar fuerte en vez de en silencio.

vi.mock('../DatabaseService', () => ({
  default: {
    query: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => {
      throw new Error('supabase.from no debería llamarse en estos tests');
    }),
  },
}));

import DatabaseService from '../DatabaseService';
import { supabase } from '../../supabaseClient';
import SyncService from '../SyncService';

const USER_ID = 'user-1';

/**
 * Configura DatabaseService.query para que solo rpg_historial_recompensas
 * tenga filas pendientes. El chequeo final de completitud
 * (`SELECT 1 AS x ...`, usado por _quedanCambiosSinSubir) siempre responde
 * "nada pendiente" acá -- es un mock estático, no simula que execute()
 * realmente limpió is_dirty. El test que sí necesita simular una fila que
 * se queda atascada arma su propio mock en vez de usar este helper.
 */
function mockRecompensasPendientes(filas) {
  DatabaseService.query.mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT 1 AS x')) return [];
    if (sql.includes('rpg_historial_recompensas')) return filas;
    return [];
  });
}

describe('SyncService.pushData — outbox de recompensas RPG', () => {
  beforeEach(() => {
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    DatabaseService.execute.mockResolvedValue(null);
    supabase.rpc.mockReset();
  });

  it('reproduce una recompensa pendiente con su UUID local como idempotency key', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    supabase.rpc.mockResolvedValue({
      data: { success: true, xp_total: 110, monedas_total: 55, racha: 3 },
      error: null,
    });

    const resultado = await SyncService.pushData(USER_ID);

    expect(supabase.rpc).toHaveBeenCalledWith('completar_mision_rpg', {
      p_user_id: USER_ID,
      p_origen: 'entrenamiento',
      p_idempotency_key: 'reward-uuid-1',
      p_xp: 10,
      p_monedas: 5,
    });
    expect(resultado).toBe(true);
  });

  it('en éxito, limpia is_dirty y adopta el saldo autoritativo del servidor en el perfil local', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    supabase.rpc.mockResolvedValue({
      data: { success: true, xp_total: 110, monedas_total: 55, racha: 3 },
      error: null,
    });

    await SyncService.pushData(USER_ID);

    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rpg_historial_recompensas SET is_dirty = 0'),
      ['reward-uuid-1']
    );
    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE perfiles SET xp_actual'),
      [110, 55, 3, USER_ID]
    );
  });

  it('si el servidor manda nivel_rpg (VETA_VIGOR_FIX_NIVEL_RPG.sql aplicado), también lo adopta en el perfil local', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'descanso_activo', xp_ganada: 15, monedas_ganadas: 15 },
    ]);
    supabase.rpc.mockResolvedValue({
      data: { success: true, xp_total: 110, monedas_total: 55, racha: 3, nivel_rpg: 2 },
      error: null,
    });

    await SyncService.pushData(USER_ID);

    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE perfiles SET xp_actual'),
      [110, 55, 3, 2, USER_ID]
    );
  });

  it('si el servidor todavía no manda nivel_rpg (migración vieja), no lo pisa con NULL -- usa el UPDATE de 3 campos de siempre', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    supabase.rpc.mockResolvedValue({
      data: { success: true, xp_total: 110, monedas_total: 55, racha: 3 }, // sin nivel_rpg
      error: null,
    });

    await SyncService.pushData(USER_ID);

    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE perfiles SET xp_actual'),
      [110, 55, 3, USER_ID]
    );
    expect(DatabaseService.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('nivel_rpg'),
      expect.anything()
    );
  });

  it('"Ya se registró esta misión" (reintento de una clave ya usada) limpia is_dirty pero NO reescribe el perfil local', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    // Así responde el RPC cuando la idempotency_key ya existe en rpg_transacciones:
    // sin error de red, pero success:false y sin xp_total/monedas_total/racha.
    supabase.rpc.mockResolvedValue({
      data: { success: false, error: 'Ya se registró esta misión.' },
      error: null,
    });

    await SyncService.pushData(USER_ID);

    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rpg_historial_recompensas SET is_dirty = 0'),
      ['reward-uuid-1']
    );
    expect(DatabaseService.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE perfiles SET xp_actual'),
      expect.anything()
    );
  });

  it('un error real (ej. de red) deja la fila sucia para reintentar y no interrumpe el resto de la cola', async () => {
    mockRecompensasPendientes([
      { id: 'reward-falla', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
      { id: 'reward-ok', user_id: USER_ID, fuente: 'descanso_activo', xp_ganada: 15, monedas_ganadas: 15 },
    ]);
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'network error' } })
      .mockResolvedValueOnce({
        data: { success: true, xp_total: 25, monedas_total: 20, racha: 1 },
        error: null,
      });

    await SyncService.pushData(USER_ID);

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    // Solo la fila que sí tuvo éxito se limpia.
    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rpg_historial_recompensas SET is_dirty = 0'),
      ['reward-ok']
    );
    expect(DatabaseService.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rpg_historial_recompensas SET is_dirty = 0'),
      ['reward-falla']
    );
  });

  it('una recompensa que se queda sin subir SÍ hace que pushData reporte "incompleto" (fix 2026-08-16)', async () => {
    // rpg_historial_recompensas se agregó a SyncService.TABLAS_SINCRONIZADAS
    // (la lista que _quedanCambiosSinSubir recorre al final de pushData).
    // Antes de este fix, una recompensa atascada en is_dirty=1 no se
    // detectaba ahí y pushData() reportaba éxito igual -- ver memoria
    // syncservice-hueco-recompensas-atascadas para el hallazgo original.
    DatabaseService.query.mockImplementation(async (sql) => {
      // A diferencia del helper compartido, acá el chequeo final de
      // completitud SÍ debe encontrar la fila que nunca se limpió --
      // es justo lo que este test verifica.
      if (sql.includes('rpg_historial_recompensas')) {
        return [{ id: 'reward-falla', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 }];
      }
      return [];
    });
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'network error' } });

    const resultado = await SyncService.pushData(USER_ID);

    expect(resultado).toBe(false);
  });

  it('si la racha adoptada cruza 7 al reproducir un entrenamiento normal, también reclama el bono de 7 días (antes solo lo hacía RutinaRetoPlayer)', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    supabase.rpc.mockImplementation(async (fn) => {
      if (fn === 'completar_mision_rpg') {
        return { data: { success: true, xp_total: 110, monedas_total: 55, racha: 7 }, error: null };
      }
      if (fn === 'reclamar_bono_reto') {
        return { data: { success: true }, error: null };
      }
      throw new Error(`RPC inesperada en el test: ${fn}`);
    });

    await SyncService.pushData(USER_ID);

    expect(supabase.rpc).toHaveBeenCalledWith('reclamar_bono_reto', {
      p_user_id: USER_ID,
      p_bono_tipo: '7_dias',
      p_idempotency_key: `bono_7_${USER_ID}`,
    });
  });

  it('con racha por debajo de 7 no intenta reclamar ningún bono', async () => {
    mockRecompensasPendientes([
      { id: 'reward-uuid-1', user_id: USER_ID, fuente: 'entrenamiento', xp_ganada: 10, monedas_ganadas: 5 },
    ]);
    supabase.rpc.mockResolvedValue({
      data: { success: true, xp_total: 20, monedas_total: 10, racha: 3 },
      error: null,
    });

    await SyncService.pushData(USER_ID);

    expect(supabase.rpc).not.toHaveBeenCalledWith('reclamar_bono_reto', expect.anything());
  });
});
