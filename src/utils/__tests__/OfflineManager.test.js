import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabaseClient', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}));

import { supabase } from '../../supabaseClient';
import { addToOfflineQueue, actualizarAuthMetaConReintento } from '../OfflineManager';

// vitest.config.js corre en environment 'node' (sin jsdom -- el proyecto no
// lo tiene como dependencia), así que localStorage no existe de por sí acá.
// Un polyfill mínimo en memoria alcanza para lo que esta cola necesita.
function instalarLocalStorageFalso() {
  const datos = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  });
}

describe('actualizarAuthMetaConReintento', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    supabase.auth.updateUser.mockReset();
  });

  it('en éxito, no encola nada', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null });

    await actualizarAuthMetaConReintento({ suscripcion: 'Plan Platinum' });

    expect(JSON.parse(localStorage.getItem('veta_vigor_offline_queue') || '[]')).toEqual([]);
  });

  it('si updateUser devuelve error, encola UPDATE_AUTH_META con el mismo payload', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: { message: 'network error' } });

    await actualizarAuthMetaConReintento({ suscripcion: 'Plan Platinum' });

    const cola = JSON.parse(localStorage.getItem('veta_vigor_offline_queue'));
    expect(cola).toHaveLength(1);
    expect(cola[0].actionType).toBe('UPDATE_AUTH_META');
    expect(cola[0].payload).toEqual({ suscripcion: 'Plan Platinum' });
  });

  it('si updateUser lanza (ej. sin red), también encola en vez de propagar la excepción', async () => {
    supabase.auth.updateUser.mockRejectedValue(new Error('sin conexión'));

    await expect(actualizarAuthMetaConReintento({ cuestionario_complete: true })).resolves.toBeUndefined();

    const cola = JSON.parse(localStorage.getItem('veta_vigor_offline_queue'));
    expect(cola).toHaveLength(1);
    expect(cola[0].payload).toEqual({ cuestionario_complete: true });
  });
});

describe('addToOfflineQueue', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
  });

  it('acumula varias acciones en orden', () => {
    addToOfflineQueue('UPDATE_PERFIL', { userId: 'u1', data: { nivel: 'Pino' } });
    addToOfflineQueue('INSERT_CHECKIN', { id: 'c1' });

    const cola = JSON.parse(localStorage.getItem('veta_vigor_offline_queue'));
    expect(cola.map((i) => i.actionType)).toEqual(['UPDATE_PERFIL', 'INSERT_CHECKIN']);
  });
});
