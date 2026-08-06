import React from 'react';

export default function AvatarConMarco({ src, alt, size = 50, marco = 'ninguno', style = {} }) {
  const isBordeFuego = marco === 'borde_fuego';

  // Si no hay marco, renderizar avatar normal
  if (!isBordeFuego) {
    return (
      <img 
        src={src || '/assets/niveles/semilla.png'} 
        alt={alt} 
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

  // Dimensiones SVG para dar espacio al fuego exterior
  const svgSize = size * 1.4; 
  const offset = (svgSize - size) / 2;
  const radius = size / 2;
  const center = svgSize / 2;

  return (
    <div style={{ position: 'relative', width: svgSize, height: svgSize, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', ...style }}>
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
          0% { filter: drop-shadow(0 0 10px #ff4757) brightness(1); }
          50% { filter: drop-shadow(0 0 25px #ff7f50) brightness(1.3); }
          100% { filter: drop-shadow(0 0 10px #ff4757) brightness(1); }
        }
      `}</style>
      
      {/* Contenedor SVG Animado (El Borde de Fuego) */}
      <svg width={svgSize} height={svgSize} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        
        {/* Filtros para resplandor (Glow) */}
        <defs>
          <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Anillo de Fuego Externo (Gira hacia la derecha) */}
        <g style={{ transformOrigin: 'center', animation: 'fireSpin 4s linear infinite, firePulse 2s ease-in-out infinite' }}>
          <circle cx={center} cy={center} r={radius + 4} fill="none" stroke="#ff4757" strokeWidth="3" filter="url(#fireGlow)" />
          {/* Partículas / chispas externas */}
          <circle cx={center} cy={center - (radius + 4)} r="2" fill="#ff7f50" />
          <circle cx={center + (radius + 4)} cy={center} r="1.5" fill="#ffd32a" />
          <circle cx={center} cy={center + (radius + 4)} r="2.5" fill="#ff4757" />
          <circle cx={center - (radius + 4)} cy={center} r="1" fill="#ffa502" />
        </g>

        {/* Anillo Interno Discontinuo (Gira hacia la izquierda) */}
        <g style={{ transformOrigin: 'center', animation: 'fireSpinReverse 6s linear infinite' }}>
          <circle 
            cx={center} 
            cy={center} 
            r={radius + 2} 
            fill="none" 
            stroke="#ff7f50" 
            strokeWidth="2" 
            strokeDasharray="15, 10, 5, 10" 
            filter="url(#fireGlow)" 
          />
        </g>
      </svg>

      {/* Imagen del Avatar en el centro */}
      <img 
        src={src || '/assets/niveles/semilla.png'} 
        alt={alt} 
        style={{
          width: size, 
          height: size, 
          borderRadius: '50%', 
          objectFit: 'cover',
          position: 'absolute',
          top: offset,
          left: offset,
          border: '2px solid #2a0800',
          boxShadow: 'inset 0 0 10px #000'
        }} 
      />
    </div>
  );
}
