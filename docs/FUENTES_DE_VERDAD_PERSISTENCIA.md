# Fuentes de verdad — persistencia de datos (auditoría 2026-08-16)

Este documento mapea, por dominio de dato, cuál de las 5 capas de
persistencia de la app es la fuente de verdad, cuáles otras capas
guardan una copia, y qué riesgos de desincronización existen hoy. No es
un rediseño — es terreno firme para decidir qué tocar primero dentro del
punto 1 del backlog de salud de código (ver memoria
`backlog-salud-de-codigo`).

Las 5 capas:

1. **SQLite local** (`src/services/DatabaseService.js`, vía
   `@capacitor-community/sqlite`) — espejo del usuario en el
   dispositivo, con banderas `is_dirty` para saber qué falta subir.
2. **Supabase** (Postgres remoto) — la base real. La mayoría de las
   tablas de usuario están protegidas por RLS + triggers.
3. **IndexedDB / localforage** — usada en DOS instancias/configs
   independientes (`DatabaseManager.js` y `LocalDB.js`, ver abajo), como
   caché adicional a SQLite para los mismos datos.
4. **user_metadata** (Supabase Auth, `auth.users.raw_user_meta_data`) —
   caché rápida/offline (viaja con la sesión/JWT) de datos que también
   viven en `perfiles`; nunca autoritativa cuando hay conflicto, aunque
   el código no siempre lo trata así de forma consistente (ver abajo).
5. **localStorage** — caché de lectura síncrona para UI, timestamps, y
   una segunda cola offline independiente de la de SQLite (ver abajo).

`SyncService.js` (`pullData`/`pushData`) es el puente entre SQLite local
y Supabase para casi todo. Su regla central: nunca pisar una fila local
con `is_dirty = 1` al bajar del servidor (`_idsSucios`/`_sinSucias`), y
un allowlist explícito de qué campos del perfil sí sube el push genérico
(ver bloque 1 de `pushData`).

---

## Tabla resumen

