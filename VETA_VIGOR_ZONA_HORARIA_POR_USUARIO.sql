-- Generaliza completar_mision_rpg() a la zona horaria real de cada usuario
-- en vez de tener 'America/Mexico_City' hardcodeado. Hasta hoy funcionaba
-- porque todos los atletas estaban en México; esto lo prepara para
-- atletas en otros países (ej. España) sin cambiar nada para nadie más.
--
-- Confirmado contra la base VIVA (pg_get_functiondef, no un archivo del
-- repo -- varios .sql viejos en la raíz redefinen esta función y solo uno
-- está realmente vivo, ver memoria contrato-real-completar-mision-rpg)
-- que la única función con lógica de día/zona horaria propia es esta.
-- reclamar_bono_reto y comprar_item_rpg solo leen racha_actual ya
-- calculada, no necesitan cambios.
--
-- De paso corrige un bug real y separado encontrado al leer la función:
-- "updated_at = timezone('America/Mexico_City', now())" es el mismo
-- patrón ya documentado en bug-zona-horaria-timestamptz (escribir un
-- valor ya convertido de zona en una columna timestamptz la corre 6h) --
-- quedó sin corregir acá en el arreglo del 16/08.

-- 1. Columna nueva. Default constante = sin reescritura de tabla (PG11+)
--    y cero cambio de comportamiento para los usuarios actuales: todos
--    quedan con el mismo valor que ya se usaba hardcodeado.
alter table public.perfiles
  add column if not exists zona_horaria text not null default 'America/Mexico_City';

