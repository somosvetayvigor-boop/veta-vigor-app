-- =====================================================================
-- VETA & VIGOR — completar_mision_rpg también calcula nivel_rpg
-- =====================================================================
--
-- NOTA PARA CUALQUIER OTRO AGENTE QUE TOQUE ESTA FUNCIÓN (Antigravity u
-- otra sesión): esta función ya tuvo un incidente real de coexistencia el
-- 18/08 (ver VETA_VIGOR_RESTAURAR_ECONOMIA_RPG.sql) — otra sesión la
-- sobrescribió sin saber que ya estaba blindada, y quedó otra vez
-- explotable durante varias horas. Antes de volver a redefinir
-- completar_mision_rpg, confirma el contrato real en vivo con:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'completar_mision_rpg';
-- No asumas desde ningún archivo .sql del repo cuál es la versión vigente
-- — varios se escribieron para revertir a otro. Esta es la versión más
-- reciente al 20/08.
--
-- CONTEXTO DEL CAMBIO
-- La versión anterior (VETA_VIGOR_RESTAURAR_ECONOMIA_RPG.sql, 18/08) dejó
-- de actualizar nivel_rpg dentro de esta función a propósito ("lo calcula
-- el cliente y lo sube por separado"). El problema: SOLO
-- RutinaDetail.jsx sube nivel_rpg al servidor tras calcularlo (una
-- llamada aparte, best-effort, sin reintento si falla). El check-in de
-- Bienestar y Descanso Activo NUNCA lo suben — se quedan solo en SQLite
-- local, y SyncService.pushData() excluye nivel_rpg a propósito del push
-- genérico de perfiles (para no chocar con esta función). Resultado real
-- reportado por Gerardo: la barra de "Nivel 1" en El Gremio se veía
-- completamente llena (xp_actual ya había cruzado el umbral de 100) pero
-- el número de nivel nunca subía, porque nivel_rpg se quedó pegado en el
-- servidor.
--
-- SOLUCIÓN: esta función (la única fuente atómica y confiable de XP) pasa
-- a ser también la única fuente de verdad de nivel_rpg — se recalcula
-- aquí en cada llamada, a partir del XP total ya acumulado, y se
-- devuelve en la respuesta para que el cliente lo adopte de inmediato
-- (igual que ya hace con xp_total/monedas_total/racha). Autocorrige solo:
-- la próxima vez que cualquier usuario atascado gane XP por cualquier
-- camino, su nivel_rpg salta al valor correcto -- no hace falta backfill
-- manual para las cuentas que ya quedaron mal.
--
-- Misma firma (uuid, varchar, varchar, integer, integer) que la versión
-- vigente, así que CREATE OR REPLACE basta -- no hace falta DROP y los
-- GRANT existentes se conservan intactos. Todo lo demás (orígenes
-- reconocidos, montos por origen, tope diario, cálculo de racha,
-- idempotencia namespaced por usuario) queda IDÉNTICO a
-- VETA_VIGOR_RESTAURAR_ECONOMIA_RPG.sql -- no se toca nada de eso.
--
-- ORDEN DE APLICACIÓN
-- Ninguno. Autocontenido, seguro de reejecutar.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.completar_mision_rpg(
    p_user_id uuid,
    p_origen character varying,
    p_idempotency_key character varying,
    p_xp integer DEFAULT 10,          -- ignorado si el origen es reconocido;
    p_monedas integer DEFAULT 5       -- el importe real lo decide el servidor
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
    v_nivel_rpg     INT;
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

    -- Los importes los fija el servidor a partir del origen, no el cliente.
    IF p_origen = 'entrenamiento' THEN
        v_xp := 10; v_monedas := 5;
    ELSIF p_origen = 'descanso_activo' THEN
        -- ProgressionEngine da 15-20 XP según hábitos marcados; se acota lo
        -- que pide el cliente a ese rango en vez de fijarlo, para no hacer
        -- bajar un número que el usuario ya vio en pantalla.
        v_xp := LEAST(GREATEST(COALESCE(p_xp, 15), 15), 20);
        v_monedas := 15;
    ELSIF p_origen LIKE 'reto_vigor21_dia_%' THEN
        v_xp := 10; v_monedas := 5;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Origen no reconocido: ' || p_origen);
    END IF;

    -- Clave namespaced por usuario: la de un usuario no puede colisionar ni
    -- reutilizar la de otro.
    v_key := v_uid::text || ':' || p_idempotency_key;

    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = v_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se registró esta misión.');
    END IF;

    v_hoy := (timezone('America/Mexico_City', now()))::DATE;

    -- Tope diario: acota el daño de generar claves nuevas en bucle, sin
    -- romper la sincronización de varios días entrenados sin conexión.
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

    -- Mismo cálculo que calculateLevel() en ProgressionEngine.js (100 XP
    -- lineales por nivel) -- se mantiene igual acá para que servidor y
    -- cliente nunca diverjan en qué nivel corresponde a cuánto XP.
    v_nivel_rpg := FLOOR((v_xp_actual + v_xp) / 100) + 1;

    -- Solo puntos_forja: es la columna real. No se escribe monedas_forja ni
    -- last_workout_date porque no existen en el esquema.
    UPDATE public.perfiles
    SET xp_actual    = v_xp_actual + v_xp,
        puntos_forja = v_saldo_actual + v_monedas,
        racha_actual = v_racha_actual,
        nivel_rpg    = v_nivel_rpg,
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
        'nivel_rpg', v_nivel_rpg,
        'xp_total', v_xp_actual + v_xp,
        'monedas_total', v_saldo_actual + v_monedas
    );
END;
$function$;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
--
-- select pg_get_functiondef(oid) from pg_proc where proname = 'completar_mision_rpg';
-- Debe mostrar "nivel_rpg = v_nivel_rpg" dentro del UPDATE y
-- "'nivel_rpg', v_nivel_rpg" dentro del RETURN.
--
-- Prueba funcional: si tienes un usuario con xp_actual >= 100 y nivel_rpg
-- todavía en 1 (el bug reportado), que ese usuario gane cualquier XP desde
-- la app (rutina, bienestar o Descanso Activo) y confirmar que nivel_rpg
-- sube a lo que le corresponda por su XP total, no solo por el XP nuevo.
