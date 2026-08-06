import { createClient } from '@supabase/supabase-js';

const url = 'https://rhxseahupujjqhcrthpf.supabase.co';
const key = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('email, avatar_url')
    .neq('avatar_url', null)
    .limit(10);
    
  console.log(data);
}
run();
