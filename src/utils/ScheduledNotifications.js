import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_IDS = {
  FRASE_DEL_DIA: 8001,
  RECORDATORIO_ENTRENAMIENTO: 8002,
};

/**
 * Configura las notificaciones programadas al abrir la app.
 * - 8:00 AM → Frase del día
 * - 6:00 PM → Recordatorio de entrenamiento (si hoy le toca y no ha entrenado)
 */
export async function setupScheduledNotifications(session, supabase) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Verificar/pedir permisos
    let perms = await LocalNotifications.checkPermissions();
    if (perms.display === 'prompt') {
      perms = await LocalNotifications.requestPermissions();
    }
    if (perms.display !== 'granted') {
      console.log('[Notif] Permisos de notificación no concedidos');
      return;
    }

    // Cancelar notificaciones anteriores para no duplicar
    await LocalNotifications.cancel({
      notifications: [
        { id: NOTIFICATION_IDS.FRASE_DEL_DIA },
        { id: NOTIFICATION_IDS.RECORDATORIO_ENTRENAMIENTO }
      ]
    });

    // Programar frase del día a las 8 AM de mañana
    await scheduleMotivationalNotification();

    // Programar recordatorio de entrenamiento a las 6 PM (si aplica)
    if (session?.user) {
      await scheduleTrainingReminder(session, supabase);
    }

    console.log('[Notif] Notificaciones programadas exitosamente');
  } catch (e) {
    console.error('[Notif] Error configurando notificaciones:', e);
  }
}

/**
 * Programa la notificación de "Frase del Día" para las 8:00 AM de mañana.
 */
async function scheduleMotivationalNotification() {
  const now = new Date();
  const target = new Date(now);

  // Si todavía no son las 8 AM, programar para HOY a las 8 AM
  if (now.getHours() < 8) {
    target.setHours(8, 0, 0, 0);
  } else {
    // Si ya pasaron las 8 AM, programar para MAÑANA
    target.setDate(target.getDate() + 1);
    target.setHours(8, 0, 0, 0);
  }

  await LocalNotifications.schedule({
    notifications: [{
      id: NOTIFICATION_IDS.FRASE_DEL_DIA,
      title: '🌅 Buenos días, Guerrero',
      body: 'Tu frase motivacional del día te espera. ¡Ábrela y conquista tu mañana!',
      schedule: { at: target, allowWhileIdle: true },
      sound: 'default',
    }]
  });
  console.log('[Notif] Frase del día programada para:', target.toLocaleString());
}

/**
 * Programa recordatorio de entrenamiento a las 6:00 PM de hoy,
 * SOLO si hoy es día de entrenamiento y el usuario no ha entrenado.
 */
async function scheduleTrainingReminder(session, supabase) {
  const now = new Date();

  // Si ya son las 6 PM o más tarde, no programar
  if (now.getHours() >= 18) {
    console.log('[Notif] Ya son más de las 6 PM, no se programa recordatorio');
    return;
  }

  // Obtener frecuencia de entrenamiento del usuario
  const dias = session?.user?.user_metadata?.dias_entrenamiento || '>3';

  // Determinar el índice del día (Lunes = 0, Domingo = 6) para coincidir con el calendario
  const jsDay = now.getDay(); // JavaScript: 0 = Domingo
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convertir a Lunes-basado

  // Verificar si hoy es día de entrenamiento según el calendario
  let isTrainingDay = false;
  if (dias === '3') {
    // 3 días: Lunes(0), Miércoles(2), Viernes(4) son entrenamiento
    isTrainingDay = [0, 2, 4].includes(todayIndex);
  } else {
    // 4+ días: Lunes(0), Martes(1), Jueves(3), Viernes(4) son entrenamiento
    isTrainingDay = [0, 1, 3, 4].includes(todayIndex);
  }

  if (!isTrainingDay) {
    console.log('[Notif] Hoy es día de descanso, no se programa recordatorio');
    return;
  }

  // Verificar si el usuario ya entrenó hoy
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayWorkouts } = await supabase
    .from('historial_entrenamientos')
    .select('id')
    .eq('user_id', session.user.id)
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (todayWorkouts && todayWorkouts.length > 0) {
    console.log('[Notif] Usuario ya entrenó hoy, no se programa recordatorio');
    return;
  }

  // Programar para las 6 PM de hoy
  const today6pm = new Date(now);
  today6pm.setHours(18, 0, 0, 0);

  await LocalNotifications.schedule({
    notifications: [{
      id: NOTIFICATION_IDS.RECORDATORIO_ENTRENAMIENTO,
      title: '🏋️ ¡Hoy te toca entrenar!',
      body: 'Todavía no registras tu entrenamiento de hoy. ¡No dejes pasar el día, tu cuerpo te lo agradecerá!',
      schedule: { at: today6pm, allowWhileIdle: true },
      sound: 'default',
    }]
  });
  console.log('[Notif] Recordatorio de entrenamiento programado para:', today6pm.toLocaleString());
}

/**
 * Cancela el recordatorio de entrenamiento.
 * Llamar cuando el usuario completa un entrenamiento para que no le moleste a las 6 PM.
 */
export async function cancelTrainingReminder() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: NOTIFICATION_IDS.RECORDATORIO_ENTRENAMIENTO }]
    });
    console.log('[Notif] Recordatorio de entrenamiento cancelado (usuario ya entrenó)');
  } catch (e) {
    console.error('[Notif] Error cancelando recordatorio:', e);
  }
}
