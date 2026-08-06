-- VETA & VIGOR - MIGRACIÓN RPG MVP (C-05 CONSOLIDADO)
-- Instrucciones: Ejecuta este script íntegramente en el SQL Editor de tu panel de Supabase.

-- 1. TABLA: HISTORIAL DE TRANSACCIONES (Inmutable, registro de economía)
CREATE TABLE IF NOT EXISTS public.rpg_transacciones (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'MISION', 'BONO', 'COMPRA', 'GOLEM'
    origen VARCHAR(100) NOT NULL, -- Ej: 'reto_21_dia_1', 'anima_bosque'
    cantidad_xp INT NOT NULL DEFAULT 0,
    cantidad_monedas INT NOT NULL DEFAULT 0,
    saldo_anterior_monedas INT NOT NULL DEFAULT 0,
    saldo_posterior_monedas INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL, -- Previene doble cobro
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('America/Mexico_City', now())
);

-- 2. TABLA: INVENTARIO DE OBJETOS PERMANENTES/CONSUMIBLES
CREATE TABLE IF NOT EXISTS public.rpg_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    item_id VARCHAR(100) NOT NULL, -- 'ficha_reposo', 'anima_bosque', 'borde_fuego'
    cantidad INT NOT NULL DEFAULT 1,
    adquirido_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('America/Mexico_City', now()),
    UNIQUE(user_id, item_id)
);

-- 3. TABLA: PROGRESO DEL GÓLEM DEL LASTRE
CREATE TABLE IF NOT EXISTS public.golem_progreso (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    golpes_utilizados INT NOT NULL DEFAULT 0,
    golem_vencido BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_victoria TIMESTAMP WITH TIME ZONE
);

-- 4. PROCEDIMIENTOS ALMACENADOS (RPC) PARA TRANSACCIONES ATÓMICAS