-- 2. La función. Cuerpo idéntico a la versión viva confirmada hoy, salvo:
--    - v_zona nueva, leída una sola vez y validada contra pg_timezone_names
--      (un valor corrupto/inválido nunca puede tumbar la función: cae al
--      default seguro en vez de que Postgres tire error).
--    - Los TRES sitios que usaban 'America/Mexico_City' hardcodeado (v_hoy,
--      el filtro del tope diario, y v_fecha_ultima) pasan a usar v_zona --
--      los tres, no solo uno o dos, para que "hoy" no quede partido en dos
--      zonas distintas dentro de la misma llamada.
--    - El bug aparte de updated_at, corregido.
create or replace function public.completar_mision_rpg(p_user_id uuid, p_origen character varying, p_idempotency_key character varying, p_xp integer DEFAULT 10, p_monedas integer DEFAULT 5)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
    v_uid           uuid;
    v_key           text;
    v_xp            int;
    v_monedas       int;
    v_saldo_actual  INT;
    v_xp_actual     INT;
    v_racha_actual  INT;
    v_nivel_rpg     INT;
    v_ultima_mision TIMESTAMP WITH TIME ZONE;
    v_zona          text;
    v_hoy           DATE;
    v_fecha_ultima  DATE;
    v_hoy_count     INT;
    TOPE_DIARIO     CONSTANT INT := 10;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sin sesión.');
    END IF;

    -- Los importes los fija el servidor a partir del origen, no el cliente.
    IF p_origen = 'entrenamiento' THEN
        v_xp := 10; v_monedas := 5;
    ELSIF p_origen = 'descanso_activo' THEN
        -- ProgressionEngine da 15-20 XP según hábitos marcados; se acota lo
        -- que pide el cliente a ese rango en vez de fijarlo, para no hacer
        -- bajar un número que el usuario ya vio en pantalla.
        v_xp := LEAST(GREATEST(COALESCE(p_xp, 15), 15), 20);
        v_monedas := 15;
    ELSIF p_origen LIKE 'reto_vigor21_dia_%' THEN
        v_xp := 10; v_monedas := 5;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Origen no reconocido: ' || p_origen);
    END IF;

    -- Clave namespaced por usuario: la de un usuario no puede colisionar ni
    -- reutilizar la de otro.
    v_key := v_uid::text || ':' || p_idempotency_key;

    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = v_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se registró esta misión.');
    END IF;

    -- Zona horaria real del usuario, validada una sola vez. Si es nula o no
    -- existe en el catálogo de Postgres (dato corrupto, o un valor raro que
    -- mandó el cliente), cae al default histórico en vez de que timezone()
    -- tire error y tumbe la función entera para ese usuario.
    SELECT zona_horaria INTO v_zona FROM public.perfiles WHERE id = v_uid;
    IF v_zona IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zona) THEN
        v_zona := 'America/Mexico_City';
    END IF;

    v_hoy := (timezone(v_zona, now()))::DATE;

    -- Tope diario: acota el daño de generar claves nuevas en bucle, sin
    -- romper la sincronización de varios días entrenados sin conexión.
    SELECT count(*) INTO v_hoy_count
    FROM public.rpg_transacciones
    WHERE user_id = v_uid
      AND tipo = 'MISION'
      AND (timezone(v_zona, created_at))::DATE = v_hoy;

    IF v_hoy_count >= TOPE_DIARIO THEN
        RETURN jsonb_build_object('success', false, 'error', 'Límite diario de misiones alcanzado.');
    END IF;

    SELECT puntos_forja, xp_actual, racha_actual
    INTO v_saldo_actual, v_xp_actual, v_racha_actual
    FROM public.perfiles WHERE id = v_uid FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
    END IF;

    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_xp_actual    := COALESCE(v_xp_actual, 0);
    v_racha_actual := COALESCE(v_racha_actual, 0);

    -- La racha se deriva del libro de transacciones porque perfiles no tiene
    -- last_workout_date. El ledger es de todos modos la fuente de verdad.
    SELECT MAX(created_at) INTO v_ultima_mision
    FROM public.rpg_transacciones
    WHERE user_id = v_uid AND tipo = 'MISION';

    v_fecha_ultima := (timezone(v_zona, v_ultima_mision))::DATE;

    IF v_fecha_ultima IS NULL THEN
        v_racha_actual := 1;
    ELSIF v_fecha_ultima = v_hoy THEN
        v_racha_actual := GREATEST(v_racha_actual, 1);
    ELSIF v_fecha_ultima = v_hoy - 1 THEN
        v_racha_actual := v_racha_actual + 1;
    ELSE
        v_racha_actual := 1;
    END IF;

    -- Mismo cálculo que calculateLevel() en ProgressionEngine.js (100 XP
    -- lineales por nivel) -- se mantiene igual acá para que servidor y
    -- cliente nunca diverjan en qué nivel corresponde a cuánto XP.
    v_nivel_rpg := FLOOR((v_xp_actual + v_xp) / 100) + 1;

    -- Solo puntos_forja: es la columna real. No se escribe monedas_forja ni
    -- last_workout_date porque no existen en el esquema.
    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp,
        puntos_forja = v_saldo_actual + v_monedas,
        racha_actual = v_racha_actual,
        nivel_rpg    = v_nivel_rpg,
        updated_at   = now()
    WHERE id = v_uid;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_xp, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (v_uid, 'MISION', p_origen, v_xp, v_monedas,
         v_saldo_actual, v_saldo_actual + v_monedas, v_key);

    RETURN jsonb_build_object(
        'success', true,
        'xp_ganada', v_xp,
        'monedas_ganadas', v_monedas,
        'racha', v_racha_actual,
        'nivel_rpg', v_nivel_rpg,
        'xp_total', v_xp_actual + v_xp,
        'monedas_total', v_saldo_actual + v_monedas
    );
END;
$function$
;

-- ==========================================================================
-- VERIFICACION -- correr despues de lo de arriba
-- ==========================================================================

-- 1. Todos los usuarios existentes deben seguir en el default (nadie debe
--    haber cambiado de comportamiento con esta migracion):
-- select id, zona_horaria from public.perfiles limit 5;

-- 2. Confirmar que la funcion quedo exactamente como se pidio:
-- select pg_get_functiondef(oid) from pg_proc where proname = 'completar_mision_rpg';

-- 3. Verificar que las conversiones de Espana caen del lado correcto de sus
--    propias transiciones de horario de verano 2026 (29 mar, 25 oct) --
--    esto NO toca ningun usuario real, solo prueba timezone():
-- select timezone('Europe/Madrid', '2026-03-29 01:30:00-06'::timestamptz),
--        timezone('Europe/Madrid', '2026-10-25 02:30:00-06'::timestamptz);
