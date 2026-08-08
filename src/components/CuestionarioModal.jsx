import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronRight, Target, Loader, Activity, ShieldCheck, Dumbbell, Calendar } from 'lucide-react';

const QUESTIONS = [
  {
    id: 'C1',
    question: '¿Cuántas flexiones (lagartijas) completas puedes hacer seguidas con buena forma?',
    options: [
      { text: 'Menos de 5 o ninguna', points: 0 },
      { text: 'Entre 5 y 15', points: 1 },
      { text: 'Más de 15', points: 2 }
    ]
  },
  {
    id: 'C3',
    question: '¿Puedes hacer dominadas (pull-ups) estrictas?',
    options: [
      { text: 'No puedo hacer ninguna', points: 0 },
      { text: 'Puedo hacer entre 1 y 3', points: 1 },
      { text: 'Puedo hacer 4 o más', points: 2 }
    ]
  },
  {
    id: 'G2',
    question: '¿Puedes hacer sentadilla con barra (back squat) con buena técnica?',
    options: [
      { text: 'No la he intentado o me cuesta sin peso', points: 0 },
      { text: 'Puedo con la barra sola o poco peso', points: 1 },
      { text: 'Puedo con peso moderado a pesado manteniendo forma', points: 2 }
    ]
  },
  {
    id: 'G5',
    question: '¿Cuánto tiempo llevas entrenando de forma constante (cualquier tipo)?',
    options: [
      { text: 'Menos de 3 meses o acabo de empezar', points: 0 },
      { text: 'Entre 3 y 12 meses', points: 1 },
      { text: 'Más de 1 año', points: 2 }
    ]
  }
];

