const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const code = fs.readFileSync('src/supabaseClient.js', 'utf8');
const urlMatch = code.match(/supabaseUrl\s*=\s*['"`]([^'"`]+)['"`]/);
const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"`]([^'"`]+)['"`]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('perfiles').select('plan_membresia, reto_activo_id, reto_completado').eq('email', 'strolabiobooks@gmail.com').single();
  console.log("DB DATA:", JSON.stringify(data, null, 2));
}
run();
