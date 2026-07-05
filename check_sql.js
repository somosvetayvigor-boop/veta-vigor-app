import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSQL() {
  const { data, error } = await supabase.rpc('run_sql', { query: "SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'on_auth_user_created'" });
  if (error) console.log(error);
  else console.log(data);
}
checkSQL();
