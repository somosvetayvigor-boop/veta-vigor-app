import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Share2, ArrowLeft, Gem, Users, CircleDollarSign, Info, Target } from 'lucide-react';

export default function MisGanancias({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({});
  const [dbData, setDbData] = useState({
    codigo_referido: '',
    referidos_count: 0,
    ganancias: 0,
    comision_personalizada: null
  });

  useEffect(() => {
    fetchGanancias();
  }, [session]);

  const fetchGanancias = async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('codigo_referido, referidos_count, ganancias, comision_personalizada')
        .eq('id', session?.user.id)
        .single();

      if (!error && data) {
        if (data.codigo_referido) {
          setDbData(data);
        } else {
          // Nadie generó su código todavía -- se pide al servidor que lo
          // cree y se guarde de verdad, en vez de mostrar uno inventado al
          // vuelo que nunca queda persistido (así era antes).
          const { data: nuevoCodigo, error: genError } = await supabase.rpc('generar_mi_codigo_referido');
          if (!genError && nuevoCodigo) {
            setDbData({ ...data, codigo_referido: nuevoCodigo });
          } else {
            console.warn('No se pudo generar el código de referido:', genError);
            setDbData(data);
          }
        }
      }
      setMeta(session?.user?.user_metadata || {});
    } catch (err) {
      console.error("Error fetching ganancias:", err);
    } finally {
      setLoading(false);
    }
  };

  const shareCode = async () => {
    const defaultCode = dbData.codigo_referido || `VETA-${session?.user.user_metadata?.username || 'VIGOR'}`.toUpperCase().substring(0,10);
    const textToShare = `¡Únete a Veta & Vigor! Usa mi código de referido ${defaultCode} al registrarte y construyamos nuestra mejor versión juntos.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Veta & Vigor',
          text: textToShare,
          url: 'https://app.vetayvigor.com'
        });
      } catch (err) {
        console.log("Error al compartir", err);
      }
    } else {
      navigator.clipboard.writeText(textToShare);
      alert('¡Código copiado al portapapeles!');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{ fontSize: '3rem' }}></i></div>;
  }

  // --- Lógica de Niveles de Comisión ---
  const count = dbData.referidos_count || 0;
  let currentTier = "Base";
  let currentCommission = 10;
  let nextGoal = 6;
  let nextCommission = 15;
  let progressText = "";
  
  if (dbData.comision_personalizada && dbData.comision_personalizada > 0) {
    currentTier = "Influencer VIP";
    currentCommission = dbData.comision_personalizada;
    nextGoal = null;
  } else {
    if (count < 6) {
      currentTier = "Base";
      currentCommission = 10;
      nextGoal = 6;
      nextCommission = 15;
      progressText = `Faltan ${6 - count} referidos para subir al ${nextCommission}%`;
    } else if (count >= 6 && count < 16) {
      currentTier = "Pro";
      currentCommission = 15;
      nextGoal = 16;
      nextCommission = 20;
      progressText = `Faltan ${16 - count} referidos para subir al ${nextCommission}%`;
    } else {
      currentTier = "Élite";
      currentCommission = 20;
      nextGoal = null;
      progressText = "¡Has alcanzado el nivel máximo de comisiones!";
    }
  }

  // Calculate progress bar percentage
  let progressPercentage = 100;
  if (nextGoal !== null) {
    let lowerBound = 0;
    if (currentTier === "Pro") lowerBound = 6;
    progressPercentage = ((count - lowerBound) / (nextGoal - lowerBound)) * 100;
  }

  const defaultCode = dbData.codigo_referido || `VETA-${meta.username || 'VIGOR'}`.toUpperCase().substring(0,10);

  return (
    <div style={{ paddingBottom: '100px', backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#111', position: 'sticky', top: '0px', zIndex: 10 }}>
        <button onClick={() => navigate('/perfil')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px', marginRight: '10px' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Mis Ganancias</h2>
      </div>

      <div className="container" style={{ padding: '20px' }}>
        
        {/* WELCOME BANNER */}
        <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '10px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', border: '1px solid var(--accent-gold)' }}>
            <Gem size={30} color="var(--accent-gold)" />
          </div>
          <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Socio Fundador Vitalicio</h1>
          <p style={{ color: '#ccc', margin: 0, lineHeight: '1.5' }}>Comparte tu código de referido y haz crecer tus ganancias pasivas dentro de la Tribu V&V.</p>
        </div>

        {/* METRICS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(145deg, #15151a 0%, #1a1a24 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Users size={24} color="#888" style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>Referidos</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{count}</div>
          </div>
          
          <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <CircleDollarSign size={24} color="var(--accent-gold)" style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '5px' }}>Ganancias</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
              <span style={{ fontSize: '1rem', color: '#aaa', marginRight: '2px' }}>$</span>
              {dbData.ganancias ? Number(dbData.ganancias).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        {/* GAMIFICATION / TIERS TIER PROGRESS */}
        <div className="card" style={{ padding: '20px', marginBottom: '25px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '5px 10px', background: 'var(--accent-gold)', color: '#000', fontSize: '0.7rem', fontWeight: 'bold', borderBottomLeftRadius: '10px' }}>
            Nivel {currentTier}
          </div>
          
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={20} color="var(--accent-gold)" /> Tu Nivel de Comisión: <span className="gold-gradient-text" style={{ fontSize: '1.4rem' }}>{currentCommission}%</span>
          </h3>

          <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ 
              width: `${progressPercentage}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #D4AF37 0%, #FFD700 100%)',
              borderRadius: '6px',
              transition: 'width 1s ease-in-out'
            }}></div>
          </div>
          
          {nextGoal !== null ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>{progressText}</span>
              <strong style={{ color: '#fff' }}>{nextGoal} Ref.</strong>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#78e08f', fontWeight: 'bold' }}>
              {progressText}
            </p>
          )}
        </div>

        {/* SHARE CODE SECTION */}
        <div className="card" style={{ padding: '25px 20px', textAlign: 'center', marginBottom: '25px', border: '1px dashed rgba(212, 175, 55, 0.4)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px' }}>Tu Código Exclusivo:</p>
          <div style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '2px', color: '#fff', marginBottom: '20px', userSelect: 'all' }}>
            {defaultCode}
          </div>
          
          <button 
            onClick={shareCode}
            className="btn-primary"
            style={{ width: '100%', padding: '15px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <Share2 size={20} /> Compartir mi código
          </button>
        </div>

        {/* FAQs */}
        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} color="var(--accent-gold)" /> ¿Cómo funciona?
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid var(--accent-gold)' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '0.95rem' }}>Estructura de Escalones</h4>
            <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem', lineHeight: '1.5' }}>
              • <strong>1 a 5 referidos:</strong> Ganas el 10%<br/>
              • <strong>6 a 15 referidos:</strong> Ganas el 15%<br/>
              • <strong>16+ referidos:</strong> Ganas el 20%<br/>
              Recibes este porcentaje de cada pago que realicen tus referidos activos.
            </p>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid #78e08f' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '0.95rem' }}>Registro Automático</h4>
            <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Cada vez que un nuevo usuario se registra colocando tu código en la App, queda vinculado a tu cuenta para siempre.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid #888' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '0.95rem' }}>Reflejo de Ganancias</h4>
            <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Tus ganancias se registran y validan en esta sección una vez que se acredita exitosamente el pago de la membresía (Argentum, Aurum o Platinum) de tus referidos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
