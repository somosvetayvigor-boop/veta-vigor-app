import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft, Lock, Unlock, CheckCircle, Flame, Clock, Trophy } from 'lucide-react';
import RutinaRetoPlayer from '../components/RutinaRetoPlayer';
import html2canvas from 'html2canvas';

const START_DATE = new Date('2026-08-10T00:00:00');

const CountdownTimer = ({ startDate }) => {
  const [timeLeft, setTimeLeft] = useState(startDate.getTime() - new Date().getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(startDate.getTime() - new Date().getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  if (timeLeft <= 0) return null;

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#1a1a1e', border: '1px solid var(--accent-gold)', borderRadius: '10px', padding: '10px 12px', fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
          {days.toString().padStart(2, '0')}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '8px', textTransform: 'uppercase' }}>Días</div>
      </div>
      <div style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', marginTop: '10px' }}>:</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#1a1a1e', border: '1px solid var(--accent-gold)', borderRadius: '10px', padding: '10px 12px', fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
          {hours.toString().padStart(2, '0')}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '8px', textTransform: 'uppercase' }}>Hrs</div>
      </div>
      <div style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', marginTop: '10px' }}>:</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#1a1a1e', border: '1px solid var(--accent-gold)', borderRadius: '10px', padding: '10px 12px', fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
          {minutes.toString().padStart(2, '0')}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '8px', textTransform: 'uppercase' }}>Min</div>
      </div>
      <div style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', marginTop: '10px' }}>:</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#1a1a1e', border: '1px solid var(--accent-gold)', borderRadius: '10px', padding: '10px 12px', fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
          {seconds.toString().padStart(2, '0')}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '8px', textTransform: 'uppercase' }}>Seg</div>
      </div>
    </div>
  );
};

