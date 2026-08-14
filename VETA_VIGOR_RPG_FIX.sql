-- =====================================================================
-- VETA & VIGOR — CORRECCIÓN DE LOS RPC DE ECONOMÍA RPG
-- =====================================================================
--
-- PROBLEMA
-- Tres de las cuatro funciones RPG se escribieron contra columnas que no
-- existen en la tabla perfiles: xp, monedas_forja y last_workout_date.
-- Fallan siempre con:  ERROR 42703: column "monedas_forja" does not exist
--
-- Las columnas reales son:  xp_actual, puntos_forja
-- (atacar_golem ya las usaba bien; por eso esa función nunca falló)
--
-- CONSECUENCIA EN PRODUCCIÓN
-- Completar un día del reto de 21 días no otorga XP ni monedas, y los bonos
-- de racha de 7, 14 y 21 días nunca se pagaron. El frontend registra el error
-- con console.error y sigue de largo, por eso pasó desapercibido.
--
-- QUÉ HACE ESTE SCRIPT
--   1. completar_mision_rpg  — corrige columnas, deriva la racha desde
--                              rpg_transacciones (no existe last_workout_date)
--                              y acepta XP y monedas variables.
--   2. reclamar_bono_reto    — corrige columnas.
--   3. comprar_item_rpg      — corrige columnas.
--
-- Es idempotente: se puede ejecutar más de una vez sin problema.
-- No modifica datos existentes, solo redefine funciones.
--
-- CÓMO EJECUTARLO
-- Supabase → SQL Editor → pegar todo → Run. Al final hay comprobaciones.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. COMPLETAR MISIÓN
-- ---------------------------------------------------------------------
-- Se agregan p_xp y p_monedas con valores por defecto 10 y 5, que son los
-- que la función usaba fijos. Así las llamadas existentes de 3 argumentos
-- (RutinaRetoPlayer) siguen funcionando igual, y MiRutina/RutinaDetail
-- pueden pasar sus montos variables.
--
-- Hay que borrar la versión anterior primero: CREATE OR REPLACE no puede
-- cambiar la lista de argumentos, crearía una sobrecarga y las llamadas de
-- 3 argumentos quedarían ambiguas ("function is not unique").

