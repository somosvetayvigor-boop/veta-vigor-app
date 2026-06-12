import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc'; // Use service role to list users
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
  } else {
    data.users.forEach(u => {
      console.log("Email:", u.email);
      console.log("Metadata:", u.user_metadata);
    });
  }
}
checkUser();
