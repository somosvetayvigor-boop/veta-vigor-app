import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader, PlayCircle, CalendarDays, Edit3, X, ChevronRight, Music, Zap, Lock, Headphones, BatteryCharging } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpedienteModal from '../components/ExpedienteModal';
import TuMusicaModal from '../components/TuMusicaModal';
import { DatabaseManager } from '../utils/DatabaseManager';
import DatabaseService from '../services/DatabaseService';
import SyncService from '../services/SyncService';
import { useWakeLock } from '../utils/useWakeLock';

let globalRutinaSemana = [];
let globalRutinaTodas = [];
let globalRutinaCustomCal = {};
let globalRutinaArticulos = [];

export default function MiRutina({ session }) {
  useWakeLock();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(globalRutinaSemana.length === 0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [semanaState, setSemanaState] = useState(globalRutinaSemana);
  const [todasRutinasState, setTodasRutinasState] = useState(globalRutinaTodas);
  const [customCalState, setCustomCalState] = useState(globalRutinaCustomCal);
  
  const semana = semanaState;
  const setSemana = (val) => { globalRutinaSemana = val; setSemanaState(val); };
  
  const todasRutinas = todasRutinasState;
  const setTodasRutinas = (val) => { globalRutinaTodas = val; setTodasRutinasState(val); };
  
  const customCal = customCalState;
  const setCustomCal = (val) => { globalRutinaCustomCal = val; setCustomCalState(val); };

  const [allCalendarios, setAllCalendarios] = useState({});
  const [diasEntrenadosSemana, setDiasEntrenadosSemana] = useState(0);
  const [totalEntrenamientos, setTotalEntrenamientos] = useState(0);
  const [racha, setRacha] = useState(0);
  const [coachBrand, setCoachBrand] = useState(null);
  const [ultimoEntrenamiento, setUltimoEntrenamiento] = useState(null);
  const [planFrescoServidor, setPlanFrescoServidor] = useState(null);

  // VIP check (necesario antes de detectar día de descanso). suscripcion
  // sale primero de user_metadata (rápido, puede estar cacheado) y luego se
  // corrige sola con planFrescoServidor en cuanto responde la consulta
  // directa de abajo -- igual que el chequeo de RevenueCat en App.jsx, para
  // no depender del SQLite local (puede quedarse "sucio" y atrasado, como
  // pasó hoy con reto_ultimo_completado). Solo sirve para SUBIR a VIP más
  // rápido tras una compra reciente; la baja de plan la maneja por separado
  // la reconciliación de RevenueCat.
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const suscripcion = planFrescoServidor || session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
  const esVIP = isAdmin ||
                localStorage.getItem('user_role') === 'alumno_entrenador' ||
                suscripcion?.includes('Entrenador Pro') ||
                suscripcion?.includes('Entrenador Élite') ||
                ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcion);

  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  const [showTuMusica, setShowTuMusica] = useState(false);
  const [customMusicLink, setCustomMusicLink] = useState(session?.user?.user_metadata?.custom_music_link || '');
  
  // Estados para Check-In de Bienestar (días de descanso)
  const [bienestarHabitos, setBienestarHabitos] = useState([]);
  const [bienestarDone, setBienestarDone] = useState(false);
  const [savingBienestar, setSavingBienestar] = useState(false);
  const [showingBienestarCheckin, setShowingBienestarCheckin] = useState(false);
  const [intencionDescanso, setIntencionDescanso] = useState(false);
  const [entrenoHoy, setEntrenoHoy] = useState(false);
  
  // Novedades / Explora
  const [articulosState, setArticulosState] = useState(globalRutinaArticulos);
  const articulos = articulosState;
  const setArticulos = (val) => { globalRutinaArticulos = val; setArticulosState(val); };
  
  const [diaToChange, setDiaToChange] = useState(null);
  const [rutinasCompatibles, setRutinasCompatibles] = useState([]);

  // Estado para forzar Expediente
  const [showExpediente, setShowExpediente] = useState(false);

  // Consulta chica y directa a Supabase (sin SQLite de por medio) para que
  // esVIP se corrija sola si el usuario acaba de comprar y user_metadata
  // todavía no se refrescó. No bloquea nada más: si falla o tarda, la
  // pantalla sigue mostrando lo que ya tenía en user_metadata mientras
  // tanto.
  useEffect(() => {
    if (!session?.user?.id || !navigator.onLine) return;
    supabase.from('perfiles').select('plan_membresia').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data?.plan_membresia) setPlanFrescoServidor(data.plan_membresia);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    let safetyTimer = null;

    async function init() {
      // SAFETY NET: Si después de 30 segundos la app sigue en loading, forzar la salida
      safetyTimer = setTimeout(() => {
        console.warn("⚠️ Safety timeout triggered — forcing UI to load");
        setLoading(false);
        setIsCheckingStatus(false);
      }, 30000);

      try {
        // PASO 0: Cargar del caché LOCAL PRIMERO (instantáneo, sin red)
        const metadata = session?.user.user_metadata || {};
        const userRole = localStorage.getItem('user_role') || 'atleta_normal';
        const isAlumno = userRole === 'alumno_entrenador';
        const sistemaId = isAlumno ? 'entrenador' : (metadata?.sistema_activo);
        const dias = isAlumno ? '7' : (metadata?.dias_entrenamiento || '>3');

        if (sistemaId) {
          const cached = await DatabaseManager.getRoutines(sistemaId);
          if (cached && cached.todasRutinas) {
            setTodasRutinas(cached.todasRutinas || []);
            setCustomCal(cached.customCal || {});
            setAllCalendarios(cached.allCalendarios || {});
            setDiasEntrenadosSemana(cached.diasEntrenadosSemana || 0);
            // Inyectar stats del caché INMEDIATAMENTE (Cache-First)
            if (cached.racha !== undefined) setRacha(cached.racha);
            if (cached.totalEntrenamientos) setTotalEntrenamientos(cached.totalEntrenamientos);
            if (cached.ultimoEntrenamiento) setUltimoEntrenamiento(cached.ultimoEntrenamiento);
            buildCalendar(cached.todasRutinas || [], dias, cached.customCal || {});
            setLoading(false); // UI liberada instantáneamente
          }
        }

        // PASO 1: Verificar check-in local
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const localCheckin = await DatabaseManager.getCheckin(session?.user.id, todayStr);
        if (localCheckin) {
          setHasCheckedInToday(true);
        }

        // PASO 2: Si estamos offline, ya terminamos (todo vino del caché)
        if (!navigator.onLine) {
          setHasCheckedInToday(true);
          setLoading(false);
          setIsCheckingStatus(false);
          clearTimeout(safetyTimer);
          return;
        }

        // PASO 3: Sincronizar cola offline
        try {
          const { processOfflineQueue } = await import('../utils/OfflineManager');
          const syncCount = await processOfflineQueue();
          if (syncCount && syncCount > 0) {
            console.log(`Se sincronizaron ${syncCount} elementos pendientes.`);
          }
        } catch { /* ignorar errores de sync */ }

        // PASO 4: Sincronizar con la red (con timeout de 5s)
        await checkTodayStatus();

        // PASO 5: Cargar rutinas completas desde la red (actualizar caché)
        try {
          console.log("🔄 Iniciando loadRutinas...");
          await Promise.race([
            loadRutinas(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('loadRutinas_timeout')), 25000))
          ]);
          console.log("✅ loadRutinas completado exitosamente");
        } catch(e) {
          console.warn("loadRutinas timeout or error:", e.message);
        }

      } catch (error) {
        console.warn("Init error, falling back to cache:", error);
      } finally {
        setLoading(false);
        setIsCheckingStatus(false);
        clearTimeout(safetyTimer);
      }
    }

    init();

    return () => { if (safetyTimer) clearTimeout(safetyTimer); };
  }, []);

  const checkTodayStatus = async () => {
    try {
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      let checkinResult = await DatabaseService.query(`SELECT id, nivel FROM checkins WHERE user_id = ? AND fecha = ?`, [session?.user.id, todayStr]);
      let perfilResult = await DatabaseService.query(`SELECT racha_actual FROM perfiles WHERE id = ?`, [session?.user.id]);
      let bienestarTodayResult = await DatabaseService.query(`SELECT fecha, habitos FROM checkins_bienestar WHERE user_id = ? AND fecha = ?`, [session?.user.id, todayStr]);

      // FALLBACK: si no aparece el check-in de hoy, preguntarle a Supabase.
      //
      // Antes esta condición exigía que faltaran el check-in Y el perfil. Como el
      // perfil está siempre en local, el respaldo no se activaba nunca: si el
      // check-in no había llegado a SQLite, la app no tenía forma de enterarse de
      // que en el servidor sí existía, y volvía a preguntar la disposición aunque
      // el usuario ya la hubiera contestado.
      //
      // Ya NO se exige navigator.onLine acá (18/08, reporte real: la tabla de
      // disposición volvía a salir SIEMPRE que se mataba el proceso de la app y
      // se reabría, nunca solo al minimizarla). navigator.onLine puede reportar
      // false por error justo al arrancar en frío un WebView de Android, antes
      // de que termine de detectar la conexión real -- si eso pasaba acá, este
      // respaldo se saltaba entero aunque hubiera internet de verdad. Ahora se
      // intenta siempre que el local esté vacío; si en verdad no hay conexión,
      // el fetch falla solo y cae al catch de abajo, sin romper nada.
      if (!checkinResult || checkinResult.length === 0) {
        console.log("⚠️ checkTodayStatus: SQLite vacío, leyendo de Supabase...");
        try {
          const [checkinRes, perfilRes, bienestarRes] = await Promise.all([
            supabase.from('checkins').select('id, nivel').eq('user_id', session?.user.id).eq('fecha', todayStr),
            supabase.from('perfiles').select('racha_actual').eq('id', session?.user.id).single(),
            supabase.from('checkins_bienestar').select('fecha, habitos').eq('user_id', session?.user.id).eq('fecha', todayStr)
          ]);
          checkinResult = checkinRes.data || [];
          perfilResult = perfilRes.data ? [perfilRes.data] : [];
          bienestarTodayResult = bienestarRes.data || [];

          // Devolver a SQLite lo que se encontró, para que la próxima vez no
          // haga falta la red. Si no, cada arranque repetiría el viaje.
          if (checkinResult.length > 0) {
            const c = checkinResult[0];
            await DatabaseService.execute(
              `INSERT OR REPLACE INTO checkins (id, user_id, fecha, nivel, is_dirty) VALUES (?, ?, ?, ?, 0)`,
              [c.id, session?.user.id, todayStr, c.nivel]
            );
          }
        } catch (sbErr) {
          console.warn("Supabase fallback failed in checkTodayStatus:", sbErr);
        }
      }

      const checkinData = checkinResult.length > 0 ? checkinResult[0] : null;
      if (checkinData) {
        setHasCheckedInToday(true);
        setEntrenoHoy(true);
      }

      const bienestarData = bienestarTodayResult.length > 0 ? bienestarTodayResult[0] : null;
      if (bienestarData) {
        const habitos = typeof bienestarData.habitos === 'string' ? bienestarData.habitos : JSON.stringify(bienestarData.habitos || []);
        const habitosParsed = JSON.parse(habitos || '[]');
        if (habitosParsed.length >= 2) {
          setBienestarDone(true);
          setHasCheckedInToday(true);
        }
      }

      // Inyectar racha_actual de la BD directo a la pantalla (sin calcular)
      if (perfilResult.length > 0 && perfilResult[0].racha_actual !== undefined) {
        setRacha(perfilResult[0].racha_actual);
      }

      // PASO B: Recálculo profundo EN SEGUNDO PLANO (no bloquea la UI)
      // Esto verifica si se perdió un día y consume la Ficha de Reposo si aplica
      recalcularRachaEnFondo(todayStr, checkinData);
    } catch (error) {
      console.warn("Error on startup local check:", error);
    }
  };

  // Recálculo profundo de la Llama Viva — se ejecuta SIN bloquear la pantalla
  const recalcularRachaEnFondo = async (todayStr) => {
    try {
      let checkinsResult = await DatabaseService.query(`SELECT fecha FROM checkins WHERE user_id = ? ORDER BY fecha DESC LIMIT 30`, [session?.user.id]);
      let bienestarResult = await DatabaseService.query(`SELECT fecha, habitos FROM checkins_bienestar WHERE user_id = ? ORDER BY fecha DESC LIMIT 30`, [session?.user.id]);

      // FALLBACK: si el SQLite local no tiene nada (dispositivo nuevo o que
      // llevaba tiempo sin sincronizar), preguntarle a Supabase antes de
      // asumir racha 0 -- a diferencia de checkTodayStatus/loadRutinas, este
      // cálculo no tenía respaldo de red, y como el resultado se GUARDA
      // (is_dirty=1, más abajo), un local vacío podía pisar con un 0 la
      // racha real que sí existía en el servidor.
      if ((!checkinsResult || checkinsResult.length === 0) && (!bienestarResult || bienestarResult.length === 0) && navigator.onLine) {
        try {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - 30);
          const limitStr = limitDate.toISOString().split('T')[0];
          const [{ data: checkinsRemoto }, { data: bienestarRemoto }] = await Promise.all([
            supabase.from('checkins').select('fecha').eq('user_id', session?.user.id).gte('fecha', limitStr),
            supabase.from('checkins_bienestar').select('fecha, habitos').eq('user_id', session?.user.id).gte('fecha', limitStr)
          ]);
          checkinsResult = checkinsRemoto || [];
          bienestarResult = bienestarRemoto || [];
        } catch (sbErr) {
          console.warn("Supabase fallback failed in recalcularRachaEnFondo:", sbErr);
        }
      }

      const allCheckins = checkinsResult || [];
      const allBienestar = (bienestarResult || []).filter(b => {
        const h = JSON.parse(b.habitos || '[]');
        return h.length >= 2;
      });
        
      if (allCheckins.length > 0 || allBienestar.length > 0) {
        let currentStreak = 0;
        let checkDate = new Date();
        const hasTodayCheckin = allCheckins.some(c => c.fecha === todayStr);
        const hasTodayBienestar = allBienestar.some(b => b.fecha === todayStr);
        
        if (!hasTodayCheckin && !hasTodayBienestar) checkDate.setDate(checkDate.getDate() - 1);
        
        let usedToken = false;

        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
          const hasCheckin = allCheckins.some(c => c.fecha === dateStr);
          const hasBienestar = allBienestar.some(b => b.fecha === dateStr);
          
          if (hasCheckin || hasBienestar) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            // Solo usar la Ficha de Reposo si YA hay una racha activa (currentStreak > 0).
            if (!usedToken && currentStreak > 0) {
              const invResult = await DatabaseService.query(`SELECT id, cantidad FROM rpg_inventario WHERE user_id = ? AND item_id = ?`, [session?.user.id, 'ficha_reposo']);
                
              if (invResult.length > 0 && invResult[0].cantidad > 0) {
                const currentCantidad = invResult[0].cantidad;
                await DatabaseService.execute(`UPDATE rpg_inventario SET cantidad = ?, is_dirty = 1 WHERE id = ?`, [currentCantidad - 1, invResult[0].id]);
                
                const newCheckinId = crypto.randomUUID();
                await DatabaseService.execute(`INSERT INTO checkins (id, user_id, fecha, nivel, is_dirty) VALUES (?, ?, ?, ?, 1)`, [newCheckinId, session?.user.id, dateStr, 3]);
                
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
                usedToken = true;
                setTimeout(() => alert("¡El Gremio ha consumido tu Ficha de Reposo! Tu Llama Viva ha sido salvada del frío."), 2000);
                continue;
              }
            }
            break;
          }
        }
        // Actualizar pantalla silenciosamente solo si el resultado cambió
        setRacha(currentStreak);

        // Guardar la racha actualizada en perfiles para que los aliados (Dúos) puedan verla
        await DatabaseService.execute(`UPDATE perfiles SET racha_actual = ?, is_dirty = 1 WHERE id = ?`, [currentStreak, session?.user.id]);
      } else {
        // Si no hay NINGUN checkin en los ultimos 30 dias, la racha es definitivamente 0
        setRacha(0);
        await DatabaseService.execute(`UPDATE perfiles SET racha_actual = ?, is_dirty = 1 WHERE id = ?`, [0, session?.user.id]);
      }
    } catch (error) {
      console.warn("Background streak recalculation error (non-blocking):", error);
    }
  };


  const loadRutinas = async () => {
    try {
      const metadata = session?.user.user_metadata || {};
      const userRole = localStorage.getItem('user_role') || 'atleta_normal';
      const isAlumno = userRole === 'alumno_entrenador';

      // 0. Intentar leer perfil de SQLite primero (rápido, offline)
      let perfilData = null;
      try {
        const perfilesRows = await DatabaseService.query(`SELECT plan_membresia, calendario_personalizado, sistema_activo, nivel, dias_entrenamiento, racha_actual FROM perfiles WHERE id = ?`, [session?.user.id]);
        perfilData = perfilesRows.length > 0 ? perfilesRows[0] : null;
      } catch (dbErr) {
        console.warn("SQLite query failed in loadRutinas:", dbErr);
      }

      // FALLBACK CRÍTICO: Si SQLite no tiene el perfil, leerlo directo de Supabase
      if (!perfilData && navigator.onLine) {
        console.log("⚠️ Perfil no encontrado en SQLite, leyendo de Supabase directamente...");
        try {
          const { data: perfilRemoto } = await supabase.from('perfiles').select('plan_membresia, calendario_personalizado, sistema_activo, nivel, dias_entrenamiento, racha_actual').eq('id', session?.user.id).single();
          if (perfilRemoto) {
            perfilData = {
              ...perfilRemoto,
              calendario_personalizado: typeof perfilRemoto.calendario_personalizado === 'string' 
                ? perfilRemoto.calendario_personalizado 
                : JSON.stringify(perfilRemoto.calendario_personalizado || {}),
              dias_entrenamiento: typeof perfilRemoto.dias_entrenamiento === 'string'
                ? perfilRemoto.dias_entrenamiento
                : JSON.stringify(perfilRemoto.dias_entrenamiento || [])
            };
            console.log("✅ Perfil obtenido de Supabase:", perfilData.sistema_activo, perfilData.nivel);
            
            // Intentar guardar en SQLite para la próxima vez (no bloqueante)
            SyncService.syncAll(session.user.id).catch(e => console.warn("Background sync:", e));
          }
        } catch (sbErr) {
          console.warn("Supabase perfil fetch failed:", sbErr);
        }
      }

      let nivel = isAlumno ? 'Entrenador' : (perfilData?.nivel || metadata?.nivel);
      const sistemaId = isAlumno ? 'entrenador' : (perfilData?.sistema_activo || metadata?.sistema_activo);
      const dias = isAlumno ? '7' : (perfilData?.dias_entrenamiento || metadata?.dias_entrenamiento || '>3');
        
      const suscripcionReal = perfilData?.plan_membresia || metadata?.suscripcion || metadata?.plan_membresia;
      const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
      const hasPaidPlan = suscripcionReal?.includes('Pro') || suscripcionReal?.includes('Élite') || ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcionReal);
      const isFreeUser = !isAdmin && !hasPaidPlan;

      // Si es usuario gratis, solo le corresponde la rutina de regalo (Semilla)
      if (isFreeUser && nivel && !['Semilla', 'General'].includes(nivel) && !isAlumno) {
        nivel = 'Semilla';
      }

      if (!nivel || !sistemaId) {
        navigate('/sistemas');
        return;
      }

      // Racha
      if (perfilData?.racha_actual !== undefined) {
        setRacha(perfilData.racha_actual);
      }

      // Calcular inicio de semana (Lunes)
      const now = new Date();
      const day = now.getDay() || 7; 
      const startOfWeek = new Date(now);
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
      startOfWeek.setHours(0,0,0,0);
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

      // Traer historial — SQLite primero, Supabase fallback
      let historialRows = await DatabaseService.query(`SELECT fecha_completado FROM historial_entrenamientos WHERE user_id = ? AND fecha_completado >= ?`, [session?.user.id, startOfWeekStr]);
      let historialTotal = await DatabaseService.query(`SELECT fecha_completado FROM historial_entrenamientos WHERE user_id = ? ORDER BY fecha_completado DESC`, [session?.user.id]);

      // FALLBACK: Si SQLite no tiene historial, leer de Supabase
      if ((!historialTotal || historialTotal.length === 0) && navigator.onLine) {
        console.log("⚠️ Historial no en SQLite, leyendo de Supabase...");
        try {
          const { data: histRemoto } = await supabase.from('historial_entrenamientos').select('fecha_completado, created_at').eq('user_id', session?.user.id).order('created_at', { ascending: false });
          if (histRemoto && histRemoto.length > 0) {
            historialTotal = histRemoto.map(h => ({ fecha_completado: h.fecha_completado || h.created_at }));
            historialRows = historialTotal.filter(h => h.fecha_completado >= startOfWeekStr);
            console.log(`✅ Historial obtenido de Supabase: ${histRemoto.length} registros`);
          }
        } catch (hErr) {
          console.warn("Supabase historial fetch failed:", hErr);
        }
      }

      // fecha_completado puede venir null en filas viejas -- sin filtrarlas
      // acá, una sola fila así hacia que loadRutinas() reventara en este punto
      // (.split() sobre null) y nunca llegara a recargar las rutinas ni el
      // caché más abajo (17/08, reporte real: "último entrenamiento"/
      // "progreso semanal" dejaron de actualizarse, y cambiar de sistema y
      // volver tampoco lo arreglaba porque el crash pasaba antes de llegar a
      // esa parte del código).
      const historialConFecha = (historialTotal || []).filter(h => h.fecha_completado);
      const trainedDays = historialRows ? new Set(historialRows.map(h => h.fecha_completado?.split('T')[0]).filter(Boolean)).size : 0;
      setDiasEntrenadosSemana(trainedDays);

      if (historialConFecha.length > 0) {
        const uniqueDays = new Set(historialConFecha.map(h => h.fecha_completado.split('T')[0]));
        setTotalEntrenamientos(uniqueDays.size);
        setUltimoEntrenamiento(historialConFecha[0].fecha_completado);
      }

      // 2. Cargar preferencias guardadas (calendario personalizado)
      const allCalsStr = perfilData?.calendario_personalizado;
      const allCals = allCalsStr ? JSON.parse(allCalsStr) : {};
      setAllCalendarios(allCals);
      
      const savedCustomCal = allCals[sistemaId] || {};
      setCustomCal(savedCustomCal);

      // 3. Cargar rutinas — SQLite primero, Supabase fallback
      let data = [];
      if (isAlumno) {
        const routineIds = Object.values(savedCustomCal).filter(id => id);
        if (routineIds.length > 0) {
          const placeholders = routineIds.map(() => '?').join(',');
          const res = await DatabaseService.query(`SELECT * FROM rutinas WHERE id IN (${placeholders})`, routineIds);
          data = res || [];
          
          // FALLBACK alumno
          if (data.length === 0 && navigator.onLine) {
            const { data: rutRemoto } = await supabase.from('rutinas').select('*').in('id', routineIds);
            data = rutRemoto || [];
          }
        }

        if (navigator.onLine) {
          // Fetch en dos pasos: el embed por FK (perfiles!...fkey) no
          // funciona contra perfiles_publico, una vista no tiene llave
          // foranea que PostgREST pueda usar (blindaje de columnas 16/08).
          const { data: rel } = await supabase.from('relacion_entrenador_alumno').select('entrenador_id').eq('alumno_id', session?.user.id).eq('estado', 'activo').single();
          if (rel?.entrenador_id) {
            const { data: coachPerfil } = await supabase.from('perfiles_publico').select('full_name, logo_entrenador').eq('id', rel.entrenador_id).single();
            if (coachPerfil) {
              setCoachBrand({ name: coachPerfil.full_name, logo: coachPerfil.logo_entrenador });
            }
          }
        }
      } else {
        // If the user is forced to 'Semilla', do not enforce the exact system_id match, 
        // because they might have selected a system that doesn't have a specific Semilla routine.
        if (nivel === 'Semilla') {
           data = await DatabaseService.query(`SELECT * FROM rutinas WHERE nivel = ? OR user_id = ? ORDER BY nombre`, [nivel, session?.user.id]);
        } else {
           data = await DatabaseService.query(`SELECT * FROM rutinas WHERE (nivel = ? AND sistema_id = ?) OR user_id = ? ORDER BY nombre`, [nivel, sistemaId, session?.user.id]);
        }
        
        // FALLBACK: Si SQLite no tiene rutinas, leer de Supabase
        if ((!data || data.length === 0) && navigator.onLine) {
          console.log("⚠️ Rutinas no encontradas en SQLite, leyendo de Supabase...");
          let rutRemoto;
          if (nivel === 'Semilla') {
            const { data: res } = await supabase.from('rutinas').select('*').eq('nivel', nivel).order('nombre');
            rutRemoto = res;
          } else {
            const { data: res } = await supabase.from('rutinas').select('*').eq('nivel', nivel).eq('sistema_id', sistemaId).order('nombre');
            rutRemoto = res;
          }
          data = rutRemoto || [];
          console.log(`✅ Rutinas obtenidas de Supabase: ${data.length}`);
        }
      }
      
      setTodasRutinas(data || []);
      buildCalendar(data || [], dias, savedCustomCal);

      // Guardar en caché local para carga instantánea en el próximo inicio
      try {
        await DatabaseManager.saveRoutines(sistemaId, {
          todasRutinas: data || [],
          customCal: savedCustomCal,
          allCalendarios: allCals,
          diasEntrenadosSemana: trainedDays,
          racha: perfilData?.racha_actual || 0,
          totalEntrenamientos: new Set(historialConFecha.map(h => h.fecha_completado.split('T')[0])).size,
          ultimoEntrenamiento: historialConFecha[0]?.fecha_completado || null
        });
        console.log("✅ Datos guardados en caché local para próximo inicio");
      } catch (cacheErr) {
        console.warn("Error guardando en caché:", cacheErr);
      }

      // Cargar artículos de explora (solo online)
      if (navigator.onLine) {
        const { data: artData } = await supabase
          .from('articulos_explora')
          .select('*')
          .order('orden', { ascending: true })
          .order('created_at', { ascending: false });
        if (artData) setArticulos(artData);
      }

      console.log(`✅ loadRutinas COMPLETADO: ${(data||[]).length} rutinas, nivel=${nivel}, sistema=${sistemaId}`);

    } catch (error) {
      console.error("Error loading rutinas:", error);
    }
  };

  const buildCalendar = (rutinas, dias, custom) => {
    const isAlumno = localStorage.getItem('user_role') === 'alumno_entrenador';
    const hasCustomRoutines = Object.values(custom).some(id => id);
    
    // Si es alumno y el entrenador no le ha asignado ninguna rutina, el calendario está vacío
    if (isAlumno && !hasCustomRoutines) {
      setSemana([]);
      return;
    }

    let completas = rutinas.filter(r => r.nombre.toLowerCase().includes('completo') || r.enfoque?.toLowerCase().includes('completo'));
    let superiores = rutinas.filter(r => r.nombre.toLowerCase().includes('superior'));
    let inferiores = rutinas.filter(r => r.nombre.toLowerCase().includes('inferior'));

    if (completas.length === 0) completas = rutinas;
    if (superiores.length === 0) superiores = rutinas;
    if (inferiores.length === 0) inferiores = rutinas;

    const descanso = { isDescanso: true, nombre: 'Descanso Activo', descripcion: 'Recuperación, caminata ligera o movilidad.', tipoRequerido: 'descanso' };

    let defaultCalendar = [];

    if (dias === '3') {
      defaultCalendar = [
        { ...completas[0 % completas.length], tipoRequerido: 'completo' }, // Dia 1
        descanso,                        // Dia 2
        { ...completas[1 % completas.length], tipoRequerido: 'completo' }, // Dia 3
        descanso,                        // Dia 4
        { ...completas[2 % completas.length], tipoRequerido: 'completo' }, // Dia 5
        descanso,                        // Dia 6
        descanso                         // Dia 7
      ];
    } else {
      defaultCalendar = [
        { ...superiores[0 % superiores.length], tipoRequerido: 'superior' }, // Dia 1
        { ...inferiores[0 % inferiores.length], tipoRequerido: 'inferior' }, // Dia 2
        descanso,                          // Dia 3
        { ...superiores[1 % superiores.length], tipoRequerido: 'superior' }, // Dia 4
        { ...inferiores[1 % inferiores.length], tipoRequerido: 'inferior' }, // Dia 5
        descanso,                          // Dia 6
        descanso                           // Dia 7
      ];
    }

    // Aplicar sobreescritura personalizada
    const finalCalendar = defaultCalendar.map((dia, index) => {
      if (custom[index]) {
        const customRoutine = rutinas.find(r => r.id === custom[index]);
        if (customRoutine) return { ...customRoutine, tipoRequerido: dia.tipoRequerido };
      }
      return dia;
    });

    setSemana(finalCalendar);
  };

  const openChangeModal = (index, tipoRequerido, e) => {
    e.stopPropagation(); // Evitar que navegue a la rutina
    setDiaToChange(index);
    
    // Filtrar opciones compatibles
    let compatibles = [];
    if (tipoRequerido === 'superior') {
      compatibles = todasRutinas.filter(r => r.nombre.toLowerCase().includes('superior') || (!r.nombre.toLowerCase().includes('inferior') && !r.nombre.toLowerCase().includes('completo')));
    } else if (tipoRequerido === 'inferior') {
      compatibles = todasRutinas.filter(r => r.nombre.toLowerCase().includes('inferior') || (!r.nombre.toLowerCase().includes('superior') && !r.nombre.toLowerCase().includes('completo')));
    } else {
      compatibles = todasRutinas.filter(r => r.nombre.toLowerCase().includes('completo') || r.enfoque?.toLowerCase().includes('completo'));
    }
    
    // Fallback
    if (compatibles.length === 0) compatibles = todasRutinas;
    
    setRutinasCompatibles(compatibles);
    setShowModal(true);
  };

  const selectRoutineForDay = async (rutinaId) => {
    setLoading(true);
    setShowModal(false);
    
    try {
      const sistemaId = session?.user.user_metadata?.sistema_activo;
      const newCustomCal = { ...customCal, [diaToChange]: rutinaId };
      const updatedDB = { ...allCalendarios, [sistemaId]: newCustomCal };
      
      const updatedDBStr = JSON.stringify(updatedDB);
      
      await DatabaseService.execute(`UPDATE perfiles SET calendario_personalizado = ?, is_dirty = 1 WHERE id = ?`, [updatedDBStr, session?.user.id]);
      
      setCustomCal(newCustomCal);
      setAllCalendarios(updatedDB);
      
      // Rebuild ui
      const dias = session?.user.user_metadata?.dias_entrenamiento || '>3';
      buildCalendar(todasRutinas, dias, newCustomCal);
    } catch (err) {
      console.error("Error updating custom calendar", err);
      alert("Hubo un error guardando tu preferencia.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (disposicion) => {
    setSaving(true);
    try {
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      const checkinId = crypto.randomUUID();
      await DatabaseService.execute(`INSERT INTO checkins (id, user_id, fecha, nivel, is_dirty) VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET nivel=excluded.nivel, is_dirty=1`, [checkinId, session?.user.id, todayStr, disposicion]);

      // El arranque comprueba PRIMERO en IndexedDB (PASO 1, DatabaseManager),
      // que hasta ahora nadie rellenaba desde aquí: se escribía solo en SQLite.
      // Ese desajuste entre capas es la razón de que la tabla de disposición
      // reapareciera al refrescar aunque ya se hubiera contestado.
      await DatabaseManager.saveCheckin(session?.user.id, todayStr, disposicion);

      // Y subirlo ya, sin esperar al siguiente ciclo de sincronización. Si el
      // usuario recarga en los segundos siguientes, el respaldo contra Supabase
      // necesita encontrarlo allí.
      if (navigator.onLine) {
        supabase.from('checkins')
          .upsert({ id: checkinId, user_id: session?.user.id, fecha: todayStr, nivel: disposicion })
          .then(({ error }) => {
            if (!error) {
              DatabaseService.execute(`UPDATE checkins SET is_dirty = 0 WHERE id = ?`, [checkinId]);
            }
          });
      }

      setHasCheckedInToday(true);
      setEntrenoHoy(true);
    } catch (error) {
      console.error("Error saving checkin:", error);
      setHasCheckedInToday(true);
    } finally {
      setSaving(false);
    }
  };

  // ================= CHECK-IN DE BIENESTAR (DÍAS DE DESCANSO) =================
  const HABITOS_BIENESTAR = [
    { id: 'agua', emoji: '💧', label: 'Agua suficiente' },
    { id: 'sueno', emoji: '🛏️', label: 'Dormí 7h+' },
    { id: 'comida', emoji: '🥗', label: 'Comida sana' },
    { id: 'lectura', emoji: '📖', label: 'Lectura' },
    { id: 'meditacion', emoji: '🧘', label: 'Meditación' },
    { id: 'caminata', emoji: '🚶', label: 'Caminata 30min' },
    { id: 'bicicleta', emoji: '🚴', label: 'Bicicleta' },
    { id: 'natacion', emoji: '🏊', label: 'Natación' },
    { id: 'cuerda', emoji: '🤸', label: 'Saltar cuerda' },
  ];

  const toggleHabito = (id) => {
    setBienestarHabitos(prev => 
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };

  const handleBienestarCheckin = async () => {
    if (bienestarHabitos.length < 2) return;
    setSavingBienestar(true);
    try {
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      const checkinId = crypto.randomUUID();
      await DatabaseService.execute(`INSERT INTO checkins_bienestar (id, user_id, fecha, habitos, is_dirty) VALUES (?, ?, ?, ?, 1)`, [checkinId, session?.user.id, todayStr, JSON.stringify(bienestarHabitos)]);
      setBienestarDone(true);

      // Empuje inmediato, best-effort -- mismo motivo que en
      // RutinaDetail.jsx: sin esto, esta fila dependía por completo del
      // próximo ciclo de SyncService.pushData(), que puede no llegar a
      // correr si el usuario cierra la app pronto (18/08, reporte real: la
      // pestaña Bienestar de Historial.jsx, que lee directo de Supabase,
      // nunca mostraba los días de descanso registrados).
      if (navigator.onLine) {
        supabase.from('checkins_bienestar').upsert({
          id: checkinId, user_id: session?.user.id, fecha: todayStr, habitos: bienestarHabitos
        }).then(({ error }) => {
          if (!error) {
            DatabaseService.execute(`UPDATE checkins_bienestar SET is_dirty = 0 WHERE id = ?`, [checkinId]);
          }
        });
      }

      // === INYECCIÓN RPG ENGINE (Recompensas por Descanso) ===
      try {
        const perfilesRows = await DatabaseService.query(`SELECT xp_actual, puntos_forja, nivel_rpg FROM perfiles WHERE id = ?`, [session?.user.id]);
        if (perfilesRows.length > 0) {
          const perfilInfo = perfilesRows[0];
          const { calculateBienestarRewards, calculateLevel } = await import('../utils/ProgressionEngine');
          const { xp, puntosForja } = calculateBienestarRewards(bienestarHabitos.length);
          
          const newXp = (perfilInfo.xp_actual || 0) + xp;
          const newForja = (perfilInfo.puntos_forja || 0) + puntosForja;
          const newLevelRPG = calculateLevel(newXp);
          
          // Guardar en SQLite local
          await DatabaseService.execute(`UPDATE perfiles SET xp_actual = ?, puntos_forja = ?, nivel_rpg = ?, is_dirty = 1 WHERE id = ?`, [newXp, newForja, newLevelRPG, session?.user.id]);
          
          // Encolar la recompensa (is_dirty = 1): el push la reproduce contra
          // completar_mision_rpg con este id como clave de idempotencia.
          const recId = crypto.randomUUID();
          await DatabaseService.execute(`INSERT INTO rpg_historial_recompensas (id, user_id, xp_ganada, monedas_ganadas, fuente, descripcion, fecha_reclamo, is_dirty) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, [
            recId, session?.user.id, xp, puntosForja, 'descanso_activo', `Descanso Activo (${bienestarHabitos.length} hábitos)`, new Date().toISOString()
          ]);

          // === SYNC DIRECTO A SUPABASE (cuando hay internet) ===
          if (navigator.onLine) {
            // El RPC completar_mision_rpg ahora calculará el nivel en el servidor,
            // ya no es necesario empujar nivel_rpg desde el cliente.
          }
          
          // Alerta silenciosa y motivadora
            setTimeout(() => alert(`¡Bien hecho! Tu descanso te ha otorgado +${xp} XP y +${puntosForja} Oro del Gremio.`), 500);
          }
        } catch (rpgError) {
          console.warn("Error otorgando recompensas de descanso:", rpgError);
        }
      
      // Cerrar el modal y dejar entrar al usuario
      setHasCheckedInToday(true);
    } catch (err) {
      console.error('Error in bienestar checkin:', err);
      setBienestarDone(true);
      setHasCheckedInToday(true);
    } finally {
      setSavingBienestar(false);
    }
  };

  const renderBienestarSummary = () => {
    if (!bienestarDone || entrenoHoy) return null;
    return (
      <div 
        onClick={() => navigate('/historial', { state: { tab: 'bienestar' } })}
        style={{
          background: 'linear-gradient(135deg, #1a1f2e 0%, #1c2025 100%)',
          border: '1px solid rgba(212, 175, 55, 0.4)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '25px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(212, 175, 55, 0.15)',
          transition: 'transform 0.2s'
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <div style={{ fontSize: '2.5rem' }}>🧘</div>
        <div style={{ flex: 1 }}>
          <h3 className="gold-gradient-text" style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>Día de Recuperación</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Has marcado tus hábitos de bienestar hoy. ¡Toca aquí para ver tus estadísticas!
          </p>
        </div>
        <ChevronRight size={24} color="var(--accent-gold)" />
      </div>
    );
  };

  const screeningStatus = session?.user?.user_metadata?.screening_resultado;
  if (screeningStatus === 'REQUIERE_ORIENTACION') {
    return (
       <div className="container fade-in" style={{ paddingBottom: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
         <i className="fa-solid fa-user-doctor" style={{ fontSize: '4rem', color: '#e55039', marginBottom: '20px' }}></i>
         <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '15px' }}>Autorización Médica Requerida</h1>
         <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '30px', maxWidth: '400px', lineHeight: '1.6' }}>
           Por tu seguridad, hemos bloqueado temporalmente tus entrenamientos. Veta & Vigor está diseñado para el desarrollo físico de personas sanas. Antes de entrenar, por favor consulta a un profesional de salud que pueda valorar tu situación y orientarte sobre qué actividad física es apropiada para ti.
         </p>
         <button 
           onClick={async () => {
             try {
               await supabase.auth.updateUser({ data: { cuestionario_complete: false, screening_resultado: null } });
               window.location.reload();
             } catch {}
           }}
           style={{ 
             background: 'linear-gradient(135deg, var(--accent-gold) 0%, #b8860b 100%)', 
             color: 'black', border: 'none', padding: '15px 30px', borderRadius: '12px', 
             fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer',
             boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
           }}
         >
           Ya tengo autorización médica
         </button>
       </div>
    );
  }

  if (loading || isCheckingStatus) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f11',
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999
      }}>
        <h1 className="gold-gradient-text" style={{ 
          fontSize: '4.5rem', 
          fontWeight: '900', 
          letterSpacing: '4px',
          animation: 'pulseGold 2s infinite',
          margin: 0
        }}>
          V&V
        </h1>
        <p style={{ 
          color: 'var(--accent-gold)', 
          marginTop: '30px', 
          fontSize: '0.85rem', 
          opacity: 0.7, 
          letterSpacing: '3px', 
          textTransform: 'uppercase',
          animation: 'pulse 2s infinite'
        }}>
          Forjando...
        </p>
      </div>
    );
  }

  const nivel = session?.user.user_metadata?.nivel || "Asignado";

  if (!hasCheckedInToday) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--bg-dark)', zIndex: 999, 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        overflowY: 'auto', padding: '20px', paddingTop: '80px'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '25px 20px', position: 'relative' }}>
          
          {(saving || savingBienestar) && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '16px' }}>
              <Loader className="gold-gradient-text" style={{ animation: 'rotate 1s linear infinite' }} color="#D4AF37" size={40} />
            </div>
          )}

          <h2 className="gold-gradient-text" style={{ margin: '0 0 5px 0', fontSize: '1.5rem', textTransform: 'uppercase' }}>Disposición Diaria</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '25px' }}>¿Cómo te sientes para entrenar hoy?</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div onClick={() => handleCheckin(5)} style={checkinItemStyle('#c5a059')}>
              <div style={numberStyle}>5</div>
              <div style={emojiStyle}>🔥</div>
              <div style={textContainerStyle}>
                <span style={titleStyle}>Excelente</span>
                <span style={descStyle}>Energía al máximo. Listo para récords.</span>
              </div>
            </div>

            <div onClick={() => handleCheckin(4)} style={checkinItemStyle('#78e08f')}>
              <div style={numberStyle}>4</div>
              <div style={emojiStyle}>🔋</div>
              <div style={textContainerStyle}>
                <span style={titleStyle}>Bien</span>
                <span style={descStyle}>Motivado y buena energía.</span>
              </div>
            </div>

            <div onClick={() => handleCheckin(3)} style={checkinItemStyle('#f6b93b')}>
              <div style={numberStyle}>3</div>
              <div style={emojiStyle}>⚖️</div>
              <div style={textContainerStyle}>
                <span style={titleStyle}>Normal</span>
                <span style={descStyle}>Sensaciones promedio.</span>
              </div>
            </div>

            <div onClick={() => handleCheckin(2)} style={checkinItemStyle('#fa983a')}>
              <div style={numberStyle}>2</div>
              <div style={emojiStyle}>🥱</div>
              <div style={textContainerStyle}>
                <span style={titleStyle}>Cansado</span>
                <span style={descStyle}>Poca energía o sueño atrasado.</span>
              </div>
            </div>

            <div onClick={() => handleCheckin(1)} style={checkinItemStyle('#e55039')}>
              <div style={numberStyle}>1</div>
              <div style={emojiStyle}>🤕</div>
              <div style={textContainerStyle}>
                <span style={titleStyle}>Agotado / Dolor</span>
                <span style={descStyle}>Necesito recuperación.</span>
              </div>
            </div>
            
            {esVIP && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setIntencionDescanso(true);
                  setHasCheckedInToday(true);
                  setEntrenoHoy(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%)',
                  border: '1px dashed var(--accent-gold)',
                  borderRadius: '12px', padding: '15px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  cursor: 'pointer', marginTop: '10px', width: '100%'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🧘</span>
                <span className="gold-gradient-text" style={{ fontWeight: 'bold', fontSize: '1rem' }}>Hoy es mi día de descanso</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Renderizado de la Llama Viva ---
  const renderLlamaViva = () => {
    const isCold = racha === 0;
    const color = isCold ? '#888' : (racha >= 5 ? '#ff4757' : 'var(--accent-gold)');
    const mensaje = isCold ? 'Tu llama se apaga...' : `La Llama Viva: ${racha} ${racha === 1 ? 'día' : 'días'}`;
    const icon = isCold ? '❄️' : '🔥';
    
    return (
      <div style={{ background: '#1c1c20', padding: '15px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', border: isCold ? '1px solid #333' : `1px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '1.8rem', animation: isCold ? 'none' : 'pulse 2s infinite' }}>{icon}</div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>La Llama Viva</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{mensaje}</div>
          </div>
        </div>
      </div>
    );
  };

  // --- Renderizado del Semáforo ---
  const renderSemaforo = () => {
    const isAlumno = localStorage.getItem('user_role') === 'alumno_entrenador';
    const metaStr = session?.user.user_metadata?.dias_entrenamiento || '>3';
    
    // Si es alumno, la meta son los días que el entrenador le asignó (rutinas personalizadas activas)
    let goalDays = 4;
    if (isAlumno) {
      goalDays = Object.values(customCal).filter(id => id).length;
      if (goalDays === 0) goalDays = 1; // Para evitar división entre 0 si no tiene rutina aún
    } else {
      goalDays = metaStr === '3' ? 3 : 4;
    }
    
    let color = '#e55039'; // Rojo por defecto
    let mensaje = '¡Arranca tu semana!';
    
    const porcentaje = diasEntrenadosSemana / goalDays;

    if (diasEntrenadosSemana === 0) {
      color = '#e55039'; // Rojo
      mensaje = 'Sin actividad';
    } else if (porcentaje >= 1) {
      color = '#78e08f'; // Verde
      mensaje = '¡Meta Alcanzada!';
    } else if (porcentaje >= 0.5) {
      color = '#f6b93b'; // Amarillo
      mensaje = `${diasEntrenadosSemana} de ${goalDays} días`;
    } else {
      color = '#fa8231'; // Naranja
      mensaje = `${diasEntrenadosSemana} de ${goalDays} días`;
    }

    return (
      <div style={{ background: '#1c1c20', padding: '15px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '24px', height: '24px', borderRadius: '50%', 
            backgroundColor: color
          }}></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Progreso Semanal</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{mensaje}</div>
          </div>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: '900', color: color }}>
          {diasEntrenadosSemana}/{goalDays}
        </div>
      </div>
    );
  };

  const renderFraseDelDia = () => {
    const frases = [
      { text: "Raíces Profundas: Antes de intentar elevarte, asegúrate de que tu base sea inquebrantable. Toda gran estructura comienza desde el suelo.", author: "Filosofía V&V" },
      { text: "La Veta del Carácter: Así como la madera revela su historia y resistencia en sus vetas, tu cuerpo y tu mente reflejan la disciplina inquebrantable de tus hábitos.", author: "Filosofía V&V" },
      { text: "Estructura Interna Oculta: La verdadera fuerza no siempre se ve por fuera. Se sostiene sobre tendones reforzados, articulaciones sanas y una voluntad de acero que soporta cualquier carga.", author: "Filosofía V&V" },
      { text: "Progreso Orgánico: El crecimiento real toma tiempo y consistencia, igual que un árbol fuerte. No hay atajos para la verdadera maestría.", author: "Filosofía V&V" },
      { text: "Solidez Estructural: Cuida tu postura en cada repetición. Un cuerpo correctamente alineado es capaz de soportar y generar fuerzas extraordinarias.", author: "Filosofía V&V" },
      { text: "Resiliencia ante la Fricción: El roce, la resistencia y el esfuerzo constante no te desgastan; son las herramientas que pulen tu mejor versión.", author: "Filosofía V&V" },
      { text: "El Poder del Reposo: El descanso no es debilidad. Es el espacio necesario donde las fibras se reparan y la fuerza se asienta.", author: "Filosofía V&V" },
      { text: "Fuerza Natural: Tu propio cuerpo es la máquina más sofisticada que existe. Domínalo por completo antes de buscar cargas externas.", author: "Filosofía V&V" },
      { text: "Vigor Inagotable: La verdadera fuerza no es un estallido momentáneo de energía, es la capacidad de sostener el esfuerzo día tras día.", author: "Filosofía V&V" },
      { text: "Gravedad como Maestra: No luches contra la gravedad; úsala a tu favor para esculpir tu fuerza y desafiar tus propios límites.", author: "Filosofía V&V" },
      { text: "Consistencia de Roble: Preséntate a entrenar incluso en los días donde la motivación escasea. El vigor se construye cuando la disciplina supera a la pereza.", author: "Filosofía V&V" },
      { text: "Forjando el Núcleo: Toda la fuerza de tus extremidades nace de un centro (core) estable y poderoso. Trabaja tu centro como el tronco que sostiene tus ramas.", author: "Filosofía V&V" },
      { text: "Vencer la Resistencia: Cada punto de estancamiento, cada repetición que falla, es simplemente el paso previo a romper tu límite anterior.", author: "Filosofía V&V" },
      { text: "Sin Excusas, Sin Adornos: Tu cuerpo, el suelo y unas barras son todo lo que necesitas. La simplicidad del entorno exige la máxima complejidad del esfuerzo.", author: "Filosofía V&V" },
      { text: "Conexión Mente-Músculo: El movimiento perfecto nace cuando la intención de tu mente y la contracción de tus fibras son una sola entidad.", author: "Filosofía V&V" },
      { text: "Calidad sobre Cantidad: Una repetición ejecutada con técnica impecable y control absoluto vale más que diez hechas con pura inercia.", author: "Filosofía V&V" },
      { text: "Tensión Isométrica: Aprende a encontrar el poder absoluto en la quietud. Sostener tu cuerpo en el espacio requiere un control mental tan fuerte como el físico.", author: "Filosofía V&V" },
      { text: "Simetría y Equilibrio: Busca siempre la armonía en tu entrenamiento. Equilibra la tensión y la relajación, el empuje y el tirón, la mente y el músculo.", author: "Filosofía V&V" },
      { text: "Fluidez del Movimiento: El objetivo final de la calistenia es que lo increíblemente difícil se vea suave y natural, como si el esfuerzo no existiera.", author: "Filosofía V&V" },
      { text: "Adaptabilidad Constante: Si un ángulo es demasiado exigente, ajusta la palanca, respira y vuelve a intentar. Sé flexible en el método, pero rígido en la meta.", author: "Filosofía V&V" },
      { text: "Legado en Movimiento: No entrenes solo para la foto de hoy. Entrena con Veta y Vigor para que tu cuerpo te responda con poder, movilidad y libertad el resto de tu vida.", author: "Filosofía V&V" }
    ];
    // Seleccionar frase basada en el día del año
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const fraseObj = frases[dayOfYear % frases.length];

    return (
      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px', padding: '0 10px' }}>
        <div style={{ fontSize: '1.05rem', marginBottom: '5px' }}>"{fraseObj.text}"</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>— {fraseObj.author}</div>
      </div>
    );
  };

  const renderStatsCard = () => {
    const nivelName = session?.user.user_metadata?.nivel || 'Semilla';
    const cicloActual = parseInt(session?.user.user_metadata?.ciclo_entrenamientos) || 0;
    const frecuencia = session?.user.user_metadata?.dias_entrenamiento || '>3';
    const metaCiclo = frecuencia === '3' ? 18 : 24;
    
    // Obtener la fuerza máxima real guardada por la calculadora de 1RM
    const fuerzaSup = parseFloat(session?.user.user_metadata?.fuerza_tren_superior) || 0;
    const fuerzaInf = parseFloat(session?.user.user_metadata?.fuerza_tren_inferior) || 0;
    const fuerzaMaxima = Math.max(fuerzaSup, fuerzaInf);
    const fuerzaMaximaStr = fuerzaMaxima > 0 ? `${fuerzaMaxima.toFixed(2)} KG` : 'Sin registros';
    
    // Formatear la fecha del último entrenamiento
    let ultimaFechaStr = "Aún no hay registros";
    if (ultimoEntrenamiento) {
      const dateObj = new Date(ultimoEntrenamiento);
      const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      const rawDate = dateObj.toLocaleDateString('es-ES', opciones);
      ultimaFechaStr = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    }

    const isAlumnoCoach = localStorage.getItem('user_role') === 'alumno_entrenador';

    return (
      <div className="card" style={{ marginBottom: '20px', padding: '15px 20px', background: 'linear-gradient(145deg, #15151a 0%, #1a1a24 100%)', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        {!isAlumnoCoach ? (
          <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Tu Madera 💪 <span className="gold-gradient-text">{nivelName}</span> 💥
          </h2>
        ) : (
          <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Tus Estadísticas 📊
          </h2>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e0e0e0', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚡</span> 
            <span style={{ color: 'var(--text-muted)' }}>Ultimo Entrenamiento:</span> 
            <strong style={{ color: '#fff' }}>{ultimaFechaStr}</strong>
          </div>
          
          {!isAlumnoCoach && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⚡</span> 
                <span style={{ color: 'var(--text-muted)' }}>Ciclo de madera:</span> 
                <strong style={{ color: '#fff' }}>{cicloActual} / {metaCiclo}</strong>
              </div>
              {/* Barra de Progreso Dinámica */}
              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '2px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, Math.max(0, (cicloActual / metaCiclo) * 100))}%`, 
                  height: '100%', 
                  background: 'var(--accent-gold)', 
                  borderRadius: '4px', 
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🏆</span> 
            <span style={{ color: 'var(--text-muted)' }}>Sesión histórica:</span> 
            <strong style={{ color: '#fff' }}>{totalEntrenamientos || 0}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔥</span> 
            <span style={{ color: 'var(--text-muted)' }}>Fuerza Maxima:</span> 
            <strong className="gold-gradient-text" style={{ fontWeight: 'bold' }}>{fuerzaMaximaStr}</strong>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      {coachBrand?.logo ? (
        <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '15px' }}>
          <img src={coachBrand.logo} alt={coachBrand.name} style={{ height: '50px', objectFit: 'contain' }} />
          <h1 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginTop: '10px' }}>Mi Calendario</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>by {coachBrand.name}</p>
        </div>
      ) : (
        <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '15px', marginTop: '20px', textAlign: 'center' }}>Mi Calendario</h1>
      )}
      
      {esVIP && renderFraseDelDia()}
      {esVIP && renderStatsCard()}
      
      {esVIP && renderLlamaViva()}
      {esVIP && renderSemaforo()}
      
      {/* Resumen de Bienestar si ya lo hizo hoy */}
      {esVIP && renderBienestarSummary()}
      
      {/* Botones de Playlists (2x2 Grid) */}
      {esVIP && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
          {/* Fila 1 */}
          <a 
            href="https://music.youtube.com/playlist?list=PL0NvLXoUW8MHugzJXCjgF5JxG8aDXBmYK&si=Tjq_Q7sP8f7YHXNq" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#2a1416', borderRadius: '12px', color: '#ff4757', textDecoration: 'none', gap: '5px' }}
          >
            <PlayCircle size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>YouTube</span>
          </a>
          
          <a 
            href="https://open.spotify.com/playlist/06g9W4J1QWImvl0DX0Kb1x?si=sXPAxKm1QwaWP42ujBR37A&pi=FN7mXw1oTnCFZ" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#132c1c', borderRadius: '12px', color: '#1ed760', textDecoration: 'none', gap: '5px' }}
          >
            <Music size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Spotify</span>
          </a>

          {/* Fila 2 */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => {
                if (customMusicLink) {
                  window.open(customMusicLink, '_blank');
                } else {
                  setShowTuMusica(true);
                }
              }}
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#1a1f35', border: 'none', borderRadius: '12px', color: '#4facfe', cursor: 'pointer', gap: '5px' }}
            >
              <Headphones size={24} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Tu Música</span>
            </button>
            
            {/* Botón de editar, solo visible si ya tiene un enlace configurado */}
            {customMusicLink && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowTuMusica(true); }}
                style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ccc', cursor: 'pointer' }}
              >
                <Edit3 size={12} />
              </button>
            )}
          </div>

          <a 
            href="https://music.youtube.com/watch?v=iAsWd4VTLnI&si=V9KYtOyxlg8bYm-5" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#2a2615', borderRadius: '12px', color: 'var(--accent-gold)', textDecoration: 'none', gap: '5px' }}
          >
            <Zap size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Vigor</span>
          </a>
        </div>
      )}

      {showTuMusica && (
        <TuMusicaModal 
          session={session} 
          onClose={() => setShowTuMusica(false)} 
          onSaved={(newLink) => {
            setCustomMusicLink(newLink);
          }}
        />
      )}

      {/* Banner Descanso Activo eliminado de aquí y movido a la tarjeta del calendario */}

      {/* Modal de Intercambio de Rutina */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(10px)',
          zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '25px', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            
            <h2 className="gold-gradient-text" style={{ margin: '0 0 5px 0', fontSize: '1.4rem' }}>
              Cambiar Misión
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Elige una alternativa compatible para el Día {diaToChange + 1}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rutinasCompatibles.map(rutina => (
                <div 
                  key={rutina.id}
                  onClick={() => selectRoutineForDay(rutina.id)}
                  style={{
                    padding: '15px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '1.1rem' }}>{rutina.nombre}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{rutina.enfoque || 'Cuerpo Completo'}</span>
                  </div>
                  <ChevronRight size={20} color="var(--accent-gold)" />
                </div>
              ))}
              
              {localStorage.getItem('user_role') !== 'alumno_entrenador' && (
                <button 
                  onClick={() => {
                    const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
                    const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
                    const esPro = isAdmin || suscripcion?.includes('Pro') || suscripcion?.includes('Élite') || ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcion);

                    const misPersonalizadas = todasRutinas.filter(r => r.user_id === session?.user?.id);
                    if (!esPro && misPersonalizadas.length >= 1) {
                      alert('Con el plan gratuito solo puedes crear 1 misión personalizada. Adquiere una suscripción para crear misiones ilimitadas.');
                      return;
                    }
                    navigate('/crear-rutina');
                  }}
                  className="btn-primary" 
                  style={{ marginTop: '10px', padding: '12px' }}
                >
                  + Crear Misión Personalizada
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registro de Bienestar (si hay intención de descanso) */}
      {intencionDescanso && !bienestarDone && (
        <div style={{ marginBottom: '30px' }}>
          {!showingBienestarCheckin ? (
            <button 
              onClick={() => setShowingBienestarCheckin(true)}
              style={{
                width: '100%', padding: '18px', borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%)',
                border: '2px solid var(--accent-gold)',
                color: 'var(--accent-gold)',
                fontWeight: 'bold', fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                cursor: 'pointer',
                animation: 'pulseGold 2s infinite',
                boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🧘</span>
              REGISTRAR DESCANSO ACTIVO
            </button>
          ) : (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--accent-gold)', boxShadow: '0 0 20px rgba(212,175,55,0.1)' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🧘</div>
                <h3 className="gold-gradient-text" style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>Día de Recuperación</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Selecciona al menos 2 hábitos para mantener tu Llama Viva.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {HABITOS_BIENESTAR.map(h => {
                  const selected = bienestarHabitos.includes(h.id);
                  return (
                    <button
                      key={h.id}
                      onClick={(e) => { e.preventDefault(); toggleHabito(h.id); }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '12px 5px', gap: '6px',
                        backgroundColor: selected ? 'rgba(212, 175, 55, 0.15)' : '#1c1c20',
                        border: selected ? '2px solid var(--accent-gold)' : '1px solid #333',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{h.emoji}</span>
                      <span style={{ fontSize: '0.65rem', color: selected ? 'var(--accent-gold)' : '#999', fontWeight: selected ? 'bold' : 'normal', textAlign: 'center', lineHeight: '1.2' }}>{h.label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: bienestarHabitos.length >= 2 ? '#78e08f' : 'var(--text-muted)' }}>
                  {bienestarHabitos.length}/9 hábitos marcados {bienestarHabitos.length >= 2 ? '✅' : '(mínimo 2)'}
                </span>
              </div>

              <button
                onClick={(e) => { e.preventDefault(); handleBienestarCheckin(); }}
                disabled={bienestarHabitos.length < 2 || savingBienestar}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  background: bienestarHabitos.length >= 2 ? 'linear-gradient(135deg, #f9f0b1 0%, #D4AF37 50%, #aa8b2c 100%)' : '#333',
                  color: bienestarHabitos.length >= 2 ? '#000' : '#666',
                  fontWeight: 'bold', fontSize: '1rem',
                  border: 'none', cursor: bienestarHabitos.length >= 2 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  marginBottom: '15px'
                }}
              >
                {savingBienestar ? 'Guardando...' : '🔥 Registrar Bienestar'}
              </button>
              
              <button 
                onClick={(e) => { e.preventDefault(); setShowingBienestarCheckin(false); }}
                style={{ background: 'none', border: '1px solid #555', color: '#888', padding: '10px', borderRadius: '8px', width: '100%', cursor: 'pointer' }}
              >
                Atrás (Ocultar Panel)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calendario UI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <CalendarDays size={28} color="var(--accent-gold)" />
        <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: 0 }}>Tu Calendario V&V</h1>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        Atleta <strong>{nivel}</strong>. Aquí tienes la estructura óptima para tu semana. Sigue el orden de los días.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        {semana.length === 0 ? (
          <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
            {localStorage.getItem('user_role') === 'alumno_entrenador' ? (
              <>
                <CalendarDays size={40} color="var(--accent-gold)" style={{ marginBottom: '15px' }} />
                <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Esperando a tu Entrenador</h3>
                <p style={{ color: 'var(--text-muted)' }}>Tu Coach Vigor aún no ha programado tus misiones para esta semana. ¡Vuelve pronto!</p>
              </>
            ) : !esVIP ? (
              <>
                <Lock size={40} color="var(--accent-gold)" style={{ marginBottom: '15px' }} />
                <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Tu Calendario está Bloqueado</h3>
                <p style={{ color: 'var(--text-muted)' }}>Para seguir un plan de entrenamiento completo y registrar tu progreso, adquiere una membresía VIP.</p>
                <button onClick={() => navigate('/sistemas')} className="btn-primary" style={{ marginTop: '15px' }}>
                  Ir a Sistemas para ver mi Misión de Regalo
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Aún no tienes un sistema activo. Ve a la pestaña de Sistemas y elige uno para empezar.</p>
            )}
          </div>
        ) : (
          semana.map((dia, index) => {
            if (dia.isDescanso) {
              return (
                <div 
                  key={index} 
                  onClick={() => navigate('/descanso')}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px',
                    marginBottom: '15px',
                    borderLeft: '4px solid #4facfe', // Blue accent for recovery
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    backgroundColor: 'rgba(79, 172, 254, 0.05)', // Slight blue tint
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 5px 15px rgba(79, 172, 254, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ 
                      width: '45px', height: '45px', borderRadius: '50%', 
                      backgroundColor: 'rgba(79, 172, 254, 0.1)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <BatteryCharging size={24} color="#4facfe" />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 3px 0', color: '#4facfe', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Día {index + 1}
                      </h4>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '1.15rem', color: '#fff' }}>Protocolos de Recuperación</h3>
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(79, 172, 254, 0.2)', color: '#4facfe' }}>Descanso Activo</span>
                    </div>
                  </div>
                  <ChevronRight size={24} color="#4facfe" style={{ opacity: 0.7 }} />
                </div>
              );
            }

            const handleEnterRoutine = (id) => {
              // 1. Validar si ya entrenó hoy
              const todayStr = new Date().toLocaleDateString();
              const lastTrainedStr = ultimoEntrenamiento ? new Date(ultimoEntrenamiento).toLocaleDateString() : null;
              
              if (todayStr === lastTrainedStr && session?.user?.email !== 'somos.vetayvigor@gmail.com') {
                alert('¡Ya completaste una misión hoy! Debes esperar a mañana para realizar tu siguiente entrenamiento. ¡Tu cuerpo necesita descanso para asimilar el esfuerzo!');
                return;
              }

              const meta = session?.user.user_metadata || {};
              if (!meta.expediente_completado) {
                setShowExpediente(true);
                return;
              }
              navigate('/rutina/' + id);
            };

            return (
              <div 
                key={index} 
                className="card"
                onClick={() => dia?.id && handleEnterRoutine(dia.id)}
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '15px',
                  cursor: dia?.id ? 'pointer' : 'default',
                  borderLeft: '4px solid var(--accent-gold)',
                  backgroundColor: 'rgba(212, 175, 55, 0.03)',
                  position: 'relative'
                }}
              >
                <div style={{ flex: 1, paddingRight: '40px' }}>
                  <h4 style={{ margin: '0 0 3px 0', color: 'var(--accent-gold)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Día {index + 1}
                  </h4>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.15rem', color: '#fff' }}>{dia?.nombre || 'Misión'}</h3>
                  <span className="badge" style={{ fontSize: '0.7rem' }}>{dia?.enfoque || 'Cuerpo Completo'}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <PlayCircle size={32} color="var(--accent-gold)" style={{ opacity: 0.9 }} />
                  <button 
                    onClick={(e) => openChangeModal(index, dia?.tipoRequerido, e)}
                    style={{
                      background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem',
                      padding: '5px', borderRadius: '5px', transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#aaa'}
                  >
                    <Edit3 size={14} /> Cambiar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* BOTON CREAR RUTINA EN EL CALENDARIO PRINCIPAL */}
      {localStorage.getItem('user_role') !== 'alumno_entrenador' && (
        <div style={{ marginTop: '20px', padding: '0 5px' }}>
          <button 
            onClick={() => {
              const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
              const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
              const esPro = isAdmin || suscripcion?.includes('Pro') || suscripcion?.includes('Élite') || ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Prueba Gratis (7 Días)'].includes(suscripcion);
              
              const misPersonalizadas = todasRutinas.filter(r => r.user_id === session?.user?.id);
              if (!esPro && misPersonalizadas.length >= 1) {
                alert('Con el plan gratuito solo puedes crear 1 misión personalizada. Adquiere una suscripción para crear misiones ilimitadas.');
                return;
              }
              navigate('/crear-rutina');
            }}
            className="btn-primary" 
            style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '1rem', background: 'linear-gradient(45deg, #2c2c2c, #1a1a1a)', border: '1px dashed var(--accent-gold)' }}
          >
            <span style={{ color: 'var(--accent-gold)' }}>+</span> Crear Rutina Personalizada
          </button>
        </div>
      )}

      {/* BANNER DE ASTROLABION */}
      <div style={{ marginTop: '30px', padding: '0 5px' }}>
        <div 
          onClick={() => window.open('https://play.google.com/store/apps/details?id=com.astrolabiobooks.app.twa', '_blank')}
          style={{
            background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Overlay brillante */}
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)', opacity: 0.8, pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
            <div style={{ padding: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(5px)', display: 'flex' }}>
              <img src="/astrolabio-logo.jpg" alt="Astrolabio Logo" style={{ width: '32px', height: '32px', borderRadius: '10px', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>Astrolabio</h3>
          </div>
          
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: '1.5', zIndex: 1 }}>
            Este contenido premium de audio está disponible en <strong>Astrolabio</strong>, nuestra app dedicada al crecimiento personal y mentalidad.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', zIndex: 1 }}>
            <span style={{ color: '#00d2ff', fontSize: '0.9rem', fontWeight: 'bold' }}>¡Descárgala gratis y escucha el episodio!</span>
            <ChevronRight size={18} color="#00d2ff" />
          </div>
        </div>
      </div>

      {/* EXPLORA V&V (ARTICULOS) */}
      {articulos.length > 0 && (
        <div style={{ marginTop: '40px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="gold-gradient-text">Explora V&V</span>
            </h2>
          </div>
          
          <div style={{ 
            display: 'flex', 
            overflowX: 'auto', 
            padding: '0 20px 20px 20px', 
            gap: '15px',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch'
          }}>
            {articulos.map(art => (
              <div 
                key={art.id} 
                onClick={() => art.enlace_url && window.open(art.enlace_url, '_blank')}
                style={{ 
                  minWidth: '260px', 
                  maxWidth: '280px',
                  height: '180px', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  position: 'relative',
                  scrollSnapAlign: 'start',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <img 
                  src={art.imagen_url} 
                  alt={art.titulo} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div style={{ 
                  position: 'absolute', 
                  top: 0, left: 0, right: 0, bottom: 0, 
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '15px'
                }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {art.titulo}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expediente Forzoso si intentan entrar sin datos */}
      {showExpediente && (
        <ExpedienteModal 
          session={session} 
          onComplete={() => setShowExpediente(false)}
        />
      )}
    </div>
  );
}

const checkinItemStyle = (color) => ({
  display: 'flex', alignItems: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', padding: '12px 15px',
  cursor: 'pointer', position: 'relative', overflow: 'hidden',
  borderLeft: `4px solid ${color}`
});

const numberStyle = {
  fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)',
  width: '30px', textAlign: 'left', marginLeft: '5px'
};

const emojiStyle = {
  fontSize: '1.8rem', marginRight: '15px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
};

const textContainerStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1
};

const titleStyle = {
  fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '2px'
};

const descStyle = {
  fontSize: '0.75rem', color: '#888', textAlign: 'left'
};
