import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true,
    fileSizeLimit: 1048576 * 5, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  });
  
  if (error) {
    console.error("Error creating bucket:", error);
  } else {
    console.log("Bucket created:", data);
  }
}
setupStorage();