export default function Reto21Dias({ session }) {
  const navigate = useNavigate();
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [reto, setReto] = useState(null);
  const [dias, setDias] = useState([]);
  
  const [playerDia, setPlayerDia] = useState(null); // When set, shows the player
  const [showVictoryModal, setShowVictoryModal] = useState(false); // Victory Modal
  
  const isPendingStart = START_DATE.getTime() > new Date().getTime();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Perfil
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session?.user.id)
        .single();
        
      if (perfilError) throw perfilError;
      setPerfil(perfilData);

      let activeRetoId = perfilData?.reto_activo_id || searchParams.get('retoId');
      
      if (!activeRetoId && perfilData) {
        // Find default Reto if not passed in query
        const { data: firstReto } = await supabase.from('retos').select('id').limit(1).single();
        if (firstReto) {
          activeRetoId = firstReto.id;
          searchParams.set('retoId', firstReto.id);
        } else {
          navigate('/');
          return;
        }
      }

      if (activeRetoId) {
        // 2 & 3. Fetch Reto and Dias in parallel
        const [retoResponse, diasResponse] = await Promise.all([
          supabase.from('retos').select('*').eq('id', activeRetoId).single(),
          supabase.from('reto_dias').select('*').eq('reto_id', activeRetoId).order('dia_numero', { ascending: true })
        ]);
        
        if (retoResponse.data) setReto(retoResponse.data);
        if (diasResponse.data) setDias(diasResponse.data || []);
      }
      
    } catch (err) {
      console.error("Error cargando reto:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          reto_activo_id: reto.id,
          reto_dia_actual: 1,
          reto_fecha_inicio: new Date().toISOString(),
          reto_completado: false,
          reto_ultimo_completado: null
        })
        .eq('id', session?.user.id);
        
      if (error) throw error;
      
      // Trigger inmediato de notificación de bienvenida (silent fail)
      try {
        fetch('/api/cron_reto21', { 
          method: 'POST', 
          headers: { 'Authorization': 'Bearer secret-vigor-21' } 
        }).catch(() => {});
      } catch (e) {}

      await fetchData(); // Recargar datos
    } catch (err) {
      console.error("Error al unirse al reto:", err);
      alert("Hubo un error al unirte al reto.");
    } finally {
      setEnrolling(false);
    }
  };

  const handlePlayerComplete = async (isFinished) => {
    setPlayerDia(null);
    if (isFinished) {
      if (!perfil.plan_membresia || perfil.plan_membresia === 'Atleta Base (Gratis)') {
        // Validar que hayan hecho al menos 18 días
        const { count } = await supabase
          .from('habitos_diarios')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', perfil.id)
          .not('dia_reto', 'is', null);

        if (count >= 18) {
          await supabase
            .from('perfiles')
            .update({ force_platinum_trial: true })
            .eq('id', perfil.id);
        }
      }
      setShowVictoryModal(true);
      fetchData(); // Reload progress and new plan
    } else {
      fetchData(); // Reload progress
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{ fontSize: '3rem' }}></i></div>;
  }

  // Pantalla de "Aceptar Reto"
  if (!perfil?.reto_activo_id) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '90px', textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ChevronLeft size={24} /> Volver
        </button>
        
        <Flame size={80} color="var(--accent-gold)" style={{ margin: '40px auto 20px auto', filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.4))' }} />
        <h1 className="gold-gradient-text" style={{ fontSize: '2.2rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>VIGOR 21 DÍAS</h1>
        <p style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '40px', lineHeight: '1.6' }}>
          Únete a la primera generación del Reto. Transforma tu cuerpo y tu mente en 21 días.
        </p>
        
        <button 
          onClick={handleEnroll} 
          disabled={enrolling}
          className="glowing-border-button" 
          style={{ width: '100%' }}
        >
          <div className="glowing-border-inner" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {enrolling ? 'INSCRIBIENDO...' : 'QUIERO INSCRIBIRME AL RETO'}
          </div>
        </button>
      </div>
    );
  }

  // Si está inscrito pero no ha empezado el reto y no es admin
  if (isPendingStart && session?.user?.email !== 'somos.vetayvigor@gmail.com') {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '90px', textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ChevronLeft size={24} /> Volver
        </button>
        
        <div ref={shareRef} style={{ background: '#0f0f13', padding: '20px 10px', borderRadius: '16px', marginBottom: '30px' }}>
          <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '20px', borderRadius: '50%', display: 'inline-block', margin: '20px auto' }}>
            <Clock size={60} color="var(--accent-gold)" />
          </div>
          
          <h1 style={{ fontSize: '1.8rem', marginBottom: '15px', color: 'white', fontWeight: 'bold' }}>¡Ya estás inscrito!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '30px', lineHeight: '1.5' }}>
            El reto se desbloqueará en:
          </p>

          <CountdownTimer startDate={START_DATE} />
          
          <div style={{ marginTop: '20px' }}>
            <h2 className="gold-gradient-text" style={{ fontSize: '1.5rem', fontWeight: '900', textTransform: 'uppercase' }}>VIGOR 21 DÍAS</h2>
            <p style={{ color: '#ccc', fontSize: '0.9rem' }}>Por Veta & Vigor</p>
          </div>
        </div>

        <p style={{ color: '#ccc', fontSize: '1.05rem', marginBottom: '25px', lineHeight: '1.5', fontStyle: 'italic', padding: '0 15px' }}>
          Mientras esperamos a que el reto se desbloquee, familiarízate con la app y compártelo con tus amigos.
        </p>

        <button 
          onClick={async () => {
            if (isSharing) return;
            setIsSharing(true);
            const shareData = {
              title: 'Veta & Vigor - Reto 21 Días',
              text: '¡Únete al Reto Vigor 21!',
              url: 'https://www.vetayvigor.com/reto-vigor21/'
            };
            try {
              if (shareRef.current) {
                const canvas = await html2canvas(shareRef.current, { backgroundColor: '#0f0f13', scale: 2 });
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const file = new File([blob], 'veta-vigor-reto.png', { type: 'image/png' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({ ...shareData, files: [file] });
                } else if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(shareData.url);
                  alert("¡Enlace copiado al portapapeles!");
                }
              }
            } catch (err) {
              console.error('Error al compartir', err);
              if (navigator.share) navigator.share(shareData).catch(()=>null);
            } finally {
              setIsSharing(false);
            }
          }}
          className="btn-primary" 
          disabled={isSharing}
          style={{ width: '100%', maxWidth: '300px', margin: '0 auto 30px auto', padding: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', borderRadius: '12px', fontSize: '1.1rem', opacity: isSharing ? 0.7 : 1 }}
        >
          {isSharing ? (
            <><i className="fa-solid fa-circle-notch fa-spin"></i> Generando imagen...</>
          ) : (
            <><i className="fa-solid fa-share-nodes"></i> Compartir Reto</>
          )}
        </button>

        <div style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(20,20,20,0.9) 100%)', border: '1px solid var(--accent-gold)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>¡Premios del Reto!</h3>
          <p style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Al participar y terminar el reto, podrás ganar unas <strong>Paralelas Veta & Vigor</strong> o una <strong>Suscripción Gratis</strong>. ¡Prepárate para darlo todo!
          </p>
        </div>
      </div>
    );
  }

  // Calculamos lógica de desbloqueo (Opción C)
  const isLockedToday = () => {
    if (session?.user?.email === 'somos.vetayvigor@gmail.com') return false; // Modo Dios Desbloqueo Infinito
    if (!perfil.reto_ultimo_completado) return false; // Nunca ha completado uno
    
    // Comparar fecha basada en el servidor UTC para evitar trampas de zona horaria
    const lastDate = new Date(perfil.reto_ultimo_completado).toISOString().split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
    return lastDate === todayDate;
  };
  
  const todayLocked = isLockedToday();
  const currentDayNum = perfil.reto_dia_actual;

  return (
    <div className="container" style={{ paddingTop: '20px', paddingBottom: '90px' }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={24} /> Volver al Inicio
      </button>

      <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>VIGOR 21 DÍAS: {perfil?.nivel}</h1>
      <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--accent-gold)', borderRadius: '10px', padding: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <Trophy size={20} color="var(--accent-gold)" />
        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '1px', textTransform: 'uppercase' }}>En busca del Atleta Vigor de la Temporada</span>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
        Día actual: {currentDayNum} de 21
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
        {dias.map((dia) => {
          const isCompleted = dia.dia_numero < currentDayNum;
          const isCurrent = dia.dia_numero === currentDayNum;
          const isLocked = dia.dia_numero > currentDayNum || (isCurrent && todayLocked);

          let bg = 'rgba(255,255,255,0.05)';
          let border = '1px solid rgba(255,255,255,0.1)';
          let icon = <Lock size={20} color="#666" />;
          let textColor = '#666';

          if (isCompleted) {
            bg = 'rgba(212, 175, 55, 0.1)';
            border = '1px solid var(--accent-gold)';
            icon = <CheckCircle size={20} color="var(--accent-gold)" />;
            textColor = 'var(--accent-gold)';
          } else if (isCurrent && !todayLocked) {
            bg = 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(20,20,20,0.9) 100%)';
            border = '1px solid var(--accent-gold)';
            icon = <Unlock size={20} color="white" />;
            textColor = 'white';
          } else if (isCurrent && todayLocked) {
             bg = 'rgba(255,255,255,0.02)';
             border = '1px dashed #666';
             icon = <Lock size={20} color="#888" />;
             textColor = '#888';
          }

          return (
            <div 
              key={dia.id}
              onClick={() => {
                if (session?.user?.email === 'somos.vetayvigor@gmail.com') {
                  setPlayerDia(dia); // Modo Dios: Abrir cualquier día
                  return;
                }
                if (isCurrent && !todayLocked) {
                  setPlayerDia(dia);
                } else if (isCurrent && todayLocked) {
                  alert("Ya completaste tu entrenamiento de hoy. ¡Vuelve mañana!");
                }
              }}
              style={{
                background: bg,
                border: border,
                borderRadius: '16px',
                padding: '20px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                cursor: (isCurrent && !todayLocked) ? 'pointer' : 'default',
                transition: 'all 0.2s',
                boxShadow: (isCurrent && !todayLocked) ? '0 0 15px rgba(212,175,55,0.2)' : 'none'
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: textColor }}>
                {dia.dia_numero}
              </div>
              {icon}
              {isCurrent && todayLocked && (
                <div style={{ fontSize: '0.6rem', color: '#888', textAlign: 'center', marginTop: '-5px' }}>Mañana</div>
              )}
            </div>
          );
        })}
      </div>

      {playerDia && (
        <RutinaRetoPlayer 
          diaInfo={playerDia} 
          perfil={perfil} 
          onClose={() => setPlayerDia(null)} 
          onComplete={handlePlayerComplete}
        />
      )}

      {showVictoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1a1a1e', border: '2px solid var(--accent-gold)', borderRadius: '20px', padding: '40px 20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 0 30px rgba(212,175,55,0.3)', animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <Trophy size={80} color="var(--accent-gold)" style={{ margin: '0 auto 20px auto', filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.5))' }} />
            <h2 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '15px', textTransform: 'uppercase', fontWeight: '900' }}>¡RETO COMPLETADO!</h2>
            <p style={{ color: 'white', fontSize: '1.1rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Felicidades por tu constancia. Acabamos de analizar tus métricas de las últimas 3 semanas para calcular tu posición en la tabla.
            </p>
            <p style={{ color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 'bold', marginBottom: '30px' }}>
              Mantente pendiente de la app para conocer al ganador oficial del reto... ¡Puedes ser tú!
            </p>
            {(!perfil.plan_membresia || perfil.plan_membresia === 'Atleta Base (Gratis)') && (
              <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--accent-gold)', borderRadius: '15px', padding: '20px', marginBottom: '30px' }}>
                <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold' }}>Tu recompensa instantánea:</p>
                <p style={{ color: 'var(--accent-gold)', fontSize: '1.3rem', margin: '0', fontWeight: '900' }}>7 DÍAS GRATIS PLATINUM</p>
                <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '10px 0 0 0' }}>Disfruta de acceso total mientras esperas los resultados.</p>
              </div>
            )}
            <button 
              onClick={() => {
                setShowVictoryModal(false);
                navigate('/');
              }} 
              className="glowing-border-button" 
              style={{ width: '100%' }}
            >
              <div className="glowing-border-inner" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {(!perfil.plan_membresia || perfil.plan_membresia === 'Atleta Base (Gratis)') ? 'RECLAMAR Y VOLVER' : 'VOLVER AL INICIO'}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
