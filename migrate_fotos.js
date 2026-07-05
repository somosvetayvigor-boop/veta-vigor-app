import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching users...");
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error("Error fetching users:", userError);
    return;
  }

  for (const u of users.users) {
    const meta = u.user_metadata || {};
    const updateData = {};
    if (meta.foto_antes) updateData.foto_antes = meta.foto_antes;
    if (meta.foto_despues) updateData.foto_despues = meta.foto_despues;
    
    if (Object.keys(updateData).length > 0) {
      console.log(`Updating perfiles for ${u.id} with photos...`);
      const { error: updateError } = await supabase.from('perfiles').update(updateData).eq('id', u.id);
      if (updateError) {
         console.error("Failed to update perfiles:", updateError.message);
      } else {
         console.log(`Success for ${u.id}`);
      }
    }
  }
  console.log("Done");
}

run();
