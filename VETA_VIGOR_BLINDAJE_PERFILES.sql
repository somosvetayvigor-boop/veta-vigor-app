-- =====================================================================
-- VETA & VIGOR — Blindaje de la tabla perfiles (Fase 1: monetización)
-- =====================================================================
--
-- PROBLEMA
-- Las columnas que deciden el acceso de pago (plan_membresia, rol_usuario,
-- force_paywall, force_platinum_trial, platinum_trial_ends_at) las escribe
-- el navegador con un UPDATE normal. Como la anon key es pública por diseño,
-- cualquier usuario logueado puede darse Platinum desde la consola.
--
-- ESTRATEGIA
-- Privilegios por columna. En Postgres los privilegios de columna y las
-- políticas RLS se evalúan en AND, así que esto funciona sin importar cómo
-- estén tus políticas actuales de perfiles.
--
-- Las funciones de abajo son SECURITY DEFINER: corren como su dueño y por
-- tanto ignoran estos GRANT. Ese es el único camino que queda para tocar las
-- columnas protegidas, que es justamente lo que buscamos.
--
-- ⚠️ ORDEN DE APLICACIÓN — no lo saltes:
--    1. Publica primero los cambios de React que acompañan a este archivo
--       (quitar plan_membresia y force_platinum_trial del push de
--       SyncService.js:211). Si revocas antes de publicar, las apps ya
--       instaladas fallarán en cada sync y reintentarán en bucle.
--    2. Cuando la v77 esté en manos de los usuarios, corre este script.
--
-- =====================================================================


-- =====================================================================
-- BLOQUE 0 — 🔴 FUGA DE DATOS PERSONALES — APLICAR YA, POR SEPARADO
-- =====================================================================
--
-- Esta política existe hoy en tu base de datos:
--
--   policyname: "Public profiles are viewable by everyone."
--   cmd: SELECT   roles: {public}   qual: true
--
-- roles={public} incluye el rol `anon`, y qual=true significa "sin filtro".
-- Resultado: cualquiera en internet, sin cuenta y sin iniciar sesión, puede
-- descargar la tabla perfiles completa usando la anon key que va dentro de tu
-- bundle de JavaScript.
--
-- Lo que queda expuesto de TODOS tus usuarios:
--   · email            (dirección real)
--   · full_name        (nombre real)
--   · foto_antes / foto_despues  → URLs públicas del bucket fotos_progreso,
--                                  es decir fotos corporales de antes/después
--   · ganancias, comision_personalizada  (ingresos de tus entrenadores)
--   · codigo_referido, chat_bloqueado
--
-- Esto no es pérdida de ingresos: es una brecha de datos personales, con la
-- agravante de que incluye fotos corporales. Va antes que todo lo demás.
--
-- Es seguro aplicarlo ahora mismo, sin esperar a la v77: verifiqué que la app
-- nunca consulta perfiles sin sesión iniciada (Login.jsx no la toca), y la
-- política "Todos pueden ver perfiles" ya cubre a los usuarios autenticados.

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.perfiles;

-- Verificación: no debe quedar ninguna política de SELECT con qual = true.
--   SELECT policyname, roles, qual FROM pg_policies
--    WHERE tablename = 'perfiles' AND cmd = 'SELECT';

-- ⚠️ Esto cierra la puerta a los no autenticados, pero cualquier usuario
-- logueado sigue viendo el email, las fotos y las ganancias de todos los
-- demás. Eso se arregla en el BLOQUE 0-bis, que necesita revisar antes qué
-- columnas usan Comunidad y get_leaderboard para no romperlos.


-- =====================================================================
-- BLOQUE 0-TER — 🔴 ESCALADA HORIZONTAL — APLICAR YA, CON EL BLOQUE 0
-- =====================================================================
--
-- Política actual en relacion_entrenador_alumno:
--
--   "Entrenadores manejan a sus alumnos"
--   cmd: ALL   qual: (auth.uid() = entrenador_id)   with_check: null
--
-- ALL incluye INSERT, y with_check nulo reutiliza el USING. Ese USING solo
-- valida entrenador_id — nunca alumno_id. Así que cualquier autenticado puede
-- insertar {entrenador_id: él mismo, alumno_id: cualquiera, estado:'activo'}
-- y, vía la política entrenadores_pueden_actualizar_alumnos de perfiles,
-- obtener UPDATE sobre el perfil completo de esa víctima.
--
-- Escalada horizontal sobre toda la base de usuarios, con escritura.
--
-- Es seguro cortarlo ya: el único INSERT a esta tabla en toda la app es
-- App.jsx:596, y lo ejecuta el alumno sobre sí mismo tras validar una
-- invitación — pasa por la política de alumnos, no por esta. PanelEntrenador
-- solo hace DELETE. Ningún flujo real usa el INSERT del entrenador.

