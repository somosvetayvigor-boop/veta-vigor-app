import { createClient } from '@supabase/supabase-js';

const url = 'https://rhxseahupujjqhcrthpf.supabase.co';
const key = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('perfiles')
    .update({ avatar_url: null })
    .like('avatar_url', 'blob:%')
    .select('email, avatar_url');
    
  console.log("Fixed:", data);
}
run();
