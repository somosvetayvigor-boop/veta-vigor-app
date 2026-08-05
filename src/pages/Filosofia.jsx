import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Leaf, TreePine, Mountain, ShieldCheck, Dumbbell, Clock, Flame, ChevronRight } from 'lucide-react';

const Filosofia = () => {
  const navigate = useNavigate();
  const [currentChapter, setCurrentChapter] = useState(1);
  const totalChapters = 7;

  useEffect(() => {
    // Escuchar el evento de scroll para actualizar el indicador de capítulo
    const handleScroll = (e) => {
      const container = e.target;
      const scrollPosition = container.scrollTop;
      const windowHeight = window.innerHeight;
      const chapter = Math.round(scrollPosition / windowHeight) + 1;
      setCurrentChapter(chapter);
    };

    const container = document.getElementById('filosofia-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const styles = {
    container: {
      backgroundColor: '#0a0a0c', // Negro muy profundo, sutil toque madera oscura
      height: '100dvh',
      overflowY: 'scroll',
      scrollSnapType: 'y mandatory',
      color: 'white',
      fontFamily: "'Inter', sans-serif",
    },
    section: {
      height: '100dvh',
      width: '100%',
      scrollSnapAlign: 'start',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      boxSizing: 'border-box'
    },
    header: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      padding: 'env(safe-area-inset-top, 20px) 20px 15px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 100,
      background: 'linear-gradient(to bottom, rgba(10,10,12,0.9) 0%, rgba(10,10,12,0) 100%)',
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '900',
      lineHeight: '1.1',
      marginBottom: '15px',
      background: 'linear-gradient(to right, #D4AF37, #f1c40f)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    subtitle: {
      fontSize: '1.2rem',
      color: '#fff',
      fontWeight: 'bold',
      marginBottom: '30px',
      letterSpacing: '1px'
    },
    text: {
      fontSize: '1.05rem',
      lineHeight: '1.6',
      color: '#ccc',
      marginBottom: '20px'
    },
    card: {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(212,175,55,0.1)',
      borderRadius: '15px',
      padding: '25px',
      marginBottom: '15px',
    },
    scrollIndicator: {
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      color: 'var(--accent-gold)',
      opacity: 0.7,
      animation: 'pulse 2s infinite'
    }
  };

  return (
    <div id="filosofia-container" style={styles.container}>
      
      {/* Header Fijo */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ChevronLeft size={24} /> <span style={{ fontSize: '0.9rem', color: '#aaa' }}>Cerrar</span>
        </button>
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', letterSpacing: '2px', fontWeight: 'bold' }}>
          {currentChapter} / {totalChapters}
        </div>
      </div>

      {/* CAPÍTULO 1: Bienvenido */}
      <section style={styles.section}>
        <div style={{ animation: 'fadeIn 1s ease-out' }}>
          <h1 style={styles.title}>Filosofía V&V</h1>
          <h3 style={styles.subtitle}>Lo que resistes, te fortalece.</h3>
          
          <p style={styles.text}>
            En Veta & Vigor creemos que entrenar no consiste únicamente en desarrollar fuerza física.
          </p>
          <p style={styles.text}>
            Cada misión fortalece algo mucho más importante.<br/><br/>
            Tu disciplina.<br/>
            Tu carácter.<br/>
            Y la relación que tienes contigo mismo.
          </p>
          <p style={styles.text}>
            No entrenamos para impresionar.<br/>
            Entrenamos para convertirnos en personas que cumplen su palabra.
          </p>
        </div>
        
        <div style={styles.scrollIndicator}>
          <span style={{ fontSize: '0.8rem', marginBottom: '5px', letterSpacing: '1px' }}>DESLIZA</span>
          <ChevronDown size={20} />
        </div>
      </section>

      {/* CAPÍTULO 2: Nuestro Origen */}
      <section style={styles.section}>
        <div>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 2</h4>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '30px' }}>Nuestro Origen</h2>
          
          <p style={styles.text}>
            Todo comenzó con una barra.
          </p>
          <p style={styles.text}>
            No con un gimnasio. No con grandes instalaciones. No con recursos ilimitados.
          </p>
          <p style={styles.text}>
            Gerardo construyó su camino con disciplina, constancia y el deseo de demostrar que una persona puede transformar su vida con los recursos que tiene y la decisión de no rendirse.
          </p>
          <p style={styles.text}>
            Con el tiempo comprendió que el verdadero cambio no estaba únicamente en desarrollar fuerza física. La verdadera transformación ocurría cuando una persona aprendía a cumplir consigo misma.
          </p>
          <p style={styles.text} style={{ ...styles.text, color: 'var(--accent-gold)', fontWeight: 'bold', borderLeft: '3px solid var(--accent-gold)', paddingLeft: '15px' }}>
            Así nació Veta & Vigor. No como una aplicación. Sino como una metodología para formar personas más disciplinadas.
          </p>
        </div>
        <div style={styles.scrollIndicator}><ChevronDown size={20} /></div>
      </section>

      {/* CAPÍTULO 3: Nuestra Filosofía */}
      <section style={styles.section}>
        <div>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 3</h4>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '30px' }}>Nuestra Filosofía</h2>
          
          <div style={{ display: 'flex', overflowX: 'auto', gap: '15px', paddingBottom: '20px', snapType: 'x mandatory' }}>
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>La disciplina supera a la motivación.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>La motivación aparece y desaparece. La disciplina permanece. Por eso entrenamos incluso cuando no tenemos ganas.</p>
            </div>
            
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>Nunca negociamos con los pretextos.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>Siempre existirán razones para no entrenar. Nosotros elegimos cumplir.</p>
            </div>
            
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>La técnica siempre antes que la carga.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>El ego busca levantar más. La disciplina busca hacerlo mejor.</p>
            </div>
            
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>Descansar también es entrenar.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>El progreso ocurre cuando el cuerpo logra adaptarse.</p>
            </div>
            
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>Lo que no se mide no mejora.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>Registrar el entrenamiento permite avanzar con intención y no por intuición.</p>
            </div>
            
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card }}>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1.2rem' }}>Nunca sacrificamos la evidencia por una tendencia.</h3>
              <p style={{ color: '#aaa', fontSize: '0.95rem' }}>La ciencia guía nuestras decisiones. No las modas.</p>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>Desliza las tarjetas <ChevronRight size={12} style={{ display: 'inline' }} /></p>
        </div>
        <div style={styles.scrollIndicator}><ChevronDown size={20} /></div>
      </section>

      {/* CAPÍTULO 4: Las Maderas */}
      <section style={styles.section}>
        <div>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 4</h4>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '10px' }}>Las Maderas</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '30px' }}>Las maderas no representan niveles. Representan evolución personal.</p>
          
          <div style={{ display: 'flex', overflowX: 'auto', gap: '15px', paddingBottom: '20px', snapType: 'x mandatory' }}>
            {/* SEMILLA */}
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card, borderLeft: '4px solid #81ecec' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Leaf size={24} color="#81ecec" />
                <h3 style={{ color: '#fff', margin: 0 }}>SEMILLA</h3>
              </div>
              <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '15px' }}>Todo comienza con una decisión. Representa el momento en que una persona deja de esperar el momento perfecto y decide actuar.</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {['Inicio', 'Curiosidad', 'Intención', 'Posibilidades'].map(v => <span key={v} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '10px' }}>{v}</span>)}
              </div>
              <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', fontSize: '0.9rem' }}>"No importa dónde empiezas. Importa que decidiste comenzar."</p>
            </div>

            {/* PINO */}
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card, borderLeft: '4px solid #55efc4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <TreePine size={24} color="#55efc4" />
                <h3 style={{ color: '#fff', margin: 0 }}>PINO</h3>
              </div>
              <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '15px' }}>La constancia comienza a echar raíces. Representa las primeras victorias contra los propios pretextos.</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {['Constancia', 'Hábito', 'Disciplina', 'Resistencia'].map(v => <span key={v} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '10px' }}>{v}</span>)}
              </div>
              <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', fontSize: '0.9rem' }}>"Cada misión cumplida fortalece tu disciplina."</p>
            </div>

            {/* TZALAM */}
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card, borderLeft: '4px solid #D4AF37' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Mountain size={24} color="#D4AF37" />
                <h3 style={{ color: '#fff', margin: 0 }}>TZALAM</h3>
              </div>
              <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '15px' }}>La presión deja de romperte. Ahora comienza a fortalecerte.</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {['Fortaleza', 'Carácter', 'Control', 'Resiliencia'].map(v => <span key={v} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '10px' }}>{v}</span>)}
              </div>
              <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', fontSize: '0.9rem' }}>"No entrenas porque siempre tengas ganas. Entrenas porque ya eres una persona disciplinada."</p>
            </div>

            {/* ROBLE */}
            <div style={{ minWidth: '85%', scrollSnapAlign: 'center', ...styles.card, borderLeft: '4px solid #e17055' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <ShieldCheck size={24} color="#e17055" />
                <h3 style={{ color: '#fff', margin: 0 }}>ROBLE</h3>
              </div>
              <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '15px' }}>La disciplina deja de ser un esfuerzo. Se convierte en parte de tu identidad.</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {['Liderazgo', 'Ejemplo', 'Servicio', 'Solidez'].map(v => <span key={v} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '10px' }}>{v}</span>)}
              </div>
              <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', fontSize: '0.9rem' }}>"Ya no inspiras por lo que dices. Inspiras por lo que haces."</p>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>Desliza las maderas <ChevronRight size={12} style={{ display: 'inline' }} /></p>
        </div>
        <div style={styles.scrollIndicator}><ChevronDown size={20} /></div>
      </section>

      {/* CAPÍTULO 5: Ciencia V&V */}
      <section style={styles.section}>
        <div>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 5</h4>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '30px' }}>Ciencia V&V</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginBottom: '5px' }}>¿Por qué entrenamos tres o cuatro días?</h4>
              <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0 }}>Porque el cuerpo necesita estímulos y recuperación para adaptarse. Más entrenamiento no siempre significa mejores resultados.</p>
            </div>
            
            <div>
              <h4 style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginBottom: '5px' }}>¿Por qué registramos pesos y repeticiones?</h4>
              <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0 }}>Porque medir permite progresar objetivamente.</p>
            </div>
            
            <div>
              <h4 style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginBottom: '5px' }}>¿Por qué existen días de recuperación?</h4>
              <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0 }}>Porque la recuperación forma parte del entrenamiento.</p>
            </div>
            
            <div>
              <h4 style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginBottom: '5px' }}>¿Por qué existen progresiones?</h4>
              <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0 }}>Porque el cuerpo mejora gradualmente. Intentar avanzar demasiado rápido suele provocar lesiones o estancamiento.</p>
            </div>

            <div>
              <h4 style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginBottom: '5px' }}>¿Por qué evaluamos antes de entrenar?</h4>
              <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0 }}>Porque cada atleta comienza desde un punto diferente. El entrenamiento debe adaptarse a la persona y no la persona al entrenamiento.</p>
            </div>
          </div>
        </div>
        <div style={styles.scrollIndicator}><ChevronDown size={20} /></div>
      </section>

      {/* CAPÍTULO 6: Código del Atleta Vigor */}
      <section style={styles.section}>
        <div>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 6</h4>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '10px' }}>Código del Atleta Vigor</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '30px' }}>No son reglas. Son compromisos personales.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>Cumplo mi misión incluso cuando no tengo ganas.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>La técnica vale más que el ego.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>Mi competencia soy yo de ayer.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>El descanso también construye.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>Nunca busco atajos.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem' }}>La disciplina es una decisión diaria.</span>
            </div>
            <div style={{ ...styles.card, padding: '15px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>Lo que resisto me fortalece.</span>
            </div>
          </div>
        </div>
        <div style={styles.scrollIndicator}><ChevronDown size={20} /></div>
      </section>

      {/* CAPÍTULO 7: El Manifiesto */}
      <section style={styles.section}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 1s ease-out' }}>
          <h4 style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>CAPÍTULO 7</h4>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '30px', letterSpacing: '1px' }}>EL MANIFIESTO</h2>
          
          <div style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.8', fontStyle: 'italic' }}>
            <p>No creemos en los cambios rápidos.<br/>Creemos en las decisiones que se repiten.</p>
            <p>No creemos en la motivación eterna.<br/>Creemos en la disciplina diaria.</p>
            <p>No creemos que un entrenamiento cambie una vida.<br/>Creemos que cientos de pequeñas decisiones sí pueden hacerlo.</p>
            <p>Entrenamos el cuerpo.<br/>Pero también entrenamos el carácter.</p>
            <p>Porque el cuerpo refleja aquello que la disciplina construye.</p>
            <p>No buscamos personas perfectas.<br/>Buscamos personas que cumplan consigo mismas.</p>
            <p>Cada misión deja una marca.<br/>Cada esfuerzo fortalece la veta.<br/>Cada obstáculo fortalece el vigor.</p>
            <p>Porque al final...</p>
            <h2 style={styles.title}>Lo que resistes,<br/>te fortalece.</h2>
          </div>
        </div>
        
        <div style={{ position: 'absolute', bottom: '30px', width: '100%', left: 0, padding: '0 20px', boxSizing: 'border-box' }}>
          <button onClick={() => navigate(-1)} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1rem', letterSpacing: '1px' }}>
            Acepto el Código
          </button>
        </div>
      </section>
      
    </div>
  );
};

export default Filosofia;
