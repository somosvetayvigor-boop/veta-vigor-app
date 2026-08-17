import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFakeDatabaseService } from './fakeDatabaseService';
import { makeThenable } from './supabaseMock';

// pullData() toca muchas tablas; estos tests se enfocan en la protección
// contra pisar cambios locales sin subir (el guard del perfil sucio, y el
// filtrado _idsSucios/_sinSucias para el resto de las tablas) -- la lógica
// exacta que ya rompió algo real una vez (16/08: un perfil con el avance del
// Reto 21 sin sincronizar fue pisado por una bajada de Supabase).

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

/** Instala el fake de DatabaseService con el estado inicial dado. */
function usarBaseLocal(seed) {
  const fake = createFakeDatabaseService(seed);
  DatabaseService.query.mockImplementation(fake.query);
  DatabaseService.execute.mockImplementation(fake.execute);
  DatabaseService.executeBatch.mockImplementation(fake.executeBatch);
  return fake;
}

/** Instala respuestas de supabase.from() por tabla; por defecto, vacío. */
function usarServidor(porTabla) {
  supabase.from.mockImplementation((tabla) => porTabla[tabla] ?? makeThenable({ data: [], error: null }));
}

describe('SyncService.pullData — no pisar cambios locales sin subir', () => {
  beforeEach(() => {
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    DatabaseService.executeBatch.mockReset();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    vi.spyOn(SyncService, 'catalogosEstanFrescos').mockResolvedValue(true); // catálogos fuera del alcance de estos tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('perfil local sucio: NO se llama a supabase.from("perfiles") -- se respeta el avance sin subir', async () => {
    usarBaseLocal({ perfiles: [{ id: USER_ID, is_dirty: 1 }] });
    usarServidor({});

    await SyncService.pullData(USER_ID);

    const tablasConsultadas = supabase.from.mock.calls.map(([t]) => t);
    expect(tablasConsultadas).not.toContain('perfiles');
  });

  it('perfil local limpio: sí se baja del servidor y se guarda marcado como sincronizado', async () => {
    usarBaseLocal({ perfiles: [{ id: USER_ID, is_dirty: 0 }] });
    usarServidor({
      perfiles: makeThenable({
        data: {
          id: USER_ID, email: 'a@a.com', nombre: 'Ana', nivel: '1', sistema_activo: null,
          reto_activo_id: null, reto_dia_actual: 3, reto_ultimo_completado: null, reto_completado: false,
          reto_fecha_inicio: null, plan_membresia: 'free', force_platinum_trial: false, puntos_totales: 0,
          rango: 'Iniciado', xp_actual: 50, puntos_forja: 20, stat_fuerza: 1, stat_agilidad: 1,
          stat_resistencia: 1, nivel_rpg: 1, racha_actual: 2, retos_completados_count: 0,
          calendario_personalizado: {}, rol_usuario: 'alumno', dias_entrenamiento: [],
        },
        error: null,
      }),
    });

    await SyncService.pullData(USER_ID);

    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO perfiles'),
      expect.arrayContaining([USER_ID])
    );
  });

  it('una fila local sucia en checkins se excluye de la bajada aunque el servidor traiga esa misma fila', async () => {
    usarBaseLocal({
      checkins: [{ id: 'c1', user_id: USER_ID, is_dirty: 1 }], // c1 tiene cambios locales sin subir
    });
    usarServidor({
      perfiles: makeThenable({ data: null, error: null }), // fuera del alcance de este test
      checkins: makeThenable({
        data: [
          { id: 'c1', user_id: USER_ID, fecha: '2026-08-16', nivel: 3 }, // el servidor también la tiene
          { id: 'c2', user_id: USER_ID, fecha: '2026-08-15', nivel: 4 },
        ],
        error: null,
      }),
    });

    await SyncService.pullData(USER_ID);

    const llamadaCheckins = DatabaseService.executeBatch.mock.calls.find(([sql]) => sql.includes('INTO checkins ('));
    expect(llamadaCheckins).toBeDefined();
    const filas = llamadaCheckins[1];
    expect(filas).toHaveLength(1);
    expect(filas[0][0]).toBe('c2'); // c1 quedó excluida por tener is_dirty=1 localmente
  });
});
