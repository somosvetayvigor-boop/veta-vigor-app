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

async function migrate() {
    console.log("🚀 Iniciando el Script Mágico de Migración...");
    
    // 1. Sistemas
    const sistemasData = await parseCSV('./csv_data/Sistemas V&V.csv');
    const sistemaMap = {}; // name -> id
    
    for (const row of sistemasData) {
        const nombre = row['Name']?.trim();
        if (!nombre) continue;
        
        const { data, error } = await supabase.from('sistemas_entrenamiento').insert({
            nombre: nombre,
            descripcion: row['Descripción'],
            imagen_url: row['Imagen']
        }).select();
        
        if (error) {
            console.error("Error insertando sistema:", error);
            continue;
        }
        sistemaMap[nombre] = data[0].id;
    }
    console.log(`✅ Sistemas insertados: ${Object.keys(sistemaMap).length}`);

    // 2. Biblioteca
    const bibliotecaData = await parseCSV('./csv_data/Biblioteca (2).csv');
    const ejercicioMap = {}; // name -> id
    
    for (const row of bibliotecaData) {
        const nombre = row['Ejercicios']?.trim();
        if (!nombre) continue;
        
        let ejId = row['Ejercicio ID']?.trim();
        if (!ejId) ejId = nombre.substring(0, 50).replace(/[^a-zA-Z0-9]/g, ''); // fallback id
        
        ejercicioMap[nombre.toLowerCase()] = ejId;

        const { error } = await supabase.from('ejercicios_biblioteca').upsert({
            id: ejId,
            nombre: nombre,
            equipo_necesario: row['Equipo'],
            instrucciones: row['Instrucciones'],
            consejos_pro: row['Consejo Pro'],
            musculos_trabajados: row['Musculos'],
            imagen_url: row['imagenPortadaEjercicio']
        });
        if (error) console.error("Error insertando ejercicio:", error);
    }
    console.log(`✅ Ejercicios insertados en la biblioteca: ${Object.keys(ejercicioMap).length}`);

    // 3. Rutinas
    const rutinasData = await parseCSV('./csv_data/Rutinas de Sistemas (1).csv');
    let rutinasCount = 0;
    let puenteCount = 0;
    
    for (const row of rutinasData) {
        const nombreRutina = row['Nombre de la Rutina']?.trim();
        if (!nombreRutina) continue;
        
        const nombreSistema = row['Ejercicios sistemas']?.trim();
        const sistema_id = sistemaMap[nombreSistema] || null;
        
        const { data, error } = await supabase.from('rutinas').insert({
            sistema_id: sistema_id,
            nombre: nombreRutina,
            enfoque: row['Enfoque'],
            nivel: row['Nivel'],
            imagen_url: row['TodosEjercicioRtuina']
        }).select();
        
        if (error) {
            console.error("Error insertando rutina:", error);
            continue;
        }
        
        const rutina_id = data[0].id;
        rutinasCount++;

        // 4. Puente: Rutina <-> Ejercicios
        for (let i = 1; i <= 6; i++) {
            const ejNombre = row[`Ejercicio ${i}`]?.trim() || row[`Ejercico ${i}`]?.trim();
            if (!ejNombre || ejNombre === 'N/A' || ejNombre === '') continue;
            
            let repeticiones = row[`Repeticiones ${i}`]?.trim() || row[`Repeticiones ${i}.0`]?.trim();
            const ejId = ejercicioMap[ejNombre.toLowerCase()];
            
            if (!ejId) {
                // Generar ID temporal si no existe en la biblioteca
                const tempId = ejNombre.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
                
                // Insertarlo rápido en la biblioteca para que no falle la llave foránea
                await supabase.from('ejercicios_biblioteca').upsert({
                    id: tempId,
                    nombre: ejNombre
                });
                ejercicioMap[ejNombre.toLowerCase()] = tempId;
                
                const { error: pErr } = await supabase.from('rutina_ejercicios').insert({
                    rutina_id: rutina_id,
                    ejercicio_id: tempId,
                    orden_ejercicio: i,
                    repeticiones_objetivo: repeticiones
                });
                if (!pErr) puenteCount++;
            } else {
                const { error: pErr } = await supabase.from('rutina_ejercicios').insert({
                    rutina_id: rutina_id,
                    ejercicio_id: ejId,
                    orden_ejercicio: i,
                    repeticiones_objetivo: repeticiones
                });
                if (!pErr) puenteCount++;
            }
        }
    }
    
    console.log(`✅ Rutinas completadas: ${rutinasCount}`);
    console.log(`✅ Conexiones creadas (Puentes): ${puenteCount}`);
    console.log("🎉 ¡MIGRACIÓN EXITOSA A LA NUEVA ARQUITECTURA!");
}

migrate();