| Dominio | Fuente de verdad | Quién escribe | Capas que también lo guardan | Riesgo conocido / estado |
|---|---|---|---|---|
| XP, monedas (`puntos_forja`), `racha_actual` | Supabase `perfiles`, escrito **solo** por la RPC `completar_mision_rpg` (atómica, con idempotencia) | Servidor (RPC `SECURITY DEFINER`) | SQLite local (espejo; nunca debería originar un cambio, ver abajo) | Blindado por trigger `proteger_columnas_perfiles` desde el 16/08 — el cliente no puede escribir estas columnas directo. Único hueco que quedaba (SyncService nunca revisaba bonos de racha en el outbox offline) se cerró hoy (2026-08-16, ver memoria `racha-bono-igualdad-estricta`). |
| Progreso Reto 21 (`reto_dia_actual`, `reto_ultimo_completado`, `reto_completado`, `retos_completados_count`) | Supabase `perfiles`, escrito **directo** (no vía RPC atómica) por `RutinaRetoPlayer.jsx` / `Reto21Dias.jsx` (`handleEnroll`) | Cliente, con `update()` directo a la tabla | SQLite local: espejo inmediato + tabla outbox nueva `reto_progreso_pendiente` | **RESUELTO (2026-08-16).** `RutinaRetoPlayer.jsx` ahora encola el progreso (`queueRetoOffline`) si falla el intento online, con una fila hermana en `rpg_historial_recompensas` para el XP. `SyncService.pushData()` las reproduce con un guard de "solo avanzar" (`retoProgresoGuard.js`) que relee el estado real del servidor antes de aplicar, para no pisar un avance ya adelantado por otro camino. Cubierto por tests. |
| `rpg_historial_recompensas` (outbox de recompensas de entrenamientos normales y del Reto 21 offline) | Local únicamente — la tabla no existe en Supabase | `RutinaDetail.jsx`, `MiRutina.jsx`, `RutinaRetoPlayer.jsx` (offline) al ganar una recompensa; `SyncService.pushData` la reproduce contra `completar_mision_rpg` y la vacía | — | **RESUELTO (2026-08-16).** Se agregó a `TABLAS_SINCRONIZADAS` — una fila atascada en `is_dirty=1` ahora sí hace que `pushData()` reporte incompleto. |
| Catálogos (`sistemas_entrenamiento`, `retos`, `reto_dias`, `rutinas`, `ejercicios_biblioteca`, `rutina_ejercicios`) | Supabase, contenido editado desde el panel de admin | — | SQLite local, refrescado cada 24h (`sync_metadata`) o al forzar desde el botón de recarga | Bajo riesgo: son de solo lectura para el usuario final, sin escritura del cliente que pueda desincronizar. |
| `plan_membresia` (RevenueCat/Stripe) | Supabase `perfiles.plan_membresia` — el cliente **no tiene permiso de UPDATE directo**, solo vía RPCs `SECURITY DEFINER` | RevenueCat (cliente, `App.jsx` reconcilia al abrir la app) y Stripe (`stripe-webhook/index.ts`, con `service_role`, bypassa las RPCs) | SQLite (solo lectura, push bloqueado — seguro), `user_metadata.suscripcion` (copia rápida) | Dos alimentadores independientes conviven bien; queda como riesgo abierto de fondo que una tercera vía futura podría romper la invariante sin RLS que lo detecte (Stripe ya la bypassa a propósito, por diseño). **La staleness de `user_metadata.suscripcion` está RESUELTA (2026-08-16)**: los `updateUser` posteriores a una RPC de plan ahora usan `actualizarAuthMetaConReintento`, que encola el reintento si fallan. |
| `user_metadata` de Supabase Auth (peso, fuerza, avatar, onboarding, `nivel`/`sistema_activo`/`dias_entrenamiento`, etc.) | Depende del campo — para casi todo lo que se solapa con `perfiles`, **`perfiles` manda**; `user_metadata` es caché rápida/offline, no autoridad | Cliente | `perfiles` (Supabase) + SQLite para los campos que se solapan | El propio código desconfía de esto para decisiones sensibles (`App.jsx`: "consultamos directo la BD... para estar 100% seguros"). **RESUELTO (2026-08-16)**: `nivel`/`sistema_activo`/`dias_entrenamiento` en `CuestionarioModal.jsx` ahora usan el mismo helper con reintento (`actualizarAuthMetaConReintento`) en vez de perder la segunda escritura en silencio si falla. `App.jsx` sigue reconociendo el desfase para `avatar_url`/`foto_antes`/`foto_despues` y lo corrige a mano comparando ambas copias cada vez. |
| `rol_usuario` | Supabase `perfiles.rol_usuario` | Servidor/admin | SQLite (`perfiles.rol_usuario`) **y** `localStorage['user_role']` | **Triplicado.** localStorage es caché de lectura síncrona para gating de UI (usado en ~8 archivos), sin invalidación declarada — si el rol cambia en Supabase, nada garantiza que se actualice ahí antes de la próxima sesión. |
| Progreso de la sesión de ejercicio del día del reto (ronda actual, ejercicios marcados) | `localStorage['vigor_reto_progreso_...']` | Cliente | Ninguna otra (es intencional: recuperación ante refresh/cierre accidental, con comentario explícito en el código) | Bajo riesgo — su propio dominio, se limpia al completar el día. |
| Cola offline de `UPDATE_PERFIL`/`INSERT_CHECKIN`/`UPDATE_AUTH_META`/`INSERT_HISTORIAL` | `localStorage['veta_vigor_offline_queue']` (`OfflineManager.js`) | Cliente | Dos mecanismos de cola offline, ambos vigentes a propósito: esta (localStorage) y la de `is_dirty` en SQLite (`SyncService.js`) | **RESUELTO COMO GUÍA (2026-08-16), no unificados.** Regla explícita: SQLite `is_dirty`+`SyncService` cuando el "queda pendiente" necesita ser visible en `_quedanCambiosSinSubir` y/o el replay necesita lógica propia de guard (`rpg_historial_recompensas`, `reto_progreso_pendiente`); `OfflineManager`/localStorage para refrescos de caché de bajo riesgo y auto-corregibles (`actualizarAuthMetaConReintento`). |
| Perfil, rutinas, checkins (caché adicional) | Supabase / SQLite (fuente real) | — | Hasta 3 copias locales: SQLite (`DatabaseService`+`SyncService`), IndexedDB vía `DatabaseManager.js` (`profile_*`, `routines_*`, `checkin_*`, `bienestar_*`), e IndexedDB vía `LocalDB.js` (`rutina_*`, `mis_rutinas_*`, para el botón "descargar offline") | **RESUELTO (2026-08-16), no era un bug.** Verificado leyendo los 3 sitios de lectura reales (`Perfil.jsx`, `MiRutina.jsx`, `App.jsx`): todos pintan desde la caché y reconcilian con datos frescos en cuanto llegan, sin excepción. `DatabaseManager.js`/`LocalDB.js` no tienen escritura propia de vuelta al servidor — son solo-lectura. Se documentó la regla de precedencia explícita en la cabecera de ambos archivos. |
| `relacion_entrenador_alumno` (estados `pendiente`/`activo`/`inactivo`/`desvinculado`) | Supabase, solo vía RPC (`canjear_invitacion_entrenador`, `aceptar_vinculacion`, etc. — RLS bloquea INSERT directo del cliente) | Servidor (RPC) | SQLite local (sincronizada por `SyncService`, ver mecánica arriba) | Bajo riesgo — `entrenador_id`/`alumno_id` inmutables por trigger tras creada la fila. Sin duplicado en localStorage/user_metadata (solo `user_role`, que es un dato derivado, no la relación en sí). |
| Comisión por referido — Socio Fundador Vitalicio (`codigo_referido`, `referidos_count`, `referido_por`) | Supabase `perfiles`, vía las RPCs nuevas de `VETA_VIGOR_SISTEMA_REFERIDOS.sql` (`generar_mi_codigo_referido`, `canjear_codigo_referido`) | Cliente autenticado, a través de esas RPCs | SQLite/local: no aplica, es solo-servidor | **RESUELTO (2026-08-17), pendiente de que Gerardo corra el SQL en Supabase.** Antes era 100% decorativo (el código nunca se guardaba, nadie podía ingresar el de quien lo refirió). Ahora `Login.jsx` captura el código al registrarse, `OnboardingModal.jsx` lo canjea, y `MisGanancias.jsx` genera un código real y persistido. El cálculo/pago del monto sigue siendo manual (Gerardo no puede usar Stripe por política de Google Play) — `AdminComisiones.jsx` (tab nuevo en `AdminPanel.jsx`) le da el reporte crudo mes a mes. Ver memoria `sistema-comisiones-referidos`. |
| Comisión de entrenador por ex-alumno desvinculado (`ganancias`, `comision_personalizada`) | *Nadie todavía — feature a futuro, sin construir, sin urgencia (confirmado por el usuario).* Blindadas por trigger contra escritura del cliente, pero no hay ninguna RPC/webhook en el código que las escriba porque el mecanismo de negocio no está diseñado del todo. Distinta de la fila de arriba (esa sí se construyó). | — (planeado: RPC nueva, ver nota) | — | **No es un bug — confirmado con el usuario (16/08), sin urgencia.** La idea: un alumno que el entrenador metió a la app y que DESPUÉS se desvincula de ese entrenador, sigue generándole un % de comisión cada vez que el ex-alumno paga. Falta definir: por cuánto tiempo dura el derecho a comisión tras la desvinculación, si aplica a cada renovación o solo la primera, y de dónde sale el %. **Bloqueador de fondo adicional**: no existe ningún registro de pagos reales con monto en toda la base (`stripe-webhook/index.ts` solo actualiza `plan_membresia`, `compras_log` no tiene monto, RevenueCat no tiene webhook propio en el repo) — antes de calcular cualquier comisión hace falta construir ese registro de pagos, sea cual sea la regla que se termine definiendo. Ver memoria `idea-comision-ex-alumno-desvinculado`. |
| Logo del entrenador (`perfiles.logo_entrenador`) | Supabase — **ya resuelto (16/08)** | Cliente (`Perfil.jsx`), tras subir a Storage | `perfiles_publico` (vista pública que lo expone al alumno) | Causa raíz real: la columna nunca existió, el UPDATE fallaba en silencio y mostraba una alerta engañosa sobre el bucket. Se agregó la columna y se republicó la vista (`VETA_VIGOR_AGREGAR_LOGO_ENTRENADOR.sql`). Regla de negocio añadida después: el logo se pierde al degradar de plan (`Entrenador Élite` es el único plan que lo permite). Cerrado, sin acción pendiente. |

