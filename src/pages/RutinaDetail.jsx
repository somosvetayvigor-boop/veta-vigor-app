import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft, PlayCircle, Timer, CheckCircle, ChevronRight, X, Loader, Play, Pause, RotateCcw } from 'lucide-react';
import { warmupsData } from '../data/warmupsData';
import { cancelTrainingReminder } from '../utils/ScheduledNotifications';
import confetti from 'canvas-confetti';

export default function RutinaDetail({ session }) {
  const { id } = useParams();
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const navigate = useNavigate();
  const [rutina, setRutina] = useState(null);
  const [ejercicios, setEjercicios] = useState([]);
  const [warmups, setWarmups] = useState([]);
  const [showWarmups, setShowWarmups] = useState(false);
  const [unlockWarningModal, setUnlockWarningModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Active Training States
  const [activeIndex, setActiveIndex] = useState(null);
  const [seriesLog, setSeriesLog] = useState({}); // { [ejercicio_id]: [ {serie, reps, peso} ] }
  
  // Timer States
  const [timeLeft, setTimeLeft] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const wakeLockRef = useRef(null);
  const targetTimeRef = useRef(null);

  // Form Inputs State { [ejId]: { 1: {kg, reps}, 2: {kg, reps} } }
  const [formInputs, setFormInputs] = useState({});

  const [rutinaCompletada, setRutinaCompletada] = useState(false);
  const [rmModal, setRmModal] = useState({ show: false, rmValue: 0, level: '', isTrenSuperior: false, isTrenInferior: false, exerciseName: '', isNewRecord: false });
  const [levelUpModal, setLevelUpModal] = useState({ show: false, newLevel: '', phrase: '' });
  const [rpgModal, setRpgModal] = useState({ show: false, xp: 0, forja: 0, stats: null });

  const getFraseInspiradora = () => {
    const frases = [
      "Domingo: Un día para recuperar cuerpo y alma. Mañana volvemos más fuertes.",
      "Lunes: El día perfecto para empezar a construir tu mejor versión. ¡No hay excusas!",
      "Martes: La disciplina es el puente entre tus metas y tus logros.",
      "Miércoles: Ya estás a la mitad. No te rindas ahora, el esfuerzo valdrá la pena.",
      "Jueves: Sigue empujando. La fuerza que construyes hoy será tu armadura mañana.",
      "Viernes: Cierra la semana con la misma fuerza con la que empezaste. ¡Termina fuerte!",
      "Sábado: Celebra tus victorias, por pequeñas que sean. Te lo has ganado."
    ];
    return frases[new Date().getDay()];
  };

  useEffect(() => {
    async function fetchData() {
      if (!navigator.onLine) {
        const { obtenerRutinaLocal } = await import('../utils/LocalDB');
        const localData = await obtenerRutinaLocal(id);
        if (localData) {
          setRutina(localData.rutina);
          setEjercicios(localData.ejercicios);
          setWarmups(localData.warmups);
          setSeriesLog(localData.seriesLog || {});
          setFormInputs(localData.formInputs || {});
          setLoading(false);
          return;
        } else {
          alert('No hay internet y esta rutina no está descargada.');
          navigate('/mi-rutina');
          return;
        }
      }

      const { data: rutData } = await supabase.from('rutinas').select('*, sistemas_entrenamiento(nombre)').eq('id', id).single();
      if (rutData) setRutina(rutData);

      const { data: ejData } = await supabase
        .from('rutina_ejercicios')
        .select(`
          orden_ejercicio,
          repeticiones_objetivo,
          ejercicios_biblioteca (
            id,
            nombre,
            equipo_necesario,
            instrucciones,
            consejos_pro,
            musculos_trabajados,
            imagen_url
          )
        `)
        .eq('rutina_id', id)
        .order('orden_ejercicio');
      
      if (ejData) {
        let n = (rutData?.nivel || meta.nivel || 'semilla').toLowerCase();
        let currentWarmups = warmupsData.semilla;
        if (n.includes('pino')) currentWarmups = warmupsData.pino;
        else if (n.includes('tzalam')) currentWarmups = warmupsData.tzalam;
        else if (n.includes('roble')) currentWarmups = warmupsData.roble;

        const warmupsArray = currentWarmups.map((w, i) => ({
          ...w,
          orden_ejercicio: i,
          ejercicios_biblioteca: {
            ...w.ejercicios_biblioteca,
            id: `warmup-${i}`
          }
        }));

        setWarmups(warmupsArray);
        setEjercicios(ejData);

        const initLogs = {};
        const initInputs = {};
        ejData.forEach(e => {
          if(e.ejercicios_biblioteca) {
            initLogs[e.ejercicios_biblioteca.id] = [];
            initInputs[e.ejercicios_biblioteca.id] = {};
          }
        });
        setSeriesLog(initLogs);
        setFormInputs(initInputs);
      }
      
      const { obtenerRutinaLocal } = await import('../utils/LocalDB');
      const localData = await obtenerRutinaLocal(id);
      if (localData) {
        setIsDownloaded(true);
      }
      
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const descargarParaOffline = async () => {
    setIsDownloading(true);
    try {
      const { guardarRutinaLocal } = await import('../utils/LocalDB');
      await guardarRutinaLocal(id, {
        rutina,
        ejercicios,
        warmups,
        seriesLog,
        formInputs
      });
      setIsDownloaded(true);
      alert('✅ Rutina descargada correctamente para usarla sin internet.');
    } catch (e) {
      console.error(e);
      alert('❌ Hubo un error al guardar la rutina.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Wake Lock Logic (Mantener pantalla encendida durante todo el entrenamiento)
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log("Wake Lock error:", err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().catch(console.error);
        wakeLockRef.current = null;
      }
    };
  }, []);

  const playTimerSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (timeOffset) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'square'; // Un sonido 'square' es mucho más penetrante y suena más fuerte
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + timeOffset);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + timeOffset + 0.15);
        gainNode.gain.setValueAtTime(1.5, audioCtx.currentTime + timeOffset); // Aumentamos la ganancia al 150%
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + timeOffset + 0.5);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(audioCtx.currentTime + timeOffset);
        oscillator.stop(audioCtx.currentTime + timeOffset + 0.5);
      };
      playBeep(0);
      playBeep(0.3);
      playBeep(0.6);
    } catch (e) {
      console.log("Audio no soportado o bloqueado", e);
    }
  };

  // Timer Logic
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      targetTimeRef.current = Date.now() + timeLeft * 1000;
      
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.round((targetTimeRef.current - now) / 1000);
        
        if (remaining <= 0) {
          clearInterval(interval);
          setIsTimerRunning(false);
          setTimeLeft(0);
          playTimerSound();
        } else {
          setTimeLeft(remaining);
        }
      }, 500); // 500ms check for accuracy
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const setTimerPreset = (seconds) => {
    setTimeLeft(seconds);
    setIsTimerRunning(false); // Espera a que el usuario le de Play
  };

  const adjustTimer = (seconds) => {
    setTimeLeft(prev => {
      const newVal = Math.max(0, prev + seconds);
      if (isTimerRunning) {
        targetTimeRef.current = Date.now() + newVal * 1000;
      }
      return newVal;
    });
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (ejId, serieNum, field, value) => {
    setFormInputs(prev => ({
      ...prev,
      [ejId]: {
        ...prev[ejId],
        [serieNum]: {
          ...prev[ejId]?.[serieNum],
          [field]: value
        }
      }
    }));
  };

  const logSerie = (ejId, serieNum) => {
    const input = formInputs[ejId]?.[serieNum];
    const reps = input?.reps || '-';
    const peso = input?.kg || '-';

    setSeriesLog(prev => {
      const current = [...(prev[ejId] || [])];
      // Si ya existía, la reemplazamos, si no la agregamos
      const existingIdx = current.findIndex(s => s.serie === serieNum);
      if (existingIdx >= 0) {
        current[existingIdx] = { serie: serieNum, reps, peso };
      } else {
        current.push({ serie: serieNum, reps, peso });
      }
      return { ...prev, [ejId]: current };
    });
  };

  const openRmModal = (ej) => {
    const inputs = formInputs[ej.id] || {};
    const logs = seriesLog[ej.id] || [];
    
    let maxKg = 0;
    let maxReps = 0;
    
    const evaluate = (kg, reps) => {
      const k = parseFloat(kg) || 0;
      const r = parseFloat(reps) || 0;
      if (k * (1 + r/30) > maxKg * (1 + maxReps/30)) { maxKg = k; maxReps = r; }
      else if (maxKg === 0 && maxReps === 0 && r > 0) { maxKg = k; maxReps = r; }
    };
    logs.forEach(l => evaluate(l.peso, l.reps));
    Object.values(inputs).forEach(i => evaluate(i.kg, i.reps));

    if (maxReps === 0 && maxKg === 0) {
      alert("Por favor, ingresa las repeticiones (y el peso si aplica) de al menos una serie para calcular tu RM.");
      return;
    }

    const bw = parseFloat(session?.user.user_metadata?.peso) || 70;
    const equipo = (ej.equipo_necesario || '').toLowerCase();
    const nombreEj = (ej.nombre || '').toLowerCase();
    const isCali = equipo.includes('peso corporal') || equipo.includes('dominadas') || equipo.includes('anillas') || 
                   nombreEj.includes('dominada') || nombreEj.includes('pull') || nombreEj.includes('fondo') || 
                   nombreEj.includes('dip') || nombreEj.includes('muscle up') || nombreEj.includes('pistol') || 
                   nombreEj.includes('lagartija') || nombreEj.includes('flexión') || nombreEj.includes('flexion') || 
                   nombreEj.includes('push') || nombreEj.includes('plancha') || nombreEj.includes('dragon') || 
                   nombreEj.includes('lever') || nombreEj.includes('sentadilla libre') || nombreEj.includes('isom') ||
                   equipo.includes('ninguno');

    setRmModal({
      show: true,
      exercise: ej,
      isCalistenia: isCali,
      bw: bw,
      maxKg: maxKg,
      maxReps: maxReps,
      isSaved: false,
      isNewRecord: false,
      isTrenSuperior: false,
      isTrenInferior: false
    });
  };

  const saveRécord = async (calculatedRm) => {
    const ej = rmModal.exercise;
    const musculos = (ej.musculos_trabajados || '').toLowerCase();
    const superiorKeywords = ['pecho', 'espalda', 'hombro', 'brazo', 'biceps', 'triceps', 'dorsal', 'pectoral', 'deltoide'];
    const inferiorKeywords = ['pierna', 'cuadriceps', 'isquio', 'gluteo', 'pantorrilla', 'gemelo'];

    const isSuperior = superiorKeywords.some(k => musculos.includes(k));
    const isInferior = inferiorKeywords.some(k => musculos.includes(k));

    let newRecord = false;
    let leveledUp = false;

    if (isSuperior || isInferior) {
      const key = isSuperior ? 'fuerza_tren_superior' : 'fuerza_tren_inferior';
      const currentMetadata = session?.user.user_metadata || {};
      const previousRm = parseFloat(currentMetadata[key]) || 0;

      if (calculatedRm > previousRm) {
        newRecord = true;
        
        const updateData = { [key]: calculatedRm.toFixed(1) };

        if (!navigator.onLine) {
          const { addToOfflineQueue } = await import('../utils/OfflineManager');
          addToOfflineQueue('UPDATE_AUTH_META', updateData);
          alert('¡Récord offline guardado localmente!');
        } else {
          await supabase.auth.updateUser({ data: updateData });
        }
      }
    }

    setRmModal(prev => ({...prev, isSaved: true, isNewRecord: newRecord, isTrenSuperior: isSuperior, isTrenInferior: isInferior}));
  };

  const procesarFinDeRutina = async () => {
    const currentMetadata = session?.user.user_metadata || {};
    let newLevel = (currentMetadata.nivel || 'Semilla').toLowerCase();
    let leveledUp = false;
    let phrase = "";

    // === INYECCIÓN RPG ENGINE (Silencioso) ===
    try {
      const { data: perfilInfo } = await supabase.from('perfiles').select('xp_actual, puntos_forja, stat_fuerza, stat_agilidad, stat_resistencia, nivel_rpg').eq('id', session?.user.id).maybeSingle();
      if (perfilInfo) {
        const { calculateWorkoutRewards, calculateLevel } = await import('../utils/ProgressionEngine');
        // Asumimos racha guardada o 0 para el bonus
        const { xp, puntosForja, statsBonus } = calculateWorkoutRewards(rutina?.sistemas_entrenamiento?.nombre, 1);
        
        const newXp = (perfilInfo.xp_actual || 0) + xp;
        const newForja = (perfilInfo.puntos_forja || 0) + puntosForja;
        const newFuerza = (perfilInfo.stat_fuerza || 0) + statsBonus.fuerza;
        const newAgilidad = (perfilInfo.stat_agilidad || 0) + statsBonus.agilidad;
        const newResistencia = (perfilInfo.stat_resistencia || 0) + statsBonus.resistencia;
        const newLevelRPG = calculateLevel(newXp);

        const rpgUpdates = {
          xp_actual: newXp, 
          puntos_forja: newForja, 
          stat_fuerza: newFuerza, 
          stat_agilidad: newAgilidad, 
          stat_resistencia: newResistencia,
          nivel_rpg: newLevelRPG
        };

        if (navigator.onLine) {
          await supabase.from('perfiles').update(rpgUpdates).eq('id', session?.user.id);
        } else {
          const { addToOfflineQueue } = await import('../utils/OfflineManager');
          addToOfflineQueue('UPDATE_PERFIL', { id: session?.user.id, ...rpgUpdates });
        }

        // Mostrar Animación de Victoria si es Admin
        if (isAdmin) {
          setRpgModal({ show: true, xp, forja: puntosForja, stats: statsBonus });
          setTimeout(() => {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#D4AF37', '#FFDF00', '#FFFFFF', '#000000']
            });
          }, 300);
        }
      }
    } catch(e) {
      console.error("Error RPG Engine Update:", e);
    }
    // === FIN RPG ENGINE ===
    
    // 1. Días de inactividad
    const hoy = new Date();
    const lastDateStr = currentMetadata.ultimo_entrenamiento_fecha;
    let diasInactivos = 0;
    
    if (lastDateStr) {
      const lastDate = new Date(lastDateStr);
      diasInactivos = Math.floor((hoy - lastDate) / (1000 * 60 * 60 * 24));
    }

    let cicloActual = parseInt(currentMetadata.ciclo_entrenamientos) || 0;
    let mensajePenalizacion = "";

    // ---- LOGICA DE ASCENSO Y CICLO ----
    const hoyStr = hoy.toISOString().split('T')[0];
    const lastDateStrJustDate = lastDateStr ? lastDateStr.split('T')[0] : null;
    const yaEntrenoHoy = (hoyStr === lastDateStrJustDate);

    // Guardar logs de esta sesión
    const historialEjercicios = { ...(currentMetadata.historial_ejercicios || {}) };
    Object.keys(seriesLog).forEach(ejId => {
      if (seriesLog[ejId].length > 0) {
        historialEjercicios[ejId] = seriesLog[ejId];
      }
    });

    const isAlumnoCoach = localStorage.getItem('user_role') === 'alumno_entrenador';
    
    if (yaEntrenoHoy) {
      // Ya entrenó hoy, no incrementamos ciclo
      // (No mostramos el alert aquí para no interrumpir el flujo del modal final)
      const updateData = {
        ultimo_entrenamiento_fecha: hoy.toISOString(),
        historial_ejercicios: historialEjercicios
      };
      if (!navigator.onLine) {
        const { addToOfflineQueue } = await import('../utils/OfflineManager');
        addToOfflineQueue('UPDATE_AUTH_META', updateData);
      } else {
        await supabase.auth.updateUser({ data: updateData });
      }
    } else {
      if (!isAlumnoCoach) {
        if (diasInactivos >= 15) {
          cicloActual = Math.floor(cicloActual * 0.5);
          mensajePenalizacion = "Han pasado más de 15 días. Has perdido el 50% de tu progreso en este ciclo.";
        } else if (diasInactivos >= 7) {
          cicloActual = Math.floor(cicloActual * 0.75);
          mensajePenalizacion = "Ha pasado una semana. Has perdido el 25% de tu progreso en este ciclo.";
        }

        cicloActual += 1;

        // 2. Definir Meta de Ciclo según frecuencia (3 o >3 días)
        const frecuencia = currentMetadata.dias_entrenamiento || '>3';
        const metaCiclo = frecuencia === '3' ? 18 : 24;

        // 3. Evaluar Ascenso
        if (cicloActual >= metaCiclo) {
          const bodyWeight = parseFloat(currentMetadata.peso) || 70;
          const forceSup = parseFloat(currentMetadata.fuerza_tren_superior) || 0;
          const forceInf = parseFloat(currentMetadata.fuerza_tren_inferior) || 0;
          
          const relSup = forceSup / bodyWeight;
          const relInf = forceInf / bodyWeight;

          if (newLevel === 'semilla' && relSup >= 1.0 && relInf >= 1.2) {
              newLevel = 'Pino';
              phrase = "Has superado la fuerza base en ambos trenes. Tu cuerpo ya no es frágil, tus raíces están firmes.";
              leveledUp = true;
          } else if (newLevel === 'pino' && relSup >= 1.2 && relInf >= 1.4) {
              newLevel = 'Tzalam';
              phrase = "Fuerza equilibrada. Has dominado la gravedad. Tienes la fuerza de un guerrero veterano.";
              leveledUp = true;
          } else if (newLevel === 'tzalam' && relSup >= 1.5 && relInf >= 1.8) {
              newLevel = 'Roble';
              phrase = "Equilibrio perfecto y fuerza monumental. Eres parte de la élite máxima de Veta & Vigor.";
              leveledUp = true;
          }

          if (leveledUp) {
            cicloActual = 0; // Resetear ciclo al ascender
          } else {
            cicloActual = metaCiclo; // Mantenerlo al tope
            if (mensajePenalizacion === "") {
              mensajePenalizacion = "Has llegado al final del ciclo, pero aún necesitas más fuerza relativa en AMBOS trenes musculares para ascender. ¡Sigue entrenando duro!";
            }
          }
        }
      }

      const updateData = {
        ciclo_entrenamientos: cicloActual,
        ultimo_entrenamiento_fecha: hoy.toISOString().split('T')[0],
        historial_ejercicios: historialEjercicios
      };

      if (leveledUp) {
        updateData.nivel = newLevel;
      }

      if (!navigator.onLine) {
        const { addToOfflineQueue } = await import('../utils/OfflineManager');
        addToOfflineQueue('UPDATE_AUTH_META', updateData);
        if (mensajePenalizacion) alert(mensajePenalizacion);
      } else {
        await supabase.auth.updateUser({ data: updateData });
        if (mensajePenalizacion && !leveledUp) alert(mensajePenalizacion);
        if (leveledUp) {
            await supabase.auth.refreshSession();
        }

        // --- INICIO LÓGICA DE GAMIFICACIÓN E INSIGNIAS ---
        try {
          // Llama al RPC que crearemos en la DB para obtener el ranking actualizado
          const { data: historialCountData } = await supabase.rpc('get_leaderboard');
          const myStats = historialCountData?.find(user => user.user_id === session?.user.id);
          const totalWorkouts = myStats ? parseInt(myStats.total_workouts) : 1;
          
          let achievedBadge = null;
          if (totalWorkouts === 10) achievedBadge = '🥉 Acero Templado (10 Entrenamientos)';
          else if (totalWorkouts === 25) achievedBadge = '🥈 Plata Pura (25 Entrenamientos)';
          else if (totalWorkouts === 50) achievedBadge = '🥇 Oro Vigoroso (50 Entrenamientos)';
          else if (totalWorkouts === 100) achievedBadge = '💎 Titán del Vigor (100 Entrenamientos)';

          if (achievedBadge) {
             const username = session?.user.user_metadata?.username || session?.user.user_metadata?.nombre_completo || 'Atleta';
             await supabase.from('chat_mensajes').insert([{
               room_id: 'vip_comunidad',
               sender_id: 'system',
               sender_name: 'Coach V&V',
               sender_avatar: '/favicon.ico',
               sender_level: 'Admin',
               mensaje: `🏆 ¡Felicidades a @${username} por desbloquear la insignia **${achievedBadge}**! Una verdadera demostración de constancia. ¡Deja tus aplausos! 👏`
             }]);
          }
        } catch (e) {
          console.error("Error al procesar insignia:", e);
        }
        // --- FIN LÓGICA DE GAMIFICACIÓN ---
      }
    }

    // Mostrar el modal final de felicitaciones (y posiblemente el de level up encima si aplica)
    setRutinaCompletada(true);
    if (leveledUp) {
      setLevelUpModal({ show: true, newLevel, phrase });
    }
  };

  const evaluarProgresoYFinalizar = async () => {
    // Verificar si estamos en Rutas de Maestría
    const isMaestria = rutina?.sistemas_entrenamiento?.nombre?.toLowerCase().includes('maestría') || false;

    if (isMaestria) {
      // Evaluar si cumplió la meta de cada ejercicio
      let rutinaSuperada = true;
      
      for (const item of ejercicios) {
        const ejId = item.ejercicios_biblioteca.id;
        const logs = seriesLog[ejId] || [];
        const repObj = item.repeticiones_objetivo || "1 serie de 1 rep";
        
        const seriesMatch = repObj.match(/(\d+)\s*series?/i);
        const metaSeries = seriesMatch ? parseInt(seriesMatch[1]) : 1;
        
        const repsMatch = repObj.match(/(\d+)(?:-|–)?(?:\d+)?\s*(reps|seg)/i);
        const metaReps = repsMatch ? parseInt(repsMatch[1]) : 0;

        if (logs.length < metaSeries) {
          rutinaSuperada = false;
          break;
        }

        const cumplenMeta = logs.slice(0, metaSeries).every(l => {
          const userReps = parseFloat(l.reps) || 0;
          return userReps >= metaReps;
        });

        if (!cumplenMeta) {
          rutinaSuperada = false;
          break;
        }
      }

      if (!rutinaSuperada) {
        setUnlockWarningModal(true);
        return; // Detener flujo para esperar decisión del usuario
      } else {
        await marcarRutinaComoSuperada();
      }
    }

    await procesarFinDeRutina();
  };

  const marcarRutinaComoSuperada = async () => {
    try {
      const currentMetadata = session?.user.user_metadata || {};
      const superadas = currentMetadata.rutinas_superadas || [];
      if (!superadas.includes(id)) {
        const newSuperadas = [...superadas, id];
        await supabase.auth.updateUser({ data: { rutinas_superadas: newSuperadas } });
      }
    } catch (err) {
      console.error("Error al guardar rutina superada:", err);
    }
  };

  const forzarDesbloqueo = async () => {
    setUnlockWarningModal(false);
    await marcarRutinaComoSuperada();
    await procesarFinDeRutina();
  };

  const finalizarEjercicio = async (item) => {
    const ejId = item.ejercicios_biblioteca.id;
    const ej = item.ejercicios_biblioteca;
    const logs = seriesLog[ejId] || [];
    
    // Validación de campos llenos
    const equipo = (ej.equipo_necesario || '').toLowerCase();
    const nombreEj = (ej.nombre || '').toLowerCase();
    const isCali = equipo.includes('peso corporal') || equipo.includes('dominadas') || equipo.includes('anillas') || nombreEj.includes('dominada') || nombreEj.includes('pull') || nombreEj.includes('fondo') || nombreEj.includes('dip') || nombreEj.includes('muscle up');
    const isCardio = nombreEj.includes('caminata') || nombreEj.includes('bici') || nombreEj.includes('correr') || nombreEj.includes('cardio');

    if (!isCardio) {
      const validLog = logs.some(l => {
        const r = parseFloat(l.reps) || 0;
        return r > 0;
      });

      if (!validLog) {
        alert("⚠️ Debes registrar (✔️) las repeticiones de al menos una serie para poder continuar.");
        return;
      }
    }

    
    if (logs.length > 0) {
      const payload = {
        user_id: session?.user.id,
        rutina_id: id,
        ejercicio_id: ejId,
        series_log: logs,
        completado: true
      };

      try {
        if (!navigator.onLine) {
          const { addToOfflineQueue } = await import('../utils/OfflineManager');
          addToOfflineQueue('INSERT_HISTORIAL', payload);
        } else {
          await supabase.from('historial_entrenamientos').insert([payload]);
          // Cancelar el recordatorio de las 6 PM ya que el usuario entrenó
          cancelTrainingReminder();
        }
      } catch (err) {
        console.error("Error guardando historial:", err);
      }
    }

    setIsTimerRunning(false);
    setTimeLeft(90);
    
    if (activeIndex < ejercicios.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setActiveIndex(null);
      await evaluarProgresoYFinalizar();
    }
  };

  if (loading) return <div style={{textAlign: 'center', padding: '40px'}}><Loader className="fa-spin gold-gradient-text" size={40} /></div>;

  // --- VISTA MODO ACTIVO ---
  if (activeIndex !== null) {
    const item = ejercicios[activeIndex];
    if (!item) { setActiveIndex(null); return null; }
    
    const ej = item.ejercicios_biblioteca;
    if (!ej) return null;
    
    const repObj = item.repeticiones_objetivo || "3 series";
    const matchSeries = repObj.match(/(\d+)\s*series?/i);
    const numSeriesGoal = matchSeries ? parseInt(matchSeries[1]) : 3;
    const currentLogs = seriesLog[ej.id] || [];
    
    const repObjLower = repObj.toLowerCase();
    const isTimeBased = repObjLower.includes('segundo') || repObjLower.includes('min') || repObjLower.includes('tiempo') || repObjLower.includes('seg');

    // Generar array de series ej: [1, 2, 3, 4]
    const seriesArray = Array.from({ length: numSeriesGoal }, (_, i) => i + 1);

    const activeModalContent = (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#111', zIndex: 9999,
        overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>
        {/* Navbar */}
        <div style={{ padding: 'max(env(safe-area-inset-top), 25px) 20px 15px 20px', display: 'flex', alignItems: 'center', gap: '15px', position: 'sticky', top: 0, backgroundColor: '#111', zIndex: 10 }}>
          <button onClick={() => { setActiveIndex(null); setIsTimerRunning(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={28} />
          </button>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', flex: 1, textAlign: 'center' }}>{ej.nombre}</h2>
          <div style={{ width: '28px' }}></div> {/* Spacer for centering */}
        </div>

        {/* Imagen Banner */}
        {ej.imagen_url && (
          <div style={{ width: '100%', height: '220px', overflow: 'hidden', position: 'relative' }}>
            <img src={ej.imagen_url} alt={ej.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(to top, #111, transparent)' }}></div>
          </div>
        )}

        <div style={{ padding: '0 20px 20px 20px' }}>
          
          {/* Instrucciones Textuales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: '#ccc', fontSize: '0.95rem', marginBottom: '25px' }}>
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#888' }}>Equipo:</p>
              <p style={{ margin: 0, color: '#fff' }}>{ej.equipo_necesario || 'Muro / Ninguno'}</p>
            </div>

            <div>
              <p style={{ margin: '0 0 5px 0', color: '#888' }}>¿Cómo hacerlo?</p>
              <p style={{ margin: 0 }}>{ej.instrucciones}</p>
            </div>

            {ej.consejos_pro && (
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#888' }}>Consejo Pro:</p>
                <p style={{ margin: 0 }}>{ej.consejos_pro}</p>
              </div>
            )}

            <div>
              <p style={{ margin: '0 0 5px 0', color: '#888' }}>¿Qué estoy Ejercitando?</p>
              <p style={{ margin: 0 }}>{ej.musculos_trabajados || 'Cuerpo Completo'}</p>
            </div>
          </div>

          {/* Temporizador Central Gigante */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px' }}>
            
            {/* Presets */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {[60, 90, 120, 180].map(secs => (
                <button 
                  key={secs}
                  onClick={() => setTimerPreset(secs)}
                  style={{ 
                    background: timeLeft === secs ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)', 
                    color: timeLeft === secs ? '#000' : '#888',
                    border: 'none', borderRadius: '20px', padding: '5px 12px', fontSize: '0.8rem',
                    fontWeight: 'bold', transition: 'all 0.2s'
                  }}
                >
                  {Math.floor(secs / 60)}:{secs % 60 === 0 ? '00' : secs % 60}
                </button>
              ))}
            </div>

            {/* Reloj Circular */}
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%', border: '4px solid rgba(212, 175, 55, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
              boxShadow: isTimerRunning ? '0 0 30px rgba(212, 175, 55, 0.15)' : 'none',
              transition: 'box-shadow 0.3s'
            }}>
              <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Controles Reloj */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button onClick={() => adjustTimer(-10)} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 'bold' }}>-10s</button>
              <button 
                onClick={toggleTimer}
                style={{
                  width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-gold)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#000', cursor: 'pointer'
                }}
              >
                {isTimerRunning ? <Pause size={30} fill="#000" /> : <Play size={30} fill="#000" style={{ marginLeft: '4px' }} />}
              </button>
              <button onClick={() => adjustTimer(10)} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 'bold' }}>+10s</button>
            </div>
          </div>

          {/* Grilla de Series */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', overflow: 'hidden', marginBottom: '30px' }}>
            
            <div style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', textTransform: 'uppercase' }}>{ej.nombre}</h3>
              <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.8rem' }}>OBJETIVO: {item.repeticiones_objetivo}</p>
            </div>

            {/* Encabezados Grilla */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 60px', padding: '10px 15px', color: '#666', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>#</div>
              <div>KG / LBS</div>
              <div>{isTimeBased ? 'TIEMPO (s)' : 'REPS'}</div>
              <div>OK</div>
            </div>

            {/* Filas de Series */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {seriesArray.map((serieNum) => {
                const logData = currentLogs.find(l => l.serie === serieNum);
                const isLogged = !!logData;
                const inputData = formInputs[ej.id]?.[serieNum] || {};
                
                const userMeta = session?.user?.user_metadata || {};
                const historial = userMeta.historial_ejercicios?.[ej.id] || [];
                const pastData = historial.find(h => h.serie === serieNum);

                return (
                  <div key={serieNum} style={{ 
                    display: 'grid', gridTemplateColumns: '40px 1fr 1fr 60px', 
                    padding: '12px 15px', alignItems: 'center', textAlign: 'center',
                    backgroundColor: isLogged ? 'rgba(120, 224, 143, 0.05)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.02)'
                  }}>
                    <div style={{ color: isLogged ? '#78e08f' : '#888', fontWeight: 'bold' }}>{serieNum}</div>
                    
                    <div style={{ padding: '0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={isLogged ? logData.peso : (inputData.kg || '')}
                        onChange={(e) => handleInputChange(ej.id, serieNum, 'kg', e.target.value)}
                        placeholder={pastData ? String(pastData.peso) : "-"}
                        style={{ 
                          width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', 
                          borderRadius: '8px', padding: '10px 0', color: '#fff', textAlign: 'center',
                          fontSize: '1.1rem', fontWeight: 'bold'
                        }}
                      />
                      {pastData && !isLogged && !inputData.kg && (
                        <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px' }}>Ant: {pastData.peso}</span>
                      )}
                    </div>

                    <div style={{ padding: '0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={isLogged ? logData.reps : (inputData.reps || '')}
                        onChange={(e) => handleInputChange(ej.id, serieNum, 'reps', e.target.value)}
                        disabled={isLogged}
                        placeholder={pastData ? String(pastData.reps) : (isTimeBased ? 's' : '')}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                          backgroundColor: isLogged ? 'transparent' : 'rgba(0,0,0,0.3)',
                          color: '#fff', textAlign: 'center', fontWeight: 'bold', outline: 'none'
                        }}
                      />
                      {pastData && !isLogged && !inputData.reps && (
                        <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px' }}>Ant: {pastData.reps}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button 
                        onClick={() => logSerie(ej.id, serieNum)}
                        style={{
                          width: '40px', height: '40px', borderRadius: '10px',
                          background: isLogged ? '#78e08f' : 'rgba(255,255,255,0.1)',
                          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isLogged ? '#000' : '#888', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <CheckCircle size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Botón de RM */}
            <div style={{ padding: '15px', display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                onClick={() => openRmModal(ej)}
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))',
                  border: '1px solid var(--accent-gold)',
                  color: 'var(--accent-gold)',
                  padding: '10px 20px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                <i className="fa-solid fa-bolt"></i> Calcular 1RM y Registrar
              </button>
            </div>
          </div>

          <button 
            onClick={() => finalizarEjercicio(item)}
            className="btn-primary" 
            style={{ width: '100%', padding: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '40px' }}
          >
            {activeIndex < ejercicios.length - 1 ? (
              <>SIGUIENTE EJERCICIO <ChevronRight /></>
            ) : (
              <>FINALIZAR RUTINA <CheckCircle /></>
            )}
          </button>
      </div>
      

      {/* MODAL DE RUTINA BLOQUEADA (MAESTRÍA) */}
        {rmModal.show && (() => {
          const totalW = rmModal.isCalistenia ? (rmModal.bw + rmModal.maxKg) : rmModal.maxKg;
          const calculatedRm = totalW > 0 && rmModal.maxReps > 0 ? (totalW * (1 + (rmModal.maxReps / 30))) : 0;
          const relative = rmModal.bw > 0 ? calculatedRm / rmModal.bw : 0;
          
          let level = "";
          if (relative < 1.0) level = "Veta en Construcción 🌱";
          else if (relative < 1.4) level = "Veta Dura 🪵";
          else if (relative < 1.8) level = "Veta ExtraDura 💎";
          else level = "Leyenda Vigorosa 👑";

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', backdropFilter: 'blur(5px)'
            }}>
              <div style={{
                background: '#0c0d10', border: '1px solid var(--accent-gold)',
                borderRadius: '20px', padding: '30px', width: '100%', maxWidth: '350px',
                textAlign: 'center', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}>
                <button 
                  onClick={() => setRmModal({...rmModal, show: false})}
                  style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>

                <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '10px', textTransform: 'uppercase', fontSize: '1.1rem' }}>Calculadora 1RM</h3>
                <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '15px' }}>{rmModal.exercise?.nombre}</p>

                {!rmModal.isSaved && (
                  <div style={{ marginBottom: '20px', display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                    <button 
                      onClick={() => setRmModal({...rmModal, isCalistenia: true})}
                      style={{ flex: 1, padding: '10px', border: 'none', background: rmModal.isCalistenia ? 'var(--accent-gold)' : 'transparent', color: rmModal.isCalistenia ? '#000' : '#888', fontWeight: 'bold' }}
                    >Calistenia</button>
                    <button 
                      onClick={() => setRmModal({...rmModal, isCalistenia: false})}
                      style={{ flex: 1, padding: '10px', border: 'none', background: !rmModal.isCalistenia ? 'var(--accent-gold)' : 'transparent', color: !rmModal.isCalistenia ? '#000' : '#888', fontWeight: 'bold' }}
                    >Gimnasio</button>
                  </div>
                )}

                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', textShadow: '0 0 15px rgba(212, 175, 55, 0.4)' }}>
                  {calculatedRm.toFixed(1)} <span style={{ fontSize: '1rem', color: '#888', fontWeight: 'normal' }}>kg</span>
                </div>
                
                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.1rem', margin: '15px 0' }}>
                  {level}
                </div>

                {!rmModal.isSaved ? (
                  <button 
                    onClick={() => saveRécord(calculatedRm)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--accent-gold)', color: '#000', border: 'none', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' }}
                  >Registrar Récord</button>
                ) : (
                  (rmModal.isTrenSuperior || rmModal.isTrenInferior) ? (
                    <div style={{ 
                      background: rmModal.isNewRecord ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.05)', 
                      border: rmModal.isNewRecord ? '1px solid #2ecc71' : '1px solid rgba(255,255,255,0.1)', 
                      padding: '12px', borderRadius: '10px', marginTop: '20px', fontSize: '0.85rem' 
                    }}>
                      {rmModal.isNewRecord ? (
                        <><span style={{ color: '#2ecc71', fontWeight: 'bold' }}>¡NUEVO RÉCORD!</span><br/><span style={{color: '#ccc'}}>Guardado en Perfil ({rmModal.isTrenSuperior ? 'Superior' : 'Inferior'})</span></>
                      ) : (
                        <span style={{color: '#888'}}>Tu récord actual de {rmModal.isTrenSuperior ? 'Tren Superior' : 'Tren Inferior'} es mayor o igual.</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '10px', marginTop: '20px', fontSize: '0.85rem', color: '#888' }}>
                      Este ejercicio no suma a los Trofeos Principales (Superior/Inferior) porque no tiene los músculos principales asignados.
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
    
    return createPortal(activeModalContent, document.body);
  }

  // --- VISTA LISTA (COMPACTA) ---
  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver
      </button>

      {rutina && (
        <div style={{ marginBottom: '20px' }}>
          <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '5px' }}>{rutina.nombre}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{rutina.enfoque} • Nivel {rutina.nivel}</p>
        </div>
      )}

      {warmups.length > 0 && (
        <button 
          onClick={() => setShowWarmups(true)} 
          style={{ 
            marginBottom: '10px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '10px', 
            width: '100%', 
            padding: '15px', 
            borderRadius: '12px', 
            background: 'rgba(212, 175, 55, 0.1)', 
            border: '1px solid var(--accent-gold)', 
            color: 'var(--accent-gold)', 
            fontSize: '1rem', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}
        >
          🔥 VER CALENTAMIENTO
        </button>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button onClick={() => setActiveIndex(0)} className="btn-primary" style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <PlayCircle /> INICIAR ENTRENAMIENTO
        </button>
        
        <button 
          onClick={descargarParaOffline} 
          disabled={isDownloading || !navigator.onLine}
          style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '5px', 
            padding: '10px',
            borderRadius: '12px',
            border: isDownloaded ? '1px solid #2ecc71' : '1px solid rgba(255,255,255,0.2)',
            background: isDownloaded ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.05)',
            color: isDownloaded ? '#2ecc71' : '#ccc',
            fontSize: '0.8rem',
            cursor: (isDownloading || !navigator.onLine) ? 'not-allowed' : 'pointer'
          }}
        >
          {isDownloading ? <Loader className="fa-spin" size={18} /> : (isDownloaded ? <><CheckCircle size={18} /> Guardada</> : <><i className="fa-solid fa-download"></i> Descargar</>)}
        </button>
      </div>

      <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#fff' }}>Ejercicios ({ejercicios.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ejercicios.map((item, index) => {
          const ej = item.ejercicios_biblioteca;
          if (!ej) return null;
          
          const isCompleted = (seriesLog[ej.id] || []).length > 0;
          
          return (
            <div 
              key={index} 
              onClick={() => setActiveIndex(index)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                padding: '15px 20px',
                border: isCompleted ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ 
                width: '60px', height: '60px', borderRadius: '12px', flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                position: 'relative'
              }}>
                {ej.imagen_url ? (
                  <img src={ej.imagen_url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isCompleted ? 0.4 : 1 }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                    {item.orden_ejercicio}
                  </div>
                )}
                {isCompleted && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212, 175, 55, 0.4)' }}>
                    <CheckCircle size={28} color="#000" />
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 3px 0', color: isCompleted ? '#fff' : '#ddd' }}>{ej.nombre}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {item.repeticiones_objetivo} • {ej.equipo_necesario || 'Sin equipo'}
                </p>
              </div>

              <ChevronRight size={20} color={isCompleted ? 'var(--accent-gold)' : '#666'} />
            </div>
          );
        })}
      </div>

      {/* CONFIRMACIÓN RUTINA COMPLETADA (NO ADMIN O NORMAL) */}
      {rutinaCompletada && !levelUpModal.show && !rmModal.show && !rpgModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--accent-gold)', width: '100%', maxWidth: '400px' }}>
            <div style={{ background: 'var(--accent-gold)', color: '#000', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <CheckCircle size={36} />
            </div>
            <h2 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>¡Logro Desbloqueado!</h2>
            <p style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '20px' }}>Has finalizado tu rutina.</p>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '25px', fontStyle: 'italic', color: '#ccc', lineHeight: '1.5' }}>
              "{getFraseInspiradora()}"
            </div>

            <button onClick={() => navigate('/perfil')} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
              Terminar y Volver
            </button>
          </div>
        </div>
      )}

      {/* Level Up Epic Modal */}
      {levelUpModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(15px)',
          zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', padding: '20px', textAlign: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{ fontSize: '5rem', animation: 'bounce 2s infinite' }}>💥</div>
          <h1 className="gold-gradient-text" style={{ fontSize: '3rem', margin: '20px 0 10px 0', textTransform: 'uppercase' }}>
            ¡NIVEL ASCENDIDO!
          </h1>
          <h2 style={{ fontSize: '2rem', color: '#fff', margin: '0 0 20px 0' }}>
            Bienvenido al nivel <span className="gold-gradient-text">{levelUpModal.newLevel}</span>
          </h2>
          <p style={{ color: '#ccc', fontSize: '1.2rem', maxWidth: '400px', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '40px' }}>
            "{levelUpModal.phrase}"
          </p>
          <button 
            onClick={() => setLevelUpModal({ show: false, newLevel: '', phrase: '' })}
            style={{ padding: '15px 40px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)' }}
          >
            Aceptar mi Destino
          </button>
        </div>
      )}

      {/* RPG Victory Modal */}
      {rpgModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(10px)',
          zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', padding: '20px', textAlign: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <h1 className="gold-gradient-text" style={{ fontSize: '3rem', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>
            ¡VICTORIA!
          </h1>
          <p style={{ color: '#ccc', fontSize: '1.2rem', marginBottom: '30px' }}>Has superado la prueba del Gremio.</p>
          
          <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '15px', padding: '20px', width: '100%', maxWidth: '350px', marginBottom: '30px', boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <span style={{ color: '#888', fontWeight: 'bold' }}>EXPERIENCIA</span>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.2rem' }}>+{rpgModal.xp} XP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <span style={{ color: '#888', fontWeight: 'bold' }}>MONEDAS DE FORJA</span>
              <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.2rem' }}>🪙 +{rpgModal.forja}</span>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Atributos Mejorados</p>
              {rpgModal.stats?.fuerza > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B5A2B', fontWeight: 'bold', marginBottom: '5px' }}>
                  <span>Fuerza Bruta</span><span>+{rpgModal.stats.fuerza}</span>
                </div>
              )}
              {rpgModal.stats?.agilidad > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2E8B57', fontWeight: 'bold', marginBottom: '5px' }}>
                  <span>Agilidad / Control</span><span>+{rpgModal.stats.agilidad}</span>
                </div>
              )}
              {rpgModal.stats?.resistencia > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4682B4', fontWeight: 'bold' }}>
                  <span>Resistencia</span><span>+{rpgModal.stats.resistencia}</span>
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => {
              setRpgModal({ show: false, xp: 0, forja: 0, stats: null });
              window.scrollTo(0, 0);
              navigate('/perfil');
            }}
            className="btn-primary"
            style={{ padding: '15px 40px', fontSize: '1.2rem', width: '100%', maxWidth: '350px' }}
          >
            Reclamar Recompensas
          </button>
        </div>
      )}

      {/* MODAL DE ADVERTENCIA DE DESBLOQUEO */}
      {unlockWarningModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid #d9534f', width: '100%', maxWidth: '400px' }}>
            <div style={{ background: '#d9534f', color: '#fff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.8rem' }}></i>
            </div>
            <h2 style={{ fontSize: '1.4rem', margin: '0 0 10px 0', color: '#fff' }}>¡Objetivos No Alcanzados!</h2>
            <p style={{ fontSize: '1rem', color: '#ccc', marginBottom: '20px', lineHeight: '1.5' }}>
              El sistema registró que no cumpliste con los requisitos mínimos de series y repeticiones/segundos marcados por la rutina para poder avanzar.
            </p>
            <p style={{ fontSize: '1rem', color: '#ccc', marginBottom: '25px', lineHeight: '1.5' }}>
              Te recomendamos repetir esta semana. ¿Aún así deseas forzar el desbloqueo de la siguiente etapa?
            </p>

            <button onClick={() => { setUnlockWarningModal(false); procesarFinDeRutina(); }} className="btn-secondary" style={{ width: '100%', padding: '15px', fontSize: '1rem', marginBottom: '10px' }}>
              No, seguiré practicando (Repetir)
            </button>
            <button onClick={forzarDesbloqueo} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1rem', background: '#d9534f', border: 'none', color: '#fff' }}>
              Sí, forzar desbloqueo
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CALENTAMIENTO */}
      {showWarmups && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflowY: 'auto'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '20px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowWarmups(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '8px', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 className="gold-gradient-text" style={{ margin: '0 0 20px 0', fontSize: '1.4rem' }}>Calentamiento General</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Realiza estos ejercicios antes de iniciar el entrenamiento para preparar tus articulaciones y sistema nervioso.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {warmups.map((w, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#fff' }}>{i+1}. {w.ejercicios_biblioteca.nombre}</h3>
                  <p style={{ margin: '0 0 10px 0', color: 'var(--accent-gold)', fontSize: '0.9rem', fontWeight: 'bold' }}>Objetivo: {w.repeticiones_objetivo}</p>
                  <p style={{ margin: '0 0 10px 0', color: '#ccc', fontSize: '0.9rem', lineHeight: '1.4' }}>{w.ejercicios_biblioteca.instrucciones}</p>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>{w.ejercicios_biblioteca.consejos_pro}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowWarmups(false)} className="btn-primary" style={{ width: '100%', padding: '15px', marginTop: '20px' }}>
              Entendido, Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
