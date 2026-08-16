-- =====================================================================
-- VETA & VIGOR — Cerrar SELECT/DELETE abiertos en invitaciones_entrenador
-- =====================================================================
--
-- CONTEXTO
-- invitaciones_entrenador es la "sala de espera": el entrenador mete el
-- correo de un alumno que aún no se registra (PanelEntrenador.jsx,
-- agregarAlumno), y canjear_invitacion_entrenador() la consume cuando ese
-- correo se registra, vinculando la relación automáticamente.
--
-- PROBLEMA CONFIRMADO EN VIVO (pg_policies)
-- SELECT y DELETE estaban concedidos a todo `authenticated` con qual=true,
-- sin restricción alguna:
--   · SELECT true  → cualquier usuario logueado lee TODA la tabla: el
--     correo de cada alumno invitado y qué entrenador lo invitó.
--   · DELETE true  → cualquier usuario logueado borra CUALQUIER invitación
--     de cualquier entrenador, sin restricción.
--
-- Verificado que ningún código de la app usa ninguna de las dos: el único
-- punto de contacto en todo src/ es el INSERT de PanelEntrenador.jsx. Y
-- canjear_invitacion_entrenador() es SECURITY DEFINER — corre como
-- postgres y se salta estas políticas por completo, así que no necesita
-- permiso de DELETE del rol authenticated para funcionar. Estas dos
-- políticas no tienen ningún uso legítimo actual: son solo riesgo.
--
-- La política de INSERT ("Los entrenadores pueden insertar invitaciones",
-- WITH CHECK auth.uid() = entrenador_id) está bien y no se toca.
--
-- =====================================================================

DROP POLICY IF EXISTS "Cualquier usuario autenticado puede leer para checar si tiene i" ON public.invitaciones_entrenador;
DROP POLICY IF EXISTS "Cualquier usuario puede borrar al consumir la invitación" ON public.invitaciones_entrenador;

-- SELECT: el entrenador ve solo las invitaciones que él mismo mandó. Nada
-- en la app lo usa hoy, pero si algún día se agrega un "ver invitaciones
-- pendientes" en PanelEntrenador.jsx, esta política ya lo deja listo sin
-- tener que reabrir el acceso a toda la tabla.
CREATE POLICY "Entrenadores ven sus propias invitaciones"
    ON public.invitaciones_entrenador FOR SELECT
    USING (auth.uid() = entrenador_id);

-- No se crea ninguna política de DELETE para authenticated: la única vía
-- legítima de borrado es canjear_invitacion_entrenador(), que al ser
-- SECURITY DEFINER no necesita permiso explícito.


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select policyname, cmd, qual from pg_policies where tablename = 'invitaciones_entrenador';
-- Debe mostrar 2 políticas: el INSERT original sin tocar, y el SELECT
-- nuevo restringido a auth.uid() = entrenador_id. Ninguna de DELETE.
