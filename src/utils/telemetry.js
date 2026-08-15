import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

/**
 * Telemetría: errores (Sentry) y producto (PostHog).
 *
 * Todo lo de aquí es OPCIONAL y silencioso: si faltan las variables de entorno,
 * las funciones no hacen nada y la app funciona igual. Así el build no depende
 * de tener cuentas configuradas y se puede desplegar sin ellas.
 *
 * DECISIÓN DE PRIVACIDAD
 * Esta app guarda fotos corporales, peso, porcentaje de grasa y hábitos de
 * salud. Por eso la captura automática va DESACTIVADA a propósito:
 *   · sin grabación de sesión
 *   · sin autocapture de clics ni texto del DOM
 *   · el texto de los inputs va enmascarado
 *   · a Sentry no se le manda el email, solo el id de usuario
 * Se registran únicamente los eventos declarados abajo, uno a uno.
 */

const SENTRY_DSN    = import.meta.env.VITE_SENTRY_DSN;
const POSTHOG_KEY   = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST  = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let sentryListo  = false;
let posthogListo = false;

export function iniciarTelemetria() {
  if (SENTRY_DSN && !sentryListo) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        // Distingue los fallos de la web de los de la app instalada, que es la
        // primera pregunta que uno se hace al ver un error.
        environment: import.meta.env.MODE,
        // No mandar cabeceras, cookies ni direcciones IP.
        sendDefaultPii: false,
        // Muestreo bajo de rendimiento: suficiente para detectar lentitud sin
        // agotar la cuota gratuita.
        tracesSampleRate: 0.1,
        ignoreErrors: [
          // Ruido conocido que no es un fallo de la app.
          'ResizeObserver loop limit exceeded',
          'Failed to fetch dynamically imported module',
          'Can only be used on:', // OneSignal quejándose del dominio en local
          'Failed to update a ServiceWorker',
          'The object is in an invalid state',
          'InvalidStateError',
        ],
      });
      sentryListo = true;
    } catch (e) {
      console.warn('No se pudo iniciar Sentry:', e);
    }
  }

  if (POSTHOG_KEY && !posthogListo) {
    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Ver la nota de privacidad arriba: nada de captura automática.
        autocapture: false,
        disable_session_recording: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
        // Solo se crea perfil de quien inicia sesión; los anónimos no generan
        // uno, que además consume cuota sin aportar nada.
        person_profiles: 'identified_only',
        capture_pageview: false, // se registra a mano, ver evento app_abierta
        capture_pageleave: true,
      });
      posthogListo = true;
    } catch (e) {
      console.warn('No se pudo iniciar PostHog:', e);
    }
  }
}

/**
 * Cuentas propias y de prueba, para poder excluirlas de las métricas.
 *
 * Se define en VITE_EMAILS_INTERNOS, separadas por comas. El email NO se envía
 * a ningún sitio: solo se usa aquí para decidir si marcar a la persona con
 * `interno: true`, y es esa etiqueta la que viaja.
 *
 * Importa más de lo que parece. Con pocos usuarios activos, tus propias
 * pruebas dominan cualquier estadística: verías una retención altísima que en
 * realidad eres tú abriendo la app veinte veces al día.
 */
const EMAILS_INTERNOS = (import.meta.env.VITE_EMAILS_INTERNOS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Asocia lo que pase a partir de ahora con este usuario.
 * Se manda el id, nunca el email: para cruzarlo con una persona real ya tienes
 * Supabase, y así la telemetría no guarda datos personales.
 *
 * @param {string} userId
 * @param {object} propiedades
 * @param {string} [email] solo para clasificar como interno; no se envía
 */
export function identificarUsuario(userId, propiedades = {}, email = null) {
  if (!userId) return;

  const esInterno = !!email && EMAILS_INTERNOS.includes(email.toLowerCase());

  if (sentryListo)  Sentry.setUser({ id: userId });
  if (posthogListo) posthog.identify(userId, { ...propiedades, interno: esInterno });
}

export function olvidarUsuario() {
  if (sentryListo)  Sentry.setUser(null);
  if (posthogListo) posthog.reset();
}

/** Registra un evento de producto. Ver EVENTOS abajo para la lista cerrada. */
export function evento(nombre, propiedades = {}) {
  if (posthogListo) {
    try {
      posthog.capture(nombre, propiedades);
    } catch (e) {
      console.warn('Fallo registrando evento', nombre, e);
    }
  }
}

/** Manda un error a Sentry. Úsalo en los catch que hoy solo hacen console. */
export function registrarError(error, contexto = {}) {
  console.error(error);
  if (sentryListo) {
    Sentry.captureException(error, { extra: contexto });
  }
}

/**
 * EVENTOS
 *
 * Lista deliberadamente corta. Cada uno responde a una pregunta concreta que
 * hoy no puedes contestar; medir de más es la forma más rápida de acabar sin
 * mirar ninguno.
 *
 *   APP_ABIERTA          ¿vuelven al día 2, al 7, al 30?
 *   ONBOARDING_COMPLETADO ¿cuántos de los que se registran llegan a usar la app?
 *   RETO_DIA_COMPLETADO   ¿en qué día del reto abandona la gente?
 *   RUTINA_COMPLETADA     ¿entrenan fuera del reto?
 *   PAYWALL_VISTO         ¿a cuánta gente le llega?
 *   PAYWALL_DESCARTADO    ¿cuántos lo cierran sin comprar?
 *   COMPRA_INICIADA       ¿cuántos llegan a la pasarela?
 *   COMPRA_COMPLETADA     ¿cuántos pagan? (vistos → iniciadas → completadas)
 */
export const EVENTOS = {
  APP_ABIERTA:           'app_abierta',
  ONBOARDING_COMPLETADO: 'onboarding_completado',
  RETO_DIA_COMPLETADO:   'reto_dia_completado',
  RUTINA_COMPLETADA:     'rutina_completada',
  PAYWALL_VISTO:         'paywall_visto',
  PAYWALL_DESCARTADO:    'paywall_descartado',
  COMPRA_INICIADA:       'compra_iniciada',
  COMPRA_COMPLETADA:     'compra_completada',
};