DROP POLICY IF EXISTS "Entrenadores manejan a sus alumnos"
    ON public.relacion_entrenador_alumno;

-- Se reemplaza por los tres verbos que el entrenador sí necesita, sin INSERT.
CREATE POLICY "Entrenadores ven sus vinculos"
    ON public.relacion_entrenador_alumno FOR SELECT
    USING (auth.uid() = entrenador_id);

CREATE POLICY "Entrenadores actualizan sus vinculos"
    ON public.relacion_entrenador_alumno FOR UPDATE
    USING      (auth.uid() = entrenador_id)
    WITH CHECK (auth.uid() = entrenador_id);

CREATE POLICY "Entrenadores eliminan sus vinculos"
    ON public.relacion_entrenador_alumno FOR DELETE
    USING (auth.uid() = entrenador_id);

-- Y el grafo entrenador-alumno completo también era de lectura pública
-- ("Todos pueden leer relación", SELECT con qual = true).
--
-- ⚠️ OJO: esta tabla NO tiene ninguna política de admin, y AdminEntrenadores.jsx:33
-- y :109 la consultan. Tu panel funciona hoy únicamente gracias a esa lectura
-- pública: como admin no eres ni entrenador_id ni alumno_id de esas filas, al
-- quitarla te quedarías sin datos. Por eso el orden aquí importa —
-- crear la política de admin ANTES del DROP.

CREATE POLICY "Admin ve todas las relaciones"
    ON public.relacion_entrenador_alumno FOR SELECT
    USING ((auth.jwt() ->> 'email') = 'somos.vetayvigor@gmail.com');

DROP POLICY IF EXISTS "Todos pueden leer relación"
    ON public.relacion_entrenador_alumno;

-- PENDIENTE (no urgente, no es escalada): la política
-- "alumnos_pueden_gestionar_su_vinculacion" permite a un alumno insertar un
-- vínculo con CUALQUIER entrenador sin invitación previa. No da poder sobre
-- terceros — el alumno solo se expone a sí mismo — pero salta tu flujo de
-- invitaciones y ensucia las listas de tus entrenadores. Lo correcto es
-- sustituir ese INSERT por una RPC que valide invitaciones_entrenador.


-- =====================================================================
-- BLOQUE 1 — Privilegios por columna
-- =====================================================================
--
-- CONFIRMADO con tu volcado de pg_policies: las políticas "Atletas pueden
-- actualizar su propio perfil" y "Users can update own profile" son ambas
-- UPDATE con USING (auth.uid() = id) y WITH CHECK nulo. En Postgres, un
-- WITH CHECK nulo en UPDATE reutiliza la expresión de USING — así que el
-- usuario puede escribir CUALQUIER columna de su propia fila.
-- La vulnerabilidad del paywall está confirmada, no es hipotética.

REVOKE UPDATE ON public.perfiles FROM authenticated, anon;

