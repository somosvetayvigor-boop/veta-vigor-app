-- Tabla de logs y control de idempotencia para notificaciones push del Reto Vigor 21
CREATE TABLE IF NOT EXISTS public.push_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_mensaje TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Restricción ÚNICA para garantizar IDEMPOTENCIA
    -- Un usuario solo puede recibir un tipo de mensaje una vez.
    -- Para misiones diarias, el tipo_mensaje será algo como 'mision_pendiente_2026_08_10'
    CONSTRAINT push_logs_user_tipo_unique UNIQUE (user_id, tipo_mensaje)
);

-- Políticas de seguridad (RLS)
ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

-- Solo los administradores o el backend (via Service Role) pueden insertar/leer masivamente
CREATE POLICY "Admin All Access" ON public.push_logs
    FOR ALL
    TO authenticated
    USING ( (SELECT email FROM auth.users WHERE id = auth.uid()) = 'somos.vetayvigor@gmail.com' )
    WITH CHECK ( (SELECT email FROM auth.users WHERE id = auth.uid()) = 'somos.vetayvigor@gmail.com' );

-- Los usuarios pueden leer sus propios logs si es necesario
CREATE POLICY "Users can read own logs" ON public.push_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
