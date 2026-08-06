const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const wb = xlsx.readFile('Retos_21_Dias_VETAyVIGOR_Descritos.xlsx');
  console.log("Hojas encontradas:", wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    console.log(`\nProcesando reto: ${sheetName}...`);
    
    // Asignar nivel
    let nivelRequerido = '';
    if (sheetName.includes('Cero')) nivelRequerido = 'Semilla';
    if (sheetName.includes('Principiante')) nivelRequerido = 'Pino,Tzalam';
    
    // 1. Crear el reto
    const { data: reto, error: retoError } = await supabase
      .from('retos')
      .insert([{
        nombre: `Reto 21 Días: ${sheetName}`,
        descripcion: `Completa este reto de 21 días para nivel ${nivelRequerido}.`,
        nivel_requerido: nivelRequerido
      }])
      .select()
      .single();
      
    if (retoError) {
      console.error(`Error creando reto ${sheetName}:`, retoError);
      continue;
    }
    
    console.log(`✅ Reto creado: ${reto.nombre} (ID: ${reto.id})`);
    
    // 2. Leer días
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    const diasInsert = data.map(row => ({
      reto_id: reto.id,
      dia_numero: row['Día'],
      semana: row['Sem'],
      enfoque: row['Enfoque'],
      trabajo_descanso: row['Trabajo / Descanso'] || 'N/A',
      rutina_json: row['Ejercicios y Ejecución (Circuito 4 Rondas)'] || row['Ejercicios y Ejecución'] || 'Descanso'
    }));
    
    // 3. Insertar días
    const { error: diasError } = await supabase
      .from('reto_dias')
      .insert(diasInsert);
      
    if (diasError) {
      console.error(`Error insertando días para ${sheetName}:`, diasError);
    } else {
      console.log(`✅ ${diasInsert.length} días insertados para ${sheetName}`);
    }
  }
  console.log("\n¡Importación completada!");
}

run().catch(console.error);
