import DatabaseService from '../services/DatabaseService';

/**
 * Deja constancia de que hoy se entrenó, creando la fila de `checkins` del día.
 *
 * POR QUÉ EXISTE
 * Hasta ahora las filas de checkins solo nacían en MiRutina, en el check-in
 * diario de disposición. Terminar una rutina o un día del reto no creaba
 * ninguna — y de esa tabla dependen el Progreso Semanal, la sesión histórica y
 * el "último entrenamiento" del panel de administración. El resultado era que
 * un usuario entrenaba, se le acreditaba el XP y subía su ciclo, pero los
 * contadores de días seguían clavados.
 *
 * NO PISA EL CHECK-IN DE DISPOSICIÓN
 * Si el usuario ya registró hoy cómo se sentía (nivel 1 a 5), esa fila se
 * respeta tal cual: sería absurdo sustituir su valoración por un valor neutro
 * solo porque además entrenó. Solo se crea cuando no hay nada para hoy.
 *
 * La fecha se calcula en horario local, igual que en MiRutina, para que ambos
 * caminos coincidan en qué día es "hoy".
 *
 * @param {string} userId
 * @returns {Promise<boolean>} true si creó la fila, false si ya existía
 */
export async function registrarDiaEntrenado(userId) {
  if (!userId) return false;

  try {
    const hoy = new Date();
    const hoyStr = hoy.getFullYear()
      + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
      + '-' + String(hoy.getDate()).padStart(2, '0');

    const existentes = await DatabaseService.query(
      `SELECT id FROM checkins WHERE user_id = ? AND fecha = ?`,
      [userId, hoyStr]
    );

    if (existentes && existentes.length > 0) return false;

    // nivel 3 = neutro. Es el mismo valor que ya usaba MiRutina al rellenar
    // días de entrenamiento sin valoración explícita.
    await DatabaseService.execute(
      `INSERT INTO checkins (id, user_id, fecha, nivel, is_dirty) VALUES (?, ?, ?, ?, 1)`,
      [crypto.randomUUID(), userId, hoyStr, 3]
    );

    return true;
  } catch (e) {
    // Que falle esto no debe tumbar el cierre de una rutina ya completada.
    console.warn('No se pudo registrar el día entrenado:', e);
    return false;
  }
}
