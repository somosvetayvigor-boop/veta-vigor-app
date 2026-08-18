
// Paletas de los bordes -- mismos colores que ya usa ArbolForja.jsx para
// sus fases plata/oro (src/components/ArbolForja.jsx), para que el
// borde y el Árbol de Forja se sientan parte del mismo sistema visual.
const PALETAS_BORDE = {
  borde_fuego: {
    anillo: '#ff4757',
    anilloInterno: '#ff7f50',
    chispas: ['#ff7f50', '#ffd32a', '#ff4757', '#ffa502'],
    glowA: '#ff4757',
    glowB: '#ff7f50',
    bordeAvatar: '#2a0800',
  },
  borde_plata: {
    anillo: '#dcdde1',
    anilloInterno: '#f5f6fa',
    chispas: ['#00a8ff', '#f5f6fa', '#dcdde1', '#7f8fa6'],
    glowA: '#dcdde1',
    glowB: '#00a8ff',
    bordeAvatar: '#2f3542',
  },
  borde_dorado: {
    anillo: '#ffd700',
    anilloInterno: '#ffeb3b',
    chispas: ['#ff4757', '#ffd700', '#ffeb3b', '#b8860b'],
    glowA: '#ffd700',
    glowB: '#ffeb3b',
    bordeAvatar: '#2a1a00',
  },
};

// Aura Arcana: resplandor de fondo, independiente del anillo -- se
// puede tener puesto un borde y un aura al mismo tiempo.
const AURA_COLOR = '#8e44ad';

export default function AvatarConMarco({ src, alt, size = 50, marco = 'ninguno', aura = 'ninguna', style = {}, onError }) {
  const paleta = PALETAS_BORDE[marco];
  const tieneAura = aura === 'aura_arcana';

  // Sin borde ni aura: avatar simple, igual que siempre.
  if (!paleta && !tieneAura) {
    return (
      <img
        src={src || '/assets/niveles/semilla.png'}
        alt={alt}
        onError={onError}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          ...style
        }}
      />
    );
  }

  // Dimensiones para dar espacio al anillo/aura exterior. Todas las capas
  // (aura, anillo, imagen) se centran a mano contra el mismo contenedor,
  // en vez de mezclar centrado por flex con offsets manuales -- así cada
  // capa queda alineada exactamente igual sin depender de cómo el
  // navegador resuelva el centrado de hijos con position:absolute.
  const svgSize = size * 1.4;
  const auraSize = size * 1.9;
  const containerSize = Math.max(svgSize, auraSize);
  const svgOffset = (containerSize - svgSize) / 2;
  const auraOffset = (containerSize - auraSize) / 2;
  const imgOffset = (containerSize - size) / 2;
  const radius = size / 2;
  const center = svgSize / 2;

  return (
    <div style={{ position: 'relative', width: containerSize, height: containerSize, ...style }}>
      <style>{`
        @keyframes fireSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fireSpinReverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes firePulse {
          0% { filter: drop-shadow(0 0 10px var(--glow-a)) brightness(1); }
          50% { filter: drop-shadow(0 0 25px var(--glow-b)) brightness(1.3); }
          100% { filter: drop-shadow(0 0 10px var(--glow-a)) brightness(1); }
        }
        @keyframes auraPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
      `}</style>

      {/* Aura Arcana: resplandor de fondo, detrás de todo lo demás */}
      {tieneAura && (
        <div
          style={{
            position: 'absolute',
            top: auraOffset,
            left: auraOffset,
            width: auraSize,
            height: auraSize,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${AURA_COLOR} 0%, transparent 70%)`,
            filter: 'blur(6px)',
            animation: 'auraPulse 3.5s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Anillo del borde (si hay uno equipado) */}
      {paleta && (
        <svg width={svgSize} height={svgSize} style={{ position: 'absolute', top: svgOffset, left: svgOffset, pointerEvents: 'none' }}>
          <defs>
            <filter id={`fireGlow-${marco}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Anillo Externo (gira hacia la derecha) */}
          <g style={{ '--glow-a': paleta.glowA, '--glow-b': paleta.glowB, transformOrigin: 'center', animation: 'fireSpin 4s linear infinite, firePulse 2s ease-in-out infinite' }}>
            <circle cx={center} cy={center} r={radius + 4} fill="none" stroke={paleta.anillo} strokeWidth="3" filter={`url(#fireGlow-${marco})`} />
            <circle cx={center} cy={center - (radius + 4)} r="2" fill={paleta.chispas[0]} />
            <circle cx={center + (radius + 4)} cy={center} r="1.5" fill={paleta.chispas[1]} />
            <circle cx={center} cy={center + (radius + 4)} r="2.5" fill={paleta.chispas[2]} />
            <circle cx={center - (radius + 4)} cy={center} r="1" fill={paleta.chispas[3]} />
          </g>

          {/* Anillo Interno discontinuo (gira hacia la izquierda) */}
          <g style={{ transformOrigin: 'center', animation: 'fireSpinReverse 6s linear infinite' }}>
            <circle
              cx={center}
              cy={center}
              r={radius + 2}
              fill="none"
              stroke={paleta.anilloInterno}
              strokeWidth="2"
              strokeDasharray="15, 10, 5, 10"
              filter={`url(#fireGlow-${marco})`}
            />
          </g>
        </svg>
      )}

      {/* Imagen del avatar en el centro */}
      <img
        src={src || '/assets/niveles/semilla.png'}
        alt={alt}
        onError={onError}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          position: 'absolute',
          top: imgOffset,
          left: imgOffset,
          border: paleta ? `2px solid ${paleta.bordeAvatar}` : 'none',
          boxShadow: paleta ? 'inset 0 0 10px #000' : 'none'
        }}
      />
    </div>
  );
}
