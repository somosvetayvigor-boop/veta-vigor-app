-- =====================================================================
-- VETA & VIGOR — Checklist de comisiones pagadas (Socio Fundador Vitalicio)
-- =====================================================================
--
-- CONTEXTO
-- Sigue de VETA_VIGOR_SISTEMA_REFERIDOS.sql (ya corrido). Ese script le
-- dio a Gerardo un reporte de "quién refirió a quién y qué plan tiene
-- cada uno HOY", pero no calculaba ningún monto ni llevaba memoria de
-- qué ya se pagó -- cada mes había que reconstruir todo desde cero a
-- mano, cruzando contra RevenueCat/Play Console para saber quién pagó
-- de verdad ese ciclo (dato que no vive en esta base).
--
-- Este script agrega, sobre lo mismo:
--   1. Una tabla para marcar "esta comisión ya se pagó este mes" (con
--      el monto, para llevar historial).
--   2. Dos RPCs para marcar/desmarcar, solo admin.
--   3. admin_reporte_comisiones_fundadores() actualizada para devolver,
--      por cada referido, si ya está marcado como pagado este mes y con
--      qué monto -- y de paso corrige un descuido del script anterior:
--      nunca devolvía comision_personalizada, así que el nivel
--      "Influencer VIP" (override manual) nunca se veía reflejado en
--      este reporte aunque sí funcionaba en MisGanancias.jsx.
--
-- El cálculo del monto SUGERIDO (precio del plan x % del fundador) se
-- hace del lado del cliente (AdminComisiones.jsx), no acá -- los precios
-- cambian con el tiempo y es mucho más fácil ajustarlos en un objeto de
-- JS que redesplegar SQL. Esta tabla solo guarda lo que Gerardo confirmó
-- que pagó de verdad, no calcula nada por su cuenta.
--
-- NOTA PARA ANTIGRAVITY: `comisiones_pagos_registrados` es de acceso
-- exclusivo vía las 2 RPCs de abajo (RLS habilitado, sin políticas para
-- authenticated/anon a propósito) -- no le agregues políticas de
-- INSERT/UPDATE directas para el cliente, rompería el propósito de que
-- solo un admin pueda marcar algo como pagado.
--
-- ORDEN DE APLICACIÓN
-- Después de VETA_VIGOR_SISTEMA_REFERIDOS.sql (que ya corrió). Seguro
-- de reejecutar.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 1 — Tabla nueva
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comisiones_pagos_registrados (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fundador_id uuid NOT NULL REFERENCES public.perfiles(id),
    referido_id uuid NOT NULL REFERENCES public.perfiles(id),
    mes text NOT NULL, -- formato 'YYYY-MM'
    monto numeric,
    marcado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (fundador_id, referido_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_comisiones_pagos_fundador ON public.comisiones_pagos_registrados(fundador_id);

ALTER TABLE public.comisiones_pagos_registrados ENABLE ROW LEVEL SECURITY;
-- Sin políticas para authenticated/anon a propósito: el acceso es
-- exclusivo vía las RPCs SECURITY DEFINER de abajo.


-- ---------------------------------------------------------------------
-- BLOQUE 2 — admin_marcar_comision_pagada(p_referido_id, p_monto)
-- ---------------------------------------------------------------------
-- El fundador se deriva del lado del servidor (perfiles.referido_por
-- del referido) -- nunca se recibe como parámetro, mismo principio que
-- el resto de las RPCs de este sistema.

CREATE OR REPLACE FUNCTION public.admin_marcar_comision_pagada(p_referido_id uuid, p_monto numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_fundador_id uuid;
    v_mes text := to_char(now(), 'YYYY-MM');
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT referido_por INTO v_fundador_id FROM public.perfiles WHERE id = p_referido_id;
    IF v_fundador_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este usuario no tiene un referente asignado.');
    END IF;

    INSERT INTO public.comisiones_pagos_registrados (fundador_id, referido_id, mes, monto)
    VALUES (v_fundador_id, p_referido_id, v_mes, p_monto)
    ON CONFLICT (fundador_id, referido_id, mes)
    DO UPDATE SET monto = EXCLUDED.monto, marcado_en = now();

    RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_marcar_comision_pagada(uuid, numeric) TO authenticated;


-- ---------------------------------------------------------------------
-- BLOQUE 3 — admin_desmarcar_comision_pagada(p_referido_id)
-- ---------------------------------------------------------------------
-- Para corregir un clic accidental. Solo borra el registro del mes actual.

CREATE OR REPLACE FUNCTION public.admin_desmarcar_comision_pagada(p_referido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_mes text := to_char(now(), 'YYYY-MM');
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    DELETE FROM public.comisiones_pagos_registrados
    WHERE referido_id = p_referido_id AND mes = v_mes;

    RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_desmarcar_comision_pagada(uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- BLOQUE 4 — admin_reporte_comisiones_fundadores(): agregar checklist
-- ---------------------------------------------------------------------
-- Mismo cuerpo que VETA_VIGOR_SISTEMA_REFERIDOS.sql, más:
--   - comision_personalizada (faltaba, corrige el nivel "Influencer VIP"
--     en este reporte).
--   - pagado_este_mes / monto_pagado por cada referido.

CREATE OR REPLACE FUNCTION public.admin_reporte_comisiones_fundadores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_resultado jsonb;
    v_mes_actual text := to_char(now(), 'YYYY-MM');
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
            'comision_personalizada', f.comision_personalizada,
            'referidos', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', r.id,
                    'nombre', r.full_name,
                    'email', r.email,
                    'plan_membresia', r.plan_membresia,
                    'pagado_este_mes', EXISTS (
                        SELECT 1 FROM public.comisiones_pagos_registrados p
                        WHERE p.fundador_id = f.id AND p.referido_id = r.id AND p.mes = v_mes_actual
                    ),
                    'monto_pagado', (
                        SELECT p.monto FROM public.comisiones_pagos_registrados p
                        WHERE p.fundador_id = f.id AND p.referido_id = r.id AND p.mes = v_mes_actual
                    )
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


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- 1. select column_name from information_schema.columns
--    where table_name='comisiones_pagos_registrados';
--    Debe devolver id, fundador_id, referido_id, mes, monto, marcado_en.
--
-- 2. select proname from pg_proc
--    where proname in ('admin_marcar_comision_pagada','admin_desmarcar_comision_pagada');
--    Debe devolver las 2.
--
-- 3. select pg_get_functiondef(oid) from pg_proc where proname = 'admin_reporte_comisiones_fundadores';
--    Debe incluir "comision_personalizada" y "pagado_este_mes" en el cuerpo.
