import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

const csvFiles = [
  'Biblioteca (2).csv',
  'Biblioteca_gym.csv',
  'Biblioteca_COMPLETA.csv'
];

async function updateBiblioteca() {
  console.log("Iniciando actualización de biblioteca...");
  let updatedCount = 0;
  let notFoundCount = 0;

  for (const file of csvFiles) {
    const filePath = path.join(process.cwd(), 'csv_data', file);
    if (!fs.existsSync(filePath)) continue;
    
    console.log(`Leyendo archivo: ${file}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    for (const row of records) {
      // Diferentes CSVs pueden tener diferentes nombres de columnas
      const nombre = row['Ejercicios'] || row['Ejercicio'] || row['Nombre'];
      if (!nombre) continue;

      const equipo = row['Equipo'] || row['Equipo Necesario'] || null;
      const instrucciones = row['Instrucciones'] || row['¿Cómo hacerlo?'] || null;
      const consejo = row['Consejo Pro'] || row['Consejos Pro'] || null;
      const musculos = row['Musculos'] || row['Músculos'] || row['¿Qué estoy ejercitando?'] || null;

      // Si no tiene al menos instrucciones o músculos, saltar
      if (!instrucciones && !musculos && !equipo && !consejo) continue;

      // Buscar si el ejercicio existe en Supabase (insensible a mayúsculas si es posible)
      const { data: dbEjercicios, error: searchError } = await supabase
        .from('ejercicios_biblioteca')
        .select('id, nombre')
        .ilike('nombre', nombre)
        .limit(1);

      if (searchError) {
        console.error(`Error buscando ${nombre}:`, searchError.message);
        continue;
      }

      if (dbEjercicios && dbEjercicios.length > 0) {
        const ejId = dbEjercicios[0].id;

        // Actualizar datos
        const updateData = {};
        if (equipo) updateData.equipo_necesario = equipo;
        if (instrucciones) updateData.instrucciones = instrucciones;
        if (consejo) updateData.consejos_pro = consejo;
        if (musculos) updateData.musculos_trabajados = musculos;

        const { error: updateError } = await supabase
          .from('ejercicios_biblioteca')
          .update(updateData)
          .eq('id', ejId);

        if (updateError) {
          console.error(`Error actualizando ${nombre}:`, updateError.message);
        } else {
          updatedCount++;
        }
      } else {
        notFoundCount++;
      }
    }
  }

  console.log(`¡Proceso completado!`);
  console.log(`Ejercicios actualizados correctamente: ${updatedCount}`);
  console.log(`Ejercicios en CSV no encontrados en BD: ${notFoundCount}`);
}

updateBiblioteca().catch(console.error);