---

## Mecánica de sincronización (SQLite local ↔ Supabase)

- **Pull** (`SyncService.pullData`): perfil se salta la bajada completa
  si tiene `is_dirty=1` local. El resto de tablas de usuario
  (`habitos_diarios`, `checkins`, `checkins_bienestar`,
  `historial_entrenamientos`, `rpg_inventario`,
  `relacion_entrenador_alumno`) filtran fila por fila con
  `_idsSucios`/`_sinSucias`: una fila local sucia nunca se pisa, aunque
  el servidor traiga esa misma fila.
- **Push** (`SyncService.pushData`): el perfil solo sube `nivel` y
  `sistema_activo` — todo lo demás (economía RPG, progreso de reto,
  monetización) está excluido a propósito porque cada uno tiene su
  propio camino de escritura directa o su propia RPC atómica. El resto
  de tablas hacen upsert/insert simple de sus filas sucias.
- **`_quedanCambiosSinSubir`** decide si `pushData()` devuelve
  `true`/`false` recorriendo `TABLAS_SINCRONIZADAS` — una lista fija que
  hoy no incluye `rpg_historial_recompensas` (ver arriba).

---

## Hallazgos priorizados — estado al 2026-08-16 (tarde)

De los 7 hallazgos originales de esta auditoría, 6 quedaron resueltos en
la misma sesión (plan en `C:\Users\grd_a\.claude\plans\lexical-scribbling-whale.md`,
si todavía existe). El único abierto es una pregunta, no una tarea de código:

