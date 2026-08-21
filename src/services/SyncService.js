import { supabase } from '../supabaseClient';
import DatabaseService from './DatabaseService';
import { bonosAReclamar } from '../utils/rachaBonos';
import { debeAplicarProgresoPendiente, calcularRetosCompletadosCount } from '../utils/retoProgresoGuard';

// Cada cuánto se vuelven a bajar los catálogos (sistemas, retos, rutinas, ejercicios).
// Son datos que cambian rara vez, así que no tiene sentido traerlos en cada arranque.
// Los datos del usuario (perfil, checkins, historial, hábitos) se sincronizan siempre.
// Con 6 horas, cualquiera que abriera la app a la mañana siguiente disparaba la
// descarga completa de catálogos —sistemas, retos, días, rutinas, biblioteca—
// justo mientras el arranque intentaba renovar el token. Dos cosas compitiendo
// por la misma red recién despertada.
//
// 24 h es más acorde a lo que son estos datos: contenido que se edita desde el
// panel de administración de vez en cuando, no algo que cambie cada rato. Y
// cuando cambia, el botón de recarga de la cabecera llama a invalidarCatalogos()
// y los baja al momento, así que nadie se queda esperando un día.
const HORAS_FRESCURA_CATALOGOS = 24;
const CLAVE_CATALOGOS = 'catalogos';

class SyncService {
  /**
   * ¿Hace falta volver a bajar los catálogos?
   * Sin columnas updated_at en Supabase no hay sync incremental posible, así que
   * lo que hacemos es limitar la frecuencia usando sync_metadata.
   */
  async catalogosEstanFrescos() {
    try {
      const filas = await DatabaseService.query(
        `SELECT last_sync_timestamp FROM sync_metadata WHERE table_name = ?`,
        [CLAVE_CATALOGOS]
      );
      const ultimo = filas?.[0]?.last_sync_timestamp;
      if (!ultimo) return false;
      const horas = (Date.now() - new Date(ultimo).getTime()) / 36e5;
      return horas >= 0 && horas < HORAS_FRESCURA_CATALOGOS;
    } catch {
      return false;
    }
  }

  async marcarCatalogosSincronizados() {
    await DatabaseService.execute(
      `INSERT OR REPLACE INTO sync_metadata (table_name, last_sync_timestamp) VALUES (?, ?)`,
      [CLAVE_CATALOGOS, new Date().toISOString()]
    );
  }

  /** Fuerza que el próximo pull vuelva a bajar los catálogos. */
  async invalidarCatalogos() {
    await DatabaseService.execute(`DELETE FROM sync_metadata WHERE table_name = ?`, [CLAVE_CATALOGOS]);
  }

  /**
   * Ids de una tabla local que aún no se han subido a Supabase.
   *
   * El pull usa INSERT OR REPLACE, que pisa la fila entera. Si una fila local
   * tiene cambios sin subir —porque el push falló o porque se editó estando sin
   * conexión— sobrescribirla con la versión del servidor borra el trabajo del
   * usuario, y encima el is_dirty = 0 del pull hacía que no se reintentara jamás.
   * Estas filas se excluyen de la bajada y se quedan esperando su push.
   */
  async _idsSucios(tabla, userId, columnaUsuario = 'user_id') {
    try {
      const filas = await DatabaseService.query(
        `SELECT id FROM ${tabla} WHERE is_dirty = 1 AND ${columnaUsuario} = ?`,
        [userId]
      );
      return new Set((filas || []).map(f => String(f.id)));
    } catch {
      // Ante la duda, no filtramos nada: es peor bloquear el pull entero.
      return new Set();
    }
  }

  /** Quita de las filas bajadas las que tienen cambios locales pendientes. */
  _sinSucias(filas, idsSucios) {
    if (!idsSucios.size) return filas || [];
    return (filas || []).filter(f => !idsSucios.has(String(f.id)));
  }

  /** Tablas locales con marca is_dirty, y la columna por la que se filtra al usuario. */
  static get TABLAS_SINCRONIZADAS() {
    return [
      ['perfiles', 'id'],
      ['habitos_diarios', 'user_id'],
      ['checkins', 'user_id'],
      ['checkins_bienestar', 'user_id'],
      ['historial_entrenamientos', 'user_id'],
      ['rpg_inventario', 'user_id'],
      ['relacion_entrenador_alumno', 'alumno_id'],
      ['rpg_historial_recompensas', 'user_id'],
      ['reto_progreso_pendiente', 'user_id'],
    ];
  }

