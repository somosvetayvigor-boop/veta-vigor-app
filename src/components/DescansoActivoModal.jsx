import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Square, Share, Droplets, Wind, Activity, Pause } from 'lucide-react';

const BreathingAudioWidget = () => {
  const [phase, setPhase] = useState('RESPIRA');
  const [scale, setScale] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
       setScale(1);
       setPhase('RESPIRA');
       return;
    }

    const phases = [
      { text: 'INHALA', scale: 1.5 },
      { text: 'SOSTÉN', scale: 1.5 },
      { text: 'EXHALA', scale: 1 },
      { text: 'SOSTÉN', scale: 1 }
    ];
    let step = 0;
    
    setPhase(phases[0].text);
    setScale(phases[0].scale);

    const interval = setInterval(() => {
      step = (step + 1) % 4;
      setPhase(phases[step].text);
      setScale(phases[step].scale);
    }, 4000); // 4 seconds per phase

    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    let progressInterval;
    if (isPlaying) {
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 546) { // 9:06 = 546 seconds
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(progressInterval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatSecs = (total) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
      
      {/* Top Card - Breathing */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '16px',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.05)',
        minHeight: '280px'
      }}>
        <h3 style={{ color: 'var(--accent-gold)', letterSpacing: '2px', fontSize: '1rem', marginTop: 0, marginBottom: '40px' }}>RECUPERACIÓN</h3>
        
        <div style={{
          width: '120px', height: '120px',
          borderRadius: '50%',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.2)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'transform 4s linear, box-shadow 4s linear',
          transform: `scale(${scale})`,
          border: '2px solid rgba(212, 175, 55, 0.5)'
        }}>
          <span style={{ 
            color: 'var(--accent-gold)', 
            fontWeight: 'bold', 
            letterSpacing: '1px',
            transition: 'transform 4s linear',
            transform: `scale(${1/scale})` // keep text size constant
          }}>
            {phase}
          </span>
        </div>
      </div>

      {/* Bottom Card - Audio Player */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '16px',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h3 style={{ color: 'var(--accent-gold)', letterSpacing: '2px', fontSize: '1rem', marginTop: 0, marginBottom: '25px' }}>DESCANSO ABSOLUTO</h3>
        
        <button 
          onClick={togglePlay}
          style={{ 
            width: '70px', height: '70px', borderRadius: '50%', 
            backgroundColor: 'transparent', border: '2px solid var(--accent-gold)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
            marginBottom: '30px'
          }}
        >
          {isPlaying ? <Pause size={30} color="var(--accent-gold)" /> : <Play size={30} color="var(--accent-gold)" style={{ marginLeft: '4px' }} />}
        </button>

        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>{formatSecs(progress)}</span>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
            <div style={{ 
              position: 'absolute', top: 0, left: 0, bottom: 0, 
              backgroundColor: 'var(--accent-gold)', borderRadius: '2px',
              width: `${(progress / 546) * 100}%` 
            }} />
            <div style={{
              position: 'absolute', top: '-4px', width: '12px', height: '12px',
              backgroundColor: 'var(--accent-gold)', borderRadius: '50%',
              left: `calc(${(progress / 546) * 100}% - 6px)`
            }} />
          </div>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>9:06</span>
        </div>
      </div>
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" loop />
    </div>
  );
};

