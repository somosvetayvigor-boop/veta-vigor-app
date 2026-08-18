-- =====================================================================
-- VETA & VIGOR - ÍTEMS COSMÉTICOS: BORDES NUEVOS + AURA + "MI COLECCIÓN"
-- =====================================================================
-- Nota para quien lea esto (Antigravity u otra sesión): agrega un
-- segundo "slot" cosmético independiente del borde (marco_activo).
-- aura_activa sigue exactamente el mismo criterio que marco_activo:
-- es puramente decorativo (no afecta economía RPG ni permisos), así
-- que NO se agrega a proteger_columnas_perfiles() -- el cliente la
-- escribe directo, sin RPC, igual que ya pasa con marco_activo desde
-- VETA_VIGOR_BLINDAJE_PERFILES.sql.
--
-- Los ítems en sí (borde_plata, borde_dorado, aura_arcana) NO requieren
-- catálogo en la base -- comprar_item_rpg (VETA_VIGOR_FIX_ZONA_HORARIA_RPG.sql)
-- ya acepta cualquier p_item_id sin lista fija. Todo el catálogo de
-- precios/nombres vive del lado del cliente (src/pages/LaPrueba.jsx).
--
-- Verificado antes de escribir esto: la definición vigente de
-- perfiles_publico es la de VETA_VIGOR_AGREGAR_LOGO_ENTRENADOR.sql (la
-- más reciente de las que tocan esta vista), y la de get_leaderboard()
-- es la de VETA_VIGOR_LEADERBOARD_FIX.sql. Si alguna de las dos volvió
-- a cambiar después de este archivo, confirmar con pg_get_viewdef /
-- pg_get_functiondef antes de asumir que este CREATE OR REPLACE sigue
-- vigente.

-- 1. Columna nueva, mismo criterio que marco_activo (cosmético, sin protección)
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS aura_activa text;

-- 2. Vista pública: agregar aura_activa junto a marco_activo
CREATE OR REPLACE VIEW public.perfiles_publico
WITH (security_invoker = false) AS
SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.nivel,
    p.nivel_rpg,
    p.racha_actual,
    p.marco_activo,
    p.plan_membresia,
    CASE
        WHEN p.id = auth.uid() THEN p.email
        WHEN EXISTS (
            SELECT 1 FROM public.relacion_entrenador_alumno rea
            WHERE (rea.entrenador_id = auth.uid() AND rea.alumno_id = p.id)
               OR (rea.alumno_id = auth.uid() AND rea.entrenador_id = p.id)
        ) THEN p.email
        ELSE NULL
    END AS email,
    CASE
        WHEN p.id = auth.uid() THEN p.calendario_personalizado
        WHEN EXISTS (
            SELECT 1 FROM public.relacion_entrenador_alumno rea
            WHERE rea.entrenador_id = auth.uid() AND rea.alumno_id = p.id
        ) THEN p.calendario_personalizado
        ELSE NULL
    END AS calendario_personalizado,
    p.logo_entrenador,
    -- Al final, no en medio: CREATE OR REPLACE VIEW no deja insertar una
    -- columna nueva entre las que ya existen (error 42P16, ya
    -- confirmado en vivo el 16/08 en VETA_VIGOR_AGREGAR_LOGO_ENTRENADOR.sql).
    p.aura_activa
FROM public.perfiles p;

GRANT SELECT ON public.perfiles_publico TO authenticated;

-- 3. Leaderboard: agregar aura_activa junto a marco_activo
DROP FUNCTION IF EXISTS public.get_leaderboard();
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
    user_id uuid,
    username text,
    nombre_completo text,
    avatar_url text,
    marco_activo text,
    aura_activa text,
    total_workouts bigint,
    retos_completados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS user_id,
        p.username,
        p.full_name AS nombre_completo,
        p.avatar_url,
        p.marco_activo,
        p.aura_activa,
        COUNT(h.id) AS total_workouts, -- Basado en entrenamientos reales 100% seguros
        COALESCE(p.retos_completados_count, 0) AS retos_completados
    FROM public.perfiles p
    LEFT JOIN public.historial_entrenamientos h ON p.id = h.user_id AND h.completado = true
    WHERE p.rol_usuario IS DISTINCT FROM 'entrenador'
    GROUP BY p.id
    ORDER BY total_workouts DESC
    LIMIT 100;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='perfiles' and column_name='aura_activa';
-- Debe devolver 1 fila.
--
-- select pg_get_viewdef('public.perfiles_publico'::regclass, true);
-- Debe incluir aura_activa en el SELECT.
--
-- select pg_get_functiondef('public.get_leaderboard'::regproc);
-- Debe incluir aura_activa en RETURNS TABLE y en el SELECT interno.
