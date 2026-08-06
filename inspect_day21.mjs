import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('reto_dias').select('dia_numero, enfoque, rutina_json').eq('dia_numero', 21).limit(2);
  console.log(JSON.stringify(data, null, 2));
}

run();
