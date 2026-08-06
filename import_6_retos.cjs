const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const wb = xlsx.readFile('Retos_6_Rutas_VETAyVIGOR.xlsx');
  console.log("Hojas encontradas:", wb.SheetNames);

  // Opcional: Eliminar retos anteriores para no tener duplicados (Cuidado si ya hay perfiles)
  // await supabase.from('retos').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
  // Nota: No los borraré por ahora, solo insertaré los nuevos.
  
  for (const sheetName of wb.SheetNames) {
    console.log(`\nProcesando reto: ${sheetName}...`);
    
    // Determinar nivel requerido
    let nivelRequerido = '';
    if (sheetName.includes('Nivel 0')) nivelRequerido = 'Semilla';
    if (sheetName.includes('Nivel 1')) nivelRequerido = 'Pino,Tzalam';
    
    // Determinar sistema
    let sistemaMatch = '';
    if (sheetName.includes('Calistenia')) sistemaMatch = 'Vigor';
    if (sheetName.includes('Gym')) sistemaMatch = 'Hierro';
    if (sheetName.includes('Híbrido')) sistemaMatch = 'Híbrido';
    
    // 1. Crear el reto
    const { data: reto, error: retoError } = await supabase
      .from('retos')
      .insert([{
        nombre: `Reto 21 Días: ${sheetName}`,
        descripcion: `Reto de 21 días para nivel ${nivelRequerido} en la ruta ${sistemaMatch}.`,
        nivel_requerido: `${nivelRequerido}|${sistemaMatch}` // Unimos ambos para buscar fácil luego
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
      trabajo_descanso: row['Trabajo/Descanso'] || row['Trabajo / Descanso'] || 'N/A',
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
  console.log("\n¡Importación de 6 rutas completada!");
}

run().catch(console.error);
