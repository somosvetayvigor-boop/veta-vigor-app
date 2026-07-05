import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('perfiles').select('username, full_name, plan_membresia').order('created_at', { ascending: false }).limit(10);
  console.log('Perfiles:', data);
  
  const { data: users } = await supabase.auth.admin.listUsers();
  users.users.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  console.log('Auth Users:', users.users.slice(0, 5).map(u => ({ email: u.email, meta: u.user_metadata })));
}
check();
