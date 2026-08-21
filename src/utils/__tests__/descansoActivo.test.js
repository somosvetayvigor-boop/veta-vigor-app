import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/DatabaseService', () => ({
  default: {
    query: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import DatabaseService from '../../services/DatabaseService';
import { supabase } from '../../supabaseClient';
import {
  getOrCreateTodayBienestarRow,
  marcarProtocoloHecho,
  PROTOCOLOS_COMPARTIDOS_CON_BIENESTAR,
  hoyStrLocal,
} from '../descansoActivo';

describe('PROTOCOLOS_COMPARTIDOS_CON_BIENESTAR', () => {
  it('son exactamente los 3 protocolos que también son hábitos de bienestar', () => {
    expect(PROTOCOLOS_COMPARTIDOS_CON_BIENESTAR).toEqual(['caminata', 'bicicleta', 'natacion']);
  });
});

describe('getOrCreateTodayBienestarRow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T15:00:00'));
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    supabase.from.mockReset();
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('sin userId, devuelve una fila nueva sin tocar la base de datos', async () => {
    const row = await getOrCreateTodayBienestarRow(null);
    expect(row.isNew).toBe(true);
    expect(row.habitos).toEqual([]);
    expect(DatabaseService.query).not.toHaveBeenCalled();
  });

  it('si ya existe fila local hoy, la usa tal cual sin tocar Supabase', async () => {
    DatabaseService.query.mockResolvedValue([{ id: 'row-1', habitos: JSON.stringify(['agua', 'caminata']) }]);

    const row = await getOrCreateTodayBienestarRow('user-1');

    expect(row).toEqual({ id: 'row-1', habitos: ['agua', 'caminata'], fecha: '2026-08-20', isNew: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sin fila local y sin conexión, no llama a Supabase y devuelve fila nueva vacía', async () => {
    DatabaseService.query.mockResolvedValue([]);
    vi.stubGlobal('navigator', { onLine: false });

    const row = await getOrCreateTodayBienestarRow('user-1');

    expect(row.isNew).toBe(true);
    expect(row.habitos).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sin fila local, con conexión y Supabase tiene fila remota, la adopta y la guarda local', async () => {
    DatabaseService.query.mockResolvedValue([]);
    // Cadena encadenable y "thenable": select()/eq() devuelven el mismo
    // objeto, y await lo resuelve vía su propio .then() -- evita tener que
    // distinguir cuál de las dos llamadas a .eq() (user_id, fecha) es la
    // última en la cadena real.
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve) => resolve({ data: [{ id: 'row-remoto', habitos: ['caminata'] }] }),
    };
    supabase.from.mockReturnValue(chain);

    const row = await getOrCreateTodayBienestarRow('user-1');

    expect(row).toEqual({ id: 'row-remoto', habitos: ['caminata'], fecha: '2026-08-20', isNew: false });
    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO checkins_bienestar'),
      ['row-remoto', 'user-1', '2026-08-20', JSON.stringify(['caminata'])]
    );
  });

  it('hoyStrLocal usa fecha local, no UTC', () => {
    expect(hoyStrLocal()).toBe('2026-08-20');
  });
});

describe('marcarProtocoloHecho', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T15:00:00'));
    DatabaseService.query.mockReset();
    DatabaseService.execute.mockReset();
    supabase.from.mockReset();
    vi.stubGlobal('navigator', { onLine: false }); // offline: sin ruido del upsert async
  });

  it('si el protocolo ya está registrado hoy, no escribe nada', async () => {
    DatabaseService.query.mockResolvedValue([{ id: 'row-1', habitos: JSON.stringify(['caminata']) }]);

    const resultado = await marcarProtocoloHecho('user-1', 'caminata');

    expect(resultado).toEqual({ yaHecho: true, habitos: ['caminata'] });
    expect(DatabaseService.execute).not.toHaveBeenCalled();
  });

  it('si el protocolo es nuevo, lo agrega a la fila existente y lo guarda', async () => {
    DatabaseService.query.mockResolvedValue([{ id: 'row-1', habitos: JSON.stringify(['agua']) }]);

    const resultado = await marcarProtocoloHecho('user-1', 'movilidad');

    expect(resultado).toEqual({ yaHecho: false, habitos: ['agua', 'movilidad'] });
    expect(DatabaseService.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO checkins_bienestar'),
      ['row-1', 'user-1', '2026-08-20', JSON.stringify(['agua', 'movilidad'])]
    );
  });

  it('sin fila previa hoy, crea una fila nueva con solo ese protocolo', async () => {
    DatabaseService.query.mockResolvedValue([]);

    const resultado = await marcarProtocoloHecho('user-1', 'natacion');

    expect(resultado.yaHecho).toBe(false);
    expect(resultado.habitos).toEqual(['natacion']);
    const [, params] = DatabaseService.execute.mock.calls[0];
    expect(params[1]).toBe('user-1');
    expect(params[3]).toBe(JSON.stringify(['natacion']));
  });
});
