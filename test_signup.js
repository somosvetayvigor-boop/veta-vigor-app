import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTrigger() {
  const email = `test_trigger_${Date.now()}@test.com`;
  console.log('Creating user:', email);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
    user_metadata: { nombre: 'Test Aurum', nivel: 'Semilla' }
  });
  if (error) { console.log('Auth Error:', error); return; }
  
  // wait 3 seconds for trigger
  await new Promise(r => setTimeout(r, 3000));
  
  const { data: profile, error: profErr } = await supabase.from('perfiles').select('*').eq('id', data.user.id).single();
  console.log('Inserted profile:', profile);
  console.log('Profile Error:', profErr);
  
  await supabase.auth.admin.deleteUser(data.user.id);
}
testTrigger();
