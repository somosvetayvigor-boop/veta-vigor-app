package dev.workers.somos_vetayvigor.vetayvigor_assetlinks.twa

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * Widget de pantalla de inicio: racha (La Llama Viva), nivel (madera),
 * rutina de hoy, y último entrenamiento.
 *
 * No lee el SQLite de la app directo -- leer los datos ya calculados por
 * MiRutina.jsx desde SharedPreferences (escritos vía @capacitor/preferences,
 * ver src/utils/widgetBridge.js) evita duplicar la lógica de "qué toca hoy"
 * en dos lenguajes. Ese plugin escribe siempre strings, así que acá se lee
 * con getString(...), nunca getInt(...) -- un ClassCastException acá no
 * tumba la app, solo deja el widget sin actualizar en silencio.
 */
class VetaVigorWidgetProvider : AppWidgetProvider() {

    companion object {
        // Mismo nombre que Preferences.configure({ group }) en widgetBridge.js.
        private const val PREFS_GROUP = "VetaVigorWidget"
        private const val KEY_RACHA = "racha"
        private const val KEY_RUTINA_HOY = "rutinaHoy"
        private const val KEY_NIVEL = "nivel"
        private const val KEY_ULTIMO_ENTRENAMIENTO = "ultimoEntrenamiento"
        private const val KEY_PROGRESO_SEMANAL = "progresoSemanal"

        private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_GROUP, Context.MODE_PRIVATE)
            val racha = prefs.getString(KEY_RACHA, "0 días") ?: "0 días"
            val rutinaHoy = prefs.getString(KEY_RUTINA_HOY, "—") ?: "—"
            val nivel = prefs.getString(KEY_NIVEL, "Semilla") ?: "Semilla"
            val ultimoEntrenamiento = prefs.getString(KEY_ULTIMO_ENTRENAMIENTO, "Sin registros") ?: "Sin registros"
            val progresoSemanal = prefs.getString(KEY_PROGRESO_SEMANAL, "") ?: ""

            val views = RemoteViews(context.packageName, R.layout.veta_vigor_widget)
            views.setTextViewText(R.id.widget_racha, racha)
            views.setTextViewText(R.id.widget_nivel, "Nivel: $nivel")
            views.setTextViewText(R.id.widget_rutina_hoy, "Hoy: $rutinaHoy")
            views.setTextViewText(R.id.widget_ultimo_entrenamiento, "Último: $ultimoEntrenamiento")
            if (progresoSemanal.isNotBlank()) {
                views.setTextViewText(R.id.widget_progreso_semanal, "Semana: $progresoSemanal")
                views.setViewVisibility(R.id.widget_progreso_semanal, android.view.View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.widget_progreso_semanal, android.view.View.GONE)
            }

            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            // FLAG_IMMUTABLE es obligatorio desde API 31 -- sin esto, truena en
            // tiempo de ejecución la primera vez que Android intenta pintar el
            // widget, no al compilar.
            val pendingIntent = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
}
