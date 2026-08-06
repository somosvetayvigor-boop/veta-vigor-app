import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Iniciando inyeccion de Descanso Activo...');
  
  const { data: sis } = await supabase.from('sistemas_entrenamiento').select('id').limit(1).single();
  
  const { data: nuevaRutina, error: errorRutina } = await supabase.from('rutinas').insert([{
    sistema_id: sis.id,
    nombre: 'Descanso Activo (Caminar 30m o Bici 20m)'
  }]).select().single();

  if (errorRutina) {
    console.error('Error creando rutina:', errorRutina);
    return;
  }
  
  console.log(`✅ Rutina Descanso Activo creada con ID: ${nuevaRutina.id}`);

  const { data: retos } = await supabase.from('retos').select('id, nombre');
  console.log(`\nModificando los dias 4, 8, 12, 16, 20 para ${retos.length} retos...`);
  
  for (const reto of retos) {
    const { error: updateError } = await supabase.from('reto_dias')
      .update({ rutina_id: nuevaRutina.id })
      .eq('reto_id', reto.id)
      .in('dia_numero', [4, 8, 12, 16, 20]);
      
    if (updateError) {
      console.error(`Error actualizando ${reto.nombre}:`, updateError);
    } else {
      console.log(`✅ ${reto.nombre} actualizado correctamente.`);
    }
  }
  
  console.log('\n🚀 Inyección de Descanso Activo completada con éxito.');
}

run();
