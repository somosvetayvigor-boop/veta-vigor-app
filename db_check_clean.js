import { createClient } from '@supabase/supabase-js';

const url = 'https://rhxseahupujjqhcrthpf.supabase.co';
const key = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('perfiles').select('id, email, plan_membresia, reto_activo_id, reto_completado, chat_bloqueado').ilike('email', '%strolabio%');
  console.log("DB DATA:", JSON.stringify(data, null, 2));
  console.log("ERROR:", error);
}
run();
