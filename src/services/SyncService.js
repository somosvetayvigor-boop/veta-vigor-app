import { supabase } from '../supabaseClient';
import DatabaseService from './DatabaseService';

class SyncService {
  /**
   * Sincroniza desde Supabase hacia la base de datos local (Pull)
   * Ideal llamarlo al iniciar la app
   */
  async pullData(userId) {
    if (!userId) return;
    console.log("Iniciando Pull de datos desde Supabase...");

    try {
      // 1. Pull Perfil
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

      // 2. Pull Sistemas de Entrenamiento
      const { data: sistemas } = await supabase.from('sistemas_entrenamiento').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO sistemas_entrenamiento (id, nombre, descripcion, imagen_url, orden)
        VALUES (?, ?, ?, ?, ?)
      `, (sistemas || []).map(s => [s.id, s.nombre, s.descripcion, s.imagen_url, s.orden]));

      // 3. Pull Retos
      const { data: retos } = await supabase.from('retos').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO retos (id, nombre, descripcion, nivel_requerido, puntos_recompensa)
        VALUES (?, ?, ?, ?, ?)
      `, (retos || []).map(r => [r.id, r.nombre, r.descripcion, r.nivel_requerido, r.puntos_recompensa || 0]));

      // 3.5 Pull Reto Dias
      const { data: retoDias } = await supabase.from('reto_dias').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO reto_dias (id, reto_id, dia_numero, nombre_dia, descripcion, video_url, minutos_estimados, puntos_dia)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, (retoDias || []).map(rd => [
        rd.id,
        rd.reto_id,
        rd.dia_numero || 0,
        rd.nombre_dia || '',
        rd.descripcion || null,
        rd.video_url || null,
        rd.minutos_estimados || 0,
        rd.puntos_dia || 0
      ]));

