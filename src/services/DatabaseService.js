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

      CREATE TABLE IF NOT EXISTS sistemas_entrenamiento (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        descripcion TEXT,
        imagen_url TEXT,
        orden INTEGER
      );

      CREATE TABLE IF NOT EXISTS retos (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        descripcion TEXT,
        nivel_requerido TEXT,
        puntos_recompensa INTEGER
      );

      CREATE TABLE IF NOT EXISTS reto_dias (
        id TEXT PRIMARY KEY,
        reto_id TEXT,
        dia_numero INTEGER,
        nombre_dia TEXT,
        descripcion TEXT,
        video_url TEXT,
        minutos_estimados INTEGER,
        puntos_dia INTEGER
      );

      CREATE TABLE IF NOT EXISTS rutinas (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        nivel TEXT,
        frecuencia TEXT,
        descripcion TEXT,
        sistema_id TEXT,
        premium INTEGER
      );

      CREATE TABLE IF NOT EXISTS rutina_dias (
        id TEXT PRIMARY KEY,
        rutina_id TEXT,
        dia_numero INTEGER,
        nombre_dia TEXT
      );

      CREATE TABLE IF NOT EXISTS ejercicios_biblioteca (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        equipo_necesario TEXT,
        instrucciones TEXT,
        consejos_pro TEXT,
        musculos_trabajados TEXT,
        imagen_url TEXT
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
