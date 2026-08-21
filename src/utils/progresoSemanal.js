// Meta fija de días activos por semana (la semana completa, 7 días) --
// reemplaza la meta anterior de 3/4 días de rutina, ahora que Descanso
// Activo y Bienestar también cuentan como "día activo".
export const META_DIAS_SEMANA = 7;

/**
 * Cuenta días únicos de la semana con actividad en cualquiera de las tres
 * fuentes -- un día con actividad en más de una tabla cuenta una sola vez.
 * @param {{historialFechas?: string[], checkinsFechas?: string[], bienestarFechas?: string[]}} fechas
 */
export function contarDiasEntrenadosSemana({ historialFechas = [], checkinsFechas = [], bienestarFechas = [] }) {
  const dias = new Set();
  [...historialFechas, ...checkinsFechas, ...bienestarFechas].forEach(f => { if (f) dias.add(f); });
  return dias.size;
}
