import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local to get Supabase credentials
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
  console.log("🛠️ Intentando insertar un error de prueba...");
  
  const { data, error } = await supabase
    .from('frontend_errors')
    .insert([{
      error_message: "Error de prueba para verificar RLS",
      component_stack: "ComponenteTest",
      user_agent: "Node.js"
    }])
    .select();

  if (error) {
    console.error("❌ Falló la inserción. Es casi seguro un problema de RLS.");
    console.error(error);
    console.log("\n⚠️ POR FAVOR EJECUTA ESTE CÓDIGO SQL EN EL SQL EDITOR DE SUPABASE:");
    console.log(`
-- Desactivar temporalmente RLS (o añadir política)
ALTER TABLE public.frontend_errors DISABLE ROW LEVEL SECURITY;

-- Alternativamente, si prefieres mantener RLS, crea esta política:
-- CREATE POLICY "Permitir insertar a todos" ON public.frontend_errors FOR INSERT TO public WITH CHECK (true);
    `);
  } else {
    console.log("✅ Inserción exitosa! El RLS ya permite insertar.");
    console.log(data);
  }
}

fixRLS();