1. ✅ **Reto21 sin camino offline** — resuelto. Cola dedicada
   (`reto_progreso_pendiente` + fila hermana en `rpg_historial_recompensas`),
   con guard de "solo avanzar" (`src/utils/retoProgresoGuard.js`) y tests
   en `src/services/__tests__/SyncService.retoProgreso.test.js`.
2. ✅ **Tres copias locales sin precedencia declarada** — investigado a
   fondo: no era un bug (las 3 lecturas reales ya reconciliaban
   correctamente), solo faltaba documentarlo. Regla explícita agregada a
   `DatabaseManager.js`/`LocalDB.js`.
3. ✅ **`nivel`/`sistema_activo`/`dias_entrenamiento` doble escritura no
   transaccional** — resuelto con `actualizarAuthMetaConReintento`
   (`src/utils/OfflineManager.js`) en `CuestionarioModal.jsx`.
4. ✅ **Dos colas offline paralelas** — resuelto como guía explícita, no
   unificación: SQLite+`SyncService` para outbox con guard propio,
   `OfflineManager`/localStorage para refrescos de caché auto-corregibles.
5. ✅ **`rpg_historial_recompensas` fuera de `TABLAS_SINCRONIZADAS`** —
   agregada. Test de caracterización actualizado para reflejar el fix.
6. ✅ **`user_metadata.suscripcion` puede desfasarse** — resuelto con el
   mismo helper `actualizarAuthMetaConReintento`, en los 4 puntos donde
   se llama tras una RPC de plan (`App.jsx` x2, `Paywall.jsx`,
   `PaywallCoach.jsx`).
7. 💡 **Comisión por ex-alumno desvinculado — feature a futuro, sin
   diseño cerrado todavía.** No es un hueco de sincronización: confirmado
   con el usuario (16/08) que es una idea de producto pendiente, no algo
   que ya debería estar funcionando. Ver la fila de la tabla arriba para
   el detalle y lo que falta definir antes de poder implementarla.
   **No confundir con la comisión por referido de Socio Fundador
   Vitalicio (17/08) — esa es un sistema distinto y ya se construyó**
   (ver fila de la tabla arriba, memoria `sistema-comisiones-referidos`).

No priorizados por ser de bajo riesgo confirmado: catálogos (solo
lectura), relación entrenador-alumno (bien protegida por RLS/triggers),
logo del entrenador (ya resuelto desde antes de esta auditoría),
progreso de sesión de ejercicio en `localStorage` (su propio dominio,
sin solapamiento).

---

*Auditoría hecha en una sola sesión (2026-08-16) combinando lectura
directa del código de esta conversación con 3 investigaciones en
paralelo. Es un mapa de "qué encontramos hoy", no una garantía de
exhaustividad total — si aparece un dato importante que no está acá,
vale la pena agregarlo en vez de asumir que ya se revisó.*
