import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSQL() {
  const query = `
    DROP POLICY IF EXISTS "Admin update ejercicios" ON ejercicios_biblioteca;
    DROP POLICY IF EXISTS "Admin update sistemas" ON sistemas_entrenamiento;
    DROP POLICY IF EXISTS "Admin all ejercicios" ON ejercicios_biblioteca;
    DROP POLICY IF EXISTS "Admin all sistemas" ON sistemas_entrenamiento;

    CREATE POLICY "Admin all ejercicios" ON ejercicios_biblioteca FOR ALL USING (auth.email() = 'somos.vetayvigor@gmail.com');
    CREATE POLICY "Admin all sistemas" ON sistemas_entrenamiento FOR ALL USING (auth.email() = 'somos.vetayvigor@gmail.com');
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  if (error) console.log('Error:', error);
  else console.log('Success:', data);
}
checkSQL();
