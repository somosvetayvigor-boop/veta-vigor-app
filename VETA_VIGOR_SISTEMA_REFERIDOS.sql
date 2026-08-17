-- =====================================================================
-- VETA & VIGOR — Sistema real de comisiones por referido (Socio Fundador Vitalicio)
-- =====================================================================
--
-- CONTEXTO
-- MisGanancias.jsx ya le muestra a los Socios Fundadores Vitalicios un
-- código de referido y una comisión escalonada (10%/15%/20% según
-- cantidad de referidos), pero era 100% decorativo: codigo_referido
-- nunca se guardaba (se inventaba al vuelo solo para pintarlo), y no
-- existía NINGUNA columna que registrara quién refirió a quién. Un
-- fundador podía compartir su código, la gente registrarse con él, y
-- nunca pasaba nada — ganancias se quedaba en $0.00 para siempre.
--
-- El pago en sí sigue siendo MANUAL (no se usa Stripe por la política
-- de Google Play sobre pagos fuera de Play Billing) — Gerardo revisa un
-- reporte mensual y paga a mano. Este script no automatiza ningún pago
-- ni calcula un monto final: solo captura el dato real de quién refirió
-- a quién, y le da a Gerardo los datos crudos para que él aplique el
-- porcentaje y la periodicidad de cada plan.
--
-- NOTA PARA ANTIGRAVITY (u otro agente que retome esto):
-- Este script agrega la columna `referido_por` a `perfiles` y le suma
-- una línea de protección a `proteger_columnas_perfiles()`
-- (CREATE OR REPLACE, reproduce la versión vigente completa de
-- VETA_VIGOR_BLINDAJE_STATS_RPG.sql + la línea nueva). Si tocás esa
-- función después de este script, no te olvides la línea
-- `NEW.referido_por := OLD.referido_por;` — sin ella, cualquier usuario
-- autenticado podría auto-asignarse un referente por UPDATE directo y
-- robarle la comisión a un fundador real.
-- Las RPCs `generar_mi_codigo_referido` y `canjear_codigo_referido`
-- corren sobre auth.uid() únicamente — nunca reciben el id del usuario
-- como parámetro, siguiendo el mismo principio que ya se aplicó en
-- completar_mision_rpg (ver VETA_VIGOR_BLINDAJE_ECONOMIA_RPG.sql) tras
-- el incidente real de "se podían acreditar movimientos a la cuenta de
-- otro". No reintroducir un parámetro p_user_id en ninguna de las dos.
--
-- ORDEN DE APLICACIÓN
-- Ninguno. Es autocontenido y no depende de que se haya corrido nada
-- más hoy. Seguro de reejecutar (todo con IF NOT EXISTS / CREATE OR
-- REPLACE).
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 1 — Columna nueva e índices
-- ---------------------------------------------------------------------

ALTER TABLE public.perfiles
    ADD COLUMN IF NOT EXISTS referido_por uuid REFERENCES public.perfiles(id);

CREATE INDEX IF NOT EXISTS idx_perfiles_codigo_referido ON public.perfiles(codigo_referido);
CREATE INDEX IF NOT EXISTS idx_perfiles_referido_por ON public.perfiles(referido_por);


-- ---------------------------------------------------------------------
-- BLOQUE 2 — proteger_columnas_perfiles(): agregar referido_por
-- ---------------------------------------------------------------------
-- Reproduce la versión vigente completa (VETA_VIGOR_BLINDAJE_STATS_RPG.sql,
-- 16/08) + una sola línea nueva. El trigger trg_proteger_columnas_perfiles
-- ya apunta a esta función, CREATE OR REPLACE basta.

CREATE OR REPLACE FUNCTION public.proteger_columnas_perfiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Las RPCs SECURITY DEFINER corren como postgres: pasan de largo.
    -- Solo se filtra lo que llega directamente del cliente.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Monetización y autoridad
    NEW.plan_membresia         := OLD.plan_membresia;
    NEW.rol_usuario            := OLD.rol_usuario;
    NEW.force_paywall          := OLD.force_paywall;
    NEW.force_platinum_trial   := OLD.force_platinum_trial;
    NEW.platinum_trial_ends_at := OLD.platinum_trial_ends_at;

    -- Dinero real de tus entrenadores / fundadores
    NEW.ganancias              := OLD.ganancias;
    NEW.comision_personalizada := OLD.comision_personalizada;
    NEW.codigo_referido        := OLD.codigo_referido;
    NEW.referidos_count        := OLD.referidos_count;
    NEW.referido_por           := OLD.referido_por;

    -- Moderación
    NEW.chat_bloqueado         := OLD.chat_bloqueado;

    -- Economía RPG
    NEW.xp_actual              := OLD.xp_actual;
    NEW.puntos_forja           := OLD.puntos_forja;
    NEW.racha_actual           := OLD.racha_actual;

    -- Estadísticas de vanidad
    NEW.puntos_totales         := OLD.puntos_totales;
    NEW.nivel_rpg              := OLD.nivel_rpg;
    NEW.stat_fuerza            := OLD.stat_fuerza;
    NEW.stat_agilidad          := OLD.stat_agilidad;
    NEW.stat_resistencia       := OLD.stat_resistencia;

    -- Inmutables
    NEW.id                     := OLD.id;
    NEW.email                  := OLD.email;
    NEW.created_at             := OLD.created_at;

    RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- BLOQUE 3 — generar_mi_codigo_referido()