export default function CuestionarioModal({ session, onComplete }) {
  const [step, setStep] = useState('s1'); 
  const [isRestricted, setIsRestricted] = useState(false);
  // 's1'-'s3': screening, -1: Origen, 0: Dias, 1-4: questions, 5: system select, 6: calculating, 7: result
  const [origen, setOrigen] = useState('');
  const [diasEntrenamiento, setDiasEntrenamiento] = useState('');
  const [points, setPoints] = useState(0);
  const [sistemas, setSistemas] = useState([]);
  const [selectedSistema, setSelectedSistema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nivelAsignado, setNivelAsignado] = useState('');
  
  const saveHardStop = async () => {
    setLoading(true);
    try {
      await supabase.auth.updateUser({
        data: { screening_resultado: 'REQUIERE_ORIENTACION', fecha_screening: new Date().toISOString() }
      });
    } catch(e) {}
    setLoading(false);
    onComplete();
  };
  
  useEffect(() => {
    const fetchSistemas = async () => {
      const { data } = await supabase.from('sistemas_entrenamiento').select('*');
      if (data) {
        setSistemas(data.filter(s => s.nombre !== 'Ruta de la Maestría (Habilidades)'));
      }
    };
    fetchSistemas();
  }, []);

  const handleOrigen = (o) => {
    setOrigen(o);
    setStep(0);
  };

  const handleDias = (dias) => {
    setDiasEntrenamiento(dias);
    setStep(1);
  };

  const handleAnswer = (pts) => {
    setPoints(prev => prev + pts);
    setStep(prev => prev + 1);
  };

  const calculateLevel = (totalPoints) => {
    if (totalPoints <= 2) return 'Semilla';
    if (totalPoints <= 5) return 'Pino';
    if (totalPoints <= 7) return 'Tzalam';
    return 'Roble';
  };

  const handleSystemSelect = async (sistemaId) => {
    setSelectedSistema(sistemaId);
    setStep(6); // Go to calculating
    
    // Simulate calculating
    setTimeout(() => {
      const level = calculateLevel(points);
      setNivelAsignado(level);
      setStep(7);
      saveToDatabase(level, sistemaId, diasEntrenamiento);
    }, 2500);
  };

  const saveToDatabase = async (nivel, sistema_id, dias) => {
    try {
      // 1. Update Profile Table
      const { error: profileError } = await supabase
        .from('perfiles')
        .update({ nivel, sistema_activo: sistema_id, dias_entrenamiento: dias })
        .eq('id', session?.user.id);
        
      if (profileError) throw profileError;

      // 2. Update Auth Metadata (Sin marcar como completado todavía para no cerrar el modal)
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          nivel: nivel,
          sistema_activo: sistema_id,
          dias_entrenamiento: dias,
          origen: origen
        }
      });

      if (authError) throw authError;

    } catch (err) {
      console.error("Error guardando el diagnóstico:", err);
    }
  };

  const finalizeOnboarding = async () => {
    await supabase.auth.updateUser({
      data: { 
        cuestionario_complete: true,
        screening_resultado: isRestricted ? 'CON_RESTRICCIONES' : 'APTO',
        fecha_screening: new Date().toISOString()
      }
    });
    onComplete();
    if (origen === 'Reto21') {
      window.location.href = '/reto-21-dias';
    } else {
      window.location.href = '/';
    }
  };

  const OptionButton = ({ text, onClick }) => (
    <button 
      onClick={onClick}
      style={{
        padding: '18px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)'; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
    >
      <span>{text}</span>
      <ChevronRight size={20} color="var(--accent-gold)" />
    </button>
  );

  const renderContent = () => {
    // --- SCREENING MÉDICO ---
    if (step === 's1') {
      return (
        <div className="fade-in">
          <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '15px', textAlign: 'center' }}>
            Antes de comenzar
          </h3>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Queremos ayudarte a entrenar con seguridad. Veta & Vigor no diagnostica, trata ni rehabilita lesiones y actualmente sus rutinas no se adaptan automáticamente a condiciones médicas o lesiones individuales.<br/><br/>
            <strong style={{ color: 'white' }}>¿Actualmente tienes alguna lesión, dolor persistente, condición médica o indicación de un profesional de salud que limite o pueda verse afectada por el ejercicio físico?</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <OptionButton text="No" onClick={() => setStep('s3')} />
            <OptionButton text="Sí" onClick={() => setStep('s2')} />
            <OptionButton text="No estoy seguro/a" onClick={() => setStep('s2')} />
          </div>
        </div>
      );
    }

    if (step === 's2') {
      return (
        <div className="fade-in">
          <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '15px', textAlign: 'center' }}>
            Tu seguridad va primero
          </h3>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Veta & Vigor ofrece entrenamiento general y no sustituye la valoración de un profesional de salud. Como nuestras rutinas actuales no se personalizan automáticamente para lesiones o condiciones médicas, es importante conocer tus límites antes de comenzar.<br/><br/>
            <strong style={{ color: 'white' }}>¿Un profesional de salud te ha indicado que puedes realizar ejercicio y conoces las restricciones que debes respetar?</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <OptionButton text="Sí, puedo realizar ejercicio y conozco mis restricciones" onClick={() => { setIsRestricted(true); setStep('s3'); }} />
            <OptionButton text="No / No estoy seguro" onClick={saveHardStop} />
          </div>
        </div>
      );
    }

    if (step === 's3') {
      return (
        <div className="fade-in">
          <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '15px', textAlign: 'center' }}>
            Filtro Final
          </h3>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {isRestricted && <span style={{ color: 'var(--accent-gold)', display: 'block', marginBottom: '15px' }}><strong>Confirmo que he leído esta información, que conozco las indicaciones o restricciones aplicables a mi situación y que detendré el ejercicio si presento dolor o síntomas inusuales. Entiendo que Veta & Vigor no proporciona diagnóstico, tratamiento ni rehabilitación médica.</strong><br/><br/></span>}
            <strong style={{ color: 'white' }}>¿Has presentado recientemente durante el esfuerzo algún síntoma preocupante —por ejemplo, dolor u opresión en el pecho, desmayo o mareo inexplicable, o falta de aire inusual— por el que aún no hayas sido valorado/a?</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <OptionButton text="No" onClick={() => setStep(-1)} />
            <OptionButton text="Sí / No estoy seguro/a" onClick={saveHardStop} />
          </div>
        </div>
      );
    }

    // Origen
    if (step === -1) {
      return (
        <div className="fade-in">
          <Target size={40} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', display: 'block' }} />
          <h3 className="gold-gradient-text" style={{ fontSize: '1.4rem', marginBottom: '20px', textAlign: 'center' }}>
            ¿Qué te trae a Veta & Vigor?
          </h3>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Selecciona tu principal objetivo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <OptionButton text="Vengo por el Reto de 21 Días" onClick={() => handleOrigen('Reto21')} />
            <OptionButton text="Quiero mi misión de entrenamiento" onClick={() => handleOrigen('Rutina')} />
          </div>
        </div>
      );
    }

    // Dias
    if (step === 0) {
      return (
        <div className="fade-in">
          <Calendar size={40} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', display: 'block' }} />
          <h3 className="gold-gradient-text" style={{ fontSize: '1.4rem', marginBottom: '20px', textAlign: 'center' }}>
            Disponibilidad Semanal
          </h3>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            ¿Cuántos días a la semana puedes comprometerte a entrenar de forma realista?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <OptionButton text="3 días (Poco tiempo - Cuerpo Completo)" onClick={() => handleDias('3')} />
            <OptionButton text="Más de 3 días (Óptimo - Tren Superior/Inferior)" onClick={() => handleDias('>3')} />
          </div>
        </div>
      );
    }

    // Questions (steps 1 to 4)
    if (step >= 1 && step <= 4) {
      const q = QUESTIONS[step - 1];
      return (
        <div className="fade-in">
          <h3 className="gold-gradient-text" style={{ fontSize: '1.2rem', marginBottom: '15px', textAlign: 'center' }}>
            Evaluación Física ({step}/4)
          </h3>
          <p style={{ fontSize: '1.2rem', marginBottom: '30px', textAlign: 'center', fontWeight: '500' }}>
            {q.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {q.options.map((opt, i) => (
              <OptionButton key={i} text={opt.text} onClick={() => handleAnswer(opt.points)} />
            ))}
          </div>
        </div>
      );
    }

    // System Selection
    if (step === 5) {
      return (
        <div className="fade-in">
          <h3 className="gold-gradient-text" style={{ fontSize: '1.5rem', marginBottom: '15px', textAlign: 'center' }}>
            Tu Sistema
          </h3>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '30px', textAlign: 'center' }}>
            ¿Qué estilo de entrenamiento resuena más contigo?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {sistemas.map((sis) => (
              <div 
                key={sis.id}
                onClick={() => handleSystemSelect(sis.id)}
                style={{
                  padding: '20px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={sis.imagen_url} alt={sis.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>{sis.nombre}</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sis.descripcion?.substring(0, 80) || ''}...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Calculating
    if (step === 6) {
      return (
        <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Activity size={60} color="var(--accent-gold)" className="pulse-glow" style={{ margin: '0 auto 20px auto' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px' }}>Analizando Perfil...</h3>
          <p style={{ color: 'var(--text-muted)' }}>Estructurando tu semana de entrenamiento ideal.</p>
        </div>
      );
    }

    // Result
    if (step === 7) {
      return (
        <div className="fade-in" style={{ textAlign: 'center' }}>
          <ShieldCheck size={70} color="var(--accent-gold)" style={{ margin: '0 auto 20px auto', filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.5))' }} />
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '2px' }}>Tu Rango Oficial</h2>
          <h1 className="gold-gradient-text" style={{ fontSize: '3rem', margin: '0 0 20px 0', fontWeight: '900', letterSpacing: '2px' }}>
            {nivelAsignado}
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '30px', lineHeight: '1.6' }}>
            Hemos configurado tu calendario con misiones de madera <strong>{nivelAsignado}</strong> distribuidas para <strong>{diasEntrenamiento === '3' ? '3 días' : 'más de 3 días'}</strong> a la semana.
          </p>
          <button onClick={finalizeOnboarding} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem', fontWeight: 'bold' }}>
            {origen === 'Reto21' ? 'IR AL RETO 21 DÍAS' : 'INICIAR ENTRENAMIENTO'}
          </button>
        </div>
      );
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 10, 15, 0.98)', backdropFilter: 'blur(15px)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '35px',
        width: '100%', maxWidth: '500px', border: '1px solid rgba(212, 175, 55, 0.15)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), inset 0 0 40px rgba(212, 175, 55, 0.05)',
        minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center'
      }}>
        {renderContent()}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-glow { animation: pulse 1.5s infinite alternate; }
        @keyframes pulse { from { transform: scale(1); filter: drop-shadow(0 0 5px rgba(212,175,55,0.5)); } to { transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(212,175,55,0.8)); } }
      `}} />
    </div>
  );
}
