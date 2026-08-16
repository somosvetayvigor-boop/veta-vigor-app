-- =====================================================================
-- VETA & VIGOR — Restringir QUE COLUMNAS de perfiles ve un usuario de OTRO
-- =====================================================================
--
-- CONTEXTO
-- Hasta hoy (16/08), "Todos los autenticados pueden ver perfiles" (SELECT,
-- roles={authenticated}, qual=true) deja leer TODAS las columnas de
-- CUALQUIER fila a cualquier usuario con sesion -- no solo las que la app
-- pide en pantalla. Cualquiera con una cuenta gratis puede pedir
-- directo contra la API (curl/Postman, sin pasar por la app) email, fotos
-- de antes/despues y ganancias de cualquier otro usuario. Ver el hilo de
-- conversacion del 16/08 para el detalle de por que es explotable de
-- verdad y no solo en teoria.
--
-- Se investigo primero (rastreo completo del codigo) que columnas de OTROS
-- usuarios usa realmente la app, para no romper nada:
--   - Comunidad/Duos/Muro de la Fama: full_name, username, avatar_url,
--     nivel, nivel_rpg, racha_actual, marco_activo, plan_membresia.
--   - Entrenador viendo a sus alumnos (PanelEntrenador, AsignarRutina*):
--     ademas necesita email y calendario_personalizado -- SOLO de sus
--     propios alumnos, via relacion_entrenador_alumno.
--   - Alumno viendo a su entrenador (App.jsx invitacion pendiente,
--     MiRutina.jsx): full_name, logo_entrenador, y tambien email para
--     poder identificar quien lo invito (se muestra en pantalla).
--   - Dos busquedas por correo (Comunidad.jsx alianzas, PanelEntrenador.jsx
--     agregar alumno) filtran perfiles por email -- eso deja de funcionar
--     en cuanto email no sea una columna visible de forma general, asi que
--     se reemplazan por la funcion buscar_usuario_por_email() de mas abajo.
--
-- DISEÑO ELEGIDO: una vista (perfiles_publico) en vez de RLS a secas,
-- porque RLS solo filtra FILAS, no columnas -- no hay forma de decir "esta
-- columna se ve en mi propia fila pero no en las ajenas" solo con
-- politicas. La vista se crea con el dueño de base de datos (bypasea RLS
-- de perfiles al leer, igual que una funcion SECURITY DEFINER) y decide
-- columna por columna, fila por fila, que exponer.
--
-- REQUIERE CAMBIOS DE CODIGO (a diferencia de los arreglos silenciosos de
-- hoy): los componentes que leen perfiles de OTROS usuarios deben apuntar
-- a perfiles_publico en vez de perfiles. Sin esos cambios, Duos, Muro de
-- la Fama, panel de entrenador, etc. dejan de traer datos de otros
-- usuarios en cuanto se aplique este script. Ver el commit que acompaña
-- este archivo.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 1 — Vista de columnas seguras
-- ---------------------------------------------------------------------

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
    -- logo_entrenador: el codigo (Perfil.jsx, MiRutina.jsx) lo usa, pero la
    -- columna no existe en la base real (confirmado 16/08 al correr esto
    -- por primera vez -- 42703). Pendiente investigar aparte si el feature
    -- de logo de entrenador esta roto de origen o vive en otro lado.
    -- email: visible si es tu propia fila, o si existe una relacion
    -- entrenador<->alumno entre quien consulta y esta fila (en cualquier
    -- direccion y cualquier estado, para cubrir tambien invitaciones
    -- pendientes -- ver App.jsx:1040).
    CASE
        WHEN p.id = auth.uid() THEN p.email
        WHEN EXISTS (
            SELECT 1 FROM public.relacion_entrenador_alumno rea
            WHERE (rea.entrenador_id = auth.uid() AND rea.alumno_id = p.id)
               OR (rea.alumno_id = auth.uid() AND rea.entrenador_id = p.id)
        ) THEN p.email
        ELSE NULL
    END AS email,
    -- calendario_personalizado: solo el entrenador de ESTE alumno lo ve
    -- (lo necesita para asignar rutinas). No es reciproco: un alumno no
    -- necesita ver el calendario de su entrenador.
    CASE
        WHEN p.id = auth.uid() THEN p.calendario_personalizado
        WHEN EXISTS (
            SELECT 1 FROM public.relacion_entrenador_alumno rea
            WHERE rea.entrenador_id = auth.uid() AND rea.alumno_id = p.id
        ) THEN p.calendario_personalizado
        ELSE NULL
    END AS calendario_personalizado
FROM public.perfiles p;

-- security_invoker = false (el default historico): la vista corre con los
-- privilegios de quien la creo, no de quien la consulta -- por eso puede
-- leer filas ajenas en perfiles pese a que la politica de abajo ya no lo
-- permite directo. El filtrado real pasa aqui adentro, columna por
-- columna, no en una politica de perfiles.

GRANT SELECT ON public.perfiles_publico TO authenticated;


-- ---------------------------------------------------------------------
-- BLOQUE 2 — Cerrar el acceso de columna completa en la tabla base
-- ---------------------------------------------------------------------
--
-- Con esto, un authenticated que consulte perfiles directo (tabla, no
-- vista) solo ve su propia fila -- exactamente como ya funcionaba para
-- anon. "Users read own profile only" (roles={public}, auth.uid()=id) se
-- queda igual, sigue cubriendo tanto anon (siempre false, sin sesion) como
-- authenticated (su propia fila). El admin sigue intacto (politica ALL
-- aparte, verificada en vivo antes de este cambio).

DROP POLICY IF EXISTS "Todos los autenticados pueden ver perfiles" ON public.perfiles;


-- ---------------------------------------------------------------------
-- BLOQUE 3 — Busqueda por correo (reemplaza los dos SELECT ... WHERE
-- email = ... que dejan de funcionar sin la columna email disponible)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.buscar_usuario_por_email(p_email text)
RETURNS TABLE(id uuid, rol_usuario text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, rol_usuario
    FROM public.perfiles
    WHERE email = p_email;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_email(text) TO authenticated;

-- No es una fuga nueva: hoy cualquiera ya puede hacer exactamente esta
-- misma pregunta ("hay un usuario con este correo, y si lo hay cual es su
-- id/rol") a traves de la consulta directa que esta funcion reemplaza.
-- Esto solo acota la respuesta a esas dos columnas en vez de la fila
-- completa.


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- 1. select policyname, roles, qual from pg_policies where tablename = 'perfiles' and cmd = 'SELECT';
--    Ya no debe existir "Todos los autenticados pueden ver perfiles".
--    Debe seguir "Users read own profile only" y la de Admin.
--
-- 2. select * from public.perfiles_publico limit 3;
--    (corrido como owner/dashboard) debe traer filas con email y
--    calendario_personalizado en NULL para usuarios que no sean tu propia
--    fila ni tus alumnos/entrenador.
--
-- 3. select * from public.buscar_usuario_por_email('un-correo-que-exista@ejemplo.com');
--    debe traer id + rol_usuario.
