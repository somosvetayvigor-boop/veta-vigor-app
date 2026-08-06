import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Get the current user's profile
    // Since we don't know the exact ID, we will find the profile with the old reto_id
    // "Reto 21 Días: Nivel 2 - Principiante" -> 87ae1984-b508-402c-bbfe-75f2315134c9
    // or just reset everyone who has that old reto.
    const { data, error } = await supabase
      .from('perfiles')
      .update({ reto_activo_id: null, reto_dia_actual: 1 })
      .eq('reto_activo_id', '87ae1984-b508-402c-bbfe-75f2315134c9');

    if (error) throw error;
    console.log("Profiles reset. You can now choose a new challenge.");

  } catch(e) {
    console.error(e);
  }
}

run();
