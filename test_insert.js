import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from('perfiles').insert([
    { id: '00000000-0000-0000-0000-000000000000', username: 'testuser', avatar_url: 'test', display_preference: 'username' }
  ]);
  
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success:", data);
  }
}
testInsert();