-- Solo estas columnas quedan en manos del usuario. Todo lo que no aparece
-- aquí pasa a ser exclusivo del servidor.
GRANT UPDATE (
    -- Identidad y presentación
    username,
    full_name,
    avatar_url,
    display_preference,
    updated_at,
    ultimo_ingreso,

    -- Progreso de entrenamiento (offline-first: el teléfono es la fuente)
    nivel,
    sistema_activo,
    dias_entrenamiento,
    calendario_personalizado,
    foto_antes,
    foto_despues,

    -- Progreso del reto — ver NOTA A al final
    reto_activo_id,
    reto_dia_actual,
    reto_ultimo_completado,
    reto_completado,
    reto_fecha_inicio,

    -- Social
    usuarios_silenciados,

    -- Marca de tiempo del paywall (no otorga acceso, solo evita repetir)
    last_paywall_shown_date,

    -- Fase 2 — ver NOTA B al final. Siguen abiertas porque SyncService
    -- todavía las empuja; revocarlas hoy rompería el sync.
    puntos_totales,
    retos_completados_count,
    nivel_rpg,
    stat_fuerza,
    stat_agilidad,
    stat_resistencia,

    -- Cosmético. LaPrueba.jsx:162 lo premia directamente y los marcos se
    -- compran con puntos_forja vía comprar_item_rpg. Queda abierto porque el
    -- daño máximo es lucir un marco no ganado; cerrarlo bien exige validar
    -- contra rpg_inventario, y eso va con la fase 2.
    marco_activo
) ON public.perfiles TO authenticated;

-- Columnas que quedan cerradas a partir de aquí:
--   MONETIZACIÓN  plan_membresia, force_paywall, force_platinum_trial,
--                 platinum_trial_ends_at, rol_usuario
--   DINERO REAL   ganancias, comision_personalizada, codigo_referido,
--                 referidos_count
--   MODERACIÓN    chat_bloqueado
--   ECONOMÍA RPG  xp_actual, puntos_forja, racha_actual, marco_activo
--                 (ya eran autoritativas del servidor vía completar_mision_rpg;
--                  sin este REVOKE el RPC era decorativo — el cliente podía
--                  escribir el saldo directamente y saltárselo)
--   INMUTABLES    id, created_at, email


-- =====================================================================
-- BLOQUE 2 — Acceso derivado (elimina la degradación desde el cliente)
-- =====================================================================
--
-- Hoy el propio cliente se degrada al vencer el trial (App.jsx:570). Un
-- usuario que impida que ese código corra, no vence nunca.
--
-- Con esta función el vencimiento deja de necesitar escritura alguna: se
-- deduce de la fecha. El trial caduca solo.