export default function DescansoActivoModal({ onClose }) {
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  
  // Timer state
  const [time, setTime] = useState(0); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('caminadora'); // for Caminata

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const protocolos = [
    {
      id: 'caminata',
      title: "Caminata Regenerativa 🚶‍♂️",
      desc: "45 minutos a paso ligero. La mejor herramienta para calmar el sistema nervioso.",
      img: "/assets/descanso/caminata.png",
      duration: 45,
      hasTabs: true,
      tabs: ['CAMINADORA', 'CALLE'],
      tips: {
        caminadora: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "TÉCNICA V&V", text: "Ajusta la caminadora al 10%-15% de inclinación y una velocidad de 4.5 a 5.5 km/h. Usa tus brazos y no te sostengas de los barandales." },
          { icon: <Wind size={18} color="#3498db" />, title: "ZONA 2 (ESFUERZO)", text: "Debes poder mantener una conversación fluida. Si puedes cantar, acelera el paso. Si te falta el aire al hablar, baja un poco el ritmo." }
        ],
        calle: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "TÉCNICA V&V", text: "Mantén un paso firme y constante. Busca un terreno plano o con una ligera inclinación constante." },
          { icon: <Wind size={18} color="#3498db" />, title: "ZONA 2 (ESFUERZO)", text: "Debes poder mantener una conversación fluida. Si te falta el aire, reduce la velocidad de tu paso." }
        ]
      }
    },
    {
      id: 'bicicleta',
      title: "Flush de Piernas (Bicicleta) 🚴‍♂️",
      desc: "30 minutos de pedaleo continuo sin resistencia pesada para oxigenar.",
      img: "/assets/descanso/bicicleta.png",
      duration: 30,
      hasTabs: true,
      tabs: ['ESTÁTICA', 'RUTA'],
      tips: {
        estática: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "CADENCIA: 75-90 RPM", text: "Ajusta la perilla de resistencia para sentir que empujas con fuerza constante, sin brincar en el asiento." },
          { icon: <Wind size={18} color="#3498db" />, title: "ZONA 2 (NIVEL DE ESFUERZO)", text: "Prueba del habla: Debes poder mantener una conversación fluida. Si puedes cantar, súbele a la intensidad. Si te falta el aire, bájale." }
        ],
        ruta: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "CADENCIA: 75-90 RPM", text: "Mantén un pedaleo fluido y constante. Usa los cambios de tu bicicleta para evitar hacer fuerza excesiva en las subidas." },
          { icon: <Wind size={18} color="#3498db" />, title: "ZONA 2 (NIVEL DE ESFUERZO)", text: "Prueba del habla: Debes poder mantener una conversación fluida. Si puedes cantar, súbele a la intensidad. Si te falta el aire, baja el ritmo." }
        ]
      }
    },
    {
      id: 'movilidad',
      title: "Protocolo de Movilidad 🧘‍♂️",
      desc: "15 a 20 minutos de fluidez articular para reconstruir y descomprimir.",
      img: "/assets/descanso/movilidad.png",
      duration: 20,
      hasTabs: false,
      tips: {
        default: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "TÉCNICA V&V", text: "Sostén cada postura entre 30 y 60 segundos. No rebotes, usa la respiración profunda para ganar rango de movimiento." },
          { icon: <Droplets size={18} color="#2ecc71" />, title: "FOCO PRINCIPAL", text: "Abre la cadera, estira los isquiosurales y descomprime la espalda baja. Evita llegar al dolor punzante." }
        ]
      }
    },
    {
      id: 'natacion',
      title: "Impacto Cero (Natación) 🏊‍♂️",
      desc: "20 minutos de nado libre para relajar activamente con movimiento suave.",
      img: "/assets/descanso/natacion.png",
      duration: 20,
      hasTabs: false,
      hasTimer: true,
      tips: {
        default: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "TÉCNICA V&V", text: "Nado estilo libre o pecho a un ritmo sumamente relajado. Concéntrate en deslizarte y estirarte en el agua." },
          { icon: <Wind size={18} color="#3498db" />, title: "GRAVEDAD CERO", text: "Aprovecha la flotabilidad para descomprimir la columna. Si tu ritmo cardíaco sube demasiado, tómate pausas en la orilla." }
        ]
      }
    },
    {
      id: 'absoluto',
      title: "Descanso Absoluto 🛏️",
      desc: "0 impacto, 100% recuperación. Hoy tu único trabajo es comer como un atleta, hidratarte y dormir profundo.",
      img: "/assets/descanso/absoluto.png",
      hasTabs: false,
      hasTimer: false,
      tips: {
        default: [
          { icon: <Activity size={18} color="var(--accent-gold)" />, title: "OBJETIVO", text: "0 impacto, 100% recuperación. Hoy tu único trabajo es comer como un atleta, hidratarte y dormir profundo." },
          { icon: <Droplets size={18} color="#3498db" />, title: "RECUERDA", text: "El músculo se destruye en el gimnasio, pero crece en la cama. No intentes compensar nada hoy." }
        ]
      }
    }
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '¡Recuperación V&V Completada!',
        text: `Acabo de completar mi ${selectedProtocol.title}. Modo Recuperación Activado 🔥`,
      }).catch(err => console.error(err));
    } else {
      alert("¡Tu victoria ha sido registrada en el sistema! (Función de compartir no soportada en este navegador)");
    }
  };

  if (selectedProtocol) {
    const tipsToRender = selectedProtocol.hasTabs 
      ? selectedProtocol.tips[activeTab.toLowerCase()] 
      : selectedProtocol.tips.default;

    return (
      <div style={{
        backgroundColor: '#0a0a0c',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        paddingBottom: '80px' // Espacio para el BottomNav
      }}>
        {/* Header Detalle */}
        <div style={{
          padding: 'calc(15px + env(safe-area-inset-top, 20px)) 20px 15px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          backgroundColor: '#0a0a0c',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0
        }}>
          <button 
            onClick={() => { setSelectedProtocol(null); setIsRunning(false); setTime(0); }}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{selectedProtocol.title}</h2>
        </div>

        {selectedProtocol.id === 'absoluto' ? (
          <BreathingAudioWidget />
        ) : (
          <>
            {/* Tabs (Si existen) */}
        {selectedProtocol.hasTabs && (
          <div style={{ display: 'flex', padding: '0 20px', gap: '10px', marginBottom: '20px' }}>
            {selectedProtocol.tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '25px',
                  border: activeTab === tab.toLowerCase() ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: activeTab === tab.toLowerCase() ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                  color: activeTab === tab.toLowerCase() ? 'var(--accent-gold)' : '#666',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Stopwatch Circular */}
        {selectedProtocol.hasTimer !== false && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
              <div style={{
                width: '140px', height: '140px',
                borderRadius: '50%',
                border: '4px solid var(--accent-gold)',
                boxShadow: '0 0 15px rgba(212, 175, 55, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative'
              }}>
                <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#fff', fontWeight: 'bold', lineHeight: 1 }}>
                  {formatTime(time)}
                </h1>
                <p style={{ color: 'var(--accent-gold)', margin: '5px 0 0 0', fontSize: '0.85rem' }}>
                  Meta: {selectedProtocol.duration} min
                </p>
              </div>
            </div>

            {/* Controles de Tiempo */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
              <button 
                onClick={() => { setIsRunning(false); setTime(0); }}
                style={{ 
                  width: '45px', height: '45px', borderRadius: '50%', 
                  backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' 
                }}
              >
                <Square size={18} color="#e74c3c" fill="#e74c3c" />
              </button>
              
              <button 
                onClick={() => setIsRunning(!isRunning)}
                style={{ 
                  width: '55px', height: '55px', borderRadius: '50%', 
                  backgroundColor: 'var(--accent-gold)', border: 'none', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
                  boxShadow: '0 5px 15px rgba(212, 175, 55, 0.4)'
                }}
              >
                {isRunning ? <Square size={20} color="#000" /> : <Play size={24} color="#000" style={{ marginLeft: '4px' }} />}
              </button>
            </div>
          </>
        )}

        {/* Compartir Victoria */}
        <div style={{ padding: '0 20px', marginBottom: '30px' }}>
          <button 
            onClick={handleShare}
            style={{ 
              width: '100%', padding: '15px', borderRadius: '12px', 
              backgroundColor: 'transparent', border: '1px solid var(--accent-gold)', 
              color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1rem',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
              cursor: 'pointer'
            }}
          >
            <Share size={20} /> COMPARTIR VICTORIA
          </button>
        </div>

        {/* Tips / Info */}
        <div style={{ padding: '0 20px 40px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {tipsToRender.map((tip, i) => (
            <div key={i} style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderRadius: '16px', 
              padding: '20px',
              borderLeft: '4px solid var(--accent-gold)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {tip.icon}
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', letterSpacing: '1px' }}>{tip.title}</h4>
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                {tip.text}
              </p>
            </div>
          ))}
        </div>

          </>
        )}
      </div>
    );
  }

  // Vista de Lista (Menú)
  return (
    <div style={{
      backgroundColor: '#0a0a0c',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      paddingBottom: '80px' // Espacio para el BottomNav
    }}>
      {/* Header General */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: 'calc(15px + env(safe-area-inset-top, 20px)) 20px 15px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 2
      }}>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Descanso Activo</h2>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '40px' }}>
        {protocolos.map((p) => (
          <div 
            key={p.id} 
            onClick={() => {
              setSelectedProtocol(p);
              if (p.hasTabs && p.tabs.length > 0) {
                setActiveTab(p.tabs[0].toLowerCase());
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{ 
              width: '100%', 
              height: '180px', 
              borderRadius: '12px', 
              overflow: 'hidden',
              backgroundColor: '#222',
              position: 'relative'
            }}>
              <img src={p.img} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.2)', transition: 'background-color 0.3s' 
              }} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {p.title}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {p.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
