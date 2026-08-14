import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

class DatabaseService {
  constructor() {
    this.sqlitePlugin = CapacitorSQLite;
    this.sqliteConnection = new SQLiteConnection(this.sqlitePlugin);
    this.db = null;
    this.isWeb = Capacitor.getPlatform() === 'web';
    // Cola de serialización: ver _enqueue
    this._chain = Promise.resolve();
  }

  /**
   * Serializa todo el acceso a la conexión SQLite.
   * capacitor-community/sqlite envuelve cada run()/executeSet() en su propia
   * transacción, así que dos operaciones solapadas fallan con
   * "cannot start a transaction within a transaction". Como el sync en segundo
   * plano corre mientras las pantallas consultan, ese solapamiento es la norma
   * y no la excepción: encolamos para que nunca haya dos a la vez.
   */
  _enqueue(fn) {
    const run = this._chain.then(fn, fn);
    this._chain = run.catch(() => {});
    return run;
  }

  async initWebStore() {
    try {
      if (this.isWeb) {
        // Registrar el custom element <jeep-sqlite>. Sin esto customElements.whenDefined
        // nunca resuelve y el arranque se cuelga hasta el timeout de emergencia.
        // Import dinámico para que el bundle de stencil no se cargue en nativo.
        const { defineCustomElements } = await import('jeep-sqlite/loader');
        defineCustomElements(window);

        // Inicializar jeep-sqlite (custom element)
        if (!document.querySelector('jeep-sqlite')) {
          const jeepEl = document.createElement('jeep-sqlite');
          document.body.appendChild(jeepEl);
        }

        // Red de seguridad: si el elemento no llega a definirse, fallar rápido
        // en vez de dejar la promesa colgada para siempre.
        await Promise.race([
          customElements.whenDefined('jeep-sqlite'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('jeep-sqlite no se definió en 10s')), 10000))
        ]);

        await this.sqliteConnection.initWebStore();
      }
    } catch (e) {
      console.error("Error al inicializar jeep-sqlite", e);
      throw e;
    }
  }

  async setupDatabase() {
    try {
      if (this.isWeb) {
        await this.initWebStore();
      }

      // Check connections consistency
      const isConn = (await this.sqliteConnection.checkConnectionsConsistency()).result;
      if (isConn) {
        this.db = await this.sqliteConnection.retrieveConnection("veta_vigor_db", false);
      } else {
        this.db = await this.sqliteConnection.createConnection("veta_vigor_db", false, "no-encryption", 1, false);
      }

      await this.db.open();

      // Migrar antes de crear: createSchema usa CREATE TABLE IF NOT EXISTS, así que
      // sin esto los dispositivos ya instalados conservarían el esquema viejo para siempre.
      await this.migrateIfNeeded();

      // Create Tables
      await this.createSchema();

      // En web, hay que llamar saveToStore periódicamente o después de escrituras fuertes
      if (this.isWeb) {
        await this.sqliteConnection.saveToStore("veta_vigor_db");
      }

      return true;
    } catch (e) {
      console.error("Error seteando la base de datos", e);
      return false;
    }
  }

  /**
   * Migración por versión de esquema.
   *
   * Las tablas de catálogo son un espejo desechable de Supabase: se pueden borrar
   * sin perder nada porque el próximo sync las rellena. Las tablas con datos del
   * usuario NO se tocan jamás: pueden contener filas is_dirty = 1 todavía sin subir.
   */
  async migrateIfNeeded() {
    // v2: el esquema local no coincidía con el real de Supabase (faltaba rutinas.user_id,
    // faltaba reto_dias.rutina_json, y sobraban 9 columnas que no existen del otro lado).
    const SCHEMA_VERSION = 2;
    const TABLAS_CATALOGO = [
      'sistemas_entrenamiento', 'retos', 'reto_dias',
      'rutinas', 'rutina_dias', 'rutina_ejercicios', 'ejercicios_biblioteca'
    ];

    try {
      const res = await this.db.query('PRAGMA user_version;');
      const version = res.values?.[0]?.user_version ?? 0;
      if (version >= SCHEMA_VERSION) return;

      console.log(`Migrando esquema local v${version} → v${SCHEMA_VERSION}...`);
      for (const tabla of TABLAS_CATALOGO) {
        await this.db.execute(`DROP TABLE IF EXISTS ${tabla};`);
      }
      await this.db.execute(`PRAGMA user_version = ${SCHEMA_VERSION};`);
      console.log('Migración completada. Los catálogos se rellenan en el próximo sync.');
    } catch (e) {
      console.error('Error migrando el esquema local:', e);
    }
  }

  async createSchema() {
    const schema = `
      CREATE TABLE IF NOT EXISTS perfiles (
        id TEXT PRIMARY KEY,
        email TEXT,
        nombre TEXT,
        nivel TEXT,
        sistema_activo TEXT,
        reto_activo_id TEXT,
        reto_dia_actual INTEGER,
        reto_ultimo_completado TEXT,
        reto_completado INTEGER,
        reto_fecha_inicio TEXT,
        plan_membresia TEXT,
        force_platinum_trial INTEGER,
        puntos_totales INTEGER,
        rango TEXT,
        xp_actual INTEGER DEFAULT 0,
        puntos_forja INTEGER DEFAULT 0,
        stat_fuerza INTEGER DEFAULT 1,
        stat_agilidad INTEGER DEFAULT 1,
        stat_resistencia INTEGER DEFAULT 1,
        nivel_rpg INTEGER DEFAULT 1,
        racha_actual INTEGER DEFAULT 0,
        retos_completados_count INTEGER DEFAULT 0,
        calendario_personalizado TEXT,
        rol_usuario TEXT,
        dias_entrenamiento TEXT,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS historial_entrenamientos (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        rutina_id TEXT,
        ejercicio_id TEXT,
        series_log TEXT,
        completado INTEGER,
        fecha_completado TEXT,
        is_dirty INTEGER DEFAULT 0
      );

      -- === TABLAS DE CATÁLOGO ===
      -- Espejo exacto del esquema real de Supabase (verificado 2026-08-14).
      -- No inventar columnas: las que no existen del otro lado se sincronizan como NULL.

      CREATE TABLE IF NOT EXISTS sistemas_entrenamiento (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        descripcion TEXT,
        imagen_url TEXT
      );

      CREATE TABLE IF NOT EXISTS retos (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        descripcion TEXT,
        nivel_requerido TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS reto_dias (
        id TEXT PRIMARY KEY,
        reto_id TEXT,
        dia_numero INTEGER,
        semana INTEGER,
        enfoque TEXT,
        trabajo_descanso TEXT,
        rutina_json TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS rutinas (
        id TEXT PRIMARY KEY,
        sistema_id TEXT,
        nombre TEXT,
        enfoque TEXT,
        nivel TEXT,
        imagen_url TEXT,
        user_id TEXT,
        is_custom INTEGER
      );

      CREATE TABLE IF NOT EXISTS ejercicios_biblioteca (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        equipo_necesario TEXT,
        instrucciones TEXT,
        consejos_pro TEXT,
        musculos_trabajados TEXT,
        imagen_url TEXT,
        is_custom INTEGER,
        created_by TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS rutina_ejercicios (
        id TEXT PRIMARY KEY,
        rutina_id TEXT,
        ejercicio_id TEXT,
        orden_ejercicio INTEGER,
        repeticiones_objetivo TEXT
      );

      CREATE TABLE IF NOT EXISTS habitos_diarios (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        dia_reto INTEGER,
        agua TEXT,
        sueno TEXT,
        comida_sana INTEGER,
        puntos_ganados INTEGER,
        created_at TEXT,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        fecha TEXT,
        nivel INTEGER,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS checkins_bienestar (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        fecha TEXT,
        habitos TEXT,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rpg_inventario (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        item_id TEXT,
        cantidad INTEGER,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rpg_historial_recompensas (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        xp_ganada INTEGER,
        monedas_ganadas INTEGER,
        fuente TEXT,
        descripcion TEXT,
        fecha_reclamo TEXT,
        is_dirty INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS relacion_entrenador_alumno (
        id TEXT PRIMARY KEY,
        entrenador_id TEXT,
        alumno_id TEXT,
        estado TEXT,
        is_dirty INTEGER DEFAULT 0
      );
      
      -- Metadata for sync tracking
      CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_sync_timestamp TEXT
      );

      -- === ÍNDICES ===
      -- Sin estos, cada WHERE user_id = ? recorre la tabla entera. Las columnas
      -- id son PRIMARY KEY y ya están indexadas, por eso no aparecen acá.

      CREATE INDEX IF NOT EXISTS idx_historial_user_fecha ON historial_entrenamientos(user_id, fecha_completado);
      CREATE INDEX IF NOT EXISTS idx_checkins_user_fecha ON checkins(user_id, fecha);
      CREATE INDEX IF NOT EXISTS idx_bienestar_user_fecha ON checkins_bienestar(user_id, fecha);
      CREATE INDEX IF NOT EXISTS idx_habitos_user ON habitos_diarios(user_id);
      CREATE INDEX IF NOT EXISTS idx_inventario_user_item ON rpg_inventario(user_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_recompensas_user ON rpg_historial_recompensas(user_id);
      CREATE INDEX IF NOT EXISTS idx_entrenador_alumno ON relacion_entrenador_alumno(alumno_id);

      CREATE INDEX IF NOT EXISTS idx_reto_dias_reto ON reto_dias(reto_id, dia_numero);
      CREATE INDEX IF NOT EXISTS idx_retos_nivel ON retos(nivel_requerido);
      CREATE INDEX IF NOT EXISTS idx_rutinas_sistema ON rutinas(sistema_id);
      CREATE INDEX IF NOT EXISTS idx_rutinas_nivel ON rutinas(nivel);
      CREATE INDEX IF NOT EXISTS idx_rutinas_user ON rutinas(user_id);
      CREATE INDEX IF NOT EXISTS idx_rutina_ejercicios_rutina ON rutina_ejercicios(rutina_id, orden_ejercicio);

      -- Índices parciales para el push: solo indexan las filas pendientes de subir,
      -- que son unas pocas, en vez de toda la tabla.
      CREATE INDEX IF NOT EXISTS idx_historial_dirty ON historial_entrenamientos(user_id) WHERE is_dirty = 1;
      CREATE INDEX IF NOT EXISTS idx_checkins_dirty ON checkins(user_id) WHERE is_dirty = 1;
      CREATE INDEX IF NOT EXISTS idx_bienestar_dirty ON checkins_bienestar(user_id) WHERE is_dirty = 1;
      CREATE INDEX IF NOT EXISTS idx_habitos_dirty ON habitos_diarios(user_id) WHERE is_dirty = 1;
      CREATE INDEX IF NOT EXISTS idx_inventario_dirty ON rpg_inventario(user_id) WHERE is_dirty = 1;
    `;

    try {
      await this.db.execute(schema);
    } catch (error) {
      console.error("Error ejecutando esquema SQL:", error);
      throw error;
    }
  }

  // --- MÉTODOS CRUD GENÉRICOS ---
  
  sanitizeValues(values) {
    if (!Array.isArray(values)) return [];
    return values.map(v => typeof v === 'undefined' ? null : v);
  }

  async query(sql, values = []) {
    return this._enqueue(async () => {
      try {
        const safeValues = this.sanitizeValues(values);
        const res = await this.db.query(sql, safeValues);
        return res.values;
      } catch (e) {
        console.error("Error en query SQL:", e);
        return [];
      }
    });
  }

  async execute(sql, values = []) {
    return this._enqueue(async () => {
      try {
        const safeValues = this.sanitizeValues(values);
        const res = await this.db.run(sql, safeValues);
        if (this.isWeb) await this.sqliteConnection.saveToStore("veta_vigor_db");
        return res.changes;
      } catch (e) {
        console.error("Error en execute SQL:", e);
        return null;
      }
    });
  }

  /**
   * Ejecuta una misma sentencia para muchas filas dentro de una sola transacción.
   * Un solo cruce del puente JS→nativo en vez de uno por fila: es la diferencia
   * entre decenas de segundos y menos de uno en sincronizaciones grandes.
   * @param {string} sql sentencia con placeholders (?)
   * @param {any[][]} rows lista de arrays de valores, uno por fila
   */
  async executeBatch(sql, rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    return this._enqueue(async () => {
      try {
        const set = [{
          statement: sql,
          values: rows.map(r => this.sanitizeValues(r))
        }];
        const res = await this.db.executeSet(set, true);
        if (this.isWeb) await this.sqliteConnection.saveToStore("veta_vigor_db");
        return res.changes;
      } catch (e) {
        console.error("Error en executeBatch SQL:", e);
        return null;
      }
    });
  }
}

export default new DatabaseService();
