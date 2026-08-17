import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeDatabaseService } from './fakeDatabaseService';
import { makeThenable } from './supabaseMock';

// Cubre los bloques de pushData() que SyncService.test.js no toca (ese
// archivo es solo el outbox de recompensas RPG). Aquí: el allowlist de
// campos del perfil -- la protección directa contra el incidente real del
// 16/08 donde un push genérico pisó reto_dia_actual -- y que el mecanismo de
// "pendiente sin subir" SÍ funciona para estas tablas (a diferencia del hueco
// documentado para rpg_historial_recompensas en SyncService.test.js).

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

function usarServidor(porTabla) {
  supabase.from.mockImplementation((tabla) => porTabla[tabla] ?? makeThenable({ error: null }));
}

describe('SyncService.pushData — bloques más allá del outbox de recompensas', () => {
  beforeEach(() => {
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    DatabaseService.executeBatch.mockReset();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
  });

  it('el push de perfil solo envía nivel y sistema_activo -- nunca xp/racha/reto_* aunque estén en la fila local', async () => {
    usarBaseLocal({
      perfiles: [{
        id: USER_ID, is_dirty: 1, nivel: '5', sistema_activo: 'fuerza',
        xp_actual: 999, puntos_forja: 999, racha_actual: 99,
        reto_dia_actual: 10, reto_completado: 1, plan_membresia: 'platinum',
      }],
    });
    const perfilBuilder = makeThenable({ error: null });
    usarServidor({ perfiles: perfilBuilder });

    const resultado = await SyncService.pushData(USER_ID);

    expect(perfilBuilder.update).toHaveBeenCalledWith({ nivel: '5', sistema_activo: 'fuerza' });
    expect(perfilBuilder.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(resultado).toBe(true);
  });

  it('si el push de perfil falla, la fila queda sucia Y pushData() reporta incompleto (perfiles sí está en TABLAS_SINCRONIZADAS)', async () => {
    usarBaseLocal({
      perfiles: [{ id: USER_ID, is_dirty: 1, nivel: '5', sistema_activo: 'fuerza' }],
    });
    usarServidor({ perfiles: makeThenable({ error: { message: 'network error' } }) });

    const resultado = await SyncService.pushData(USER_ID);

    expect(resultado).toBe(false);
  });

  it('habitos_diarios: upsert exitoso limpia is_dirty de esa fila y convierte comida_sana a boolean', async () => {
    const fake = usarBaseLocal({
      habitos_diarios: [{
        id: 'h1', user_id: USER_ID, is_dirty: 1, dia_reto: 3,
        agua: '1', sueno: '6', comida_sana: 1, puntos_ganados: 40, created_at: '2026-08-16',
      }],
    });
    const habitosBuilder = makeThenable({ error: null });
    usarServidor({ habitos_diarios: habitosBuilder });

    await SyncService.pushData(USER_ID);

    expect(habitosBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h1', comida_sana: true })
    );
    expect(fake.tables.habitos_diarios[0].is_dirty).toBe(0);
  });

  it('historial_entrenamientos: parsea series_log de texto a objeto antes de subirlo y marca completado como boolean', async () => {
    const fake = usarBaseLocal({
      historial_entrenamientos: [{
        id: 'hist1', user_id: USER_ID, is_dirty: 1, rutina_id: 'r1', ejercicio_id: 'e1',
        series_log: JSON.stringify([{ reps: 10, peso: 20 }]), completado: 1,
        fecha_completado: '2026-08-16T12:00:00.000Z',
      }],
    });
    const historialBuilder = makeThenable({ error: null });
    usarServidor({ historial_entrenamientos: historialBuilder });

    await SyncService.pushData(USER_ID);

    expect(historialBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'hist1',
        series_log: [{ reps: 10, peso: 20 }], // ya no es un string
        completado: true,
      }),
    ]);
    expect(fake.tables.historial_entrenamientos[0].is_dirty).toBe(0);
  });

  it('checkins, checkins_bienestar e inventario limpian is_dirty en éxito', async () => {
    const fake = usarBaseLocal({
      checkins: [{ id: 'c1', user_id: USER_ID, is_dirty: 1, fecha: '2026-08-16', nivel: 3 }],
      checkins_bienestar: [{ id: 'cb1', user_id: USER_ID, is_dirty: 1, fecha: '2026-08-16', habitos: JSON.stringify({ agua: true }) }],
      rpg_inventario: [{ id: 'inv1', user_id: USER_ID, is_dirty: 1, item_id: 'ficha_reposo', cantidad: 1 }],
    });
    usarServidor({
      checkins: makeThenable({ error: null }),
      checkins_bienestar: makeThenable({ error: null }),
      rpg_inventario: makeThenable({ error: null }),
    });

    const resultado = await SyncService.pushData(USER_ID);

    expect(fake.tables.checkins[0].is_dirty).toBe(0);
    expect(fake.tables.checkins_bienestar[0].is_dirty).toBe(0);
    expect(fake.tables.rpg_inventario[0].is_dirty).toBe(0);
    expect(resultado).toBe(true);
  });
});