-- ---------------------------------------------------------------------
-- Idempotente: si ya tenés código, lo devuelve tal cual. Si no, genera
-- uno legible (VV-XXXXXX) y lo guarda. Opera solo sobre auth.uid().

CREATE OR REPLACE FUNCTION public.generar_mi_codigo_referido()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_uid          uuid;
    v_existente    text;
    v_nuevo_codigo text;
    v_intentos     int := 0;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sin sesión.';
    END IF;

    SELECT codigo_referido INTO v_existente FROM public.perfiles WHERE id = v_uid;
    IF v_existente IS NOT NULL AND v_existente <> '' THEN
        RETURN v_existente;
    END IF;

    LOOP
        v_intentos := v_intentos + 1;
        v_nuevo_codigo := 'VV-' || upper(substr(md5(v_uid::text || clock_timestamp()::text || v_intentos::text), 1, 6));

        BEGIN
            UPDATE public.perfiles SET codigo_referido = v_nuevo_codigo WHERE id = v_uid;
            RETURN v_nuevo_codigo;
        EXCEPTION WHEN unique_violation THEN
            -- Choque contra un código existente: reintenta con otro, hasta 10 veces.
            IF v_intentos >= 10 THEN
                RAISE EXCEPTION 'No se pudo generar un código de referido único.';
            END IF;
        END;
    END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generar_mi_codigo_referido() TO authenticated;


-- ---------------------------------------------------------------------
-- BLOQUE 4 — canjear_codigo_referido(p_codigo)
-- ---------------------------------------------------------------------
-- Solo se puede fijar el referente una vez (primera llamada gana). No
-- se puede uno auto-referir. Nunca recibe el id del usuario como
-- parámetro -- siempre auth.uid().

CREATE OR REPLACE FUNCTION public.canjear_codigo_referido(p_codigo character varying)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_uid          uuid;
    v_referente_id uuid;
    v_ya_referido  uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sin sesión.');
    END IF;

    IF p_codigo IS NULL OR trim(p_codigo) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código vacío.');
    END IF;

    SELECT referido_por INTO v_ya_referido FROM public.perfiles WHERE id = v_uid;
    IF v_ya_referido IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya tenés un referente asignado.');
    END IF;

    SELECT id INTO v_referente_id
    FROM public.perfiles
    WHERE codigo_referido = upper(trim(p_codigo));

    IF v_referente_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de referido inválido.');
    END IF;

    IF v_referente_id = v_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'No podés usar tu propio código.');
    END IF;

    UPDATE public.perfiles SET referido_por = v_referente_id WHERE id = v_uid;
    UPDATE public.perfiles SET referidos_count = COALESCE(referidos_count, 0) + 1 WHERE id = v_referente_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.canjear_codigo_referido(character varying) TO authenticated;


-- ---------------------------------------------------------------------
-- BLOQUE 5 — admin_reporte_comisiones_fundadores()
-- ---------------------------------------------------------------------
-- Gateada con es_admin() (ya existe, VETA_VIGOR_BLINDAJE_PERFILES.sql).
-- No calcula ningún monto -- solo entrega los datos crudos (quién
-- refirió a quién, y qué plan tiene cada referido HOY) para que Gerardo
-- aplique el porcentaje y la periodicidad de cada plan a mano. No hay
-- registro de fecha/monto de cada pago individual, así que fingir un
-- cálculo final sería más engañoso que útil.

CREATE OR REPLACE FUNCTION public.admin_reporte_comisiones_fundadores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_resultado jsonb;
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', f.id,
            'nombre', f.full_name,
            'email', f.email,
            'codigo_referido', f.codigo_referido,
            'referidos_count', COALESCE(f.referidos_count, 0),
            'referidos', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'nombre', r.full_name,
                    'email', r.email,
                    'plan_membresia', r.plan_membresia
                ))
                FROM public.perfiles r
                WHERE r.referido_por = f.id
            ), '[]'::jsonb)
        )
    ) INTO v_resultado
    FROM public.perfiles f
    WHERE f.plan_membresia = 'Socio Fundador Vitalicio';

    RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_reporte_comisiones_fundadores() TO authenticated;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- 1. select column_name from information_schema.columns
--    where table_schema='public' and table_name='perfiles' and column_name='referido_por';
--    Debe devolver una fila.
--
-- 2. select pg_get_functiondef(oid) from pg_proc where proname = 'proteger_columnas_perfiles';
--    Debe incluir la línea "NEW.referido_por := OLD.referido_por;".
--
-- 3. select proname from pg_proc
--    where proname in ('generar_mi_codigo_referido','canjear_codigo_referido','admin_reporte_comisiones_fundadores');
--    Debe devolver las 3.
--
-- 4. Prueba funcional (con dos cuentas de prueba, no con datos reales):
--    a) select generar_mi_codigo_referido(); -- como cuenta A, anota el código
--    b) select canjear_codigo_referido('EL_CODIGO_DE_A'); -- como cuenta B
--       Debe devolver {"success": true}.
--    c) Repetir (b) -- debe devolver {"success": false, "error": "Ya tenés..."}.
--    d) select referido_por from perfiles where id = '<id de B>'; -- debe ser el id de A.
--    e) select referidos_count from perfiles where id = '<id de A>'; -- debe haber subido en 1.
