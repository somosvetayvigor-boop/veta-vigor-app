-- =====================================================================
-- VETA & VIGOR — Bajar de Élite pierde el logo; reconciliar plan real
-- =====================================================================
--
-- CONTEXTO
-- Pedido explicito: si un entrenador baja de plan, que pierda los
-- beneficios del plan anterior y se apliquen los del nuevo. El logo/marca
-- personal es exclusivo de Entrenador Élite (Perfil.jsx:933) -- si baja a
-- Pro o a Gratis, debe perderlo.
--
-- Investigando esto aparecio un hueco mas grande: activar_plan_por_compra
-- ya maneja bien cualquier compra hecha DESDE la app (sube o baja de
-- plan), pero degradar_plan_sin_suscripcion solo sabe hacer una cosa --
-- cancelacion total a Gratis. Si alguien baja de Élite a Pro desde los
-- ajustes de suscripcion de Play Store (fuera de la app), RevenueCat ya
-- no reporta "cero entitlements" -- sigue pagando Pro -- asi que
-- App.jsx nunca detectaba el cambio y el plan viejo (Élite) se quedaba
-- pegado en perfiles para siempre. Se corrige tambien eso, del lado del
-- cliente (App.jsx, mismo commit).
--
-- =====================================================================

CREATE OR REPLACE FUNCTION public.degradar_plan_sin_suscripcion()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    UPDATE public.perfiles
       SET plan_membresia   = 'Atleta Base (Gratis)',
           logo_entrenador  = CASE WHEN plan_membresia = 'Entrenador Élite' THEN NULL ELSE logo_entrenador END
     WHERE id = auth.uid()
       AND plan_membresia IN (
           'Socio Argentum',
           'Socio Aurum',
           'Plan Platinum',
           'Socio Fundador Vitalicio',
           'Entrenador Pro',
           'Entrenador Élite'
       );
$function$;


CREATE OR REPLACE FUNCTION public.activar_plan_por_compra(p_product_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Si venía de Élite y el plan nuevo ya no lo es, pierde el logo -- es
    -- beneficio exclusivo de ese plan (Perfil.jsx:933).
    UPDATE public.perfiles
       SET plan_membresia  = v_plan,
           logo_entrenador = CASE
               WHEN plan_membresia = 'Entrenador Élite' AND v_plan != 'Entrenador Élite' THEN NULL
               ELSE logo_entrenador
           END
     WHERE id = auth.uid();

    INSERT INTO public.compras_log (user_id, product_id, plan)
    VALUES (auth.uid(), p_product_id, v_plan);

    RETURN jsonb_build_object('ok', true, 'plan', v_plan);
END;
$function$;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select pg_get_functiondef(oid) from pg_proc
-- where proname in ('degradar_plan_sin_suscripcion', 'activar_plan_por_compra');
-- Ambas deben mostrar la línea de logo_entrenador en su UPDATE.
