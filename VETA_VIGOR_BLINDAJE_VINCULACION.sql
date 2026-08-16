-- =====================================================================
-- VETA & VIGOR — Blindar relacion_entrenador_alumno (ambas direcciones)
-- =====================================================================
--
-- CONTEXTO
-- "alumnos_pueden_gestionar_su_vinculacion" (ALL, alumno_id=auth.uid(),
-- sin restriccion de entrenador_id ni estado) dejaba a cualquier alumno
-- insertar una fila apuntando a CUALQUIER usuario, con estado='activo'
-- directo, sin invitacion. Combinado con la vista perfiles_publico de hoy
-- (que muestra el email de cualquiera con quien exista una fila en esta
-- tabla), esto abria una puerta para leer el email de cualquier persona
-- fabricando una relacion falsa.
--
-- Revisando el resto de la tabla para blindarla completa, aparecieron dos
-- huecos mas, simetricos:
--
--   1. "Entrenadores actualizan sus vinculos" (UPDATE) no restringe que
--      estado se puede poner. El codigo cliente (PanelEntrenador.jsx:267)
--      ya evita mandar 'activo' directo, pero eso es solo disciplina del
--      cliente -- por API directa un entrenador podia activar una
--      relacion sin que el alumno aceptara nunca, saltandose el diseño
--      de invitacion-con-aceptacion de hoy.
--
--   2. No existe NINGUNA politica de INSERT para el entrenador. Con RLS
--      activo (confirmado: relrowsecurity=true) y sin ella,
--      PanelEntrenador.jsx:246 (agregar un alumno que YA tiene cuenta)
--      esta fallando en silencio -- ningun entrenador puede agregar hoy a
--      un alumno ya registrado por este camino.
--
-- Tambien: ni la politica de alumno ni la de entrenador protegian contra
-- reasignar el OTRO id en una fila ya existente (un alumno podia mover su
-- fila a otro entrenador_id via UPDATE; un entrenador podia mover
-- alumno_id a otro usuario, "robando" la fila). Un trigger, no una
-- politica, es lo que hace falta -- WITH CHECK solo ve la fila NUEVA, no
-- puede comparar contra la vieja.
--
-- DISEÑO
--   - Trigger BEFORE UPDATE: entrenador_id y alumno_id quedan inmutables
--     para el cliente en una fila ya existente (mismo patron que
--     proteger_columnas_perfiles). Para cambiar quien esta vinculado con
--     quien hay que borrar e insertar de nuevo, nunca reasignar.
--   - Alumno: ya no puede INSERT (solo via canjear_invitacion_entrenador /
--     aceptar_vinculacion, que corren como postgres). UPDATE solo le deja
--     mover su propia fila a estado='desvinculado'. DELETE sin
--     restriccion de estado (para rechazar una invitacion pendiente).
--   - Entrenador: INSERT nuevo, solo con estado='pendiente' (nunca activo
--     directo). UPDATE solo a 'pendiente' o 'inactivo' (nunca 'activo').
--     DELETE sin cambios.
--   - 'activo' solo lo pone aceptar_vinculacion(), que ya valida
--     alumno_id=auth.uid() antes de tocar la fila. Verificado en vivo.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 1 — entrenador_id y alumno_id inmutables para el cliente
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proteger_columnas_relacion_entrenador_alumno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Las RPCs (aceptar_vinculacion, canjear_invitacion_entrenador, etc.)
    -- corren como postgres: pasan de largo. Solo se filtra lo que llega
    -- directo del cliente.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    NEW.entrenador_id := OLD.entrenador_id;
    NEW.alumno_id      := OLD.alumno_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_columnas_relacion ON public.relacion_entrenador_alumno;
CREATE TRIGGER trg_proteger_columnas_relacion
    BEFORE UPDATE ON public.relacion_entrenador_alumno
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_columnas_relacion_entrenador_alumno();


-- ---------------------------------------------------------------------
-- BLOQUE 2 — Alumno: sin INSERT, UPDATE solo para desvincularse, DELETE libre
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "alumnos_pueden_gestionar_su_vinculacion" ON public.relacion_entrenador_alumno;

DROP POLICY IF EXISTS "Alumnos desvinculan su propia relacion" ON public.relacion_entrenador_alumno;
CREATE POLICY "Alumnos desvinculan su propia relacion"
    ON public.relacion_entrenador_alumno FOR UPDATE
    USING      (alumno_id = auth.uid())
    WITH CHECK (alumno_id = auth.uid() AND estado = 'desvinculado');

DROP POLICY IF EXISTS "Alumnos eliminan su propia relacion" ON public.relacion_entrenador_alumno;
CREATE POLICY "Alumnos eliminan su propia relacion"
    ON public.relacion_entrenador_alumno FOR DELETE
    USING (alumno_id = auth.uid());

-- Sin politica de INSERT para alumno_id=auth.uid(): a proposito. Solo
-- canjear_invitacion_entrenador() y aceptar_vinculacion() pueden crear o
-- activar una fila, y ambas ya validan la invitacion/identidad antes.


-- ---------------------------------------------------------------------
-- BLOQUE 3 — Entrenador: INSERT nuevo, UPDATE acotado a pendiente/inactivo
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Entrenadores crean vinculo pendiente" ON public.relacion_entrenador_alumno;
CREATE POLICY "Entrenadores crean vinculo pendiente"
    ON public.relacion_entrenador_alumno FOR INSERT
    WITH CHECK (entrenador_id = auth.uid() AND estado = 'pendiente');

DROP POLICY IF EXISTS "Entrenadores actualizan sus vinculos" ON public.relacion_entrenador_alumno;
CREATE POLICY "Entrenadores actualizan sus vinculos"
    ON public.relacion_entrenador_alumno FOR UPDATE
    USING      (auth.uid() = entrenador_id)
    WITH CHECK (auth.uid() = entrenador_id AND estado IN ('pendiente', 'inactivo'));

-- "Entrenadores eliminan sus vinculos" (DELETE) y las 3 politicas de
-- SELECT (Admin, Alumnos ven su propio estado, Entrenadores ven sus
-- vinculos) no cambian.


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select policyname, cmd, qual, with_check from pg_policies
-- where tablename = 'relacion_entrenador_alumno' order by cmd, policyname;
--
-- Debe mostrar: 1 INSERT (entrenador, estado='pendiente'), 3 SELECT sin
-- cambios, 2 UPDATE (entrenador acotado a pendiente/inactivo; alumno
-- acotado a desvinculado), 2 DELETE (entrenador y alumno, cada uno sobre
-- su propia fila). Cero politicas ALL.
--
-- Probar en la app: un entrenador agregando a un alumno YA registrado
-- (PanelEntrenador.jsx) debe volver a funcionar. Desvincularse
-- (Perfil.jsx) y rechazar una invitacion pendiente (App.jsx) deben seguir
-- funcionando igual que antes.
