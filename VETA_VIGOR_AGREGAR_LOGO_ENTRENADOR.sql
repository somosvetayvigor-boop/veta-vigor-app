-- =====================================================================
-- VETA & VIGOR — Agregar la columna logo_entrenador que faltaba
-- =====================================================================
--
-- CONTEXTO
-- Perfil.jsx (subir logo, linea 338) y MiRutina.jsx (mostrarlo al alumno,
-- marca blanca del entrenador arriba de "Mi Calendario") ya usaban
-- perfiles.logo_entrenador, pero la columna nunca existio en la base real
-- (confirmado en vivo el 16/08 con information_schema.columns). Cada vez
-- que un entrenador subia su logo, la imagen SI se guardaba en el bucket
-- de Storage y en su user_metadata, pero el UPDATE a perfiles fallaba --
-- y como es el ultimo paso de la funcion, el error hacia saltar una
-- alerta enganosa ("revisa tu bucket de Supabase") que no tenia nada que
-- ver con el problema real.
--
-- Este script solo agrega la columna. El codigo de Perfil.jsx (subir/
-- quitar logo) ya estaba bien escrito, nomas nunca tuvo donde guardar.
-- MiRutina.jsx se corrige aparte (ver commit) para volver a leerla de
-- perfiles_publico -- hoy esta forzada a null ahi porque la columna no
-- existia cuando se escribio el blindaje de columnas de perfiles.
--
-- =====================================================================

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS logo_entrenador text;

-- logo_entrenador es dato de marca del entrenador (su logo), no privado --
-- se agrega a la vista publica igual que full_name/avatar_url, visible
-- para cualquier usuario autenticado. Mismos criterios que
-- VETA_VIGOR_BLINDAJE_COLUMNAS_PERFILES.sql.
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
    -- Al final, no en medio: CREATE OR REPLACE VIEW no deja insertar una
    -- columna nueva entre las que ya existen (Postgres lo lee como intento
    -- de renombrar la que quedaba en esa posicion -- error 42P16,
    -- confirmado en vivo el 16/08).
    p.logo_entrenador
FROM public.perfiles p;

GRANT SELECT ON public.perfiles_publico TO authenticated;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='perfiles' and column_name='logo_entrenador';
-- Debe devolver 1 fila.
