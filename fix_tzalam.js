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

async function fixTzalam() {
    console.log("🛠️ Reparando puentes de Tzalam (con insert puro)...");

    // 1. Obtener todas las rutinas de Tzalam
    const { data: rutinasData, error } = await supabase.from('rutinas').select('id, nombre').eq('nivel', 'Tzalam');
    if (error) {
        console.error("Error obteniendo rutinas:", error);
        return;
    }

    const rutinasMap = {};
    for (const r of rutinasData) {
        rutinasMap[r.nombre] = r.id; // Map name to ID
    }

    const data = await parseCSV('final_csv_output.csv');
    let puenteCount = 0;

    for (const row of data) {
        const nombreRutina = row['Nombre de la Rutina']?.trim();
        if (!nombreRutina) continue;

        const rutina_id = rutinasMap[nombreRutina];
        if (!rutina_id) {
            console.log(`⚠️ Rutina no encontrada en DB: ${nombreRutina}`);
            continue;
        }

        // Process Exercises 1 to 6
        for (let i = 1; i <= 6; i++) {
            const ejName = row[`Ejercicio ${i}`]?.trim();
            if (!ejName) continue;

            // Same ID generation as import_tzalam.js
            const ejId = ejName.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');

            let repsKey = `Repeticiones ${i}.0`;
            if (!row[repsKey]) repsKey = `Repeticiones ${i}`;

            const { error: puenteError } = await supabase.from('rutina_ejercicios').insert({
                rutina_id: rutina_id,
                ejercicio_id: ejId,
                orden_ejercicio: i,
                repeticiones_objetivo: row[repsKey]
            }); 

            if (puenteError && !puenteError.message.includes('duplicate key')) {
                console.error(`Error linking exercise ${ejName} to routine:`, puenteError.message);
            } else if (!puenteError) {
                puenteCount++;
            }
        }
    }

    console.log(`✅ Reparación finalizada!`);
    console.log(`- Vínculos rutina-ejercicio creados/actualizados: ${puenteCount}`);
}

fixTzalam();