-- 4.1. COMPLETAR MISIÓN DEL RETO (Atómico, con idempotencia)
CREATE OR REPLACE FUNCTION completar_mision_rpg(
    p_user_id UUID,
    p_origen VARCHAR,
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_actual INT;
    v_xp_actual INT;
    v_racha_actual INT;
    v_ultima_mision TIMESTAMP WITH TIME ZONE;
    v_hoy DATE;
    v_fecha_ultima DATE;
BEGIN
    -- 1. Validar idempotencia (Si ya existe, lanzar error o retornar success mudo)
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se registró esta misión.');
    END IF;

    -- 2. Obtener saldo y XP actual
    SELECT monedas_forja, xp, racha_actual, last_workout_date 
    INTO v_saldo_actual, v_xp_actual, v_racha_actual, v_ultima_mision
    FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
    END IF;

    -- Manejo de nulos
    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_xp_actual := COALESCE(v_xp_actual, 0);
    v_racha_actual := COALESCE(v_racha_actual, 0);

    -- 3. Calcular Llama Viva (Racha) basada en America/Mexico_City
    v_hoy := (timezone('America/Mexico_City', now()))::DATE;
    v_fecha_ultima := (timezone('America/Mexico_City', v_ultima_mision))::DATE;

    IF v_fecha_ultima IS NULL OR v_fecha_ultima = v_hoy - INTERVAL '1 day' THEN
        -- Racha continua
        v_racha_actual := v_racha_actual + 1;
    ELSIF v_fecha_ultima = v_hoy THEN
        -- Ya hizo misión hoy, la racha se mantiene igual
        v_racha_actual := v_racha_actual;
    ELSE
        -- Perdió la racha (Nota: la protección de Ficha de Reposo se manejará en otra lógica o extendiendo esto)
        v_racha_actual := 1; 
    END IF;

    -- 4. Actualizar Perfil (+10 XP, +5 Monedas)
    UPDATE public.perfiles 
    SET 
        xp = v_xp_actual + 10,
        monedas_forja = v_saldo_actual + 5,
        racha_actual = v_racha_actual,
        last_workout_date = timezone('America/Mexico_City', now()),
        updated_at = timezone('America/Mexico_City', now())
    WHERE id = p_user_id;

    -- 5. Registrar Transacción
    INSERT INTO public.rpg_transacciones 
    (user_id, tipo, origen, cantidad_xp, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES 
    (p_user_id, 'MISION', p_origen, 10, 5, v_saldo_actual, v_saldo_actual + 5, p_idempotency_key);

    RETURN jsonb_build_object('success', true, 'xp_ganada', 10, 'monedas_ganadas', 5, 'racha', v_racha_actual);
END;
$$;


-- 4.2. RECLAMAR BONOS DE RETO (Atómico)
CREATE OR REPLACE FUNCTION reclamar_bono_reto(
    p_user_id UUID,
    p_bono_tipo VARCHAR, -- '7_dias', '14_dias', '21_dias', 'perfecto_21'
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_actual INT;
    v_xp_actual INT;
    v_monedas_premio INT := 0;
    v_xp_premio INT := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bono ya reclamado.');
    END IF;

    IF p_bono_tipo = '7_dias' THEN
        v_monedas_premio := 25;
    ELSIF p_bono_tipo = '14_dias' THEN
        v_monedas_premio := 35;
    ELSIF p_bono_tipo = '21_dias' THEN
        v_monedas_premio := 50;
        v_xp_premio := 50;
    ELSIF p_bono_tipo = 'perfecto_21' THEN
        v_monedas_premio := 50;
    END IF;

    SELECT monedas_forja, xp INTO v_saldo_actual, v_xp_actual
    FROM public.perfiles WHERE id = p_user_id FOR UPDATE;

    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    v_xp_actual := COALESCE(v_xp_actual, 0);

    UPDATE public.perfiles 
    SET 
        xp = v_xp_actual + v_xp_premio,
        monedas_forja = v_saldo_actual + v_monedas_premio
    WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones 
    (user_id, tipo, origen, cantidad_xp, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES 
    (p_user_id, 'BONO', p_bono_tipo, v_xp_premio, v_monedas_premio, v_saldo_actual, v_saldo_actual + v_monedas_premio, p_idempotency_key);

    RETURN jsonb_build_object('success', true, 'xp_ganada', v_xp_premio, 'monedas_ganadas', v_monedas_premio);
END;
$$;


-- 4.3. COMPRAR ITEM (Atómico)
CREATE OR REPLACE FUNCTION comprar_item_rpg(
    p_user_id UUID,
    p_item_id VARCHAR,
    p_precio INT,
    p_es_permanente BOOLEAN,
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_saldo_actual INT;
    v_cantidad_actual INT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transacción ya procesada.');
    END IF;

    SELECT monedas_forja INTO v_saldo_actual FROM public.perfiles WHERE id = p_user_id FOR UPDATE;
    v_saldo_actual := COALESCE(v_saldo_actual, 0);

    IF v_saldo_actual < p_precio THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fondos insuficientes.');
    END IF;

    IF p_es_permanente THEN
        -- Verificar si ya lo tiene
        IF EXISTS (SELECT 1 FROM public.rpg_inventario WHERE user_id = p_user_id AND item_id = p_item_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'El ítem ya fue adquirido previamente.');
        END IF;
        INSERT INTO public.rpg_inventario (user_id, item_id, cantidad) VALUES (p_user_id, p_item_id, 1);
    ELSE
        -- Consumible (ej. ficha_reposo, max 2)
        SELECT cantidad INTO v_cantidad_actual FROM public.rpg_inventario WHERE user_id = p_user_id AND item_id = p_item_id;
        v_cantidad_actual := COALESCE(v_cantidad_actual, 0);
        IF p_item_id = 'ficha_reposo' AND v_cantidad_actual >= 2 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Inventario lleno para este ítem (Máx 2).');
        END IF;

        IF v_cantidad_actual = 0 THEN
            INSERT INTO public.rpg_inventario (user_id, item_id, cantidad) VALUES (p_user_id, p_item_id, 1);
        ELSE
            UPDATE public.rpg_inventario SET cantidad = cantidad + 1 WHERE user_id = p_user_id AND item_id = p_item_id;
        END IF;
    END IF;

    UPDATE public.perfiles SET monedas_forja = v_saldo_actual - p_precio WHERE id = p_user_id;

    INSERT INTO public.rpg_transacciones 
    (user_id, tipo, origen, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
    VALUES 
    (p_user_id, 'COMPRA', p_item_id, -p_precio, v_saldo_actual, v_saldo_actual - p_precio, p_idempotency_key);

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 4.4. ATACAR AL GÓLEM (Atómico)
CREATE OR REPLACE FUNCTION atacar_golem(
    p_user_id UUID,
    p_idempotency_key VARCHAR
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_xp_actual INT;
    v_golpes_totales INT;
    v_golpes_utilizados INT;
    v_golem_vencido BOOLEAN;
    v_saldo_actual INT;
    v_golpes_disponibles INT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.rpg_transacciones WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Golpe ya registrado.');
    END IF;

    -- Obtener XP para calcular golpes
    SELECT xp_actual, puntos_forja INTO v_xp_actual, v_saldo_actual FROM public.perfiles WHERE id = p_user_id FOR UPDATE;
    v_xp_actual := COALESCE(v_xp_actual, 0);
    v_saldo_actual := COALESCE(v_saldo_actual, 0);
    
    v_golpes_totales := FLOOR(v_xp_actual / 25);

    -- Obtener progreso del golem
    SELECT golpes_utilizados, golem_vencido 
    INTO v_golpes_utilizados, v_golem_vencido 
    FROM public.golem_progreso WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.golem_progreso (user_id, golpes_utilizados, golem_vencido) 
        VALUES (p_user_id, 0, false);
        v_golpes_utilizados := 0;
        v_golem_vencido := false;
    END IF;

    v_golpes_disponibles := v_golpes_totales - v_golpes_utilizados;

    IF v_golpes_disponibles <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes golpes disponibles. Gana 25 XP para obtener uno.');
    END IF;

    IF v_golem_vencido THEN
        RETURN jsonb_build_object('success', false, 'error', 'El Gólem ya fue vencido.');
    END IF;

    -- Aplicar golpe
    v_golpes_utilizados := v_golpes_utilizados + 1;
    
    -- Si llegó a 10 golpes, muere
    IF v_golpes_utilizados >= 10 THEN
        v_golem_vencido := true;
        
        -- Actualizar Golem
        UPDATE public.golem_progreso 
        SET golpes_utilizados = v_golpes_utilizados, golem_vencido = true, fecha_victoria = now() 
        WHERE user_id = p_user_id;

        -- Dar 100 monedas de recompensa
        UPDATE public.perfiles SET puntos_forja = v_saldo_actual + 100 WHERE id = p_user_id;
        
        INSERT INTO public.rpg_transacciones 
        (user_id, tipo, origen, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
        VALUES 
        (p_user_id, 'GOLEM', 'victoria_golem_lastre', 100, v_saldo_actual, v_saldo_actual + 100, p_idempotency_key);

        RETURN jsonb_build_object('success', true, 'golem_muerto', true, 'recompensa', 100, 'golpes_restantes_vida', 0);
    ELSE
        -- Solo restarle salud
        UPDATE public.golem_progreso SET golpes_utilizados = v_golpes_utilizados WHERE user_id = p_user_id;
        
        -- Registrar el golpe sin monedas
        INSERT INTO public.rpg_transacciones 
        (user_id, tipo, origen, cantidad_monedas, saldo_anterior_monedas, saldo_posterior_monedas, idempotency_key)
        VALUES 
        (p_user_id, 'GOLEM', 'golpe_golem_lastre', 0, v_saldo_actual, v_saldo_actual, p_idempotency_key);

        RETURN jsonb_build_object('success', true, 'golem_muerto', false, 'golpes_restantes_vida', 10 - v_golpes_utilizados);
    END IF;
END;
$$;
