/**
 * Guard de "solo avanzar" para reproducir el progreso pendiente del Reto 21
 * (tabla local reto_progreso_pendiente) contra el estado real del servidor.
 *
 * Existe porque este progreso se escribe directo a `perfiles`, no vía una
 * RPC atómica -- si el servidor ya alcanzó o superó lo que quedó encolado
 * (por ejemplo, el mismo día se completó desde otro dispositivo, o el
 * usuario volvió a intentarlo online mientras la fila seguía pendiente),
 * aplicar la fila vieja igual pisaría el avance real. Se compara por la
 * tupla (día, completado) y no solo el día: el servidor puede estar ya en
 * el día 21 sin que reto_completado sea true todavía (ese último paso es
 * el que cierra el reto).
 */
export function debeAplicarProgresoPendiente(pendiente, servidor) {
  const diaServidor = servidor.reto_dia_actual ?? 0;
  const completadoServidor = !!servidor.reto_completado;
  const diaPendiente = pendiente.reto_dia_actual;
  const completadoPendiente = !!pendiente.reto_completado;

  const yaAlcanzado =
    diaServidor > diaPendiente ||
    (diaServidor === diaPendiente && completadoServidor === completadoPendiente);

  return !yaAlcanzado;
}

/**
 * retos_completados_count se recalcula contra el valor fresco del servidor
 * en vez de guardarse como valor absoluto en la fila pendiente -- así no se
 * pisa un contador que pudo haber avanzado por otro camino mientras la fila
 * esperaba a sincronizarse.
 */
export function calcularRetosCompletadosCount(servidor, completadoPendiente) {
  const completadoServidor = !!servidor.reto_completado;
  const actual = servidor.retos_completados_count || 0;
  return !completadoServidor && completadoPendiente ? actual + 1 : actual;
}
