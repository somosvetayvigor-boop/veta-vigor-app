import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: retos } = await supabase.from('retos').select('*');
  console.log('Retos:', retos);
  
  const { data: sis } = await supabase.from('sistemas_entrenamiento').select('*');
  console.log('\nSistemas:', sis.map(s => ({id: s.id, nombre: s.nombre})));
}

run();
