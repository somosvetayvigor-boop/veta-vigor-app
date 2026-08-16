-- =====================================================================
-- VETA & VIGOR — Corregir doble conversión de zona horaria en la economía RPG
-- =====================================================================
--
-- CONTEXTO
-- Descubierto el 16/08 investigando por qué el día 7 de sofiita en el Reto
-- Vigor 21 seguía bloqueado pese a corregir reto_ultimo_completado en el
-- servidor: rpg_transacciones.created_at guardaba una hora 6 horas antes
-- de la real.
--
-- EL BUG, EN CONCRETO
-- timezone('America/Mexico_City', now()) convierte now() (un instante UTC
-- correcto) a un TIMESTAMP SIN ZONA que representa la hora de pared en
-- Ciudad de México (ej. now()=14:31 UTC -> resultado naive "08:31"). Ese
-- valor naive, al guardarse en una columna timestamptz, Postgres lo
-- reinterpreta con la zona de la SESIÓN (normalmente UTC en Supabase) --
-- no vuelve a convertirlo a Ciudad de México. Resultado: se guarda
-- "08:31 UTC", un instante real 6 horas ANTES del verdadero.
--
-- El patrón correcto para escribir en una columna timestamptz es now() a
-- secas (o cualquier expresión que ya sea timestamptz). timezone(zona, x)
-- solo debe usarse para LEER un timestamptz y convertirlo a hora de pared
-- para comparar fechas -- nunca para escribir.
--
-- IMPACTO REAL
-- completar_mision_rpg vuelve a aplicar timezone('America/Mexico_City', ...)
-- sobre created_at para calcular el tope diario de misiones y la racha.
-- Como created_at ya nació mal guardado, esa segunda conversión resta OTRAS
-- 6 horas -- un desfase total de 12 horas. Solo se nota cuando una misión
-- se completa entre medianoche y las 6 AM hora de México: en esa ventana,
-- el sistema puede pensar que se entrenó "un día antes" del real, y romper
-- o alargar la racha de cualquier usuario incorrectamente.
--
-- Se rastreó con:
--   select proname from pg_proc where prosrc ilike '%timezone(''America/Mexico_City'', now())%';
-- Resultado: reclamar_bono_reto, completar_mision_rpg, comprar_item_rpg.
-- Las tres solo lo usan para escribir perfiles.updated_at -- no afecta
-- monedas, XP ni idempotencia, esos ya eran correctos.
--
-- NO SE HACE BACKFILL de filas viejas en rpg_transacciones/rpg_inventario.
-- La racha solo depende de MAX(created_at) -- se autocorrige con la
-- primera misión nueva que se registre tras este arreglo. Reescribir el
-- historial completo es más riesgo (UPDATE masivo) que beneficio (el dato
-- viejo solo se usa para mostrar fecha, no para lógica de negocio en
-- curso).
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 1 — Defaults de columna
-- ---------------------------------------------------------------------

ALTER TABLE public.rpg_transacciones
    ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.rpg_inventario
    ALTER COLUMN adquirido_en SET DEFAULT now();


-- ---------------------------------------------------------------------
-- BLOQUE 2 — completar_mision_rpg: solo cambia la línea de updated_at
-- ---------------------------------------------------------------------
-- Las dos lecturas con timezone('America/Mexico_City', created_at) para
-- tope diario y racha se quedan igual -- son correctas una vez que
-- created_at nace bien guardado.

CREATE OR REPLACE FUNCTION public.completar_mision_rpg(p_user_id uuid, p_origen character varying, p_idempotency_key character varying, p_xp integer DEFAULT 10, p_monedas integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid           uuid;
    v_key           text;
    v_xp            int;
    v_monedas       int;
    v_saldo_actual  INT;
    v_xp_actual     INT;
    v_racha_actual  INT;
    v_ultima_mision TIMESTAMP WITH TIME ZONE;
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

    v_hoy := (timezone('America/Mexico_City', now()))::DATE;

    -- Tope diario: acota el daño de generar claves nuevas en bucle, sin
    -- romper la sincronización de varios días entrenados sin conexión.
    SELECT count(*) INTO v_hoy_count
    FROM public.rpg_transacciones
    WHERE user_id = v_uid
      AND tipo = 'MISION'
      AND (timezone('America/Mexico_City', created_at))::DATE = v_hoy;

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

    v_fecha_ultima := (timezone('America/Mexico_City', v_ultima_mision))::DATE;

    IF v_fecha_ultima IS NULL THEN
        v_racha_actual := 1;
    ELSIF v_fecha_ultima = v_hoy THEN
        v_racha_actual := GREATEST(v_racha_actual, 1);
    ELSIF v_fecha_ultima = v_hoy - 1 THEN
        v_racha_actual := v_racha_actual + 1;
    ELSE
        v_racha_actual := 1;
    END IF;

    -- Solo puntos_forja: es la columna real. No se escribe monedas_forja ni
    -- last_workout_date porque no existen en el esquema, y no se toca
    -- nivel_rpg aquí — eso lo calcula el cliente (ProgressionEngine) y lo
    -- sube por separado, como en el resto de la app.
    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp,
        puntos_forja = v_saldo_actual + v_monedas,
        racha_actual = v_racha_actual,
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
        'xp_total', v_xp_actual + v_xp,
        'monedas_total', v_saldo_actual + v_monedas
    );
