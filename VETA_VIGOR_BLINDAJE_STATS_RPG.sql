-- =====================================================================
-- VETA & VIGOR — Blindar puntos_totales, nivel_rpg y stats contra escritura directa
-- =====================================================================
--
-- CONTEXTO
-- proteger_columnas_perfiles() (trigger BEFORE UPDATE en perfiles) ya
-- descarta en silencio los intentos del cliente de escribir directo
-- xp_actual/puntos_forja/racha_actual. puntos_totales, nivel_rpg,
-- stat_fuerza, stat_agilidad y stat_resistencia se quedaron fuera de esa
-- lista -- cualquier usuario autenticado podia (via API directa, no desde
-- la app) inflar sus propias estadisticas de vanidad.
--
-- SEVERIDAD REAL (verificado en vivo, 16/08): baja. get_leaderboard()
-- ordena solo por total_workouts (contado real de historial_entrenamientos,
-- no manipulable) -- estos campos no afectan ningun ranking, dinero, ni a
-- otros usuarios. Es presuncion falsa, no una ventaja competitiva ni
-- economica.
--
-- VERIFICADO ANTES DE ESCRIBIR ESTO: SyncService.js:293 (push generico del
-- perfil) NUNCA envia estos 5 campos a Supabase -- solo nivel y
-- sistema_activo. Las escrituras que existen en RutinaDetail.jsx y
-- MiRutina.jsx son puramente locales (SQLite, para reflejar el numero en
-- pantalla al instante) y nunca llegan al servidor. No hay ningun camino
-- legitimo que este trigger vaya a romper.
--
-- NO se agrega retos_completados_count a esta lista aposta: ese si lo
-- escribe el cliente de verdad, directo a Supabase, desde
-- RutinaRetoPlayer.jsx al terminar los 21 dias del reto -- protegerlo
-- rompería esa funcionalidad real.
--
-- =====================================================================

CREATE OR REPLACE FUNCTION public.proteger_columnas_perfiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Las RPCs del bloque 3 en adelante corren como postgres: pasan de largo.
    -- Solo se filtra lo que llega directamente del cliente.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Monetización y autoridad
    NEW.plan_membresia         := OLD.plan_membresia;
    NEW.rol_usuario            := OLD.rol_usuario;
    NEW.force_paywall          := OLD.force_paywall;
    NEW.force_platinum_trial   := OLD.force_platinum_trial;
    NEW.platinum_trial_ends_at := OLD.platinum_trial_ends_at;

    -- Dinero real de tus entrenadores
    NEW.ganancias              := OLD.ganancias;
    NEW.comision_personalizada := OLD.comision_personalizada;
    NEW.codigo_referido        := OLD.codigo_referido;
    NEW.referidos_count        := OLD.referidos_count;

    -- Moderación
    NEW.chat_bloqueado         := OLD.chat_bloqueado;

    -- Economía RPG: ya eran autoritativas del servidor vía completar_mision_rpg,
    -- pero sin esto el cliente podía escribir el saldo directamente y saltarse
    -- el RPC por el costado.
    NEW.xp_actual              := OLD.xp_actual;
    NEW.puntos_forja           := OLD.puntos_forja;
    NEW.racha_actual           := OLD.racha_actual;

    -- Estadísticas de vanidad (16/08): nivel RPG y stats. Ya no las escribe
    -- el cliente de verdad (ver contexto arriba) -- esto solo cierra la
    -- puerta a que alguien las falsee por API directa.
    NEW.puntos_totales         := OLD.puntos_totales;
    NEW.nivel_rpg              := OLD.nivel_rpg;
    NEW.stat_fuerza            := OLD.stat_fuerza;
    NEW.stat_agilidad          := OLD.stat_agilidad;
    NEW.stat_resistencia       := OLD.stat_resistencia;

    -- Inmutables
    NEW.id                     := OLD.id;
    NEW.email                  := OLD.email;
    NEW.created_at             := OLD.created_at;

    RETURN NEW;
END;
$$;

-- El trigger ya existe (trg_proteger_columnas_perfiles, BEFORE UPDATE) y
-- apunta a esta funcion -- CREATE OR REPLACE alcanza, no hace falta tocarlo.


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- select pg_get_functiondef(oid) from pg_proc where proname = 'proteger_columnas_perfiles';
-- Debe incluir las 5 lineas nuevas (puntos_totales, nivel_rpg, stat_fuerza,
-- stat_agilidad, stat_resistencia).
