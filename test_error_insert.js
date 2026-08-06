import { createClient } from '@supabase/supabase-js';

const url = 'https://rhxseahupujjqhcrthpf.supabase.co';
const key = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('frontend_errors')
    .insert([{
      error_message: 'TEST_ERROR_PLEASE_IGNORE',
      component_stack: 'Test Stack',
      user_agent: 'Node.js Test'
    }])
    .select();
    
  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert success:", data);
    // clean it up
    if (data && data[0]) {
       await supabase.from('frontend_errors').delete().eq('id', data[0].id);
       console.log("Cleaned up test error.");
    }
  }
}
run();
