import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: 'C:/Users/grd_a/.gemini/antigravity/scratch/Veta_Vigor_App/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    DROP POLICY IF EXISTS "Admin update ejercicios" ON ejercicios_biblioteca;
    DROP POLICY IF EXISTS "Admin update sistemas" ON sistemas_entrenamiento;
    DROP POLICY IF EXISTS "Admin all ejercicios" ON ejercicios_biblioteca;
    DROP POLICY IF EXISTS "Admin all sistemas" ON sistemas_entrenamiento;

    CREATE POLICY "Admin all ejercicios" ON ejercicios_biblioteca FOR ALL USING (auth.email() = 'somos.vetayvigor@gmail.com');
    CREATE POLICY "Admin all sistemas" ON sistemas_entrenamiento FOR ALL USING (auth.email() = 'somos.vetayvigor@gmail.com');
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('RPC result:', data, 'Error:', error);
}

run();
