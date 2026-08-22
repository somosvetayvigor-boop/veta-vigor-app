
export default function GolemAnimado({ nivel, isHit, isDead, size = 150 }) {
  const isLevel2 = nivel >= 2;

  // Animaciones de Combate
  const animationStyles = `
    @keyframes floatGolem {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-5px); }
      100% { transform: translateY(0px); }
    }
    @keyframes breatheGolem {
      0% { transform: scaleX(1) scaleY(1); }
      50% { transform: scaleX(1.02) scaleY(0.98); }
      100% { transform: scaleX(1) scaleY(1); }
    }
    @keyframes hitShake {
      0% { transform: translate(5px, 3px) rotate(2deg); filter: brightness(2) contrast(1.5); }
      20% { transform: translate(-5px, -3px) rotate(-2deg); filter: brightness(2) contrast(1.5); }
      40% { transform: translate(5px, 2px) rotate(1deg); filter: brightness(1); }
      60% { transform: translate(-3px, -1px) rotate(0deg); }
      80% { transform: translate(2px, 1px) rotate(-1deg); }
      100% { transform: translate(0px, 0px) rotate(0deg); filter: brightness(1); }
    }
    @keyframes coreGlow {
      0% { opacity: 0.6; }
      50% { opacity: 1; filter: drop-shadow(0 0 8px currentColor); }
      100% { opacity: 0.6; }
    }
    /* Nivel 2: núcleo "chispeante" (así lo describe ya el flavor text de
       renderOxido) -- varios destellos irregulares por ciclo en vez del
       pulso único y suave de coreGlow, para que se sienta más eléctrico
       e inestable que el núcleo de magma lento del Gólem del Lastre. */
    @keyframes sparkCore {
      0%, 100% { opacity: 0.5; filter: drop-shadow(0 0 4px currentColor); }
      15% { opacity: 1; filter: drop-shadow(0 0 12px currentColor) brightness(1.6); }
      30% { opacity: 0.55; filter: drop-shadow(0 0 5px currentColor); }
      45% { opacity: 1; filter: drop-shadow(0 0 14px currentColor) brightness(1.7); }
      60% { opacity: 0.5; filter: drop-shadow(0 0 4px currentColor); }
    }
    /* Nivel 2: leve bamboleo del cuerpo entero, sobre el wrapper (no sobre
       .golem-body) para no pelear con floatGolem/breatheGolem, que ya
       animan su propio transform -- refuerza la idea de "inconsistencia"
       (la debilidad temática del Gólem de Óxido) frente a la quietud
       pesada del Gólem del Lastre. */
    @keyframes swayGolem {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-1.5deg); }
      75% { transform: rotate(1.5deg); }
    }
    .golem-wrapper {
      animation: ${isLevel2 && !isDead && !isHit ? 'swayGolem 2.6s ease-in-out infinite' : 'none'};
      transform-origin: center bottom;
    }
    .golem-body {
      animation: ${isHit && !isDead ? 'hitShake 0.4s ease-in-out' : (isDead ? 'none' : (isLevel2 ? 'floatGolem 3s ease-in-out infinite, breatheGolem 2.2s ease-in-out infinite' : 'floatGolem 4s ease-in-out infinite, breatheGolem 3s ease-in-out infinite'))};
      transform-origin: center bottom;
      transition: filter 0.3s ease-out, opacity 0.5s ease-out;
      filter: ${isDead ? 'grayscale(100%) brightness(0.4) opacity(0.5)' : 'none'};
    }
    .golem-core {
      animation: ${isDead ? 'none' : (isLevel2 ? 'sparkCore 1.3s ease-in-out infinite' : 'coreGlow 2s ease-in-out infinite')};
      color: ${isLevel2 ? '#ff7f50' : '#ff4757'};
    }
  `;

  // --- Nivel 1: GÓLEM DEL LASTRE (Piedra Pesada) ---
  const renderLastre = () => (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible" className="golem-body">
      {/* Sombra base */}
      <ellipse cx="50" cy="95" rx="35" ry="8" fill="#111" opacity="0.6" />
      
      {/* Piernas gruesas */}
      <path d="M 35 70 L 25 90 L 45 90 Z" fill="#2d3436" />
      <path d="M 65 70 L 55 90 L 75 90 Z" fill="#2d3436" />

      {/* Cuerpo principal (Roca monolítica) */}
      <path d="M 30 75 Q 15 50 25 25 Q 50 10 75 25 Q 85 50 70 75 Z" fill="#636e72" />
      
      {/* Relieves oscuros (volumen) */}
      <path d="M 30 75 Q 15 50 25 25 L 35 35 Q 25 55 40 70 Z" fill="#2d3436" opacity="0.5" />
      <path d="M 70 75 Q 85 50 75 25 L 65 35 Q 75 55 60 70 Z" fill="#2d3436" opacity="0.5" />

      {/* Brazos colgantes y pesados */}
      <path d="M 20 35 Q 0 50 10 75 Q 20 80 25 65 Z" fill="#4a555c" />
      <path d="M 80 35 Q 100 50 90 75 Q 80 80 75 65 Z" fill="#4a555c" />

      {/* Grietas de Magma / Energía (Núcleo) */}
      <g className="golem-core">
        <path d="M 50 35 L 45 45 L 55 50 L 40 65" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 60 30 L 65 40 L 55 45" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Ojos / Ranuras faciales */}
        <line x1="40" y1="25" x2="48" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="60" y1="25" x2="52" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );

  // --- Nivel 2: GÓLEM DE ÓXIDO (Hierro viejo y Pinchos) ---
  const renderOxido = () => (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible" className="golem-body">
      <ellipse cx="50" cy="95" rx="35" ry="8" fill="#111" opacity="0.6" />
      
      {/* Piernas metálicas puntiagudas */}
      <path d="M 40 60 L 30 95 L 45 85 Z" fill="#4b302c" />
      <path d="M 60 60 L 70 95 L 55 85 Z" fill="#4b302c" />

      {/* Torso angular (Hierro oxidado) */}
      <path d="M 35 70 L 20 40 L 40 15 L 60 15 L 80 40 L 65 70 Z" fill="#9c412f" />
      
      {/* Placas sobrepuestas oscuras */}
      <path d="M 25 45 L 45 25 L 55 25 L 75 45 L 65 65 L 35 65 Z" fill="#5a3129" />
      <path d="M 35 55 L 50 35 L 65 55 Z" fill="#3a1e19" />

      {/* Hombros de hierro engranados */}
      <rect x="10" y="30" width="15" height="15" rx="2" fill="#7a3b31" transform="rotate(25 15 35)" />
      <rect x="75" y="30" width="15" height="15" rx="2" fill="#7a3b31" transform="rotate(-25 85 35)" />
      
      {/* Brazos largos como vigas */}
      <path d="M 15 40 L 5 80 L 15 85 L 25 50 Z" fill="#7a3b31" />
      <path d="M 85 40 L 95 80 L 85 85 L 75 50 Z" fill="#7a3b31" />

      {/* Cadenas y Núcleo Naranja Chispeante */}
      <g className="golem-core">
        {/* Ojo central visor de robot */}
        <rect x="40" y="25" width="20" height="4" fill="currentColor" rx="2" />
        <circle cx="50" cy="45" r="5" fill="currentColor" />
        {/* Resplandor del núcleo */}
        <path d="M 45 55 L 50 65 L 55 55 Z" fill="currentColor" />
      </g>
    </svg>
  );

  return (
    <div className="golem-wrapper" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: size, height: size }}>
      <style>{animationStyles}</style>
      {isLevel2 ? renderOxido() : renderLastre()}
    </div>
  );
}
