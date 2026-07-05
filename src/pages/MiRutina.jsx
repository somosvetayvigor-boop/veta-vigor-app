import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader, PlayCircle, CalendarDays, Coffee, Edit3, X, ChevronRight, Music, Zap, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpedienteModal from '../components/ExpedienteModal';
import DescansoActivoModal from '../components/DescansoActivoModal';

export default function MiRutina({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [semana, setSemana] = useState([]);
  const [todasRutinas, setTodasRutinas] = useState([]);
  const [customCal, setCustomCal] = useState({});
  const [allCalendarios, setAllCalendarios] = useState({});
  const [diasEntrenadosSemana, setDiasEntrenadosSemana] = useState(0);
  const [totalEntrenamientos, setTotalEntrenamientos] = useState(0);
  const [ultimoEntrenamiento, setUltimoEntrenamiento] = useState(null);

  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  
  // Novedades / Explora
  const [articulos, setArticulos] = useState([]);
  const [diaToChange, setDiaToChange] = useState(null);
  const [rutinasCompatibles, setRutinasCompatibles] = useState([]);
  const [showDescanso, setShowDescanso] = useState(false);

  // Estado para forzar Expediente
  const [showExpediente, setShowExpediente] = useState(false);

  useEffect(() => {
    async function init() {
      if (navigator.onLine) {
        const { processOfflineQueue } = await import('../utils/OfflineManager');
        const syncCount = await processOfflineQueue();
        if (syncCount && syncCount > 0) {
          console.log(`Se sincronizaron ${syncCount} elementos pendientes.`);
        }
      }
      checkTodayStatus();
    }
    init();
  }, []);

  const checkTodayStatus = async () => {
    try {
      if (!navigator.onLine) {
        // Modo offline: Asumimos que ya hizo checkin o saltamos la comprobación
        // para que pueda ver sus rutinas descargadas en caché
        setHasCheckedInToday(true);
        await loadRutinas();
        return;
      }

      const today = new Date();
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      const { data, error } = await supabase
        .from('checkins')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('fecha', todayStr)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; 
      
      if (data) {
        setHasCheckedInToday(true);
      }
      await loadRutinas();
    } catch (error) {
      console.error("Error fetching checkin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRutinas = async () => {
    try {
      const metadata = session.user.user_metadata;
      let nivel = metadata?.nivel;
      const sistemaId = metadata?.sistema_activo;
      const dias = metadata?.dias_entrenamiento || '>3';

      // 0. Fetch Real Subscription
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('plan_membresia, calendario_personalizado')
        .eq('id', session.user.id)
        .single();
        
      const suscripcionReal = perfilData?.plan_membresia || metadata?.suscripcion || metadata?.plan_membresia;
      const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
      const hasPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(suscripcionReal);
      const isFreeUser = !isAdmin && !hasPaidPlan;

      // Si es usuario gratis, solo le corresponde la rutina de regalo (Semilla)
      if (isFreeUser && nivel && !['Semilla', 'General'].includes(nivel)) {
        nivel = 'Semilla';
      }

      if (!nivel || !sistemaId) return;

      const cacheKey = `veta_vigor_mis_datos_${sistemaId}`;

      // 1. Intentar cargar de caché si estamos offline
      if (!navigator.onLine) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setTodasRutinas(parsed.todasRutinas || []);
          setCustomCal(parsed.customCal || {});
          setAllCalendarios(parsed.allCalendarios || {});
          setDiasEntrenadosSemana(parsed.diasEntrenadosSemana || 0);
          buildCalendar(parsed.todasRutinas || [], dias, parsed.customCal || {});
        }
        return;
      }

      // Calcular inicio de semana (Lunes)
      const now = new Date();
      const day = now.getDay() || 7; 
      const startOfWeek = new Date(now);
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
      startOfWeek.setHours(0,0,0,0);

      // Traer historial de la semana para el semáforo
      const { data: historial } = await supabase
        .from('historial_entrenamientos')
        .select('created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', startOfWeek.toISOString());

      const trainedDays = historial ? new Set(historial.map(h => h.created_at.split('T')[0])).size : 0;
      setDiasEntrenadosSemana(trainedDays);

      // Traer historial total para la tarjeta de nivel
      const { data: historialTotal } = await supabase
        .from('historial_entrenamientos')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (historialTotal && historialTotal.length > 0) {
        const uniqueDays = new Set(historialTotal.map(h => h.created_at.split('T')[0]));
        setTotalEntrenamientos(uniqueDays.size);
        setUltimoEntrenamiento(historialTotal[0].created_at);
      }

      // 2. Cargar preferencias guardadas (calendario personalizado)

      const allCals = perfilData?.calendario_personalizado || {};
      setAllCalendarios(allCals);
      
      const savedCustomCal = allCals[sistemaId] || {};
      setCustomCal(savedCustomCal);

      // 3. Cargar rutinas
      const { data, error } = await supabase
        .from('rutinas')
        .select('*')
        .eq('nivel', nivel)
        .eq('sistema_id', sistemaId)
        .order('nombre');

      if (error) throw error;
      
      setTodasRutinas(data);
      buildCalendar(data, dias, savedCustomCal);

      // Guardar en caché
      localStorage.setItem(cacheKey, JSON.stringify({ 
        todasRutinas: data || [], 
        customCal: savedCustomCal, 
        allCalendarios: allCals,
        diasEntrenadosSemana: trainedDays
      }));

      // Cargar artículos de explora
      const { data: artData } = await supabase
        .from('articulos_explora')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: false });
      if (artData) setArticulos(artData);

    } catch (error) {
      console.error("Error loading rutinas:", error);
    }
  };

  const buildCalendar = (rutinas, dias, custom) => {
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
      const sistemaId = session.user.user_metadata?.sistema_activo;
      const newCustomCal = { ...customCal, [diaToChange]: rutinaId };
      const updatedDB = { ...allCalendarios, [sistemaId]: newCustomCal };
      
      const { error } = await supabase
        .from('perfiles')
        .update({ calendario_personalizado: updatedDB })
        .eq('id', session.user.id);
        
      if (error) throw error;
      
      setCustomCal(newCustomCal);
      setAllCalendarios(updatedDB);
      
      // Rebuild ui
      const dias = session.user.user_metadata?.dias_entrenamiento || '>3';
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

      if (!navigator.onLine) {
        const { addToOfflineQueue } = await import('../utils/OfflineManager');
        addToOfflineQueue('INSERT_CHECKIN', { user_id: session.user.id, nivel: disposicion, fecha: todayStr });
        setHasCheckedInToday(true);
        return;
      }

      const { error } = await supabase
        .from('checkins')
        .insert([
          { user_id: session.user.id, nivel: disposicion, fecha: todayStr }
        ]);

      if (error) throw error;
      setHasCheckedInToday(true);
    } catch (error) {
      console.error("Error saving checkin:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading && semana.length === 0) {
    return <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}><Loader className="fa-spin gold-gradient-text" size={40} /></div>;
  }

  const nivel = session.user.user_metadata?.nivel || "Asignado";

  if (!hasCheckedInToday) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--bg-dark)', zIndex: 999, 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        overflowY: 'auto', padding: '20px', paddingTop: '80px'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '25px 20px', position: 'relative' }}>
          
          {saving && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '16px' }}>
              <Loader className="fa-spin gold-gradient-text" size={40} />
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
          </div>
        </div>
      </div>
    );
  }

  // --- Renderizado del Semáforo ---
  const renderSemaforo = () => {
    const metaStr = session.user.user_metadata?.dias_entrenamiento || '>3';
    const goalDays = metaStr === '3' ? 3 : 4;
    
    let color = '#e55039'; // Rojo por defecto
    let mensaje = '¡Arranca tu semana!';

    if (goalDays === 3) {
      if (diasEntrenadosSemana === 0) { color = '#e55039'; mensaje = 'Sin actividad'; }
      else if (diasEntrenadosSemana === 1) { color = '#f6b93b'; mensaje = '1 de 3 días'; } // Amarillo
      else if (diasEntrenadosSemana === 2) { color = '#f6b93b'; mensaje = '2 de 3 días'; } // Amarillo
      else if (diasEntrenadosSemana >= 3) { color = '#78e08f'; mensaje = '¡Meta Alcanzada!'; } // Verde
    } else {
      if (diasEntrenadosSemana === 0) { color = '#e55039'; mensaje = 'Sin actividad'; }
      else if (diasEntrenadosSemana === 1) { color = '#fa8231'; mensaje = '1 de 4 días'; } // Naranja
      else if (diasEntrenadosSemana === 2) { color = '#f6b93b'; mensaje = '2 de 4 días'; } // Amarillo
      else if (diasEntrenadosSemana === 3) { color = '#f6b93b'; mensaje = '3 de 4 días'; } // Amarillo
      else if (diasEntrenadosSemana >= 4) { color = '#78e08f'; mensaje = '¡Meta Alcanzada!'; } // Verde
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
      { text: "Ningún ciudadano tiene derecho a ser un aficionado en el entrenamiento físico. Qué desgracia es para un hombre envejecer sin ver la belleza y la fuerza de la que su cuerpo es capaz.", author: "Sócrates" },
      { text: "El descanso no es la pausa del progreso, es el taller silencioso donde la fuerza se asienta y el cuerpo se reconstruye.", author: "VETA & VIGOR" },
      { text: "El dolor de la disciplina pesa onzas, el dolor del arrepentimiento pesa toneladas. Tú eliges qué peso levantar hoy.", author: "Jim Rohn" },
      { text: "El árbol más fuerte no crece en un ambiente controlado; desarrolla su mejor madera bajo los vientos más duros.", author: "VETA & VIGOR" },
      { text: "Aquel que conquista a los demás es fuerte; pero aquel que se conquista a sí mismo y domina su propio peso, es verdaderamente poderoso.", author: "Lao Tse" },
      { text: "No somos lo que hacemos de vez en cuando, somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, es un hábito.", author: "Aristóteles" },
      { text: "La madera revela su verdadera veta al ser trabajada; el atleta revela su verdadero vigor al ser probado.", author: "Filosofía V&V" }
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
    const nivelName = session.user.user_metadata?.nivel || 'Semilla';
    const cicloActual = parseInt(session.user.user_metadata?.ciclo_entrenamientos) || 0;
    const frecuencia = session.user.user_metadata?.dias_entrenamiento || '>3';
    const metaCiclo = frecuencia === '3' ? 18 : 24;
    
    // Obtener la fuerza máxima real guardada por la calculadora de 1RM
    const fuerzaSup = parseFloat(session.user.user_metadata?.fuerza_tren_superior) || 0;
    const fuerzaInf = parseFloat(session.user.user_metadata?.fuerza_tren_inferior) || 0;
    const fuerzaMaxima = Math.max(fuerzaSup, fuerzaInf);
    const fuerzaMaximaStr = fuerzaMaxima > 0 ? `${fuerzaMaxima.toFixed(2)} KG` : 'Sin registros';
    
    // Formatear la fecha del último entrenamiento
    let ultimaFechaStr = "Aún no hay registros";
    if (ultimoEntrenamiento) {
      const dateObj = new Date(ultimoEntrenamiento);
      const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
      ultimaFechaStr = dateObj.toLocaleDateString('es-ES', opciones);
    }

    return (
      <div className="card" style={{ marginBottom: '20px', padding: '15px 20px', background: 'linear-gradient(145deg, #15151a 0%, #1a1a24 100%)', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Tu Nivel 💪 <span className="gold-gradient-text">{nivelName}</span> 💥
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e0e0e0', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚡</span> 
            <span style={{ color: 'var(--text-muted)' }}>Ultimo Entrenamiento:</span> 
            <strong style={{ color: '#fff' }}>{ultimaFechaStr}</strong>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>⚡</span> 
              <span style={{ color: 'var(--text-muted)' }}>Ciclo de nivel:</span> 
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

  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const suscripcion = session?.user?.user_metadata?.suscripcion || session?.user?.user_metadata?.plan_membresia;
  
  const esVIP = isAdmin ||
                ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'].includes(suscripcion);

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '15px', marginTop: '20px', textAlign: 'center' }}>Mi Calendario</h1>
      
      {esVIP && renderFraseDelDia()}
      {esVIP && renderStatsCard()}
      
      {esVIP && renderSemaforo()}
      
      {/* Botones de Playlists */}
      {esVIP && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
          <a 
            href="https://music.youtube.com/playlist?list=PL0NvLXoUW8MHugzJXCjgF5JxG8aDXBmYK&si=Tjq_Q7sP8f7YHXNq" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#2a1416', borderRadius: '12px', color: '#ff4757', textDecoration: 'none', gap: '5px' }}
          >
            <PlayCircle size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>YouTube</span>
          </a>
          
          <a 
            href="https://open.spotify.com/playlist/06g9W4J1QWImvl0DX0Kb1x?si=sXPAxKm1QwaWP42ujBR37A&pi=FN7mXw1oTnCFZ" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#132c1c', borderRadius: '12px', color: '#1ed760', textDecoration: 'none', gap: '5px' }}
          >
            <Music size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Spotify</span>
          </a>

          <a 
            href="https://music.youtube.com/watch?v=iAsWd4VTLnI&si=V9KYtOyxlg8bYm-5" 
            target="_blank" 
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 5px', backgroundColor: '#2a2615', borderRadius: '12px', color: 'var(--accent-gold)', textDecoration: 'none', gap: '5px' }}
          >
            <Zap size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Vigor</span>
          </a>
        </div>
      )}

      {/* Banner Descanso Activo */}
      {esVIP && (
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.9rem' }}>
            Descanso Activo Click en la imagen 👇
          </p>
          <div 
            onClick={() => navigate('/descanso')}
            style={{ 
              width: '100%', 
              height: '140px', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.05)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <img 
              src="/assets/descanso/banner.png" 
              alt="Descanso Activo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '15px'
            }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>Protocolos de Recuperación</span>
            </div>
          </div>
        </div>
      )}

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
              Cambiar Rutina
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
            </div>
          </div>
        </div>
      )}


      {/* Calendario UI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <CalendarDays size={28} color="var(--accent-gold)" />
        <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: 0 }}>Tu Calendario V&V</h1>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        Nivel <strong>{nivel}</strong>. Aquí tienes la estructura óptima para tu semana. Sigue el orden de los días.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        {semana.length === 0 ? (
          <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
            {!esVIP ? (
              <>
                <Lock size={40} color="var(--accent-gold)" style={{ marginBottom: '15px' }} />
                <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Tu Calendario está Bloqueado</h3>
                <p style={{ color: 'var(--text-muted)' }}>Para seguir un plan de entrenamiento completo y registrar tu progreso, adquiere una membresía VIP.</p>
                <button onClick={() => navigate('/sistemas')} className="btn-primary" style={{ marginTop: '15px' }}>
                  Ir a Sistemas para ver mi Rutina de Regalo
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
                <div key={index} className="card" style={{ padding: '15px 20px', borderLeft: '4px solid #444', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Coffee size={20} color="#888" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 3px 0', color: '#aaa', fontSize: '0.95rem' }}>Día {index + 1}</h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>{dia.nombre}</p>
                  </div>
                </div>
              );
            }

            const handleEnterRoutine = (id) => {
              const meta = session.user.user_metadata || {};
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
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.15rem', color: '#fff' }}>{dia?.nombre || 'Rutina'}</h3>
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
