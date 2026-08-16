import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import DatabaseService from '../services/DatabaseService';
import { CheckCircle, X, Trophy, PlayCircle, Music, Zap, Timer, RotateCcw, ChevronRight, Droplet, Moon, Apple, Camera as CameraIcon, Share2 } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { evento, EVENTOS } from '../utils/telemetry';
import { registrarDiaEntrenado } from '../utils/registrarDiaEntrenado';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';

const getMensajeVigor = (dia) => {
  const d = parseInt(dia);
  if (d === 21) {
    return "Cumpliste 21 días contigo. No terminaste siendo perfecto. Terminaste demostrando que puedes mantener tu palabra. Tu siguiente etapa comienza ahora. Lo que resistes, te fortalece.";
  } else if (d >= 16 && d <= 20) {
    return "Ya no eres alguien que solo quiere cambiar. Estás actuando.";
  } else if (d >= 11 && d <= 15) {
    return "La técnica construye lo que el ego intenta apresurar.";
  } else if (d >= 6 && d <= 10) {
    return "La disciplina crece cada vez que vuelves.";
  } else {
    return "Hoy cumpliste la palabra que te diste.";
  }
};

export default function RutinaRetoPlayer({ diaInfo, perfil, onClose, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const storageKey = `vigor_reto_progreso_${perfil?.id}_${diaInfo?.dia_numero}`;

  // Interactive States (with localStorage recovery)
  const [rondaActual, setRondaActual] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).rondaActual : 1;
  });
  
  const [ejerciciosMarcados, setEjerciciosMarcados] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).ejerciciosMarcados : {};
  });

  const [time, setTime] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).time : 0;
  });

  const totalRondas = diaInfo?.enfoque === 'Descanso Activo' ? 1 : 4;

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      rondaActual,
      ejerciciosMarcados,
      time
    }));
  }, [rondaActual, ejerciciosMarcados, time, storageKey]);

  // Timer States
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Habits States
  const [agua, setAgua] = useState(null); // '0', '1', '2'
  const [sueno, setSueno] = useState(null); // '5', '6', '8'
  const [comidaSana, setComidaSana] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const parseRutinaText = (text) => {
    if (!text) return [];
    
    let cleanText = text;
    // Remove enclosing quotes if they exist (e.g. from SQL update)
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.substring(1, cleanText.length - 1);
    }
    
    // Replace literal '\n' string with actual newline character just in case
    cleanText = cleanText.replace(/\\n/g, '\n');
    
    // Split by actual newlines
    let lines = cleanText.split(/\r?\n/);
    
    // If it's still a single line but contains multiple numbered items like "1. ... 2. ...", split by numbers
    if (lines.length === 1 && cleanText.match(/\d+\./)) {
      lines = cleanText.split(/(?=\d+\.)/);
    }

    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  const ejercicios = parseRutinaText(diaInfo.rutina_json);
  
  // Progress calculations
  const totalEjercicios = ejercicios.length;
  const marcadosEnRonda = Object.keys(ejerciciosMarcados).filter(k => ejerciciosMarcados[k]).length;
  const rondaCompletada = marcadosEnRonda === totalEjercicios;
  
  // Total progress percentage
  const porcentajeRondasAnteriores = ((rondaActual - 1) / totalRondas) * 100;
  const porcentajeRondaActual = (marcadosEnRonda / totalEjercicios) * (100 / totalRondas);
  const totalProgress = Math.min(100, porcentajeRondasAnteriores + porcentajeRondaActual);
  
  // Validation: To complete the day, all rounds must be done AND they must have selected agua and sueno
  const rondasTerminadas = rondaActual === totalRondas && rondaCompletada;
  const habitosLlenos = agua !== null && sueno !== null;
  const retoListoParaCompletar = rondasTerminadas && habitosLlenos;

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  // Lock body scroll and pull-to-refresh when this modal is open
  useEffect(() => {
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalOverflow = document.body.style.overflow;
    
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    
    return () => {
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleEjercicio = (idx) => {
    setEjerciciosMarcados(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const avanzarRonda = () => {
    if (rondaActual < totalRondas) {
      setRondaActual(prev => prev + 1);
      setEjerciciosMarcados({});
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleTakePhoto = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        width: 1080,
        height: 1080
      });

      if (photo.dataUrl) {
        // Convert dataUrl to File for upload
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `reto_foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFotoFile(file);
        setFotoPreview(photo.dataUrl);
      }
    } catch (err) {
      // User cancelled or camera not available, fall back to file input
      if (err.message !== 'User cancelled photos app') {
        console.warn('Camera no disponible, usando selector de archivos:', err);
        fileInputRef.current?.click();
      }
    }
  };

  const handleCompletar = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const nextDia = perfil.reto_dia_actual + 1;
      const isFinished = nextDia > 21;

      // 1. Calculate Points
      let puntos = 50; // Completar el día
      if (agua === '1') puntos += 10;
      if (agua === '2') puntos += 20;
      if (sueno === '6') puntos += 10;
      if (sueno === '8') puntos += 20;
      if (comidaSana) puntos += 10;
      if (fotoFile) puntos += 30;
      
      const hasProfileData = perfil.peso && perfil.estatura;
      if (hasProfileData) puntos += 20;

      // 2. Upload Photo (if any)
      let uploadedUrl = null;
      if (fotoFile) {
        try {
          const fileName = `${perfil.id}/${diaInfo.dia_numero}_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reto-fotos')
            .upload(fileName, fotoFile, { cacheControl: '3600', upsert: false });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('reto-fotos').getPublicUrl(fileName);
            uploadedUrl = publicUrlData.publicUrl;
          }
        } catch (e) {
          console.warn("No se pudo subir la foto (quizás no existe el bucket):", e);
        }
      }

      // 3. Save Habits log
      try {
        await supabase.from('habitos_diarios').insert([{
          user_id: perfil.id,
          dia_reto: diaInfo.dia_numero,
          agua,
          sueno,
          comida_sana: comidaSana,
          foto_url: uploadedUrl,
          puntos_ganados: puntos
        }]);
      } catch (e) {
        console.warn("No se pudo guardar el hábito (quizás no existe la tabla):", e);
      }

      // 4. Update Perfil (Base Challenge Logic)
      const updates = {
        reto_dia_actual: isFinished ? 21 : nextDia,
        reto_ultimo_completado: now,
        reto_completado: isFinished ? true : false
      };

      if (isFinished && !perfil.reto_completado) {
        updates.retos_completados_count = (perfil.retos_completados_count || 0) + 1;
      }

      const { error } = await supabase.from('perfiles').update(updates).eq('id', perfil.id);
      if (error) throw error;

      // Espejo inmediato en el SQLite local, marcado como ya sincronizado.
      //
      // Esta escritura va DIRECTA a Supabase y nunca toca el SQLite local. El
      // problema: SyncService.pushData también empuja reto_dia_actual, tomando
      // el valor que haya en SQLite en ese momento, cada vez que CUALQUIER OTRA
      // cosa marca el perfil local como sucio (completar una rutina normal,
      // por ejemplo). Sin este espejo, la próxima sincronización de fondo sube
      // el valor VIEJO que sigue en el SQLite local y pisa el avance que el
      // servidor acaba de aceptar — pasó de verdad el 14/08: dos cuentas
      // completaron días del reto, las recompensas se acreditaron
      // (rpg_transacciones lo demuestra), pero reto_dia_actual quedó
      // revertido al día anterior en Supabase.
      try {
        await DatabaseService.execute(
          `UPDATE perfiles SET reto_dia_actual = ?, reto_ultimo_completado = ?, reto_completado = ?, retos_completados_count = ?, is_dirty = 0 WHERE id = ?`,
          [
            updates.reto_dia_actual,
            updates.reto_ultimo_completado,
            updates.reto_completado ? 1 : 0,
            updates.retos_completados_count ?? perfil.retos_completados_count ?? 0,
            perfil.id
          ]
        );
      } catch (e) {
        console.warn('No se pudo espejar el avance del reto en SQLite local:', e);
      }

      // Un día del reto también es un día entrenado: crea la fila de checkins
      // de la que dependen el Progreso Semanal y el panel de admin.
      await registrarDiaEntrenado(perfil?.id);

      // Telemetría: con el número de día, que es lo que permite ver la curva de
      // abandono del reto. Si la caída está en el día 4, eso es una decisión de
      // producto que hoy no tienes forma de tomar.
      evento(EVENTOS.RETO_DIA_COMPLETADO, {
        dia: parseInt(diaInfo.dia_numero),
        es_final: parseInt(diaInfo.dia_numero) >= 21,
      });

      // 6. RPG y Economía (Atómico)
      try {
        const idempotencyMision = `reto_vigor21_dia_${diaInfo.dia_numero}_${perfil.id}`;
        const { data: rpgData, error: rpgError } = await supabase.rpc('completar_mision_rpg', {
          p_user_id: perfil.id,
          p_origen: `reto_vigor21_dia_${diaInfo.dia_numero}`,
          p_idempotency_key: idempotencyMision
        });

        if (rpgError) console.error("Error RPC Misión:", rpgError);

        if (rpgData && rpgData.success) {
          const rachaActual = rpgData.racha;
          
          // Bonos de racha
          if (rachaActual === 7) {
            await supabase.rpc('reclamar_bono_reto', { p_user_id: perfil.id, p_bono_tipo: '7_dias', p_idempotency_key: `bono_7_${perfil.id}` });
          } else if (rachaActual === 14) {
            await supabase.rpc('reclamar_bono_reto', { p_user_id: perfil.id, p_bono_tipo: '14_dias', p_idempotency_key: `bono_14_${perfil.id}` });
          }

          if (isFinished) {
            // Bono por terminar reto (50 XP, 50 Monedas)
            await supabase.rpc('reclamar_bono_reto', { p_user_id: perfil.id, p_bono_tipo: '21_dias', p_idempotency_key: `bono_21_${perfil.id}` });
            
            // Bono perfecto
            if (rachaActual >= 21) {
              await supabase.rpc('reclamar_bono_reto', { p_user_id: perfil.id, p_bono_tipo: 'perfecto_21', p_idempotency_key: `bono_perf_21_${perfil.id}` });
            }
          }
        }
      } catch (e) {
        console.error("Error en transacciones RPG:", e);
      }

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#ffffff', '#FFD700']
      });

      // Clear the local storage cache so it's clean for next time
      localStorage.removeItem(storageKey);

      setCompleted(true);
      // Remove timeout to wait for user interaction

    } catch (err) {
      console.error("Error completando el día:", err);
      alert("Hubo un error al guardar tu progreso.");
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    const isFinished = parseInt(diaInfo.dia_numero) >= 21;
    
    const handleShare = async () => {
      if (!shareCardRef.current) return;
      setIsSharing(true);

      const titulo = 'Veta & Vigor - Reto 21 Días';
      const texto = `¡Acabo de completar el Día ${diaInfo.dia_numero} de 21 en mi Reto Veta & Vigor!\n\n"${getMensajeVigor(diaInfo?.dia_numero)}"`;

      try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI updates if needed

        const canvas = await html2canvas(shareCardRef.current, {
          backgroundColor: '#0a0a0f',
          scale: 2,
          useCORS: true
        });

        if (Capacitor.isNativePlatform()) {
          // El WebView de Android NO implementa navigator.share: esa API existe en
          // Chrome como navegador, pero no dentro de una app Capacitor. Antes se
          // caía al else y salía el aviso de "no disponible en este dispositivo",
          // así que este botón nunca funcionó en la app de Play Store.
          //
          // El plugin nativo sí comparte, pero necesita una RUTA de archivo, no un
          // Blob. De ahí que haya que escribir la imagen en la caché primero.
          const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          const escrito = await Filesystem.writeFile({
            path: `veta_vigor_reto_${Date.now()}.jpg`,
            data: base64,
            directory: Directory.Cache
          });

          await Share.share({
            title: titulo,
            text: texto,
            files: [escrito.uri],
            dialogTitle: 'Compartir tu logro'
          });
        } else {
          // En web (PWA sobre Chrome) navigator.share sí existe y admite archivos.
          const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
          const file = blob ? new File([blob], 'veta_vigor_reto.jpg', { type: 'image/jpeg' }) : null;

          if (file && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title: titulo, text: texto, files: [file] });
          } else if (navigator.share) {
            await navigator.share({ title: titulo, text: texto });
          } else {
            await navigator.clipboard.writeText(texto);
            alert('Texto copiado al portapapeles. Puedes tomar una captura de pantalla para compartir tu logro.');
          }
        }
      } catch (err) {
        // Cancelar el menú de compartir lanza AbortError. Es una decisión del
        // usuario, no un fallo: no hay que avisarle de nada.
        if (err?.name !== 'AbortError' && !/cancel/i.test(err?.message || '')) {
          console.log('Error sharing:', err);
        }
      } finally {
        setIsSharing(false);
      }
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,15,0.98)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out', width: '100%', maxWidth: '400px' }}>
          
          <div ref={shareCardRef} style={{ padding: '30px 20px', backgroundColor: '#0a0a0f', borderRadius: '20px', marginBottom: '20px', border: '1px solid rgba(212,175,55,0.2)' }}>
            <Trophy size={80} color="var(--accent-gold)" style={{ margin: '0 auto 20px auto', filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.6))' }} />
            <h1 className="gold-gradient-text" style={{ fontSize: '2.5rem', marginBottom: '5px' }}>¡Día Completado!</h1>
            <p style={{ color: 'var(--accent-gold)', fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {diaInfo.dia_numero}/21 Reto Vigor 21
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontStyle: 'italic', margin: 0 }}>
              "{getMensajeVigor(diaInfo?.dia_numero)}"
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button 
              onClick={handleShare}
              disabled={isSharing}
              style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--accent-gold)', background: 'transparent', color: 'var(--accent-gold)', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: isSharing ? 0.5 : 1 }}>
              <Share2 size={20} /> {isSharing ? 'Generando imagen...' : 'Compartir mi progreso'}
            </button>
            <button 
              onClick={() => onComplete(isFinished)}
              className="btn-primary"
              style={{ width: '100%', padding: '15px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold' }}>
              Ir a mi Misión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0f', zIndex: 9999, overflowY: 'auto', overscrollBehavior: 'none' }}>
      {/* HEADER STICKY */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(15px)', padding: '65px 20px 15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Día {diaInfo.dia_numero}</h2>
            <p style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>{diaInfo.enfoque}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
        
        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${totalProgress}%`, height: '100%', backgroundColor: 'var(--accent-gold)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 10px rgba(212,175,55,0.5)' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>Ronda {rondaActual} de {totalRondas}</span>
          <span style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 'bold' }}>{Math.round(totalProgress)}% Completado</span>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px', paddingBottom: '250px' }}>
        
        {/* TIMER & PROTOCOL */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '16px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 5px 0', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 'bold' }}>Protocolo</p>
            <p style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>{diaInfo.trabajo_descanso}</p>
          </div>
          
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <Timer size={18} color="var(--accent-gold)" />
              <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatTime(time)}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setTimerRunning(!timerRunning)}
                style={{ background: timerRunning ? 'rgba(255,0,0,0.2)' : 'rgba(68, 189, 50, 0.2)', color: timerRunning ? '#ff4757' : '#44bd32', border: 'none', padding: '5px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}
              >
                {timerRunning ? 'PAUSA' : 'INICIAR'}
              </button>
              <button 
                onClick={() => { setTimerRunning(false); setTime(0); }}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '5px', borderRadius: '8px' }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Botones de Playlists */}
        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Pon tu música</h4>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <a 
            href="https://music.youtube.com/playlist?list=PL0NvLXoUW8MHugzJXCjgF5JxG8aDXBmYK&si=Tjq_Q7sP8f7YHXNq" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: 'rgba(255, 71, 87, 0.1)', borderRadius: '12px', color: '#ff4757', border: '1px solid rgba(255, 71, 87, 0.2)', textDecoration: 'none', gap: '5px' }}
          >
            <PlayCircle size={22} />
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>YouTube</span>
          </a>
          
          <a 
            href="https://open.spotify.com/playlist/06g9W4J1QWImvl0DX0Kb1x?si=sXPAxKm1QwaWP42ujBR37A&pi=FN7mXw1oTnCFZ" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: 'rgba(30, 215, 96, 0.1)', borderRadius: '12px', color: '#1ed760', border: '1px solid rgba(30, 215, 96, 0.2)', textDecoration: 'none', gap: '5px' }}
          >
            <Music size={22} />
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Spotify</span>
          </a>

          <a 
            href="https://music.youtube.com/watch?v=iAsWd4VTLnI&si=V9KYtOyxlg8bYm-5" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: '12px', color: 'var(--accent-gold)', border: '1px solid rgba(212, 175, 55, 0.2)', textDecoration: 'none', gap: '5px' }}
          >
            <Zap size={22} />
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Vigor</span>
          </a>
        </div>

        <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Lista de Ejercicios
        </h3>
        
        {/* EXERCISE LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
          {ejercicios.map((ej, idx) => {
            const isChecked = ejerciciosMarcados[idx];
            return (
              <div 
                key={idx} 
                onClick={() => toggleEjercicio(idx)}
                style={{ 
                  backgroundColor: isChecked ? 'rgba(212, 175, 55, 0.08)' : 'rgba(255,255,255,0.03)', 
                  border: isChecked ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: '16px', 
                  padding: '18px', 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isChecked ? 0.7 : 1
                }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  backgroundColor: isChecked ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  flexShrink: 0, transition: 'all 0.3s ease'
                }}>
                  {isChecked ? <CheckCircle size={20} color="black" /> : <span style={{ color: '#888', fontWeight: 'bold', fontSize: '0.9rem' }}>{idx + 1}</span>}
                </div>
                <div style={{ color: isChecked ? '#aaa' : '#fff', lineHeight: '1.4', fontSize: '1rem', transition: 'all 0.3s ease', textDecoration: isChecked ? 'line-through' : 'none' }}>
                  {ej}
                </div>
              </div>
            );
          })}
        </div>

        {/* RONDA CONTROLS */}
        {rondaCompletada && rondaActual < totalRondas && (
          <div style={{ animation: 'fadeIn 0.5s', marginBottom: '30px' }}>
            <button 
              onClick={avanzarRonda}
              className="btn-secondary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', borderColor: 'var(--accent-gold)' }}
            >
              AVANZAR A RONDA {rondaActual + 1} <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* HABITOS SECTION */}
        {rondasTerminadas && (
          <div style={{ animation: 'fadeIn 0.8s', marginBottom: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.3rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Hábitos Diarios</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>Veta & Vigor confía en ti. Sé honesto con tus registros, el verdadero premio es tu transformación.</p>
              <p style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', marginTop: '5px', fontWeight: 'bold' }}>¡Entre más puntos tengas, más boletos para el sorteo final!</p>
            </div>

            {/* Agua */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '15px', marginBottom: '15px' }}>
              <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplet size={18} color="#3498db" /> ¿Cuánta agua tomaste hoy?
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['0', '1', '2'].map((val) => {
                  const labels = {'0': '< 1 L', '1': '1-2 L', '2': '+ 2 L'};
                  const isSel = agua === val;
                  return (
                    <button key={val} onClick={() => setAgua(val)} style={{ flex: 1, padding: '10px', backgroundColor: isSel ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255,255,255,0.05)', border: isSel ? '1px solid #3498db' : '1px solid transparent', color: isSel ? '#3498db' : '#aaa', borderRadius: '10px', fontWeight: 'bold', transition: 'all 0.2s' }}>
                      {labels[val]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sueño */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '15px', marginBottom: '15px' }}>
              <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Moon size={18} color="#9b59b6" /> ¿Cuántas horas dormiste?
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['5', '6', '8'].map((val) => {
                  const labels = {'5': '< 5 h', '6': '6-7 h', '8': '+ 8 h'};
                  const isSel = sueno === val;
                  return (
                    <button key={val} onClick={() => setSueno(val)} style={{ flex: 1, padding: '10px', backgroundColor: isSel ? 'rgba(155, 89, 182, 0.2)' : 'rgba(255,255,255,0.05)', border: isSel ? '1px solid #9b59b6' : '1px solid transparent', color: isSel ? '#9b59b6' : '#aaa', borderRadius: '10px', fontWeight: 'bold', transition: 'all 0.2s' }}>
                      {labels[val]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comida */}
            <div onClick={() => setComidaSana(!comidaSana)} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: comidaSana ? '1px solid #2ecc71' : '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '15px', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Apple size={20} color={comidaSana ? '#2ecc71' : '#aaa'} />
                <span style={{ color: comidaSana ? 'white' : '#aaa', fontWeight: 'bold' }}>Comí saludable hoy</span>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: comidaSana ? '#2ecc71' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {comidaSana && <CheckCircle size={16} color="black" />}
              </div>
            </div>

            {/* Foto Post-Entreno */}
            <div style={{ backgroundColor: 'rgba(212,175,55,0.05)', border: '1px dashed var(--accent-gold)', borderRadius: '16px', padding: '20px', textAlign: 'center', position: 'relative' }}>
              <p style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 5px 0' }}>Sube tu Foto Post-Entreno 📸</p>
              <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 15px 0' }}>Obligatoria si quieres ganar las paralelas. ¡Suda y demuestra!</p>
              
              {fotoPreview ? (
                <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
                  <img src={fotoPreview} alt="Post entreno" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => {setFotoFile(null); setFotoPreview(null);}} style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', padding: '5px', borderRadius: '50%' }}>
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleTakePhoto}
                  style={{ backgroundColor: 'rgba(212,175,55,0.2)', border: 'none', color: 'var(--accent-gold)', padding: '15px 30px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 auto' }}
                >
                  <CameraIcon size={20} /> ABRIR CÁMARA
                </button>
              )}
              {/* Fallback file input for when Camera plugin fails */}
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
              />
            </div>
          </div>
        )}

        <button 
          onClick={handleCompletar}
          disabled={loading || !retoListoParaCompletar}
          className="btn-primary" 
          style={{ 
            width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            opacity: retoListoParaCompletar ? 1 : 0.5,
            filter: retoListoParaCompletar ? 'drop-shadow(0 0 15px rgba(212,175,55,0.4))' : 'none'
          }}
        >
          {loading ? 'GUARDANDO...' : (
            <>
              {retoListoParaCompletar ? <CheckCircle size={20} /> : <X size={20} />}
              {retoListoParaCompletar ? 'COMPLETAR DÍA' : (rondasTerminadas ? 'COMPLETA TUS HÁBITOS' : 'COMPLETA TUS RONDAS')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
