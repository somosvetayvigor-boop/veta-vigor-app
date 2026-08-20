import { Capacitor } from '@capacitor/core';

// Mismo grupo que lee VetaVigorWidgetProvider.kt del lado nativo
// (android/app/src/main/kotlin/.../VetaVigorWidgetProvider.kt) --
// context.getSharedPreferences(GRUPO, MODE_PRIVATE). Si este nombre
// cambia acá, tiene que cambiar ahí también.
const GRUPO_WIDGET = 'VetaVigorWidget';

/**
 * Escribe la racha, la rutina de hoy, el nivel (madera) y el último
 * entrenamiento a un almacén nativo (SharedPreferences) para que el
 * widget de pantalla de inicio los lea sin pasar por el WebView. No lee
 * el SQLite directo desde Kotlin a propósito -- evita duplicar la
 * lógica de "qué toca hoy" en dos lenguajes. El widget se actualiza
 * solo cada ~30 min (mínimo real de Android), así que esto no necesita
 * ser instantáneo.
 */
export async function actualizarWidget({ racha, rutinaHoy, nivel, ultimoEntrenamiento }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.configure({ group: GRUPO_WIDGET });
    const rachaNum = racha ?? 0;
    await Preferences.set({ key: 'racha', value: `${rachaNum} ${rachaNum === 1 ? 'día' : 'días'}` });
    await Preferences.set({ key: 'rutinaHoy', value: rutinaHoy || '—' });
    await Preferences.set({ key: 'nivel', value: nivel || 'Semilla' });
    await Preferences.set({ key: 'ultimoEntrenamiento', value: ultimoEntrenamiento || 'Sin registros' });
  } catch (e) {
    console.warn('No se pudo actualizar el widget:', e);
  }
}
