import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { actualizarAuthMetaConReintento } from '../utils/OfflineManager';
import { DatabaseManager } from '../utils/DatabaseManager';
import DatabaseService from '../services/DatabaseService';
import SyncService from '../services/SyncService';
import OneSignal from '@onesignal/capacitor-plugin';
import { setupScheduledNotifications } from '../utils/ScheduledNotifications';
import { identificarUsuario, evento, EVENTOS } from '../utils/telemetry';

// Extraído de App.jsx (20/08) sin cambiar comportamiento: arranque de
// sesión (checkSession), rol/paywall (checkUserRoleAndPaywall), servicios
// nativos (inicializarServiciosNativos) y el listener onAuthStateChange.
// Era la pieza de mayor riesgo real del archivo -- ver la nota junto a
// `await inicializarServiciosNativos(session);` más abajo sobre el bug
// real que causó (RevenueCat/notificaciones sin inicializar en sesión
// cacheada). Cualquier cambio futuro en esta zona debe probarse en
// dispositivo real, no solo en el navegador.
export function useAppSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCuestionario, setShowCuestionario] = useState(false);
  const [showExpediente, setShowExpediente] = useState(false);
  const [hasSkippedExpediente, setHasSkippedExpediente] = useState(false);
  // El listener de onAuthStateChange (más abajo) se suscribe una sola vez y
  // vive todo el ciclo de vida del componente -- su closure quedaría
  // congelada en hasSkippedExpediente=false para siempre. Sin esta ref, un
  // refresh de token en segundo plano (Supabase lo hace cada hora) volvería
  // a mostrar el modal de Expediente aunque el usuario ya lo hubiera
  // saltado.
  const hasSkippedExpedienteRef = useRef(false);
  const [pendingNominacion, setPendingNominacion] = useState(null);
  const [pendingVinculacion, setPendingVinculacion] = useState(null);
  const [showDroppedStudentModal, setShowDroppedStudentModal] = useState(false);
  const [showTrialWarningModal, setShowTrialWarningModal] = useState(false);
  const [showPlatinumTrialModal, setShowPlatinumTrialModal] = useState(false);
  const [userRoleState, setUserRoleState] = useState(localStorage.getItem('user_role') || 'atleta_normal');

  useEffect(() => {
    const checkPendingPurchases = async (session) => {
      if (!session?.user?.email) return;
      try {
        if (session?.user?.id) {
          // También traemos el rol_usuario para el menú
          const { data: perfilData } = await supabase
            .from('perfiles')
            .select('rol_usuario, plan_membresia')
            .eq('id', session.user.id)
            .single();
          if (perfilData && perfilData.rol_usuario) {
            localStorage.setItem('user_role', perfilData.rol_usuario);
          }
        }

        // El servidor busca la compra por el email de la sesión, aplica el plan
        // y consume la fila en una sola transacción. Antes el cliente leía la
        // tabla y se escribía el plan a sí mismo.
        const { data } = await supabase.rpc('aplicar_compra_pendiente');

        if (data?.ok) {
          await supabase.auth.updateUser({ data: { suscripcion: data.plan } });
          alert(`¡Felicidades! Hemos detectado y aplicado exitosamente tu compra de: ${data.plan}. ¡Bienvenido!`);
          window.location.reload();
        }
      } catch (err) {
        console.error("Error checking pending purchases", err);
      }
    };

    const checkUserRoleAndPaywall = async (user) => {
      if (!user?.id) return;

      // 1. Carga instantánea desde IndexedDB (localforage)
      const localProfile = await DatabaseManager.getProfile(user.id);
      if (localProfile) {
        if (localProfile.rol_usuario) {
          localStorage.setItem('user_role', localProfile.rol_usuario);
          setUserRoleState(localProfile.rol_usuario);
        }
      }

      // 2. Sincronización en segundo plano con Supabase
      const { data: rolData, error } = await supabase
        .from('perfiles')
        .select('rol_usuario, plan_membresia, force_paywall, force_platinum_trial, platinum_trial_ends_at, reto_activo_id, reto_completado')
        .eq('id', user.id)
        .maybeSingle();

      // Si no hay internet o error en Supabase, abortar la sincronización pero ya cargamos lo local
      if (error) {
        console.warn("Error sincronizando perfil, usando caché local", error);
        return;
      }

      if (rolData) {
        // Guardar copia fresca en la base local
        await DatabaseManager.saveProfile(user.id, rolData);
      }

      let finalRole = rolData?.rol_usuario || null;
      let forcePlatinumModal = false;

      // Vencimiento del trial Platinum.
      // La comparación de fechas la hace el servidor con su propio now(), así el
      // reloj del teléfono ya no decide cuándo se acaba el regalo. La RPC solo
      // degrada, nunca asciende.
      if (rolData?.platinum_trial_ends_at && rolData?.plan_membresia === 'Platinum') {
        const { data: sync } = await supabase.rpc('sincronizar_mi_plan');
        if (sync?.degradado) {
          rolData.plan_membresia = 'Atleta Base (Gratis)';
          rolData.platinum_trial_ends_at = null;
        }
      }

      if (rolData?.force_platinum_trial) {
        forcePlatinumModal = true;
      }

      // Check Invitaciones de Entrenador (Para usuarios nuevos)
      // El servidor busca la invitación por el email de la sesión y crea la
      // relación EN ESTADO 'pendiente' — ya no la deja 'activo' de inmediato.
      // Que un entrenador conozca tu correo no significa que hayas aceptado
      // ser su alumno. finalRole ya NO se pone en 'alumno_entrenador' aquí:
      // el bloque de pendingVinculacion (más abajo) detecta la relación
      // pendiente por su cuenta y muestra el modal de aceptar/rechazar con
      // el nombre del entrenador. El rol solo se asigna dentro de
      // aceptar_vinculacion(), si el alumno de verdad acepta.
      if (user.email) {
        await supabase.rpc('canjear_invitacion_entrenador');
      }

      if (finalRole) {
        if (finalRole === 'alumno_entrenador') {
          const { data: rel } = await supabase
            .from('relacion_entrenador_alumno')
            .select('id')
            .eq('alumno_id', user.id)
            .in('estado', ['activo', 'pendiente'])
            .maybeSingle();

          if (!rel) {
            finalRole = 'atleta_normal';
            const now = new Date().toISOString();

            // El servidor reconfirma que no queda ninguna relación viva antes de
            // devolver el rol. Solo regala los 7 días si el alumno estaba en el
            // plan gratuito: quien ya pagaba conserva el suyo, y devuelve
            // regalo=false para que no le arranquemos un contador de prueba.
            const { data: baja } = await supabase.rpc('alumno_perdio_entrenador');

            if (baja?.regalo) {
              await supabase.auth.updateUser({
                data: { trial_start_date: now }
              });
              setShowDroppedStudentModal(true);
            }
          }
        }

        if (rolData?.plan_membresia === 'Prueba Gratis (7 Días)' && finalRole !== 'alumno_entrenador') {
          const trialStart = user.user_metadata?.trial_start_date;
          if (trialStart) {
            const startDate = new Date(trialStart);
            const now = new Date();
            const diffTime = Math.abs(now - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 7) {
               // El servidor revalida los 7 días contra su propio reloj.
               await supabase.rpc('vencer_prueba_gratis');
               setShowTrialWarningModal(true);
            } else if (diffDays >= 5 && diffDays < 7) {
               setShowTrialWarningModal(true);
            } else if (!user.user_metadata?.trial_accepted) {
               setShowDroppedStudentModal(true);
            }
          }
        }

        localStorage.setItem('user_role', finalRole);
        setUserRoleState(finalRole);
      }

      if (rolData?.force_paywall) {
        if (finalRole === 'entrenador') {
          const trainerPaidPlans = ['Entrenador Pro', 'Entrenador Élite', 'Entrenador Elite'];
          const hasTrainerPlan = trainerPaidPlans.some(p => (rolData.plan_membresia || '').includes(p));
          setShowPaywall(!hasTrainerPlan);
        } else {
          const athletePaidPlans = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio'];
          const hasAthletePlan = athletePaidPlans.some(p => (rolData.plan_membresia || '').includes(p));

          // La lista de arriba no reconoce 'Platinum' (el trial, sin "Plan "
          // — activar_trial_platinum() lo escribe así a propósito, distinto
          // del plan pago) ni al inscrito en el Reto21, que Comunidad.jsx sí
          // deja pasar por su cuenta pero nunca llega a esa pantalla si acá
          // se bloquea la app entera primero. tiene_acceso_platinum() ya
          // existe en el servidor y revisa los 4 planes pagos + 'Platinum' +
          // la fecha de vencimiento en un solo lugar (18/08).
          let accesoPlatinum = false;
          try {
            const { data } = await supabase.rpc('tiene_acceso_platinum');
            accesoPlatinum = !!data;
          } catch (e) {
            console.warn('tiene_acceso_platinum falló, se sigue solo con la lista local:', e);
          }
          // reto_activo_id nunca se limpia a null al terminar el reto (solo
          // se marca reto_completado aparte) -- sin el && de abajo, quien ya
          // terminó el Reto21 seguiría destrabando el paywall para siempre,
          // sin importar si su regalo de 7 días de Platino (si le tocó) ya
          // venció.
          const estaEnReto = !!rolData.reto_activo_id && !rolData.reto_completado;

          setShowPaywall(!(hasAthletePlan || accesoPlatinum || estaEnReto));
        }
      } else {
        setShowPaywall(false);
      }

      setShowPlatinumTrialModal(forcePlatinumModal);
    };

    // OneSignal + RevenueCat. Extraída para poder llamarse desde los DOS
    // caminos de checkSession (sesión en caché y sesión nueva) — antes vivía
    // solo al final de la función y el camino de sesión en caché salía con un
    // `return` antes de llegar aquí, así que Purchases.configure() no corría
    // en casi ninguna apertura real. Ver la nota junto a la llamada.
    const inicializarServiciosNativos = async (sesionActual) => {
      // Inicializar OneSignal Nativo (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          OneSignal.initialize("f0e7f7a8-6da8-4592-92a7-542f731a91f0");
          OneSignal.Notifications.requestPermission(true);

          if (sesionActual?.user?.id) {
            OneSignal.login(sesionActual.user.id);
          }

          // Prevenir que la notificación push brinque si el usuario está con la app abierta
          OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
            event.preventDefault();
          });
        } catch (e) {
          console.error("Error inicializando OneSignal nativo:", e);
        }
      }

      // Programar notificaciones locales (8 AM frase del día, 6 PM recordatorio entrenamiento)
      if (sesionActual?.user) {
        setupScheduledNotifications(sesionActual, supabase);
      }

      // Inicializar RevenueCat con el ID del usuario si está logueado
      if (sesionActual?.user) {
        try {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

          if (Capacitor.isNativePlatform()) {
             // Solo inicializamos RevenueCat si estamos corriendo nativo (Android)
             await Purchases.configure({
               apiKey: 'goog_ksbcOecVHSqMAxOFCxsNKGmmRuU',
               appUserID: sesionActual.user.id
             });
             console.log("RevenueCat configurado exitosamente");

             // --- VERIFICACIÓN AUTOMÁTICA DE SUSCRIPCIÓN ACTIVA ---
             // Preguntamos a RevenueCat si el usuario tiene compras/suscripciones activas
             const customerInfo = await Purchases.getCustomerInfo();
             const entitlementsActivos = customerInfo.entitlements.active;
             const activeEntitlements = Object.keys(entitlementsActivos);

             if (sesionActual.user.email !== 'somos.vetayvigor@gmail.com') {
                // Consultamos directamente la BD en lugar de user_metadata para estar 100% seguros
                const { data: perfilInfo } = await supabase
                   .from('perfiles')
                   .select('plan_membresia')
                   .eq('id', sesionActual.user.id)
                   .single();

                const currentPlan = perfilInfo?.plan_membresia || 'Atleta Base (Gratis)';
                const isPaidPlan = ['Socio Argentum', 'Socio Aurum', 'Plan Platinum', 'Socio Fundador Vitalicio', 'Entrenador Pro', 'Entrenador Élite'].includes(currentPlan);

                if (activeEntitlements.length === 0) {
                   // Sin pagos activos en RevenueCat: si la BD piensa que es VIP,
                   // lo regresamos a Gratis.
                   if (isPaidPlan) {
                       console.log("Suscripción expirada en RevenueCat. Regresando a Gratis automáticamente.");
                       // Solo degrada, nunca asciende, así que exponerla es inofensivo.
                       await supabase.rpc('degradar_plan_sin_suscripcion');
                       await actualizarAuthMetaConReintento({ suscripcion: 'Atleta Base (Gratis)' });
                       // Recargamos para que la app aplique el bloqueo inmediatamente
                       window.location.reload();
                   }
                } else {
                   // Sí hay pagos activos, pero puede que NO sea el mismo plan que
                   // tiene la BD -- por ejemplo, alguien que bajó de Entrenador
                   // Élite a Entrenador Pro desde los ajustes de suscripción de
                   // Play Store, fuera de la app. RevenueCat ya no reporta "cero
                   // entitlements" en ese caso (sigue pagando Pro), así que la
                   // rama de arriba nunca se activa y el plan viejo se quedaba
                   // pegado para siempre.
                   //
                   // Mismo criterio de patrón que activar_plan_por_compra en el
                   // servidor (élite antes que pro, porque un identificador podría
                   // contener ambas palabras) -- si no reconoce el producto, la
                   // RPC simplemente no hace nada, es segura de llamar de más.
                   const productIds = activeEntitlements.map(k => entitlementsActivos[k]?.productIdentifier).filter(Boolean);
                   const mejorProductId =
                       productIds.find(id => /elite|élite/i.test(id)) ||
                       productIds.find(id => /pro/i.test(id)) ||
                       productIds.find(id => /vitalicio/i.test(id)) ||
                       productIds.find(id => /platinum/i.test(id)) ||
                       productIds.find(id => /aurum/i.test(id)) ||
                       productIds.find(id => /argentum/i.test(id));

                   if (mejorProductId) {
                       const idLower = mejorProductId.toLowerCase();
                       const planEsperado =
                           /elite|élite/.test(idLower) ? 'Entrenador Élite' :
                           /pro/.test(idLower)         ? 'Entrenador Pro' :
                           null; // los de atleta no hace falta reconciliarlos aquí

                       if (planEsperado && planEsperado !== currentPlan) {
                           console.log(`Plan de RevenueCat (${planEsperado}) no coincide con la BD (${currentPlan}). Reconciliando.`);
                           const { data } = await supabase.rpc('activar_plan_por_compra', { p_product_id: mejorProductId });
                           if (data?.ok) {
                               await actualizarAuthMetaConReintento({ suscripcion: data.plan });
                               window.location.reload();
                           }
                       }
                   }
                }
             }
             // -----------------------------------------------------
          }
        } catch (e) {
          console.error("Error al configurar RevenueCat:", e);
        }
      }
    };

    const checkSession = async () => {
      // SAFETY NET: Force-kill the splash screen after 60 seconds no matter what.
      // Native SQLite inserts can take up to 30-40 seconds on older devices
      // due to lack of batching in SyncService.
      const safetyTimer = setTimeout(() => {
        console.warn("⚠️ SAFETY TIMEOUT: Forcing splash screen to close after 60 seconds.");
        setLoading(false);
      }, 60000);

      const startTime = Date.now();
      // Marcas de tiempo del arranque. Se envían con app_abierta para poder
      // medirlo en los móviles reales, sin depender de conectar por USB.
      let msSesion = null;   // cuánto costó inyectar/renovar la sesión
      let msSqlite = null;   // cuánto tardó SQLite en estar listo (en paralelo)
      // Cuánto llevaba el documento cargándose antes de que React arrancara:
      // separa el coste del WebView y del bundle del coste de nuestro código.
      const msAntesDeReact = Math.round(performance.now());

      try {
        // ===================================================================
        // PASO 0: ARRANCAR SQLITE **SIN BLOQUEAR**
        //
        // Antes esto era un await, y era la causa principal del arranque lento.
        // En web, inicializar SQLite descarga el loader de jeep-sqlite (292 KB) y
        // sql-wasm.wasm (638 KB), y encima compila el WASM — casi un mega y un
        // motor arrancando antes de pintar un solo píxel.
        //
        // Ya no se espera: DatabaseService encola internamente cualquier consulta
        // hasta que la base esté lista (ver _ready), así que ninguna pantalla se
        // rompe por consultar antes de tiempo.
        // ===================================================================
        DatabaseService.setupDatabase()
          .then(ok => {
            msSqlite = Date.now() - startTime;
            console.log(ok ? `✅ SQLite listo en ${msSqlite} ms (en segundo plano).` : "⚠️ SQLite no disponible.");
          })
          .catch(dbInitErr => console.error("❌ Falló inicialización de SQLite:", dbInitErr));

        // ===================================================================
        // PASO 1: LEER LA SESIÓN DEL CACHÉ LOCAL (localStorage) - SIN INTERNET
        // Supabase guarda automáticamente el token en localStorage.
        // Lo leemos directamente para no depender de internet al arrancar.
        // ===================================================================
        let session = null;

        // Intentar leer la sesión cacheada de localStorage directamente
        const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (storageKey) {
          try {
            const raw = JSON.parse(localStorage.getItem(storageKey));
            if (raw?.access_token && raw?.user) {
              // Construir un objeto session compatible con lo que espera la app
              session = {
                access_token: raw.access_token,
                refresh_token: raw.refresh_token,
                user: raw.user
              };
              // Inyectar la sesión en el cliente de Supabase, para que las pantallas
              // que consulten pronto lleven el JWT y no choquen contra RLS.
              //
              // PERO CON TOPE DE ESPERA. El token de acceso caduca a la hora, así que
              // si la app llevaba tiempo cerrada, setSession sale a la red a renovarlo
              // — con la radio del móvil recién despertando. Era el único await del
              // arranque y explicaba por qué abrir tras muchas horas tardaba tanto,
              // mientras que abrirla dos veces seguidas iba fina.
              //
              // Si en 1,5 s no ha renovado, se pinta igual y la renovación termina
              // por detrás: la app arranca con datos locales de todos modos, y el
              // propio cliente de Supabase reintenta en la siguiente consulta.
              const inyeccion = supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
              }).catch(e => console.warn("Error injecting session to Supabase client", e));

              const t0Sesion = Date.now();
              await Promise.race([
                inyeccion,
                new Promise(r => setTimeout(r, 1500))
              ]);
              msSesion = Date.now() - t0Sesion;
              console.log(`✅ Sesión cargada desde caché local en ${msSesion} ms.`);
            }
          } catch (parseErr) {
            console.warn("Error parsing cached session:", parseErr);
          }
        }

        // Si tenemos sesión cacheada, usarla inmediatamente
        if (session?.user) {
          setSession(session);

          // =================================================================
          // PASO 2: ROL DESDE localStorage — SÍNCRONO, COSTE CERO
          //
          // El rol ya quedó cacheado aquí en el arranque anterior (lo escribe el
          // paso 2-bis). Leerlo de localStorage es instantáneo y evita tener que
          // esperar a SQLite solo para saber qué menú pintar.
          // =================================================================
          const rolCacheado = localStorage.getItem('user_role');
          if (rolCacheado) {
            setUserRoleState(rolCacheado);
          }

          // =================================================================
          // PASO 3: MOSTRAR UI INMEDIATAMENTE (Sin esperas artificiales)
          // =================================================================

          clearTimeout(safetyTimer);
          setLoading(false); // ← EL USUARIO YA ESTÁ DENTRO 🚀

          // startTime estaba declarado y sin usar. Ahora sirve para medir: con
          // chrome://inspect conectado al móvil puedes ver el tiempo real hasta
          // que la app es utilizable, en frío y tras horas cerrada.
          console.log(`⏱️ Arranque hasta UI utilizable: ${Date.now() - startTime} ms`);

          // Telemetría: se marca aquí, cuando la app es realmente utilizable,
          // no al empezar a cargar. Así "app_abierta" mide sesiones de verdad
          // y no intentos fallidos de arranque.
          identificarUsuario(
            session.user.id,
            {
              plataforma: Capacitor.isNativePlatform() ? 'nativo' : 'web',
              rol: rolCacheado || 'desconocido',
            },
            // El email se usa solo para marcar la cuenta como interna; no viaja.
            session.user.email
          );
          evento(EVENTOS.APP_ABIERTA, {
            plataforma: Capacitor.isNativePlatform() ? 'nativo' : 'web',
            // Desglose del arranque. Sin esto solo se puede medir conectando el
            // móvil por USB, y el caso que importa —abrir tras muchas horas—
            // es justo el que no se reproduce a demanda.
            ms_hasta_usable: Date.now() - startTime,
            ms_antes_de_react: msAntesDeReact,
            ms_sesion: msSesion,
            ms_sqlite: msSqlite,   // null si aún no había terminado
          });

          // =================================================================
          // PASO 2-BIS: HIDRATAR DESDE SQLite, YA CON LA UI PINTADA
          //
          // Esto era el paso 2 y estaba antes del render. Ahora corre detrás:
          // espera sin prisa a que SQLite termine de arrancar, corrige el rol si
          // el cacheado estaba desactualizado, y detecta si es un dispositivo
          // nuevo para forzar el primer sync.
          // =================================================================
          (async () => {
            try {
              const perfilRows = await DatabaseService.query(
                `SELECT rol_usuario, sistema_activo FROM perfiles WHERE id = ?`,
                [session.user.id]
              );
              const localProfile = perfilRows?.[0] || null;

              if (localProfile?.rol_usuario) {
                localStorage.setItem('user_role', localProfile.rol_usuario);
                if (localProfile.rol_usuario !== rolCacheado) {
                  setUserRoleState(localProfile.rol_usuario);
                }
                console.log("✅ Perfil hidratado desde SQLite.");
                return;
              }

              // Sin perfil local: dispositivo nuevo. Se fuerza el primer sync,
              // que ya corría en segundo plano antes de este cambio.
              console.log("⚠️ No hay perfil local, forzando sync inicial...");
              await supabase.auth.getSession(); // asegura el JWT antes de los SELECT masivos
              Promise.race([
                SyncService.syncAll(session.user.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('sync_timeout')), 60000))
              ]).catch(err => console.warn("Fallo sync inicial forzado:", err));
            } catch (dbErr) {
              console.warn("Hidratación desde SQLite falló (no es fatal):", dbErr);
            }
          })();

          // =================================================================
          // PASO 4: SINCRONIZACIÓN SILENCIOSA CON SUPABASE (POR DETRÁS)
          // Si hay internet, refresca el token y sincroniza datos.
          // Si NO hay internet, simplemente no hace nada y el usuario
          // sigue usando la app con los datos locales.
          // =================================================================
          (async () => {
            try {
              const { data } = await Promise.race([
                supabase.auth.getSession(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('bg_timeout')), 8000))
              ]);

              const freshSession = data?.session || null;
              if (freshSession) {
                setSession(freshSession); // Actualizar con sesión fresca

                // Sincronizar rol/paywall silenciosamente
                await Promise.race([
                  checkUserRoleAndPaywall(freshSession.user),
                  new Promise(r => setTimeout(r, 5000))
                ]);

                // Sincronizar SQLite bidireccionalmente
                await Promise.race([
                  SyncService.syncAll(freshSession.user.id),
                  new Promise(r => setTimeout(r, 10000))
                ]);
              }
            } catch (bgErr) {
              console.warn("Background sync skipped (no internet or timeout):", bgErr);
            }
          })();

          // Sin await: no debe retrasar el pintado de la pantalla. Se lanza
          // aquí, no se omite — antes este camino salía sin haber llamado
          // NUNCA a esto, y era el camino que se toma en casi cada apertura.
          inicializarServiciosNativos(session);

          return; // ← Salir aquí, ya mostramos la UI
        }

        // =================================================================
        // FALLBACK: No hay sesión cacheada (usuario nuevo o borró datos)
        // En este caso SÍ necesitamos internet para autenticar.
        // =================================================================
        try {
          const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('session_timeout')), 8000))
          ]);
          session = data?.session || null;
        } catch (sessionErr) {
          console.warn("Session fetch timed out (new user flow):", sessionErr);
          session = null;
        }

        setSession(session);

        if (session?.user) {
          try {
            await Promise.race([
              checkUserRoleAndPaywall(session.user),
              new Promise(r => setTimeout(r, 2000))
            ]);

            // Sincronizar SQLite bidireccionalmente
            console.log("⚠️ Nuevo login, forzando sincronización completa inicial (en segundo plano)...");
            Promise.race([
              SyncService.syncAll(session.user.id),
              new Promise((_, reject) => setTimeout(() => reject(new Error('initial_sync_timeout')), 60000))
            ]).catch(syncErr => console.warn("Background sync error (non-fatal):", syncErr));
          } catch (syncErr) {
            console.warn("Background role/paywall check error:", syncErr);
          }
        }

        // Mostrar UI sin esperas adicionales
      } catch (err) {
        console.warn("Critical error in checkSession, defaulting to safe state:", err);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }

      // Este bloque quedó fuera del try/catch/finally de arriba a propósito: la
      // rama de sesión en caché (PASO 3, el camino normal en cada apertura)
      // termina en un `return` para pintar la UI cuanto antes. Un `return`
      // dentro de un try SÍ deja correr el finally, pero al terminar el finally
      // la función sale — el código de aquí abajo nunca se alcanzaba en ese
      // camino. Resultado: Purchases.configure() no corría en casi ninguna
      // apertura real, solo en la primera vez que no hay sesión en caché. Por
      // eso el paywall fallaba siempre con "Purchases must be configured
      // before calling this function" — no era una carrera de tiempos, era
      // código muerto. Se llama ahora desde los dos caminos.
      await inicializarServiciosNativos(session);

      if (session) {
        checkPendingPurchases(session);

        // Verificar solicitud pendiente de entrenador
        (async () => {
          try {
            const { data: pending } = await supabase
              .from('relacion_entrenador_alumno')
              .select('id, entrenador_id')
              .eq('alumno_id', session?.user?.id)
              .eq('estado', 'pendiente')
              .maybeSingle();

            if (pending) {
              // perfiles_publico, no perfiles: la tabla base ya no deja leer
              // filas ajenas completas (blindaje 16/08); la vista da email
              // aqui porque existe esta relacion pendiente con el entrenador.
              const { data: trainerProfile } = await supabase
                .from('perfiles_publico')
                .select('full_name, email')
                .eq('id', pending.entrenador_id)
                .single();

              if (trainerProfile) {
                setPendingVinculacion({
                  relacionId: pending.id,
                  entrenadorId: pending.entrenador_id,
                  nombre: trainerProfile.full_name,
                  email: trainerProfile.email
                });
              }
            }
          } catch (err) {
            console.error('Error checking pending vinculacion:', err);
          }
        })();

        // Verificar Muro de Fama
        supabase.from('muro_fama').select('*').eq('user_id', session?.user.id).eq('estado', 'pendiente').maybeSingle().then(({ data }) => {
          if (data) setPendingNominacion(data);
        });

        // Track ultimo ingreso y revisar si hay un RESET forzado por el admin
        supabase.from('perfiles').select('nivel, plan_membresia, foto_antes, foto_despues, avatar_url').eq('id', session?.user.id).single().then(({ data }) => {
          if (data?.nivel === 'RESET') {
            // Borrar el progreso local del usuario (onboarding)
            supabase.auth.updateUser({ data: { onboarding_complete: false, cuestionario_complete: false, expediente_completado: false } }).then(() => {
              // Limpiar la bandera en la base de datos
              supabase.from('perfiles').update({ nivel: 'Semilla' }).eq('id', session?.user.id).then(() => {
                window.location.reload();
              });
            });
            return;
          }

          let updates = {};

          // Sincronizar el plan de membresía de la BD con los metadatos de Auth si cambió
          const currentSub = session?.user.user_metadata?.suscripcion || session?.user.user_metadata?.plan_membresia;
          if (data?.plan_membresia && data.plan_membresia !== currentSub) {
            updates.suscripcion = data.plan_membresia;
          }

          // Sincronizar expediente_completado si ya subieron foto en el pasado y no lo tienen en auth
          if (data?.foto_antes && !session?.user.user_metadata?.expediente_completado) {
            updates.expediente_completado = true;
          }

          // Sincronizar fotos entre dispositivos
          if (data?.foto_antes && data.foto_antes !== session?.user.user_metadata?.foto_antes) {
            updates.foto_antes = data.foto_antes;
          }
          if (data?.foto_despues && data.foto_despues !== session?.user.user_metadata?.foto_despues) {
            updates.foto_despues = data.foto_despues;
          }
          if (data?.avatar_url && data.avatar_url !== session?.user.user_metadata?.avatar_url) {
            updates.avatar_url = data.avatar_url;
          }

          if (Object.keys(updates).length > 0) {
            supabase.auth.updateUser({ data: updates });
            setSession(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                user: {
                  ...prev.user,
                  user_metadata: { ...prev.user.user_metadata, ...updates }
                }
              };
            });
          }
        });

        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session?.user.id).then();

        // OneSignal Web Prompt (solo para PWA en navegador, no en app nativa).
        // Se engancha a la promesa que expone index.html, que resuelve cuando
        // init() ya terminó. Encolar en OneSignalDeferred no sirve: esa cola no
        // espera a que el init asíncrono complete.
        if (!Capacitor.isNativePlatform() && session?.user?.id) {
          window.oneSignalListo
            ?.then(async (OneSignal) => {
              await OneSignal.login(session.user.id);
              await OneSignal.Slidedown.promptPush();
            })
            .catch(e => console.warn('OneSignal web:', e?.message || e));
        }

        const metadata = session?.user.user_metadata || {};
        if (!metadata.onboarding_complete) {
          setShowOnboarding(true);
          setShowCuestionario(false);
        } else if (!metadata.cuestionario_complete) {
          setShowOnboarding(false);
          setShowCuestionario(true);
        } else {
          setShowOnboarding(false);
          setShowCuestionario(false);
        }
      }
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session?.user && Capacitor.isNativePlatform()) {
        try {
          await Purchases.logIn({ appUserID: session?.user.id });
          OneSignal.login(session.user.id);
        } catch (e) {
          console.error("Error al loguear usuario en RC/OneSignal:", e);
        }
      } else if (!session && Capacitor.isNativePlatform()) {
        try {
          await Purchases.logOut();
          OneSignal.logout();
        } catch {}
      }

      if (session) {
        await checkUserRoleAndPaywall(session.user);

        checkPendingPurchases(session);
        // Track ultimo ingreso
        supabase.from('perfiles').update({ ultimo_ingreso: new Date().toISOString() }).eq('id', session?.user.id).then();

        // OneSignal Web Prompt (solo para PWA en navegador, no en app nativa).
        // Se engancha a la promesa que expone index.html, que resuelve cuando
        // init() ya terminó. Encolar en OneSignalDeferred no sirve: esa cola no
        // espera a que el init asíncrono complete.
        if (!Capacitor.isNativePlatform() && session?.user?.id) {
          window.oneSignalListo
            ?.then(async (OneSignal) => {
              await OneSignal.login(session.user.id);
              await OneSignal.Slidedown.promptPush();
            })
            .catch(e => console.warn('OneSignal web:', e?.message || e));
        }

        const metadata = session?.user.user_metadata || {};
        if (!metadata.onboarding_complete) {
          setShowOnboarding(true);
          setShowCuestionario(false);
          setShowExpediente(false);
        } else if (!metadata.cuestionario_complete) {
          setShowOnboarding(false);
          setShowCuestionario(true);
          setShowExpediente(false);
        } else if (!metadata.expediente_completado && !hasSkippedExpedienteRef.current) {
          setShowOnboarding(false);
          setShowCuestionario(false);
          setShowExpediente(true);
        } else {
          setShowOnboarding(false);
          setShowCuestionario(false);
          setShowExpediente(false);
        }
      } else {
        setShowOnboarding(false);
        setShowCuestionario(false);
        setShowExpediente(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Combina el ref (leído por el listener de arriba) y el state (leído por
  // el render de App.jsx) en una sola llamada, para que ExpedienteModal no
  // tenga que conocer la existencia del ref.
  const skipExpediente = () => {
    hasSkippedExpedienteRef.current = true;
    setHasSkippedExpediente(true);
  };

  return {
    session,
    loading,
    showPaywall, setShowPaywall,
    showOnboarding, setShowOnboarding,
    showCuestionario, setShowCuestionario,
    showExpediente, setShowExpediente,
    hasSkippedExpediente, skipExpediente,
    pendingNominacion, setPendingNominacion,
    pendingVinculacion, setPendingVinculacion,
    showDroppedStudentModal, setShowDroppedStudentModal,
    showTrialWarningModal, setShowTrialWarningModal,
    showPlatinumTrialModal, setShowPlatinumTrialModal,
    userRoleState,
  };
}
