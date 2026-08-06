import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('perfiles').select('email, rol_usuario, created_at').eq('rol_usuario', 'entrenador').order('created_at', { ascending: false });
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

run();