  /**
   * ¿Queda algo sin subir después de un push?
   *
   * Se comprueba el estado real de la base en vez de ir acumulando banderas por
   * cada rama de error: si algo falló, su is_dirty sigue encendido, y eso es más
   * fiable que recordar marcarlo en cada uno de los sitios de subida.
   */
  async _quedanCambiosSinSubir(userId) {
    for (const [tabla, columna] of SyncService.TABLAS_SINCRONIZADAS) {
      try {
        const filas = await DatabaseService.query(
          `SELECT 1 AS x FROM ${tabla} WHERE is_dirty = 1 AND ${columna} = ? LIMIT 1`,
          [userId]
        );
        if (filas && filas.length) return tabla;
      } catch {
        // Tabla aún no creada en este dispositivo: no es un pendiente.
      }
    }
    return null;
  }

  /**
   * Sincroniza desde Supabase hacia la base de datos local (Pull)
   * Ideal llamarlo al iniciar la app
   */
  async pullData(userId, { force = false } = {}) {
    if (!userId) return;
    console.log("Iniciando Pull de datos desde Supabase...");

    try {
      // 1. Pull Perfil
      //
      // Se salta si el perfil local tiene cambios sin subir. Es la fila más
      // delicada de todas: lleva reto_dia_actual, reto_completado y racha_actual,
      // o sea el progreso del reto. Pisarla con la versión del servidor tras un
      // push fallido borraba el entrenamiento del día en silencio.
      const perfilSucio = await DatabaseService.query(
        `SELECT is_dirty FROM perfiles WHERE id = ?`, [userId]
      );
      if (perfilSucio?.[0]?.is_dirty === 1) {
        console.warn("Perfil local con cambios sin subir: se omite la bajada para no pisarlos.");
      } else {
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', userId).single();
      if (perfil) {
        await DatabaseService.execute(`
          INSERT OR REPLACE INTO perfiles 
          (id, email, nombre, nivel, sistema_activo, reto_activo_id, reto_dia_actual, reto_ultimo_completado, reto_completado, reto_fecha_inicio, plan_membresia, force_platinum_trial, puntos_totales, rango, xp_actual, puntos_forja, stat_fuerza, stat_agilidad, stat_resistencia, nivel_rpg, racha_actual, retos_completados_count, calendario_personalizado, rol_usuario, dias_entrenamiento, is_dirty) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          perfil.id, perfil.email, perfil.nombre, perfil.nivel, perfil.sistema_activo, 
          perfil.reto_activo_id, perfil.reto_dia_actual, perfil.reto_ultimo_completado, 
          perfil.reto_completado ? 1 : 0, perfil.reto_fecha_inicio, perfil.plan_membresia,
          perfil.force_platinum_trial ? 1 : 0, perfil.puntos_totales, perfil.rango,
          perfil.xp_actual, perfil.puntos_forja, perfil.stat_fuerza, perfil.stat_agilidad,
          perfil.stat_resistencia, perfil.nivel_rpg, perfil.racha_actual,
          perfil.retos_completados_count, typeof perfil.calendario_personalizado === 'string' ? perfil.calendario_personalizado : JSON.stringify(perfil.calendario_personalizado || {}), perfil.rol_usuario,
          typeof perfil.dias_entrenamiento === 'string' ? perfil.dias_entrenamiento : JSON.stringify(perfil.dias_entrenamiento || [])
        ]);
      }
      } // fin del else de perfilSucio

      // === CATÁLOGOS (contenido compartido, cambia rara vez) ===
      const saltarCatalogos = !force && await this.catalogosEstanFrescos();
      if (saltarCatalogos) {
        console.log(`Catálogos aún frescos (<${HORAS_FRESCURA_CATALOGOS}h), se omiten.`);
      } else {

      // 2. Pull Sistemas de Entrenamiento
      const { data: sistemas } = await supabase.from('sistemas_entrenamiento').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO sistemas_entrenamiento (id, nombre, descripcion, imagen_url)
        VALUES (?, ?, ?, ?)
      `, (sistemas || []).map(s => [s.id, s.nombre, s.descripcion, s.imagen_url]));

      // 3. Pull Retos
      const { data: retos } = await supabase.from('retos').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO retos (id, nombre, descripcion, nivel_requerido, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, (retos || []).map(r => [r.id, r.nombre, r.descripcion, r.nivel_requerido, r.created_at]));

      // 3.5 Pull Reto Dias
      // rutina_json es el contenido real del día. Pese al nombre no es JSON: es texto
      // plano con un ejercicio por línea (ver parseRutinaText en RutinaRetoPlayer).
      // Se guarda tal cual; serializarlo agregaría comillas y rompería el parseo.
      const { data: retoDias } = await supabase.from('reto_dias').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO reto_dias (id, reto_id, dia_numero, semana, enfoque, trabajo_descanso, rutina_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, (retoDias || []).map(rd => [
        rd.id,
        rd.reto_id,
        rd.dia_numero || 0,
        rd.semana,
        rd.enfoque,
        rd.trabajo_descanso,
        rd.rutina_json ?? null,
        rd.created_at
      ]));

      // 4. Pull Rutinas
      const { data: rutinas } = await supabase.from('rutinas').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rutinas (id, sistema_id, nombre, enfoque, nivel, imagen_url, user_id, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, (rutinas || []).map(ru => [ru.id, ru.sistema_id, ru.nombre, ru.enfoque, ru.nivel, ru.imagen_url, ru.user_id, ru.is_custom ? 1 : 0]));

      // 4.5 Pull Ejercicios
      const { data: ejerciciosLib } = await supabase.from('ejercicios_biblioteca').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO ejercicios_biblioteca (id, nombre, equipo_necesario, instrucciones, consejos_pro, musculos_trabajados, imagen_url, is_custom, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, (ejerciciosLib || []).map(ej => [ej.id, ej.nombre, ej.equipo_necesario, ej.instrucciones, ej.consejos_pro, ej.musculos_trabajados, ej.imagen_url, ej.is_custom ? 1 : 0, ej.created_by, ej.status]));

      const { data: rutEjercicios } = await supabase.from('rutina_ejercicios').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rutina_ejercicios (id, rutina_id, ejercicio_id, orden_ejercicio, repeticiones_objetivo)
        VALUES (?, ?, ?, ?, ?)
      `, (rutEjercicios || []).map(re => [re.id, re.rutina_id, re.ejercicio_id, re.orden_ejercicio, re.repeticiones_objetivo]));

        await this.marcarCatalogosSincronizados();
      } // fin del bloque de catálogos

      // === DATOS DEL USUARIO (siempre se sincronizan) ===

      // 5. Pull Habitos Diarios
      const { data: habitos } = await supabase.from('habitos_diarios').select('*').eq('user_id', userId);
      const habitosSuciosIds = await this._idsSucios('habitos_diarios', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO habitos_diarios (id, user_id, dia_reto, agua, sueno, comida_sana, puntos_ganados, created_at, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, this._sinSucias(habitos, habitosSuciosIds).map(h => [h.id, h.user_id, h.dia_reto, h.agua, h.sueno, h.comida_sana ? 1 : 0, h.puntos_ganados, h.created_at]));

      // 6. Pull Checkins & Bienestar
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      const limitStr = limitDate.toISOString().split('T')[0];

      const { data: checkins } = await supabase.from('checkins').select('*').eq('user_id', userId).gte('fecha', limitStr);
      const checkinsSuciosIds = await this._idsSucios('checkins', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO checkins (id, user_id, fecha, nivel, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, this._sinSucias(checkins, checkinsSuciosIds).map(c => [c.id, c.user_id, c.fecha, c.nivel]));

      const { data: checkinsB } = await supabase.from('checkins_bienestar').select('*').eq('user_id', userId).gte('fecha', limitStr);
      const checkinsBSuciosIds = await this._idsSucios('checkins_bienestar', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO checkins_bienestar (id, user_id, fecha, habitos, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, this._sinSucias(checkinsB, checkinsBSuciosIds).map(cb => [cb.id, cb.user_id, cb.fecha, JSON.stringify(cb.habitos)]));

      // 7. Pull RPG Inventory & Rewards
      const { data: historial } = await supabase.from('historial_entrenamientos').select('*').eq('user_id', userId);
      const historialSuciosIds = await this._idsSucios('historial_entrenamientos', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO historial_entrenamientos (id, user_id, rutina_id, ejercicio_id, series_log, completado, fecha_completado, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, this._sinSucias(historial, historialSuciosIds).map(h => [h.id, h.user_id, h.rutina_id, h.ejercicio_id, h.series_log ? JSON.stringify(h.series_log) : null, h.completado ? 1 : 0, h.fecha_completado || h.created_at]));

      const { data: inv } = await supabase.from('rpg_inventario').select('*').eq('user_id', userId);
      const invSuciosIds = await this._idsSucios('rpg_inventario', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rpg_inventario (id, user_id, item_id, cantidad, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, this._sinSucias(inv, invSuciosIds).map(i => [i.id, i.user_id, i.item_id, i.cantidad]));

      // NOTA: rpg_historial_recompensas no se sincroniza. Esa tabla no existe en
      // Supabase (el esquema real es rpg_transacciones) y cada intento devolvía 404.
      // El registro de recompensas se mantiene solo en local; el XP y las monedas
      // que ve el usuario viven en perfiles.xp_actual / puntos_forja, que sí se sincronizan.

      // 8. Pull Entrenador
      const { data: relEntrenador } = await supabase.from('relacion_entrenador_alumno').select('*').eq('alumno_id', userId).eq('estado', 'activo');
      const relSuciasIds = await this._idsSucios('relacion_entrenador_alumno', userId, 'alumno_id');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO relacion_entrenador_alumno (id, entrenador_id, alumno_id, estado, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, this._sinSucias(relEntrenador, relSuciasIds).map(rel => [rel.id, rel.entrenador_id, rel.alumno_id, rel.estado]));

      console.log("Pull completado exitosamente.");
    } catch (error) {
      console.error("Error durante el Pull de datos:", error);
    }
  }

  /**
   * Sincroniza desde la base de datos local hacia Supabase (Push)
   * Solo envía registros marcados como is_dirty = 1
   */
  async pushData(userId) {
    if (!userId) return false;
    console.log("Iniciando Push de datos hacia Supabase...");

    try {
      // 1. Push Perfil (si está sucio)
      const perfilesSucios = await DatabaseService.query(`SELECT * FROM perfiles WHERE is_dirty = 1 AND id = ?`, [userId]);
      if (perfilesSucios && perfilesSucios.length > 0) {
        const p = perfilesSucios[0];
        const { error } = await supabase.from('perfiles').update({
          nivel: p.nivel,
          sistema_activo: p.sistema_activo
          // plan_membresia y force_platinum_trial NO se envían, por la misma razón
          // que xp_actual y puntos_forja (ver comentario abajo): son autoritativos
          // del servidor. Desde el blindaje de perfiles el rol `authenticated` ya
          // no tiene privilegio de UPDATE sobre esas columnas, así que incluirlas
          // haría fallar el push entero y dejaría is_dirty encendido para siempre.
          // Se escriben vía activar_plan_por_compra / otorgar_trial_por_reto.

          // xp_actual, puntos_forja y racha_actual NO se envían acá a propósito.
          // Son autoritativos del servidor: los escribe completar_mision_rpg dentro
          // de una transacción con idempotencia. Si los empujáramos desde el cliente
          // pisaríamos el saldo del ledger con un valor calculado localmente, que es
          // exactamente el doble cobro que el RPC existe para evitar.
          // Igual con puntos_totales, nivel_rpg, y las stats.

          // reto_activo_id, reto_dia_actual, reto_ultimo_completado, reto_completado
          // y reto_fecha_inicio NO se envían aquí (16/08). RutinaRetoPlayer.jsx y
          // Reto21Dias.jsx (handleEnroll) ya escriben estos campos directo a
          // Supabase en el momento en que cambian, con su propio espejo local.
          // Incluirlos también acá era peligroso: si is_dirty se enciende por CUALQUIER
          // otro motivo (por ejemplo, terminar una rutina normal en MiRutina.jsx, que
          // marca is_dirty=1 en toda la fila), este push subía lo que hubiera cacheado
          // en el SQLite local en ese momento — que podía ser viejo si nunca se
          // sincronizó — y pisaba el avance real del reto ya confirmado en el servidor.
          // Pasó de verdad el 16/08 con la cuenta de sofiita.
        }).eq('id', userId);

        if (!error) {
          await DatabaseService.execute(`UPDATE perfiles SET is_dirty = 0 WHERE id = ?`, [userId]);
        }
      }

      // 2. Push Hábitos Diarios
      const habitosSucios = await DatabaseService.query(`SELECT * FROM habitos_diarios WHERE is_dirty = 1 AND user_id = ?`, [userId]);
      if (habitosSucios && habitosSucios.length > 0) {
        for (const h of habitosSucios) {
          const payload = {
            id: h.id,
            user_id: h.user_id,
            dia_reto: h.dia_reto,
            agua: h.agua,
            sueno: h.sueno,
            comida_sana: h.comida_sana === 1,
            puntos_ganados: h.puntos_ganados,
            created_at: h.created_at
          };
          
          const { error } = await supabase.from('habitos_diarios').upsert(payload);
          if (!error) {
            await DatabaseService.execute(`UPDATE habitos_diarios SET is_dirty = 0 WHERE id = ?`, [h.id]);
          }
        }
      }

      console.log("Push completado exitosamente.");
      // 3. Push Historial Entrenamientos (si está sucio)
      const historialSucio = await DatabaseService.query(`SELECT * FROM historial_entrenamientos WHERE is_dirty = 1 AND user_id = ?`, [userId]);
      if (historialSucio && historialSucio.length > 0) {
        for (const h of historialSucio) {
          const { error } = await supabase.from('historial_entrenamientos').insert([{
            id: h.id,
            user_id: h.user_id,
            rutina_id: h.rutina_id,
            ejercicio_id: h.ejercicio_id,
            series_log: JSON.parse(h.series_log),
            completado: h.completado === 1,
            fecha_completado: h.fecha_completado || new Date().toISOString()
          }]);
          
          if (!error) {
            await DatabaseService.execute(`UPDATE historial_entrenamientos SET is_dirty = 0 WHERE id = ?`, [h.id]);
          }
        }
      }
      // 4. Push Checkins
      const checkinsSucios = await DatabaseService.query(`SELECT * FROM checkins WHERE is_dirty = 1 AND user_id = ?`, [userId]);
      if (checkinsSucios && checkinsSucios.length > 0) {
        for (const c of checkinsSucios) {
          const { error } = await supabase.from('checkins').upsert({
            id: c.id,
            user_id: c.user_id,
            fecha: c.fecha,
            nivel: c.nivel
          });
          if (!error) {
            await DatabaseService.execute(`UPDATE checkins SET is_dirty = 0 WHERE id = ?`, [c.id]);
          }
        }
      }

      // 5. Push Checkins Bienestar
      const checkinsBSucios = await DatabaseService.query(`SELECT * FROM checkins_bienestar WHERE is_dirty = 1 AND user_id = ?`, [userId]);
      if (checkinsBSucios && checkinsBSucios.length > 0) {
        for (const cb of checkinsBSucios) {
          const { error } = await supabase.from('checkins_bienestar').upsert({
            id: cb.id,
            user_id: cb.user_id,
            fecha: cb.fecha,
            habitos: JSON.parse(cb.habitos)
          });
          if (!error) {
            await DatabaseService.execute(`UPDATE checkins_bienestar SET is_dirty = 0 WHERE id = ?`, [cb.id]);
          }
        }
      }

      // 6. Push RPG Inventory
      const invSucio = await DatabaseService.query(`SELECT * FROM rpg_inventario WHERE is_dirty = 1 AND user_id = ?`, [userId]);
      if (invSucio && invSucio.length > 0) {
        for (const i of invSucio) {
          const { error } = await supabase.from('rpg_inventario').upsert({
            id: i.id,
            user_id: i.user_id,
            item_id: i.item_id,
            cantidad: i.cantidad
          });
          if (!error) {
            await DatabaseService.execute(`UPDATE rpg_inventario SET is_dirty = 0 WHERE id = ?`, [i.id]);
          }
        }
      }

      // 7. Push de recompensas RPG.
      //
      // rpg_historial_recompensas no se sincroniza como tabla: esa tabla no existe en
      // Supabase. Funciona como outbox local, y cada fila pendiente se reproduce como
      // una llamada a completar_mision_rpg, que acredita XP y monedas de forma atómica
      // y las registra en rpg_transacciones.
      //
      // El id de la fila es un UUID generado una sola vez cuando se ganó la recompensa,
      // así que sirve directamente como clave de idempotencia: reproducirla dos veces
      // (por reintento, por doble toque o al recuperar la conexión) no acredita de más.
      const recSucio = await DatabaseService.query(
        `SELECT * FROM rpg_historial_recompensas WHERE is_dirty = 1 AND user_id = ?`, [userId]
      );
      for (const r of recSucio || []) {
        const { data, error } = await supabase.rpc('completar_mision_rpg', {
          p_user_id: r.user_id,
          p_origen: r.fuente || 'entrenamiento',
          p_idempotency_key: r.id,
          p_xp: r.xp_ganada || 0,
          p_monedas: r.monedas_ganadas || 0
        });

        if (error) {
          console.warn('Recompensa pendiente, se reintenta luego:', error.message);
          continue; // sigue sucia, se reintenta en el próximo sync
        }

        // 'Ya se registró esta misión' también es éxito: significa que el ledger ya
        // la tiene y no hay que volver a intentarlo.
        await DatabaseService.execute(
          `UPDATE rpg_historial_recompensas SET is_dirty = 0 WHERE id = ?`, [r.id]
        );

        if (data?.success) {
          // Adoptar el saldo autoritativo que devolvió el servidor. nivel_rpg
          // incluido desde acá (20/08): antes solo lo subía RutinaDetail.jsx
          // con una llamada aparte y best-effort, así que el XP ganado por
          // Bienestar o Descanso Activo podía cruzar de nivel sin que
          // nivel_rpg se enterara nunca -- la barra se veía llena pero el
          // número de nivel se quedaba pegado. Ahora el RPC lo calcula junto
          // con el XP, en la misma transacción (ver VETA_VIGOR_FIX_NIVEL_RPG.sql),
          // y el cliente lo adopta acá.
          //
          // data.nivel_rpg puede venir undefined si todavía no se corrió esa
          // migración en Supabase -- en ese caso se omite del UPDATE en vez
          // de mandar NULL, para no borrar el valor que ya había.
          if (data.nivel_rpg !== undefined && data.nivel_rpg !== null) {
            await DatabaseService.execute(
              `UPDATE perfiles SET xp_actual = ?, puntos_forja = ?, racha_actual = ?, nivel_rpg = ? WHERE id = ?`,
              [data.xp_total, data.monedas_total, data.racha, data.nivel_rpg, userId]
            );
          } else {
            await DatabaseService.execute(
              `UPDATE perfiles SET xp_actual = ?, puntos_forja = ?, racha_actual = ? WHERE id = ?`,
              [data.xp_total, data.monedas_total, data.racha, userId]
            );
          }

          // Revisar bonos de racha (7/14 días) también acá: hasta el 16/08 solo
          // RutinaRetoPlayer.jsx los revisaba, justo después de SU propia llamada
          // a completar_mision_rpg. Pero racha_actual es un contador único
          // compartido por TODOS los orígenes de misión -- si un entrenamiento
          // normal completado offline (esta fila viene de RutinaDetail.jsx o
          // MiRutina.jsx) es el que empuja la racha a 7 u 14 al reproducirse
          // acá, nadie más lo revisaba nunca. No hay bono de 21 días/perfecto acá
          // a propósito: ese depende de haber terminado el Reto 21
          // (reto_completado), algo que este outbox de recompensas normales no
          // sabe ni le corresponde decidir.
          for (const { tipo, key } of bonosAReclamar(data.racha, false, userId)) {
            await supabase.rpc('reclamar_bono_reto', { p_user_id: userId, p_bono_tipo: tipo, p_idempotency_key: key });
          }
        }
      }

      // 8. Push de progreso pendiente del Reto 21 (outbox hermano del bloque 7).
      //
      // reto_dia_actual/reto_ultimo_completado/reto_completado no pasan por una
      // RPC atómica -- se escriben directo a perfiles desde RutinaRetoPlayer.jsx.
      // Si esa escritura falló por falta de red, quedó encolada acá con
      // is_dirty=1 (ver queueRetoOffline en RutinaRetoPlayer.jsx). Antes de
      // aplicar cada fila se relee el estado real del servidor: si ya alcanzó o
      // superó lo encolado (otro dispositivo, o el usuario reintentó online
      // mientras tanto), se descarta en vez de pisarlo.
      const retoSucio = await DatabaseService.query(
        `SELECT * FROM reto_progreso_pendiente WHERE is_dirty = 1 AND user_id = ?`, [userId]
      );
      for (const pend of retoSucio || []) {
        const { data: srv, error: selError } = await supabase
          .from('perfiles')
          .select('reto_dia_actual, reto_completado, retos_completados_count, racha_actual')
          .eq('id', userId)
          .single();

        if (selError || !srv) {
          console.warn('No se pudo leer el perfil para aplicar progreso de reto pendiente, se reintenta luego:', selError?.message);
          continue; // sigue sucia
        }

        if (!debeAplicarProgresoPendiente(pend, srv)) {
          // El servidor ya está igual o adelante: no hay nada que aplicar,
          // pero la fila SÍ se da por resuelta -- no es un error, es un no-op
          // correcto (evita reintentar para siempre algo que ya no aplica).
          await DatabaseService.execute(`UPDATE reto_progreso_pendiente SET is_dirty = 0 WHERE id = ?`, [pend.id]);
          continue;
        }

        const updates = {
          reto_dia_actual: pend.reto_dia_actual,
          reto_ultimo_completado: pend.reto_ultimo_completado,
          reto_completado: !!pend.reto_completado,
        };
        const nuevoCount = calcularRetosCompletadosCount(srv, updates.reto_completado);
        if (nuevoCount !== (srv.retos_completados_count || 0)) {
          updates.retos_completados_count = nuevoCount;
        }

        const { error: updError } = await supabase.from('perfiles').update(updates).eq('id', userId);
        if (updError) {
          console.warn('No se pudo aplicar el progreso de reto pendiente, se reintenta luego:', updError.message);
          continue; // sigue sucia
        }

        await DatabaseService.execute(`UPDATE reto_progreso_pendiente SET is_dirty = 0 WHERE id = ?`, [pend.id]);

        // Igual que el bloque 7, pero con el estado real de ESTE reto -- acá sí
        // puede corresponder el bono de 21 días/perfecto si este día lo cierra.
        // bonosAReclamar ya decide internamente qué corresponde según la racha
        // fresca y si este día termina el reto.
        for (const { tipo, key } of bonosAReclamar(srv.racha_actual || 0, updates.reto_completado, userId)) {
          await supabase.rpc('reclamar_bono_reto', { p_user_id: userId, p_bono_tipo: tipo, p_idempotency_key: key });
        }
      }

      // Se comprueba el resultado real: si algo falló, su is_dirty sigue en 1.
      const pendiente = await this._quedanCambiosSinSubir(userId);
      if (pendiente) {
        console.warn(`Push incompleto: quedan cambios sin subir en "${pendiente}". Se reintentará.`);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error durante el Push de datos:", error);
      return false;
    }
  }

  /**
   * Ejecuta sincronización bidireccional
   */
  async syncAll(userId, { force = false } = {}) {
    if (!userId) return;
    // 1. Primero subimos lo local a la nube (para no sobrescribirlo)
    const pushCompleto = await this.pushData(userId);

    // 2. Bajamos los datos frescos de la nube.
    //
    // Se baja aunque el push haya quedado incompleto, A PROPÓSITO: pullData ya
    // excluye fila por fila lo que sigue marcado como sucio, así que no puede
    // pisar nada pendiente. Abortar el pull entero por una sola fila atascada
    // dejaría al usuario sin catálogos ni datos nuevos indefinidamente, que es
    // peor que la enfermedad.
    if (!pushCompleto) {
      console.warn("Sync: el push quedó incompleto; el pull respetará las filas sin subir.");
    }
    await this.pullData(userId, { force });
  }
}

export default new SyncService();
