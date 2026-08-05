-- Ejecuta este script en el SQL Editor de tu panel de Supabase

-- Agregar columnas a rutinas
ALTER TABLE rutinas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE rutinas ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- Agregar columnas a ejercicios_biblioteca
ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente';

-- RLS Políticas para rutinas
DROP POLICY IF EXISTS "Usuarios insertan sus rutinas" ON rutinas;
CREATE POLICY "Usuarios insertan sus rutinas" ON rutinas FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus rutinas" ON rutinas;
CREATE POLICY "Usuarios actualizan sus rutinas" ON rutinas FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus rutinas" ON rutinas;
CREATE POLICY "Usuarios eliminan sus rutinas" ON rutinas FOR DELETE USING (auth.uid() = user_id);

-- Permitir lectura general de rutinas (asegurarnos de que exista)
DROP POLICY IF EXISTS "Permitir lectura de rutinas" ON rutinas;
CREATE POLICY "Permitir lectura de rutinas" ON rutinas FOR SELECT USING (true);

-- RLS Políticas para ejercicios_biblioteca
DROP POLICY IF EXISTS "Usuarios insertan ejercicios personalizados" ON ejercicios_biblioteca;
CREATE POLICY "Usuarios insertan ejercicios personalizados" ON ejercicios_biblioteca FOR INSERT WITH CHECK (is_custom = true AND auth.uid() = created_by);

-- RLS Políticas para rutina_ejercicios
-- Permitir a cualquier usuario autenticado insertar/modificar los ejercicios de su rutina temporalmente
DROP POLICY IF EXISTS "All auth insert rutina_ejercicios" ON rutina_ejercicios;
CREATE POLICY "All auth insert rutina_ejercicios" ON rutina_ejercicios FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "All auth update rutina_ejercicios" ON rutina_ejercicios;
CREATE POLICY "All auth update rutina_ejercicios" ON rutina_ejercicios FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "All auth delete rutina_ejercicios" ON rutina_ejercicios;
CREATE POLICY "All auth delete rutina_ejercicios" ON rutina_ejercicios FOR DELETE USING (auth.role() = 'authenticated');
