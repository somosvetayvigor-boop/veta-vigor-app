-- Arregla que avanzar al siguiente Golem quedaba atascado si el jugador
-- vencio al Golem anterior con su ULTIMO Golpe de Vigor disponible.
--
-- Caso real (21/08): sofiita vencio al Golem del Lastre (nivel 1) con su
-- golpe #10 de 10 disponibles (260 XP). El boton "Desafiar al Siguiente
-- Golem" reutiliza la misma funcion atacar_golem(), que revisaba
-- golpes_disponibles <= 0 ANTES de revisar si habia que avanzar de nivel
-- -- asi que con 0 golpes disponibles, avanzar tiraba el mismo error
-- generico de "no tienes golpes" que atacar, y se quedaba viendo
-- "GOLEM VENCIDO" sin poder pasar al Golem 2 hasta juntar 25 XP mas.
--
-- Arreglo: pasar de nivel es una transicion (elegir a que Golem te
-- enfrentas despues), no un golpe de combate -- ya no consume Golpes de
-- Vigor. Se resuelve el avance ANTES de tocar golpes_disponibles para
-- nada, y esa llamada corta ahi (RETURN) sin aplicar ningun golpe -- el
-- primer golpe real a la pelea nueva llega en la siguiente llamada normal
-- (el jugador toca "ATACAR" como con cualquier Golem). El resto de la
-- funcion (idempotencia, HP/recompensa por nivel, recompensa al vencer,
-- el caso de "ya derrotaste a todos") queda igual.
create or replace function public.atacar_golem(p_user_id uuid, p_idempotency_key character varying)
 returns jsonb
 language plpgsql
 security definer
as $function$
DECLARE
    v_xp_actual INT;
    v_golpes_totales INT;
    v_golpes_utilizados INT;
    v_golem_vencido BOOLEAN;
    v_golem_nivel INT;
    v_saldo_actual INT;
    v_golpes_disponibles INT;
    v_hp_golem INT;
    v_recompensa_golem INT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Golpe ya registrado.');
    END IF;

    SELECT xp_actual, puntos_forja INTO v_xp_actual, v_saldo_actual
    FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

    v_xp_actual := COALESCE(v_xp_actual, 0);
    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_golpes_totales := FLOOR(v_xp_actual / 25);

    -- Obtener progreso del golem
    SELECT golpes_utilizados, golem_vencido, golem_nivel
    INTO v_golpes_utilizados, v_golem_vencido, v_golem_nivel
    FROM public.golem_progreso WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.golem_progreso (user_id, golpes_utilizados, golem_vencido, golem_nivel)
        VALUES (p_user_id, 0, false, 1);
        v_golpes_utilizados := 0;
        v_golem_vencido := false;
        v_golem_nivel := 1;
    END IF;

    -- Si no existe golem_nivel (NULL por transición antigua), asignarlo
    IF v_golem_nivel IS NULL THEN
        v_golem_nivel := 1;
    END IF;

    -- Avanzar de nivel (gratis, no gasta golpes -- ver comentario de arriba).
    -- Si ya está vencido y todavía hay un siguiente Golem, la transición se
    -- resuelve acá y la llamada corta con RETURN antes de tocar golpes.
    IF v_golem_vencido AND v_golem_nivel < 2 THEN
        v_golem_nivel := v_golem_nivel + 1;

        UPDATE public.golem_progreso
        SET golpes_utilizados = 0, golem_vencido = false, golem_nivel = v_golem_nivel
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object('success', true, 'avanzo_nivel', true, 'golem_nivel', v_golem_nivel);
    END IF;

    -- Definir HP y Recompensa según el nivel
    IF v_golem_nivel = 1 THEN
        v_hp_golem := 10;
        v_recompensa_golem := 100;
    ELSIF v_golem_nivel = 2 THEN
        v_hp_golem := 15;
        v_recompensa_golem := 200;
    ELSE
        -- Fallback si añades más en el futuro o si ya los derrotó todos
        v_hp_golem := 20;
        v_recompensa_golem := 300;
    END IF;

    v_golpes_disponibles := v_golpes_totales - v_golpes_utilizados;

    IF v_golpes_disponibles <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes golpes disponibles. Gana 25 XP para obtener uno.');
    END IF;

    -- Si llegamos acá con golem_vencido=true, el branch de arriba ya
    -- descartó el caso "hay un siguiente nivel" -- esto es siempre
    -- "ya derrotó al último Golem disponible".
    IF v_golem_vencido THEN
        RETURN jsonb_build_object('success', false, 'error', 'Has derrotado a todos los Gólems disponibles de la Forja.');
    END IF;

    -- Aplicar golpe
    v_golpes_utilizados := v_golpes_utilizados + 1;

    -- Si muere
    IF v_golpes_utilizados >= v_hp_golem THEN
        v_golem_vencido := true;

        -- Actualizar Golem (se guarda como vencido. El próximo toque de
        -- "Desafiar" lo pasará al siguiente nivel, gratis)
        UPDATE public.golem_progreso
        SET golpes_utilizados = v_golpes_utilizados, golem_vencido = true, golem_nivel = v_golem_nivel, fecha_victoria = now()
        WHERE user_id = p_user_id;

        -- Dar recompensa
        UPDATE public.perfiles SET puntos_forja = v_saldo_actual + v_recompensa_golem WHERE id = p_user_id;

        INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
        VALUES
        (p_user_id, 'GOLEM', 'victoria_golem_nv_' || v_golem_nivel, v_recompensa_golem, v_saldo_actual, v_saldo_actual + v_recompensa_golem, p_idempotency_key);

        RETURN jsonb_build_object('success', true, 'golem_muerto', true, 'recompensa', v_recompensa_golem, 'golpes_restantes_vida', 0, 'golem_nivel', v_golem_nivel);
    ELSE
        -- Solo restarle salud
        UPDATE public.golem_progreso SET golpes_utilizados = v_golpes_utilizados, golem_nivel = v_golem_nivel, golem_vencido = false WHERE user_id = p_user_id;

        INSERT INTO public.rpg_transacciones
        (user_id, tipo, origen, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
        VALUES
        (p_user_id, 'GOLEM', 'golpe_golem_nv_' || v_golem_nivel, 0, v_saldo_actual, v_saldo_actual, p_idempotency_key);

        RETURN jsonb_build_object('success', true, 'golem_muerto', false, 'golpes_restantes_vida', v_hp_golem - v_golpes_utilizados, 'golem_nivel', v_golem_nivel);
    END IF;
END;
$function$
;

-- ==========================================================================
-- VERIFICACION -- correr despues de lo de arriba
-- ==========================================================================

-- 1. Confirmar que la funcion quedo exactamente como se pidio:
-- select pg_get_functiondef(oid) from pg_proc where proname = 'atacar_golem';

-- 2. sofiita deberia poder avanzar ahora sin juntar XP de mas -- pedirle
--    que toque "Desafiar al Siguiente Golem" en la app y confirmar que
--    pasa a Nivel 2, o revisar directo:
-- select golpes_utilizados, golem_vencido, golem_nivel
-- from public.golem_progreso where user_id = '98cfa507-6f44-44da-94fa-99ab95a9a938';
-- (antes de que ella toque el boton todavia va a mostrar nivel=1,
-- vencido=true -- eso es normal, la transicion pasa en su proximo click)
