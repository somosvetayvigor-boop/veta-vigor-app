-- =====================================================================
-- VETA & VIGOR — La invitación por correo también requiere aceptación
-- =====================================================================
--
-- CONTEXTO
-- Cuando un entrenador mete el correo de un alumno que aún no está
-- registrado (la "sala de espera" en invitaciones_entrenador), en cuanto
-- ese correo se registra, canjear_invitacion_entrenador() lo vinculaba
-- como 'activo' de inmediato — sin pedirle confirmación a la persona.
--
-- Que un entrenador SEPA tu correo no significa que te lo hayas dado PARA
-- ESTO: circula por mil razones (una lista del gimnasio, un grupo de
-- WhatsApp) sin que eso autorice la vinculación. Y mientras la relación
-- estuviera 'activo', el entrenador ya tenía permiso de escritura sobre el
-- calendario, sistema asignado, etc. del alumno vía la política
-- entrenadores_pueden_actualizar_alumnos de perfiles, y visibilidad de sus
-- datos en el panel — todo antes de que la persona supiera que existía esa
-- vinculación.
--
-- La app YA tenía resuelta esta clase de confirmación para el caso de
-- reactivar a un alumno inactivo: ese flujo pone la relación en
-- 'pendiente' y App.jsx muestra un modal (pendingVinculacion, ~línea 1315)
-- con el nombre y correo del entrenador, más botones de aceptar/rechazar,
-- usando la RPC aceptar_vinculacion() que ya existe. Este cambio solo hace
-- que la invitación por correo entre por esa misma puerta, en vez de
-- vincularse directo.
--
-- Único cambio: 'activo' -> 'pendiente' en el INSERT. Todo lo demás de la
-- función queda igual.
--
-- =====================================================================

CREATE OR REPLACE FUNCTION public.canjear_invitacion_entrenador()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_email      text;
    v_invitacion record;
BEGIN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    SELECT * INTO v_invitacion
      FROM public.invitaciones_entrenador
     WHERE lower(email_alumno) = v_email
     LIMIT 1 FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_invitacion');
    END IF;

    -- 'pendiente', no 'activo': el alumno debe aceptar antes de que el
    -- entrenador tenga cualquier permiso sobre su perfil.
    INSERT INTO public.relacion_entrenador_alumno (entrenador_id, alumno_id, estado)
    VALUES (v_invitacion.entrenador_id, auth.uid(), 'pendiente');

    -- El rol_usuario ya NO se asigna aquí. Se asignaba 'alumno_entrenador' de
    -- inmediato, antes de que la persona aceptara nada. Ahora ese cambio de
    -- rol ocurre dentro de aceptar_vinculacion(), solo si de verdad acepta.
    DELETE FROM public.invitaciones_entrenador WHERE id = v_invitacion.id;

    RETURN jsonb_build_object('ok', true, 'estado', 'pendiente');
END;
$function$;


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select pg_get_functiondef(oid) from pg_proc where proname = 'canjear_invitacion_entrenador';
-- Debe mostrar 'pendiente' en el INSERT, y ninguna línea que toque
-- rol_usuario.