DROP FUNCTION IF EXISTS public.completar_mision_rpg(UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.completar_mision_rpg(
    p_user_id UUID,
    p_origen VARCHAR,
    p_idempotency_key VARCHAR,
    p_xp INT DEFAULT 10,
    p_monedas INT DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_actual INT;
    v_xp_actual INT;
    v_racha_actual INT;
    v_ultima_mision TIMESTAMP WITH TIME ZONE;
    v_hoy DATE;
    v_fecha_ultima DATE;
BEGIN
    -- Idempotencia: si esta misión ya se registró, no se paga dos veces.
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se registró esta misión.');
    END IF;

    -- Bloqueo de fila para que dos peticiones simultáneas no se pisen.
    SELECT puntos_forja, xp_actual, racha_actual
    INTO v_saldo_actual, v_xp_actual, v_racha_actual
    FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

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
    WHERE user_id = p_user_id AND tipo = 'MISION';

    v_hoy := (timezone('America/Mexico_City', now()))::DATE;
    v_fecha_ultima := (timezone('America/Mexico_City', v_ultima_mision))::DATE;

    IF v_fecha_ultima IS NULL THEN
        v_racha_actual := 1;                      -- primera misión
    ELSIF v_fecha_ultima = v_hoy THEN
        v_racha_actual := GREATEST(v_racha_actual, 1);  -- ya entrenó hoy, se mantiene
    ELSIF v_fecha_ultima = v_hoy - 1 THEN
        v_racha_actual := v_racha_actual + 1;     -- día consecutivo
    ELSE
        v_racha_actual := 1;                      -- se cortó la racha
    END IF;

    UPDATE public.perfiles
    SET
        xp_actual    = v_xp_actual + p_xp,
        puntos_forja = v_saldo_actual + p_monedas,
        racha_actual = v_racha_actual,
        updated_at   = timezone('America/Mexico_City', now())
    WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_xp, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (p_user_id, 'MISION', p_origen, p_xp, p_monedas,
         v_saldo_actual, v_saldo_actual + p_monedas, p_idempotency_key);

    RETURN jsonb_build_object(
        'success', true,
        'xp_ganada', p_xp,
        'monedas_ganadas', p_monedas,
        'racha', v_racha_actual,
        'xp_total', v_xp_actual + p_xp,
        'monedas_total', v_saldo_actual + p_monedas
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 2. RECLAMAR BONO DE RETO
-- ---------------------------------------------------------------------
-- Misma firma que antes, solo cambian los nombres de columna.

CREATE OR REPLACE FUNCTION public.reclamar_bono_reto(
    p_user_id UUID,
    p_bono_tipo VARCHAR,
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_actual INT;
    v_xp_actual INT;
    v_monedas_premio INT := 0;
    v_xp_premio INT := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bono ya reclamado.');
    END IF;

    IF p_bono_tipo = '7_dias' THEN
        v_monedas_premio := 25;
    ELSIF p_bono_tipo = '14_dias' THEN
        v_monedas_premio := 35;
    ELSIF p_bono_tipo = '21_dias' THEN
        v_monedas_premio := 50;
        v_xp_premio := 50;
    ELSIF p_bono_tipo = 'perfecto_21' THEN
        v_monedas_premio := 50;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de bono desconocido: ' || p_bono_tipo);
    END IF;

    SELECT puntos_forja, xp_actual INTO v_saldo_actual, v_xp_actual
    FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
    END IF;

    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_xp_actual    := COALESCE(v_xp_actual, 0);

    UPDATE public.perfiles
    SET
        xp_actual    = v_xp_actual + v_xp_premio,
        puntos_forja = v_saldo_actual + v_monedas_premio,
        updated_at   = timezone('America/Mexico_City', now())
    WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_xp, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (p_user_id, 'BONO', p_bono_tipo, v_xp_premio, v_monedas_premio,
         v_saldo_actual, v_saldo_actual + v_monedas_premio, p_idempotency_key);

    RETURN jsonb_build_object(
        'success', true,
        'xp_ganada', v_xp_premio,
        'monedas_ganadas', v_monedas_premio
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 3. COMPRAR ITEM
-- ---------------------------------------------------------------------
-- Usaba monedas_forja en dos lugares. Sin esto, la tienda no puede cobrar.

CREATE OR REPLACE FUNCTION public.comprar_item_rpg(
    p_user_id UUID,
    p_item_id VARCHAR,
    p_precio INT,
    p_es_permanente BOOLEAN,
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        updated_at = timezone('America/Mexico_City', now())
    WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_monedas,
         saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES
        (p_user_id, 'COMPRA', p_item_id, -p_precio,
         v_saldo_actual, v_saldo_actual - p_precio, p_idempotency_key);

    RETURN jsonb_build_object('success', true, 'monedas_restantes', v_saldo_actual - p_precio);
END;
$$;


-- =====================================================================
-- COMPROBACIÓN
-- =====================================================================
-- Debe devolver 'Perfil no encontrado.' en las tres, NO un error 42703.
-- Usa un UUID que no existe, así que no modifica ningún dato real.

SELECT 'completar_mision_rpg' AS funcion,
       public.completar_mision_rpg(
           '00000000-0000-0000-0000-000000000000'::uuid,
           'verificacion', 'verificacion_' || gen_random_uuid()::text) AS resultado
UNION ALL
SELECT 'reclamar_bono_reto',
       public.reclamar_bono_reto(
           '00000000-0000-0000-0000-000000000000'::uuid,
           '7_dias', 'verificacion_' || gen_random_uuid()::text)
UNION ALL
SELECT 'comprar_item_rpg',
       public.comprar_item_rpg(
           '00000000-0000-0000-0000-000000000000'::uuid,
           'ficha_reposo', 10, false, 'verificacion_' || gen_random_uuid()::text);
