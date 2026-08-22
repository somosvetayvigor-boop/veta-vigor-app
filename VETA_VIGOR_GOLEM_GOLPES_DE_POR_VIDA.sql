-- Arregla que avanzar de nivel de Golem regalaba golpes gratis.
--
-- Caso real (21/08, confirmado con Gerardo Y otro usuario distinto): un
-- jugador con exactamente los golpes justos para vencer al Golem del
-- Lastre (nivel 1, 10 HP) los gastaba todos, lo vencia, avanzaba al
-- Golem de Oxido (nivel 2) -- y de repente volvia a tener 10 golpes
-- disponibles, sin haber ganado XP nueva.
--
-- Causa: golpes_disponibles = floor(xp_actual/25) - golpes_utilizados.
-- Al avanzar de nivel, golpes_utilizados se reiniciaba a 0 (para que el
-- Golem nuevo "empezara sin dano"), pero floor(xp_actual/25) nunca se
-- reinicia -- es el total de golpes ganados en toda la vida del jugador.
-- Reiniciar solo uno de los dos numeros crea una recarga gratis cada vez
-- que se avanza de nivel.
--
-- Arreglo: golpes_utilizados pasa a ser un contador DE POR VIDA que
-- nunca se reinicia (igual que floor(xp_actual/25)). En vez de comparar
-- contra el HP de un solo Golem para saber si esta "vencido", se compara
-- contra el HP ACUMULADO de todos los Golems ya enfrentados hasta el
-- nivel actual (10 para nivel 1, 10+15=25 para nivel 2). La "vida
-- restante" que se le muestra al jugador se calcula restando ese mismo
-- acumulado previo.

-- 1. Migrar las filas que YA avanzaron de nivel bajo la logica vieja:
--    su golpes_utilizados quedo en un numero chico (solo lo gastado en
--    el Golem actual, tras el reinicio viejo) en vez de reflejar
--    tambien lo ya gastado en Golems anteriores. Se le suma el HP de
--    los niveles previos para que el contador de por vida quede
--    correcto retroactivamente -- sin esto, todos los que ya avanzaron
--    quedarian con golpes de mas hasta que la funcion nueva los
--    "descontara" de nuevo (doble beneficio en vez de neutral).
update public.golem_progreso
set golpes_utilizados = golpes_utilizados + 10  -- HP del nivel 1, el unico anterior que existe hoy
where golem_nivel = 2;

-- 2. La funcion.
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
    v_hp_acumulado_previo INT;
    v_hp_acumulado_actual INT;
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

    -- Avanzar de nivel (gratis, no gasta golpes -- ver
    -- VETA_VIGOR_GOLEM_AVANCE_SIN_GOLPE.sql). golpes_utilizados YA NO se
    -- reinicia acá: es un contador de por vida (ver comentario de arriba
    -- del archivo), así que avanzar de nivel no regala golpes de la nada.
    IF v_golem_vencido AND v_golem_nivel < 2 THEN
        v_golem_nivel := v_golem_nivel + 1;

        UPDATE public.golem_progreso
        SET golem_vencido = false, golem_nivel = v_golem_nivel
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object('success', true, 'avanzo_nivel', true, 'golem_nivel', v_golem_nivel);
    END IF;

    -- HP de cada nivel y el HP acumulado de todos los niveles ANTERIORES
    -- al actual (el umbral de "vencido" es acumulado previo + HP del
    -- nivel actual -- golpes_utilizados es de por vida, así que hay que
    -- compararlo contra cuánta vida acumulada representan todos los
    -- Golems ya enfrentados, no solo el de ahora).
    IF v_golem_nivel = 1 THEN
        v_hp_golem := 10;
        v_hp_acumulado_previo := 0;
        v_recompensa_golem := 100;
    ELSIF v_golem_nivel = 2 THEN
        v_hp_golem := 15;
        v_hp_acumulado_previo := 10;
        v_recompensa_golem := 200;
    ELSE
        -- Fallback si añades más en el futuro o si ya los derrotó todos
        v_hp_golem := 20;
        v_hp_acumulado_previo := 25;
        v_recompensa_golem := 300;
    END IF;
    v_hp_acumulado_actual := v_hp_acumulado_previo + v_hp_golem;

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

    -- Si muere (el acumulado de por vida ya alcanza o pasa el umbral)
    IF v_golpes_utilizados >= v_hp_acumulado_actual THEN
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

        RETURN jsonb_build_object('success', true, 'golem_muerto', false, 'golpes_restantes_vida', v_hp_acumulado_actual - v_golpes_utilizados, 'golem_nivel', v_golem_nivel);
    END IF;
END;
$function$
;

-- ==========================================================================
-- VERIFICACION -- correr despues de lo de arriba
-- ==========================================================================

-- 1. Confirmar que la migracion de golpes_utilizados no dejo numeros raros
--    (nadie debe quedar con golpes_disponibles negativos de forma
--    permanente -- eso solo pasaria si alguien ya habia gastado golpes
--    reales contra el Golem 2 antes de este arreglo, lo cual es
--    exactamente lo que se queria corregir):
-- select gp.user_id, p.username, gp.golem_nivel, gp.golpes_utilizados,
--        floor(p.xp_actual / 25) as golpes_totales,
--        floor(p.xp_actual / 25) - gp.golpes_utilizados as golpes_disponibles
-- from public.golem_progreso gp
-- join public.perfiles p on p.id = gp.user_id
-- order by gp.golem_nivel desc, golpes_disponibles asc;

-- 2. Confirmar que la funcion quedo exactamente como se pidio:
-- select pg_get_functiondef(oid) from pg_proc where proname = 'atacar_golem';
