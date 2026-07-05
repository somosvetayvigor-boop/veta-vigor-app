import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function importTzalam() {
    console.log("🚀 Iniciando importación de Tzalam faltante...");

    // Fetch existing systems to map names to IDs
    const { data: sistemasData } = await supabase.from('sistemas_entrenamiento').select('id, nombre');
    const sistemaMap = {};
    for (const sys of sistemasData) {
        sistemaMap[sys.nombre] = sys.id;
    }
    // Hardcode known mapping if slightly different
    sistemaMap['Carga de Hierro'] = sistemaMap['Carga de Hierro (Pesas)'];
    sistemaMap['Método Híbrido V&V'] = sistemaMap['Método Híbrido (Calistenia + Pesas)'];

    const data = await parseCSV('final_csv_output.csv');
    let rutinasCount = 0;
    let puenteCount = 0;
    let ejCount = 0;

    for (const row of data) {
        const nombreRutina = row['Nombre de la Rutina']?.trim();
        if (!nombreRutina) continue;

        let sistema_nombre = row['Ejercicios sistemas']?.trim();
        let sistema_id = sistemaMap[sistema_nombre];

        console.log(`Procesando rutina: ${nombreRutina} para sistema: ${sistema_nombre}`);

        // Insert Routine
        const { data: rutinaData, error: rutinaError } = await supabase.from('rutinas').insert({
            sistema_id: sistema_id || null,
            nombre: nombreRutina,
            enfoque: row['Enfoque'] || row['AreaDeTrabajo'],
            nivel: row['Nivel']
        }).select();

        if (rutinaError) {
            console.error("Error insertando rutina:", rutinaError.message);
            continue;
        }

        const rutina_id = rutinaData[0].id;
        rutinasCount++;

        // Process Exercises 1 to 6
        for (let i = 1; i <= 6; i++) {
            const ejName = row[`Ejercicio ${i}`]?.trim();
            if (!ejName) continue;

            // Generate an ID for the exercise (remove non-alphanumeric, max 50 chars)
            const ejId = ejName.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');

            // Upsert the exercise into the library
            let equipoKey = `Detalle equipo ${i}`;
            if (!row[equipoKey] && i === 3) equipoKey = `Detalle equipo 3 `;
            if (!row[equipoKey] && i === 4) equipoKey = `detalle equipo 4 `;

            let instruccionKey = `instrucciones ${i}`;
            if (!row[instruccionKey] && i === 2) instruccionKey = `instruciones 2`;

            const { error: ejError } = await supabase.from('ejercicios_biblioteca').upsert({
                id: ejId,
                nombre: ejName,
                equipo_necesario: row[equipoKey],
                instrucciones: row[instruccionKey],
                consejos_pro: row[`Consejo Pro ${i}`],
                musculos_trabajados: row[`Músculos ${i}`]
            });

            if (ejError) {
                console.error(`Error upserting exercise ${ejName}:`, ejError.message);
            } else {
                ejCount++;
            }

            // Insert bridging record
            let repsKey = `Repeticiones ${i}.0`;
            if (!row[repsKey]) repsKey = `Repeticiones ${i}`;

            const { error: puenteError } = await supabase.from('rutina_ejercicio').insert({
                rutina_id: rutina_id,
                ejercicio_id: ejId,
                orden: i,
                repeticiones: row[repsKey]
            });

            if (puenteError) {
                console.error(`Error linking exercise ${ejName} to routine:`, puenteError.message);
            } else {
                puenteCount++;
            }
        }
    }

    console.log(`✅ Importación finalizada!`);
    console.log(`- Rutinas creadas: ${rutinasCount}`);
    console.log(`- Ejercicios creados/actualizados: ${ejCount}`);
    console.log(`- Vínculos rutina-ejercicio: ${puenteCount}`);
}

importTzalam();
