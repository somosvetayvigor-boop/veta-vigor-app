import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateName() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    '528d423e-0a12-451e-a1a1-f98af1ad42cd',
    { user_metadata: { nombre: 'Gerardo', nivel: 'Semilla' } }
  );
  if (error) {
    console.error("Error updating user:", error);
  } else {
    console.log("Updated user successfully:", data.user.user_metadata);
  }
}
updateName();
