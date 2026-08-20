package dev.workers.somos_vetayvigor.vetayvigor_assetlinks.twa

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * Widget de pantalla de inicio: racha (La Llama Viva) + rutina de hoy.
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

        private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_GROUP, Context.MODE_PRIVATE)
            val racha = prefs.getString(KEY_RACHA, "0") ?: "0"
            val rutinaHoy = prefs.getString(KEY_RUTINA_HOY, "—") ?: "—"

            val views = RemoteViews(context.packageName, R.layout.veta_vigor_widget)
            views.setTextViewText(R.id.widget_racha, racha)
            views.setTextViewText(R.id.widget_rutina_hoy, rutinaHoy)

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
