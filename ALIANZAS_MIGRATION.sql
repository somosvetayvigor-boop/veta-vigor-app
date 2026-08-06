-- ==============================================================================
-- VETA & VIGOR - SISTEMA DE ALIANZAS (DÚOS)
-- ==============================================================================

-- 1. Crear la tabla principal de alianzas
CREATE TABLE IF NOT EXISTS public.alianzas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (sender_id, receiver_id)
);

-- 2. Trigger para actualizar el updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alianzas_modtime ON public.alianzas;
CREATE TRIGGER update_alianzas_modtime
BEFORE UPDATE ON public.alianzas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.alianzas ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Policies)
-- Un usuario puede VER las alianzas donde sea el sender o el receiver
CREATE POLICY "Users can view their own alliances"
ON public.alianzas FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Un usuario puede CREAR una alianza (enviar solicitud) solo si él es el sender
CREATE POLICY "Users can create alliances"
ON public.alianzas FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Un usuario puede ACTUALIZAR una alianza (aceptar/rechazar) solo si él es el receiver (o si es sender para cancelar)
CREATE POLICY "Users can update their alliances"
ON public.alianzas FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Un usuario puede ELIMINAR una alianza en la que participa
CREATE POLICY "Users can delete their alliances"
ON public.alianzas FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