      // 4. Pull Rutinas
      const { data: rutinas } = await supabase.from('rutinas').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rutinas (id, nombre, nivel, frecuencia, descripcion, sistema_id, premium)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, (rutinas || []).map(ru => [ru.id, ru.nombre, ru.nivel, ru.frecuencia, ru.descripcion, ru.sistema_id, ru.premium ? 1 : 0]));

      // 4.5 Pull Ejercicios
      const { data: ejerciciosLib } = await supabase.from('ejercicios_biblioteca').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO ejercicios_biblioteca (id, nombre, equipo_necesario, instrucciones, consejos_pro, musculos_trabajados, imagen_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, (ejerciciosLib || []).map(ej => [ej.id, ej.nombre, ej.equipo_necesario, ej.instrucciones, ej.consejos_pro, ej.musculos_trabajados, ej.imagen_url]));

      const { data: rutEjercicios } = await supabase.from('rutina_ejercicios').select('*');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rutina_ejercicios (id, rutina_id, ejercicio_id, orden_ejercicio, repeticiones_objetivo)
        VALUES (?, ?, ?, ?, ?)
      `, (rutEjercicios || []).map(re => [re.id, re.rutina_id, re.ejercicio_id, re.orden_ejercicio, re.repeticiones_objetivo]));

      // 5. Pull Habitos Diarios
      const { data: habitos } = await supabase.from('habitos_diarios').select('*').eq('user_id', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO habitos_diarios (id, user_id, dia_reto, agua, sueno, comida_sana, puntos_ganados, created_at, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, (habitos || []).map(h => [h.id, h.user_id, h.dia_reto, h.agua, h.sueno, h.comida_sana ? 1 : 0, h.puntos_ganados, h.created_at]));

      // 6. Pull Checkins & Bienestar
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      const limitStr = limitDate.toISOString().split('T')[0];

      const { data: checkins } = await supabase.from('checkins').select('*').eq('user_id', userId).gte('fecha', limitStr);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO checkins (id, user_id, fecha, nivel, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, (checkins || []).map(c => [c.id, c.user_id, c.fecha, c.nivel]));

      const { data: checkinsB } = await supabase.from('checkins_bienestar').select('*').eq('user_id', userId).gte('fecha', limitStr);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO checkins_bienestar (id, user_id, fecha, habitos, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, (checkinsB || []).map(cb => [cb.id, cb.user_id, cb.fecha, JSON.stringify(cb.habitos)]));

      // 7. Pull RPG Inventory & Rewards
      const { data: historial } = await supabase.from('historial_entrenamientos').select('*').eq('user_id', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO historial_entrenamientos (id, user_id, rutina_id, ejercicio_id, series_log, completado, fecha_completado, is_dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, (historial || []).map(h => [h.id, h.user_id, h.rutina_id, h.ejercicio_id, h.series_log ? JSON.stringify(h.series_log) : null, h.completado ? 1 : 0, h.fecha_completado || h.created_at]));

      const { data: inv } = await supabase.from('rpg_inventario').select('*').eq('user_id', userId);
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO rpg_inventario (id, user_id, item_id, cantidad, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, (inv || []).map(i => [i.id, i.user_id, i.item_id, i.cantidad]));

      // NOTA: rpg_historial_recompensas no se sincroniza. Esa tabla no existe en
      // Supabase (el esquema real es rpg_transacciones) y cada intento devolvía 404.
      // El registro de recompensas se mantiene solo en local; el XP y las monedas
      // que ve el usuario viven en perfiles.xp_actual / puntos_forja, que sí se sincronizan.

      // 8. Pull Entrenador
      const { data: relEntrenador } = await supabase.from('relacion_entrenador_alumno').select('*').eq('alumno_id', userId).eq('estado', 'activo');
      await DatabaseService.executeBatch(`
        INSERT OR REPLACE INTO relacion_entrenador_alumno (id, entrenador_id, alumno_id, estado, is_dirty)
        VALUES (?, ?, ?, ?, 0)
      `, (relEntrenador || []).map(rel => [rel.id, rel.entrenador_id, rel.alumno_id, rel.estado]));

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
    if (!userId) return;
    console.log("Iniciando Push de datos hacia Supabase...");

    try {
      // 1. Push Perfil (si está sucio)
      const perfilesSucios = await DatabaseService.query(`SELECT * FROM perfiles WHERE is_dirty = 1 AND id = ?`, [userId]);
      if (perfilesSucios && perfilesSucios.length > 0) {
        const p = perfilesSucios[0];
        const { error } = await supabase.from('perfiles').update({
          nivel: p.nivel,
          sistema_activo: p.sistema_activo,
          reto_activo_id: p.reto_activo_id,
          reto_dia_actual: p.reto_dia_actual,
          reto_ultimo_completado: p.reto_ultimo_completado,
          reto_completado: p.reto_completado === 1,
          reto_fecha_inicio: p.reto_fecha_inicio,
          plan_membresia: p.plan_membresia,
          force_platinum_trial: p.force_platinum_trial === 1,
          puntos_totales: p.puntos_totales,
          xp_actual: p.xp_actual,
          puntos_forja: p.puntos_forja,
          stat_fuerza: p.stat_fuerza,
          stat_agilidad: p.stat_agilidad,
          stat_resistencia: p.stat_resistencia,
          nivel_rpg: p.nivel_rpg,
          racha_actual: p.racha_actual
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

      // 7. Push RPG Rewards: eliminado. Ver nota en pullData — la tabla remota no existe,
      // así que estos inserts siempre fallaban con 404 y las filas quedaban is_dirty = 1
      // para siempre, reintentándose una por una en cada sincronización.
      // Las filas sucias que ya existan en instalaciones antiguas simplemente se ignoran.
    } catch (error) {
      console.error("Error durante el Push de datos:", error);
    }
  }

  /**
   * Ejecuta sincronización bidireccional
   */
  async syncAll(userId) {
    if (!userId) return;
    // 1. Primero subimos lo local a la nube (para no sobrescribirlo)
    await this.pushData(userId);
    // 2. Bajamos los datos frescos de la nube
    await this.pullData(userId);
  }
}

export default new SyncService();