CREATE OR REPLACE FUNCTION public.tiene_acceso_platinum(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = p_user_id
          AND (
                plan_membresia IN (
                    'Socio Argentum', 'Socio Aurum', 'Plan Platinum',
                    'Socio Fundador Vitalicio', 'Platinum'
                )
             OR platinum_trial_ends_at > now()
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.tiene_acceso_platinum(uuid) TO authenticated;


-- =====================================================================
-- BLOQUE 3 — Activar el trial de 7 días (el servidor pone la fecha)
-- =====================================================================
--
-- Antes: PlatinumTrialModal.jsx:19 escribía plan_membresia = 'Platinum' y
-- calculaba platinum_trial_ends_at en el navegador. El cliente elegía su
-- propia fecha de vencimiento.
--
-- Ahora: el servidor exige que la bandera esté puesta y calcula now() + 7 días.
-- Idempotente: si ya hay un trial vigente no lo extiende.

CREATE OR REPLACE FUNCTION public.activar_trial_platinum()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_perfil public.perfiles%ROWTYPE;
BEGIN
    SELECT * INTO v_perfil FROM public.perfiles WHERE id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'perfil_inexistente');
    END IF;

    -- El regalo tiene que haber sido otorgado por el servidor.
    IF COALESCE(v_perfil.force_platinum_trial, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_oferta_pendiente');
    END IF;

    -- Idempotencia: si ya corre un trial, apagamos la bandera y no extendemos.
    IF v_perfil.platinum_trial_ends_at > now() THEN
        UPDATE public.perfiles
           SET force_platinum_trial = false
         WHERE id = auth.uid();
        RETURN jsonb_build_object('ok', true, 'motivo', 'ya_activo',
                                  'expira', v_perfil.platinum_trial_ends_at);
    END IF;

    -- Se escribe plan_membresia = 'Platinum' además de la fecha. No es
    -- redundante: App.jsx:43, Comunidad.jsx:449 y Consultorio.jsx:41 deciden el
    -- acceso VIP leyendo plan_membresia, cada uno por su cuenta y ninguno mira
    -- platinum_trial_ends_at. Derivar el acceso solo de la fecha dejaría a los
    -- usuarios en trial fuera de Comunidad y Consultorio.
    -- La diferencia con antes es quién escribe: ahora el servidor, y la fecha
    -- la fija él. El vencimiento lo aplica sincronizar_mi_plan() más abajo.
    UPDATE public.perfiles
       SET plan_membresia         = 'Platinum',
           platinum_trial_ends_at = now() + interval '7 days',
           force_platinum_trial   = false
     WHERE id = auth.uid()
    RETURNING platinum_trial_ends_at INTO v_perfil.platinum_trial_ends_at;

    RETURN jsonb_build_object('ok', true, 'expira', v_perfil.platinum_trial_ends_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activar_trial_platinum() TO authenticated;


-- =====================================================================
-- BLOQUE 4 — Descartar ofertas (solo apagar, nunca encender)
-- =====================================================================

-- "No, gracias. Prefiero seguir en la versión gratuita."
CREATE OR REPLACE FUNCTION public.descartar_oferta_platinum()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.perfiles
       SET force_platinum_trial = false
     WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.descartar_oferta_platinum() TO authenticated;


-- "Ahora no" en el paywall. Reemplaza a Paywall.jsx:221, que era la línea
-- que permitía a un usuario cancelar tu botón de admin sin ver el paywall.
CREATE OR REPLACE FUNCTION public.descartar_paywall()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.perfiles
       SET force_paywall           = false,
           last_paywall_shown_date = now()
     WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.descartar_paywall() TO authenticated;


-- =====================================================================
-- BLOQUE 5 — Acciones de admin
-- =====================================================================
--
-- El check de AdminPanel.jsx:15 solo esconde la interfaz: cualquiera puede
-- llamar a la API sin pasar por React. Aquí la comprobación vive en la base
-- de datos, que es donde sirve. Mismo criterio de email que ya usas en la
-- política de push_logs.

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT (SELECT email FROM auth.users WHERE id = auth.uid())
           = 'somos.vetayvigor@gmail.com';
$$;

GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;


-- Botón "enviar paywall" del panel (AdminAtletas.jsx:163, AdminEntrenadores.jsx:124)
CREATE OR REPLACE FUNCTION public.admin_enviar_paywall(p_user_id uuid, p_activar boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.perfiles SET force_paywall = p_activar WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enviar_paywall(uuid, boolean) TO authenticated;


-- Botón "regalar 7 días Platinum" del panel (AdminAtletas.jsx:180)
CREATE OR REPLACE FUNCTION public.admin_enviar_trial_platinum(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.perfiles SET force_platinum_trial = true WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enviar_trial_platinum(uuid) TO authenticated;


-- Cambiar el plan de un usuario a mano (activación manual de compras)
CREATE OR REPLACE FUNCTION public.admin_set_plan(p_user_id uuid, p_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.perfiles SET plan_membresia = p_plan WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_plan(uuid, text) TO authenticated;


-- =====================================================================
-- BLOQUE 6 — Aplicar compras pendientes (reemplaza App.jsx:525)
-- =====================================================================
--
-- Antes el cliente leía compras_pendientes y se escribía el plan a sí mismo.
-- Ahora el servidor comprueba que la compra sea de este usuario (por email)
-- antes de aplicarla, y consume la fila en la misma transacción.

CREATE OR REPLACE FUNCTION public.aplicar_compra_pendiente()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email   text;
    v_compra  record;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT * INTO v_compra
      FROM public.compras_pendientes
     WHERE email = v_email
     LIMIT 1
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_compras');
    END IF;

    UPDATE public.perfiles
       SET plan_membresia = v_compra.plan_membresia
     WHERE id = auth.uid();

    DELETE FROM public.compras_pendientes WHERE id = v_compra.id;

    RETURN jsonb_build_object('ok', true, 'plan', v_compra.plan_membresia);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_compra_pendiente() TO authenticated;


-- =====================================================================
-- VERIFICACIÓN — corre esto después de aplicar
-- =====================================================================
--
-- Debe listar SOLO las columnas del GRANT del bloque 1.
--
-- SELECT column_name
--   FROM information_schema.column_privileges
--  WHERE table_name = 'perfiles'
--    AND grantee    = 'authenticated'
--    AND privilege_type = 'UPDATE'
--  ORDER BY column_name;


-- =====================================================================
-- NOTA A — El progreso del reto sigue siendo escribible
-- =====================================================================
-- reto_completado y reto_dia_actual los escribe el teléfono, porque el reto
-- funciona sin conexión y no hay otra opción. Eso significa que un usuario
-- puede declararse ganador del reto sin haberlo hecho.
--
-- El blindaje real de eso está en reclamar_bono_reto: esa función debe
-- recalcular la elegibilidad desde historial_entrenamientos y NO fiarse de
-- perfiles.reto_completado. No pude revisarla porque vive solo en Supabase.
-- Revísala: si lee reto_completado para decidir, el bono es falsificable.
--
-- Lo mismo aplica a Reto21Dias.jsx:321, que hoy pone force_platinum_trial = 1
-- en el SQLite local y lo sube por sync. Tras esta migración esa escritura
-- será rechazada — que es lo correcto, pero hay que sustituirla por una RPC
-- que verifique la finalización en el servidor.


-- =====================================================================
-- NOTA B — Fase 2 (leaderboard y stats)
-- =====================================================================
-- puntos_totales, retos_completados_count, nivel_rpg y stat_* siguen abiertas
-- porque SyncService.js:213-222 todavía las empuja. Son falsificables, así que
-- hoy tu leaderboard (get_leaderboard) es manipulable.
--
-- No es urgente como lo era la monetización — cuesta reputación, no ingresos.
-- Cuando quieras cerrarlo: sácalas del push igual que ya hiciste con
-- xp_actual/puntos_forja, muévelas a completar_mision_rpg, y quítalas del
-- GRANT del bloque 1.


-- =====================================================================
-- NOTA C — Cadena de escalada vía entrenador (verificar)
-- =====================================================================
-- Tu política "entrenadores_pueden_actualizar_alumnos" concede UPDATE sobre
-- el perfil de otro usuario a quien tenga una fila en
-- relacion_entrenador_alumno con estado = 'activo'.
--
-- Y App.jsx:596 inserta en esa tabla directamente desde el cliente:
--
--     await supabase.from('relacion_entrenador_alumno').insert({
--       entrenador_id: invitacion.entrenador_id,
--       alumno_id: user.id,
--       estado: 'activo'
--     });
--
-- Si esa tabla permite INSERT libre a cualquier autenticado, la cadena es:
-- insertar una fila declarándose entrenador de una víctima → obtener UPDATE
-- sobre su perfil. Comprueba sus políticas:
--
--   SELECT policyname, cmd, qual, with_check FROM pg_policies
--    WHERE tablename = 'relacion_entrenador_alumno';
--
-- El GRANT del bloque 1 acota el daño (un "entrenador" no podrá tocar plan
-- ni ganancias de nadie), pero seguiría pudiendo manipular el entrenamiento
-- de otra persona. El INSERT debe exigir que exista una invitación válida.


-- =====================================================================
-- NOTA D — Políticas duplicadas (limpieza, sin urgencia)
-- =====================================================================
-- Tienes pares redundantes que hacen exactamente lo mismo:
--   · "Atletas pueden actualizar su propio perfil" == "Users can update own profile."
--   · "Atletas pueden insertar su perfil inicial"  == "Users can insert their own profile."
--   · "Admin control total en perfiles" (ALL) ya cubre a "Admins pueden
--     actualizar perfiles" y "Admins pueden eliminar perfiles".
--
-- Las políticas de un mismo comando se combinan con OR, así que duplicar no
-- añade permisos — pero sí dificulta razonar sobre qué está permitido, que es
-- justamente como se cuelan los agujeros. Consolidar cuando haya calma.


-- =====================================================================
-- BLOQUE 7 — RPCs para el resto de escrituras del cliente
-- =====================================================================
-- El primer barrido encontró 6 sitios; el inventario completo dio 26. Estas
-- funciones cubren los 20 restantes.


-- 7.1 — Onboarding: elegir rol inicial (OnboardingModal.jsx:110)
-- El usuario elige entre atleta y entrenador. Lo que NO puede es reescribir
-- un rol de alumno_entrenador, que se gana por invitación.
CREATE OR REPLACE FUNCTION public.elegir_rol_inicial(p_rol text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF p_rol NOT IN ('atleta_normal', 'entrenador') THEN
        RAISE EXCEPTION 'Rol no permitido: %', p_rol;
    END IF;

    UPDATE public.perfiles
       SET rol_usuario = p_rol
     WHERE id = auth.uid()
       AND (rol_usuario IS NULL OR rol_usuario = '' OR rol_usuario = 'atleta_normal');
END;
$$;
GRANT EXECUTE ON FUNCTION public.elegir_rol_inicial(text) TO authenticated;


-- 7.2 — Canjear invitación de entrenador (reemplaza App.jsx:588-605 entero)
-- Antes el cliente leía la invitación, insertaba la relación y se ponía el rol.
-- Ahora el servidor comprueba que la invitación sea para ESTE email.
CREATE OR REPLACE FUNCTION public.canjear_invitacion_entrenador()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
    v_email      text;
    v_invitacion record;
BEGIN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT * INTO v_invitacion
      FROM public.invitaciones_entrenador
     WHERE lower(email_alumno) = v_email
     LIMIT 1 FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_invitacion');
    END IF;

    INSERT INTO public.relacion_entrenador_alumno (entrenador_id, alumno_id, estado)
    VALUES (v_invitacion.entrenador_id, auth.uid(), 'activo');

    UPDATE public.perfiles SET rol_usuario = 'alumno_entrenador' WHERE id = auth.uid();
    DELETE FROM public.invitaciones_entrenador WHERE id = v_invitacion.id;

    RETURN jsonb_build_object('ok', true, 'rol', 'alumno_entrenador');
END;
$$;
GRANT EXECUTE ON FUNCTION public.canjear_invitacion_entrenador() TO authenticated;


-- 7.3 — Aceptar una vinculación pendiente (App.jsx:1119-1126)
CREATE OR REPLACE FUNCTION public.aceptar_vinculacion(p_relacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Solo el alumno de esa fila puede aceptarla.
    UPDATE public.relacion_entrenador_alumno
       SET estado = 'activo'
     WHERE id = p_relacion_id AND alumno_id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_tuya');
    END IF;

    UPDATE public.perfiles SET rol_usuario = 'alumno_entrenador' WHERE id = auth.uid();
    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.aceptar_vinculacion(uuid) TO authenticated;


-- 7.4 — Dejar de ser entrenador / desvincularse (Perfil.jsx:192, App.jsx:622)
-- Degradarse a uno mismo es inofensivo, pero pasa por RPC porque rol_usuario
-- ya no es escribible desde el cliente.
CREATE OR REPLACE FUNCTION public.volver_a_atleta_normal()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    UPDATE public.perfiles SET rol_usuario = 'atleta_normal' WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.volver_a_atleta_normal() TO authenticated;


-- 7.5 — El entrenador da de baja a un alumno suyo (PanelEntrenador.jsx:281)
CREATE OR REPLACE FUNCTION public.entrenador_dar_baja_alumno(p_alumno_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.relacion_entrenador_alumno
         WHERE entrenador_id = auth.uid() AND alumno_id = p_alumno_id
    ) THEN
        RAISE EXCEPTION 'Ese alumno no es tuyo';
    END IF;

    UPDATE public.perfiles SET rol_usuario = 'atleta_normal' WHERE id = p_alumno_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.entrenador_dar_baja_alumno(uuid) TO authenticated;


-- 7.6 — Trial por completar el Reto 21 (reemplaza Reto21Dias.jsx:321)
-- Antes el teléfono escribía la bandera en su SQLite y la subía por sync.
-- Ahora el servidor recuenta los días de hábitos, igual que hacía el cliente.
CREATE OR REPLACE FUNCTION public.otorgar_trial_por_reto()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_dias  integer;
    v_plan  text;
BEGIN
    SELECT plan_membresia INTO v_plan FROM public.perfiles WHERE id = auth.uid();

    -- El regalo es solo para quien no paga.
    IF v_plan IS NOT NULL AND v_plan <> 'Atleta Base (Gratis)' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'ya_tiene_plan');
    END IF;

    SELECT count(*) INTO v_dias
      FROM public.habitos_diarios
     WHERE user_id = auth.uid() AND dia_reto IS NOT NULL;

    IF v_dias < 18 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'reto_incompleto', 'dias', v_dias);
    END IF;

    UPDATE public.perfiles SET force_platinum_trial = true WHERE id = auth.uid();
    RETURN jsonb_build_object('ok', true, 'dias', v_dias);
END;
$$;
GRANT EXECUTE ON FUNCTION public.otorgar_trial_por_reto() TO authenticated;


-- 7.7 — Activar plan tras compra en RevenueCat (Paywall.jsx:190, PaywallCoach.jsx:68)
--
-- ⚠️⚠️ LEE ESTO: esta función es un PASO INTERMEDIO, no la solución.
--
-- Mejora lo que había — el mapeo product_id → plan pasa a ser del servidor, y
-- queda registro en compras_log — pero NO verifica que la compra existiera.
-- Un usuario puede llamarla y darse el plan.
--
-- El cierre real de este agujero requiere validar contra RevenueCat desde el
-- servidor, y eso no cabe en una migración SQL: hay que desplegar una Edge
-- Function que consulte la API de RevenueCat con la secret key
-- (GET /v1/subscribers/{app_user_id}) y confirme el entitlement activo antes
-- de tocar plan_membresia. Mientras eso no exista, el bypass del paywall
-- sigue abierto por esta vía, aunque cerrado por todas las demás.

CREATE TABLE IF NOT EXISTS public.compras_log (
    id          bigserial PRIMARY KEY,
    user_id     uuid NOT NULL,
    product_id  text NOT NULL,
    plan        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compras_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lee compras_log" ON public.compras_log
    FOR SELECT USING ((auth.jwt() ->> 'email') = 'somos.vetayvigor@gmail.com');

CREATE OR REPLACE FUNCTION public.activar_plan_por_compra(p_product_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_plan text;
BEGIN
    -- El mapeo vive en el servidor: el cliente ya no elige el nombre del plan.
    -- Los cuatro de atleta son identificadores exactos (Paywall.jsx:184-187).
    v_plan := CASE p_product_id
        WHEN 'vitalicio_unico'                 THEN 'Socio Fundador Vitalicio'
        WHEN 'platinum_anual:base-anual'       THEN 'Plan Platinum'
        WHEN 'aurum_semestral:base-semestral'  THEN 'Socio Aurum'
        WHEN 'argentum_mensual:base-mensual'   THEN 'Socio Argentum'
        ELSE NULL
    END;

    -- Los de entrenador se detectan por patrón, replicando PaywallCoach.jsx:34-35,
    -- donde los paquetes se buscan con .includes('pro') / .includes('elite').
    -- El orden importa: 'elite' se evalúa antes, porque un identificador podría
    -- contener ambas palabras.
    IF v_plan IS NULL THEN
        IF lower(p_product_id) LIKE '%elite%' OR lower(p_product_id) LIKE '%élite%' THEN
            v_plan := 'Entrenador Élite';
        ELSIF lower(p_product_id) LIKE '%pro%' THEN
            v_plan := 'Entrenador Pro';
        END IF;
    END IF;

    IF v_plan IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'producto_desconocido');
    END IF;

    UPDATE public.perfiles SET plan_membresia = v_plan WHERE id = auth.uid();

    INSERT INTO public.compras_log (user_id, product_id, plan)
    VALUES (auth.uid(), p_product_id, v_plan);

    RETURN jsonb_build_object('ok', true, 'plan', v_plan);
END;
$$;
GRANT EXECUTE ON FUNCTION public.activar_plan_por_compra(text) TO authenticated;


-- 7.7-bis — Aplicar el vencimiento del trial (reemplaza App.jsx:570-580)
--
-- Antes el cliente comprobaba la fecha y se degradaba solo. Ahora la comparación
-- la hace el servidor con su propio now(): el reloj del teléfono deja de contar.
-- Solo degrada, jamás asciende, así que llamarla de más es inofensivo.
--
-- El cliente la invoca al arrancar. Un usuario que impida esa llamada estira su
-- trial gratis — molesto, pero incomparable con poder REGALARSE Platinum, que es
-- lo que podía hacer antes. Para cerrarlo del todo, programa esto con pg_cron:
--
--   SELECT cron.schedule('vencer-trials', '0 3 * * *', $cron$
--     UPDATE public.perfiles
--        SET plan_membresia = 'Atleta Base (Gratis)', platinum_trial_ends_at = NULL
--      WHERE plan_membresia = 'Platinum' AND platinum_trial_ends_at < now();
--   $cron$);

CREATE OR REPLACE FUNCTION public.sincronizar_mi_plan()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_cambiado boolean := false;
BEGIN
    UPDATE public.perfiles
       SET plan_membresia         = 'Atleta Base (Gratis)',
           platinum_trial_ends_at = NULL
     WHERE id = auth.uid()
       AND plan_membresia = 'Platinum'
       AND platinum_trial_ends_at IS NOT NULL
       AND platinum_trial_ends_at < now();

    GET DIAGNOSTICS v_cambiado = FOUND;
    RETURN jsonb_build_object('ok', true, 'degradado', v_cambiado);
END;
$$;
GRANT EXECUTE ON FUNCTION public.sincronizar_mi_plan() TO authenticated;


-- 7.8 — Degradar cuando RevenueCat ya no reporta suscripción (App.jsx:914)
-- Solo degrada, nunca asciende: sin riesgo.
CREATE OR REPLACE FUNCTION public.degradar_plan_sin_suscripcion()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    UPDATE public.perfiles
       SET plan_membresia = 'Atleta Base (Gratis)'
     WHERE id = auth.uid()
       AND plan_membresia IN ('Socio Argentum', 'Socio Aurum', 'Plan Platinum',
                              'Socio Fundador Vitalicio');
$$;
GRANT EXECUTE ON FUNCTION public.degradar_plan_sin_suscripcion() TO authenticated;


-- 7.8-bis — El alumno se quedó sin entrenador (reemplaza App.jsx:606-609)
-- Le devuelve el rol de atleta y le concede la Prueba Gratis de 7 días.
-- El servidor confirma que de verdad no le queda ninguna relación viva antes
-- de conceder nada.
CREATE OR REPLACE FUNCTION public.alumno_perdio_entrenador()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.relacion_entrenador_alumno
         WHERE alumno_id = auth.uid() AND estado IN ('activo', 'pendiente')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'aun_tiene_entrenador');
    END IF;

    UPDATE public.perfiles
       SET rol_usuario    = 'atleta_normal',
           plan_membresia = 'Prueba Gratis (7 Días)'
     WHERE id = auth.uid()
       AND rol_usuario = 'alumno_entrenador';

    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.alumno_perdio_entrenador() TO authenticated;


-- 7.8-ter — Vencer la Prueba Gratis de 7 días (reemplaza App.jsx:628)
--
-- La fecha de inicio vive en auth.users.raw_user_meta_data.trial_start_date.
-- Nota: ese metadato lo puede reescribir el propio usuario con auth.updateUser,
-- así que la prueba gratis es estirable. Es una debilidad preexistente y menor
-- (solo alarga un regalo, no concede un plan de pago); moverla a una columna de
-- perfiles escrita por el servidor la cerraría del todo. Aquí al menos la
-- comparación de fechas deja de depender del reloj del teléfono.
CREATE OR REPLACE FUNCTION public.vencer_prueba_gratis()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
    v_inicio timestamptz;
BEGIN
    SELECT (raw_user_meta_data ->> 'trial_start_date')::timestamptz
      INTO v_inicio
      FROM auth.users WHERE id = auth.uid();

    IF v_inicio IS NULL OR now() - v_inicio < interval '7 days' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'aun_vigente');
    END IF;

    UPDATE public.perfiles
       SET plan_membresia = 'Atleta Base (Gratis)'
     WHERE id = auth.uid()
       AND plan_membresia = 'Prueba Gratis (7 Días)';

    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.vencer_prueba_gratis() TO authenticated;


-- 7.9 — Acciones de admin restantes
CREATE OR REPLACE FUNCTION public.admin_set_rol(p_user_id uuid, p_rol text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT public.es_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
    UPDATE public.perfiles SET rol_usuario = p_rol WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_rol(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_chat_bloqueado(p_user_id uuid, p_bloqueado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT public.es_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
    UPDATE public.perfiles SET chat_bloqueado = p_bloqueado WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_chat_bloqueado(uuid, boolean) TO authenticated;
