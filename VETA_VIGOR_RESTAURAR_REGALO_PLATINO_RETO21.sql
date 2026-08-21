-- =====================================================================
-- VETA & VIGOR — Restaurar el regalo de Platino al terminar el Reto21
-- =====================================================================
--
-- NOTA PARA CUALQUIER OTRO AGENTE QUE TOQUE ESTA FUNCIÓN (Antigravity u
-- otra sesión): reclamar_bono_reto YA tuvo un incidente de coexistencia
-- real -- VETA_VIGOR_REGALO_PLATINO_POR_RETO21.sql agregó este mismo
-- regalo hace tiempo, pero un blindaje de seguridad posterior
-- (VETA_VIGOR_BLINDAJE_ECONOMIA_RPG.sql, que arregla p_user_id sin
-- comparar contra auth.uid(), idempotency_key manipulable por el
-- cliente, y elegibilidad de racha sin revisar) redefinió la función
-- completa sin saber del regalo, y lo revirtió sin querer -- exactamente
-- el mismo patrón que ya le pasó a completar_mision_rpg (ver
-- VETA_VIGOR_RESTAURAR_ECONOMIA_RPG.sql / VETA_VIGOR_FIX_NIVEL_RPG.sql).
-- Antes de volver a redefinir reclamar_bono_reto por cualquier motivo,
-- confirma el contrato real en vivo con:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'reclamar_bono_reto';
-- y si el cambio no es sobre el regalo de Platino, hay que CONSERVAR el
-- bloque de v_plan/v_regalo_platino de abajo, no solo el blindaje de
-- seguridad.
--
-- QUÉ HACE EL REGALO (sin cambios de diseño, es el mismo criterio ya
-- validado antes)
-- Al reclamar el bono '21_dias' (terminar el Reto21), si el atleta está
-- en el plan gratis (o sin plan), se le otorga 'Platinum' por 7 días.
-- Si ya tiene un plan pagado, NO se toca -- conserva su plan. Si ya tenía
-- el trial por otro motivo (ej. perdió a su entrenador), tampoco se
-- pisa, porque 'Platinum' no está en la lista de "gratis" de abajo. Es
-- automático -- no hace falta que el atleta apriete ningún botón, porque
-- el cliente (RutinaRetoPlayer.jsx/SyncService.js) ya llama a
-- reclamar_bono_reto solo, para los 4 tipos de bono, cada vez que
-- corresponde. No hace falta ninguna columna nueva de "ya se usó": el
-- bono '21_dias' ya es idempotente para siempre por usuario (clave fija
-- 'bono:21_dias:<uid>'), así que el regalo hereda esa misma protección
-- gratis -- no se puede cobrar dos veces.
--
-- ORDEN DE APLICACIÓN
-- Ninguno. Autocontenida, segura de reejecutar.
-- =====================================================================

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
    v_plan           text;
    v_regalo_platino boolean := false;
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

    SELECT puntos_forja, xp_actual, COALESCE(racha_actual, 0), plan_membresia
    INTO v_saldo_actual, v_xp_actual, v_racha, v_plan
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

    -- Regalo de Platino solo al terminar el reto de verdad ('21_dias'), y
    -- solo si está en el plan gratis. Quien ya paga conserva su plan; quien
    -- ya tenía el trial activo por otro motivo (perdió entrenador) tampoco
    -- se toca -- 'Platinum' no está en la lista de "gratis" de abajo.
    IF p_bono_tipo = '21_dias' AND (v_plan IS NULL OR v_plan IN ('Atleta Base (Gratis)', '')) THEN
        v_regalo_platino := true;
    END IF;

    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp_premio,
        puntos_forja = v_saldo_actual + v_monedas_premio,
        plan_membresia = CASE WHEN v_regalo_platino THEN 'Platinum' ELSE plan_membresia END,
        platinum_trial_ends_at = CASE WHEN v_regalo_platino THEN now() + interval '7 days'
                                       ELSE platinum_trial_ends_at END,
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
        'monedas_ganadas', v_monedas_premio,
        'regalo_platino', v_regalo_platino
    );
END;
$function$;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
--
-- select pg_get_functiondef(oid) from pg_proc where proname = 'reclamar_bono_reto';
-- Debe incluir auth.uid() (blindaje de seguridad, sin tocar), Y TAMBIÉN
-- v_plan/v_regalo_platino junto con plan_membresia/platinum_trial_ends_at
-- dentro del UPDATE (el regalo restaurado).
--
-- Prueba funcional: un usuario en plan gratis que llegue a racha 21 y
-- reclame el bono '21_dias' debe terminar con plan_membresia='Platinum'
-- y platinum_trial_ends_at = ahora + 7 días. Uno que ya pague un plan no
-- debe cambiar de plan al reclamar el mismo bono.