END;
$function$;


-- ---------------------------------------------------------------------
-- BLOQUE 3 — reclamar_bono_reto: solo cambia la línea de updated_at
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reclamar_bono_reto(p_user_id uuid, p_bono_tipo character varying, p_idempotency_key character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid            uuid;
    v_key            text;
    v_saldo_actual   INT;
    v_xp_actual      INT;
    v_racha          INT;
    v_monedas_premio INT := 0;
    v_xp_premio      INT := 0;
    v_racha_minima   INT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sin sesión.');
    END IF;

    IF p_bono_tipo = '7_dias' THEN
        v_monedas_premio := 25; v_racha_minima := 7;
    ELSIF p_bono_tipo = '14_dias' THEN
        v_monedas_premio := 35; v_racha_minima := 14;
    ELSIF p_bono_tipo = '21_dias' THEN
        v_monedas_premio := 50; v_xp_premio := 50; v_racha_minima := 21;
    ELSIF p_bono_tipo = 'perfecto_21' THEN
        v_monedas_premio := 50; v_racha_minima := 21;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de bono desconocido: ' || p_bono_tipo);
    END IF;

    -- Clave construida por el servidor: un bono de cada tipo por usuario, para
    -- siempre. El cliente ya no puede rodear la idempotencia inventando claves.
    v_key := 'bono:' || p_bono_tipo || ':' || v_uid::text;

    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = v_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bono ya reclamado.');
    END IF;

    SELECT puntos_forja, xp_actual, COALESCE(racha_actual, 0)
    INTO v_saldo_actual, v_xp_actual, v_racha
    FROM public.perfiles WHERE id = v_uid FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
    END IF;

    -- Elegibilidad. racha_actual la calcula completar_mision_rpg desde el
    -- ledger, así que no es un dato que el cliente pueda inflar directamente.
    IF v_racha < v_racha_minima THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aún no alcanzas este bono.',
            'racha_actual', v_racha,
            'racha_requerida', v_racha_minima
        );
    END IF;

    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_xp_actual    := COALESCE(v_xp_actual, 0);

    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp_premio,
        puntos_forja = v_saldo_actual + v_monedas_premio,
        updated_at   = now()
    WHERE id = v_uid;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_xp, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (v_uid, 'BONO', p_bono_tipo, v_xp_premio, v_monedas_premio,
         v_saldo_actual, v_saldo_actual + v_monedas_premio, v_key);

    RETURN jsonb_build_object(
        'success', true,
        'xp_ganada', v_xp_premio,
        'monedas_ganadas', v_monedas_premio
    );
END;
$function$;


-- ---------------------------------------------------------------------
-- BLOQUE 4 — comprar_item_rpg: solo cambia la línea de updated_at
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comprar_item_rpg(p_user_id uuid, p_item_id character varying, p_precio integer, p_es_permanente boolean, p_idempotency_key character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_saldo_actual INT;
    v_cantidad_actual INT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transacción ya procesada.');
    END IF;

    SELECT puntos_forja INTO v_saldo_actual FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
    END IF;

    v_saldo_actual := COALESCE(v_saldo_actual, 0);

    IF v_saldo_actual < p_precio THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fondos insuficientes.');
    END IF;

    IF p_es_permanente THEN
        IF EXISTS (SELECT 1 FROM public.rpg_inventario WHERE user_id = p_user_id AND item_id = p_item_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'El ítem ya fue adquirido previamente.');
        END IF;
        INSERT INTO public.rpg_inventario (user_id, item_id, cantidad) VALUES (p_user_id, p_item_id, 1);
    ELSE
        SELECT cantidad INTO v_cantidad_actual
        FROM public.rpg_inventario WHERE user_id = p_user_id AND item_id = p_item_id;
        v_cantidad_actual := COALESCE(v_cantidad_actual, 0);

        IF p_item_id = 'ficha_reposo' AND v_cantidad_actual >= 2 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Inventario lleno para este ítem (Máx 2).');
        END IF;

        IF v_cantidad_actual = 0 THEN
            INSERT INTO public.rpg_inventario (user_id, item_id, cantidad) VALUES (p_user_id, p_item_id, 1);
        ELSE
            UPDATE public.rpg_inventario SET cantidad = cantidad + 1
            WHERE user_id = p_user_id AND item_id = p_item_id;
        END IF;
    END IF;

    UPDATE public.perfiles
    SET puntos_forja = v_saldo_actual - p_precio,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (p_user_id, 'COMPRA', p_item_id, -p_precio,
         v_saldo_actual, v_saldo_actual - p_precio, p_idempotency_key);

    RETURN jsonb_build_object('success', true, 'monedas_restantes', v_saldo_actual - p_precio);
END;
$function$;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- 1. select table_name, column_name, column_default from information_schema.columns
--    where table_schema='public' and column_default ilike '%timezone(%';
--    No debe quedar ninguna fila (ambos defaults ahora son now()).
--
-- 2. select proname from pg_proc
--    where prosrc ilike '%timezone(''America/Mexico_City'', now())%';
--    No debe devolver ninguna fila.
