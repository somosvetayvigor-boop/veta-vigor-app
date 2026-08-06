import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('reto_dias').select('dia_numero, enfoque, rutina_json').eq('dia_numero', 2).limit(2);
  if (error) console.error(error);
  // Log raw string to see exact characters
  if (data && data.length > 0) {
     console.log("Raw text for Day 2:");
     console.log(JSON.stringify(data[0].rutina_json));
  }
}

run();
