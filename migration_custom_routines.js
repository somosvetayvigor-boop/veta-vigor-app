import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const query = `
    -- Agregar columnas a rutinas
    ALTER TABLE rutinas ADD COLUMN IF NOT EXISTS user_id UUID;
    ALTER TABLE rutinas ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

    -- Agregar columnas a ejercicios_biblioteca
    ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
    ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS created_by UUID;
    ALTER TABLE ejercicios_biblioteca ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente';

    -- RLS Políticas para rutinas
    DROP POLICY IF EXISTS "Usuarios insertan sus rutinas" ON rutinas;
    CREATE POLICY "Usuarios insertan sus rutinas" ON rutinas FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Usuarios actualizan sus rutinas" ON rutinas;
    CREATE POLICY "Usuarios actualizan sus rutinas" ON rutinas FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Usuarios eliminan sus rutinas" ON rutinas;
    CREATE POLICY "Usuarios eliminan sus rutinas" ON rutinas FOR DELETE USING (auth.uid() = user_id);

    -- RLS Políticas para ejercicios_biblioteca
    DROP POLICY IF EXISTS "Usuarios insertan ejercicios personalizados" ON ejercicios_biblioteca;
    CREATE POLICY "Usuarios insertan ejercicios personalizados" ON ejercicios_biblioteca FOR INSERT WITH CHECK (is_custom = true AND auth.uid() = created_by);

    -- RLS Políticas para rutina_ejercicios (Permitir a todos los autenticados insertar/modificar por ahora para no bloquear, asumiendo RLS en la app)
    DROP POLICY IF EXISTS "All authenticated insert rutina_ejercicios" ON rutina_ejercicios;
    CREATE POLICY "All authenticated insert rutina_ejercicios" ON rutina_ejercicios FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "All authenticated update rutina_ejercicios" ON rutina_ejercicios;
    CREATE POLICY "All authenticated update rutina_ejercicios" ON rutina_ejercicios FOR UPDATE USING (auth.role() = 'authenticated');
    
    DROP POLICY IF EXISTS "All authenticated delete rutina_ejercicios" ON rutina_ejercicios;
    CREATE POLICY "All authenticated delete rutina_ejercicios" ON rutina_ejercicios FOR DELETE USING (auth.role() = 'authenticated');
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  if (error) {
    console.error('Error in migration:', error);
  } else {
    console.log('Migration successful:', data);
  }
}

runMigration();
