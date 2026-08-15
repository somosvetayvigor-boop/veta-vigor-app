-- =====================================================================
-- VETA & VIGOR — Blindaje de la economía RPG
-- =====================================================================
--
-- PROBLEMA
--
-- Las dos funciones de la economía estaban bien construidas —SECURITY DEFINER,
-- bloqueo FOR UPDATE, asiento en rpg_transacciones, racha derivada del ledger—
-- pero se fiaban de tres cosas que manda el cliente:
--
--   1. completar_mision_rpg recibía p_xp y p_monedas COMO PARÁMETROS.
--      El que llamaba decidía cuánto ganaba:
--          rpc('completar_mision_rpg', { p_xp: 999999, p_monedas: 999999 })
--
--   2. Las dos recibían p_user_id y nunca lo comparaban con auth.uid(),
--      así que se podían acreditar movimientos a la cuenta de otro.
--
--   3. La clave de idempotencia también venía del cliente. Impedía cobrar dos
--      veces con la MISMA clave, pero bastaba cambiarla (bono_7_x_2, _3, _4…)
--      para cobrar sin límite. Y reclamar_bono_reto no comprobaba ninguna
--      elegibilidad: le pedías 'perfecto_21' y pagaba, sin mirar la racha.
--
-- ESTRATEGIA
--
-- Se conservan las FIRMAS y se reescriben los CUERPOS. Los parámetros
-- peligrosos siguen aceptándose pero se ignoran, así que las apps ya
-- instaladas (v79 y anteriores) siguen funcionando sin cambios y el agujero
-- se cierra para todos en el momento de aplicar este script.
--
-- No hay orden de despliegue que respetar: se puede correr ahora.
--
-- =====================================================================


-- =====================================================================
-- 1 — completar_mision_rpg
-- =====================================================================
--
-- Cambia respecto de la versión anterior:
--   · p_xp y p_monedas se IGNORAN. Los importes salen de p_origen, replicando
--     ProgressionEngine.js: entrenamiento 10 XP / 5 oro; descanso activo
--     15 XP (20 con más de 2 hábitos) / 15 oro; día del reto 10 XP / 5 oro.
--   · p_user_id se IGNORA. Se usa auth.uid().
--   · La clave de idempotencia se prefija con auth.uid(), de modo que la de un
--     usuario no puede colisionar ni reutilizar la de otro.
--   · Tope diario. Ver la nota al final sobre por qué es un tope y no un
--     "una por día".

CREATE OR REPLACE FUNCTION public.completar_mision_rpg(
    p_user_id uuid,
    p_origen character varying,
    p_idempotency_key character varying,
    p_xp integer DEFAULT 10,          -- ignorado, se conserva por compatibilidad
    p_monedas integer DEFAULT 5       -- ignorado, se conserva por compatibilidad
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Los importes los fija el servidor a partir del origen. Es el cambio que
    -- convierte "pide lo que quieras" en "cobras lo que corresponde".
    IF p_origen = 'entrenamiento' THEN
        v_xp := 10; v_monedas := 5;
    ELSIF p_origen = 'descanso_activo' THEN
        -- ProgressionEngine da 15 XP base y 20 con más de 2 hábitos, y el
        -- servidor no puede verificar cuántos marcó. En vez de fijarlo en 15
        -- —lo que haría bajar el número que el usuario ya vio— se ACOTA lo que
        -- pide el cliente al rango legítimo. Lo peor que puede conseguir
        -- mintiendo son 5 XP de más; el resto de orígenes no admiten influencia.
        v_xp := LEAST(GREATEST(COALESCE(p_xp, 15), 15), 20);
        v_monedas := 15;
    ELSIF p_origen LIKE 'reto_vigor21_dia_%' THEN
        v_xp := 10; v_monedas := 5;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Origen no reconocido: ' || p_origen);
    END IF;

    -- La clave queda dentro del espacio de nombres del usuario.
    v_key := v_uid::text || ':' || p_idempotency_key;

    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = v_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se registró esta misión.');
    END IF;

    v_hoy := (timezone('America/Mexico_City', now()))::DATE;

    -- Tope diario: acota el daño de generar claves nuevas en bucle sin romper
    -- la sincronización de varios días entrenados sin conexión.
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

    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp,
        puntos_forja = v_saldo_actual + v_monedas,
        racha_actual = v_racha_actual,
        updated_at   = timezone('America/Mexico_City', now())
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


-- =====================================================================
-- 2 — reclamar_bono_reto
-- =====================================================================
--
-- Cambia respecto de la versión anterior:
--   · p_user_id se IGNORA. Se usa auth.uid().
--   · p_idempotency_key se IGNORA. La construye el servidor como
--     'bono:<tipo>:<uid>', de forma que cada bono es irrepetible por
--     definición: ya no basta cambiar la clave para volver a cobrarlo.
--   · Se COMPRUEBA LA ELEGIBILIDAD contra perfiles.racha_actual, que la
--     escribe completar_mision_rpg derivándola del ledger. Antes no se
--     comprobaba nada: pedías 'perfecto_21' y pagaba.

CREATE OR REPLACE FUNCTION public.reclamar_bono_reto(
    p_user_id uuid,
    p_bono_tipo character varying,
    p_idempotency_key character varying   -- ignorado, se conserva por compatibilidad
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        updated_at   = timezone('America/Mexico_City', now())
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


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
--
-- Desde la consola del navegador, con sesión iniciada, esto debe FALLAR ahora:
--
--   await supabase.rpc('completar_mision_rpg', {
--     p_user_id: '<tu-id>', p_origen: 'entrenamiento',
--     p_idempotency_key: crypto.randomUUID(),
--     p_xp: 999999, p_monedas: 999999
--   })
--
-- Debe devolver success: true con xp_ganada: 10 y monedas_ganadas: 5 —
-- los importes del servidor, no los pedidos.
--
--   await supabase.rpc('reclamar_bono_reto', {
--     p_user_id: '<tu-id>', p_bono_tipo: 'perfecto_21',
--     p_idempotency_key: 'lo_que_sea'
--   })
--
-- Debe devolver success: false con 'Aún no alcanzas este bono' salvo que la
-- racha real sea 21 o más.


-- =====================================================================
-- NOTA — Por qué un tope diario y no "una misión por día"
-- =====================================================================
-- Lo natural sería permitir una sola misión por día natural. No se puede: la
-- app funciona sin conexión y guarda las recompensas en una cola local
-- (rpg_historial_recompensas) que se reproduce entera al reconectar. Alguien
-- que entrene tres días sin cobertura sincroniza las tres el mismo día, y una
-- regla de "una por día" le robaría dos.
--
-- El tope de 10 acota el abuso a diez recompensas base por día en lugar de
-- infinitas, sin quitarle nada a nadie que entrene de verdad. Si algún día
-- llevas la fecha del evento a la cola —fecha_reclamo ya existe en local— se
-- podría pasar a "una por origen y día" con precisión real.


-- =====================================================================
-- NOTA — Lo que esto NO resuelve
-- =====================================================================
-- En una app offline-first el teléfono es la fuente de verdad de lo que se
-- entrenó, así que fabricar entrenamientos nunca se puede impedir del todo.
-- Lo que cambia con este script es la escala: antes bastaba una llamada para
-- un millón de monedas; ahora hay que fingir sesiones de entrenamiento reales,
-- de diez en diez al día, para ganar lo mismo que quien entrena.
--
-- Es la diferencia entre un agujero y una fricción.
