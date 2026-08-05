/**
 * Veta & Vigor RPG - Progression Engine
 * Maneja las matemáticas de niveles, experiencia y cálculo de atributos.
 */

// XP requerida por nivel (Lineal 100 XP por nivel)
export const getXpForLevel = (level) => {
  if (level <= 1) return 0;
  return (level - 1) * 100;
};

// Determina el nivel actual basado en la XP total
export const calculateLevel = (totalXp) => {
  return Math.floor((totalXp || 0) / 100) + 1;
};

// Calcula el progreso porcentual hacia el siguiente nivel
export const getLevelProgress = (totalXp, currentLevel) => {
  if (currentLevel >= 99) return 100;
  const xpCurrentLevel = getXpForLevel(currentLevel);
  const xpNextLevel = getXpForLevel(currentLevel + 1);
  const xpNeeded = xpNextLevel - xpCurrentLevel;
  if (xpNeeded <= 0) return 0; // Prevenir NaN por división entre 0
  const xpGained = totalXp - xpCurrentLevel;
  return Math.min(100, Math.max(0, (xpGained / xpNeeded) * 100));
};

// ==========================================
// RANGOS Y TÍTULOS (FASE 3)
// ==========================================
export const getRpgTitle = (nivel) => {
  if (!nivel) return 'Iniciado';
  if (nivel >= 50) return 'Leyenda';
  if (nivel >= 31) return 'Maestro del Hierro';
  if (nivel >= 11) return 'Forjador';
  return 'Iniciado';
};

// Obtiene la Madera correspondiente al nivel
export const getMaderaForLevel = (level) => {
  if (level >= 50) return { nombre: 'Roble', color: '#1a1a1a', textColor: '#D4AF37' }; // Negro/Dorado
  if (level >= 31) return { nombre: 'Tzalam', color: '#8B5A2B', textColor: '#FFFFFF' }; // Madera Oscura
  if (level >= 11) return { nombre: 'Pino', color: '#D4AF37', textColor: '#000000' }; // Dorado Claro
  return { nombre: 'Semilla', color: '#2E8B57', textColor: '#FFFFFF' }; // Verde Orgánico
};

// Recompensas por Entrenar (Fijo 10 XP y 5 Monedas sin bonos extra)
export const calculateWorkoutRewards = () => {
  return { 
    xp: 10, 
    puntosForja: 5, 
    statsBonus: { fuerza: 0, agilidad: 0, resistencia: 0 } 
  };
};

// ==========================================
// EL GÓLEM DEL LASTRE
// ==========================================
export const getGolpesTotales = (totalXp) => {
  return Math.floor((totalXp || 0) / 25);
};

export const getGolpesDisponibles = (totalXp, golpesUtilizados) => {
  const totales = getGolpesTotales(totalXp);
  return Math.max(0, totales - (golpesUtilizados || 0));
};
