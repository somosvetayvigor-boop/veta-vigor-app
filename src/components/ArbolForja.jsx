import React from 'react';

export default function ArbolForja({ nivel, size = 120 }) {
  // Configuración de colores
  const colors = {
    stem: '#8B5A2B', // Marrón madera
    leafLight: '#78e08f', // Verde claro
    leafDark: '#38ada9', // Verde oscuro
    pot: '#2f3542', // Maceta oscura
    gold: '#d4af37' // Detalles dorados
  };

  // ESTILOS DE ANIMACIÓN GLOBALES
  const animationStyles = `
    @keyframes swayRight {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(8deg); }
    }
    @keyframes swayLeft {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-8deg); }
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    .leaf-right {
      animation: swayRight 4s ease-in-out infinite;
    }
    .leaf-left {
      animation: swayLeft 4.5s ease-in-out infinite;
    }
    .tree-crown {
      animation: breathe 5s ease-in-out infinite;
      transform-origin: center bottom;
    }
    .sparkle {
      animation: float 3s ease-in-out infinite;
    }
  `;

  // --- FASE 1: EL BROTE ---
  const renderBrote = () => (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      <style>{animationStyles}</style>
      
      {/* Tierra / Base */}
      <ellipse cx="50" cy="85" rx="20" ry="5" fill="#1e1e1e" />
      <path d="M 40 85 Q 50 95 60 85" fill={colors.stem} opacity="0.3" />

      {/* Tallo principal */}
      <path d="M 50 85 Q 45 65 50 50" fill="none" stroke={colors.leafLight} strokeWidth="4" strokeLinecap="round" />
      
      {/* Hoja Izquierda */}
      <g className="leaf-left" style={{ transformOrigin: '48px 65px' }}>
        <path d="M 48 65 Q 25 55 25 40 Q 40 40 48 65" fill={colors.leafDark} />
      </g>
      
      {/* Hoja Derecha (más alta) */}
      <g className="leaf-right" style={{ transformOrigin: '50px 50px' }}>
        <path d="M 50 50 Q 75 40 75 25 Q 60 25 50 50" fill={colors.leafLight} />
      </g>
      
      {/* Destello mágico */}
      <circle cx="50" cy="20" r="2" fill={colors.gold} className="sparkle" style={{ animationDelay: '0s' }} />
      <circle cx="30" cy="35" r="1.5" fill={colors.gold} className="sparkle" style={{ animationDelay: '1s' }} />
    </svg>
  );

  // --- FASE 2: LA PLANTA ---
  const renderPlanta = () => (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      <style>{animationStyles}</style>
      
      <ellipse cx="50" cy="85" rx="25" ry="6" fill="#1e1e1e" />
      
      {/* Tallo más grueso */}
      <path d="M 50 85 Q 40 50 50 20" fill="none" stroke={colors.stem} strokeWidth="6" strokeLinecap="round" />
      
      {/* Hojas inferiores */}
      <g className="leaf-left" style={{ transformOrigin: '47px 70px' }}>
        <path d="M 47 70 Q 15 60 15 45 Q 35 40 47 70" fill={colors.leafDark} />
      </g>
      <g className="leaf-right" style={{ transformOrigin: '48px 60px' }}>
        <path d="M 48 60 Q 80 50 80 35 Q 60 30 48 60" fill={colors.leafDark} />
      </g>

      {/* Hojas medias */}
      <g className="leaf-left" style={{ transformOrigin: '46px 45px' }}>
        <path d="M 46 45 Q 20 30 25 15 Q 40 20 46 45" fill={colors.leafLight} />
      </g>
      <g className="leaf-right" style={{ transformOrigin: '47px 35px' }}>
        <path d="M 47 35 Q 75 25 70 10 Q 55 15 47 35" fill={colors.leafLight} />
      </g>
      
      {/* Hoja superior */}
      <g className="leaf-right" style={{ transformOrigin: '50px 20px', animationDuration: '3s' }}>
        <path d="M 50 20 Q 60 5 50 -5 Q 40 5 50 20" fill={colors.leafLight} />
      </g>

      <circle cx="75" cy="15" r="2" fill={colors.gold} className="sparkle" />
      <circle cx="20" cy="25" r="2" fill={colors.gold} className="sparkle" style={{ animationDelay: '1.5s' }} />
    </svg>
  );

  // --- FASE 3: EL ÁRBOL MAJESTUOSO ---
  const renderArbol = () => (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      <style>{animationStyles}</style>
      
      <ellipse cx="50" cy="90" rx="30" ry="8" fill="#1e1e1e" />
      
      {/* Tronco robusto */}
      <path d="M 40 90 Q 45 50 35 30 L 65 30 Q 55 50 60 90 Z" fill={colors.stem} />
      {/* Textura tronco */}
      <path d="M 45 85 Q 48 60 42 40" fill="none" stroke="#6b4423" strokeWidth="2" strokeLinecap="round" />
      <path d="M 55 88 Q 52 55 58 35" fill="none" stroke="#6b4423" strokeWidth="2" strokeLinecap="round" />

      {/* Copa del árbol respirando */}
      <g className="tree-crown" style={{ transformOrigin: '50px 30px' }}>
        {/* Sombra base */}
        <circle cx="50" cy="25" r="30" fill={colors.leafDark} />
        <circle cx="25" cy="35" r="20" fill={colors.leafDark} />
        <circle cx="75" cy="35" r="20" fill={colors.leafDark} />
        <circle cx="35" cy="15" r="22" fill={colors.leafDark} />
        <circle cx="65" cy="15" r="22" fill={colors.leafDark} />
        
        {/* Luces (Hojas claras) */}
        <circle cx="50" cy="20" r="25" fill={colors.leafLight} />
        <circle cx="30" cy="30" r="15" fill={colors.leafLight} />
        <circle cx="70" cy="30" r="15" fill={colors.leafLight} />
        
        {/* Detalles extras en la copa */}
        <path d="M 40 10 Q 50 0 60 10" fill="none" stroke="#9cf3af" strokeWidth="4" strokeLinecap="round" />
        <path d="M 25 25 Q 30 15 40 20" fill="none" stroke="#9cf3af" strokeWidth="3" strokeLinecap="round" />
        <path d="M 75 25 Q 70 15 60 20" fill="none" stroke="#9cf3af" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Partículas de energía dorada (Vigor) */}
      <circle cx="10" cy="50" r="2.5" fill={colors.gold} className="sparkle" />
      <circle cx="90" cy="40" r="2" fill={colors.gold} className="sparkle" style={{ animationDelay: '0.8s' }} />
      <circle cx="80" cy="70" r="1.5" fill={colors.gold} className="sparkle" style={{ animationDelay: '1.2s' }} />
      <circle cx="20" cy="80" r="2" fill={colors.gold} className="sparkle" style={{ animationDelay: '2s' }} />
      <circle cx="50" cy="-10" r="3" fill={colors.gold} className="sparkle" style={{ animationDelay: '0.5s' }} />
    </svg>
  );

  // Renderizar según nivel RPG de Veta & Vigor
  let content = null;
  if (nivel >= 31) {
    content = renderArbol();
  } else if (nivel >= 11) {
    content = renderPlanta();
  } else {
    content = renderBrote(); // Nivel 1-10
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: size, height: size }}>
      {content}
    </div>
  );
}
