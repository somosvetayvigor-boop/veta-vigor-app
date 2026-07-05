import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
// Llave maestra para usar Admin API
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

async function migrateUsers() {
    console.log("🚀 Iniciando Migración de Atletas...");
    
    const usersData = await parseCSV('./Users (1).csv');
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of usersData) {
        let email = row['Email']?.trim();
        const nombre = row['Name']?.trim() || row['Usuario']?.trim() || 'Atleta V&V';
        const foto = row['Foto Perfil']?.trim();
        const nivel = row['Nivel Alcanzado']?.trim() || 'Semilla';
        
        if (!email) {
            console.log(`⚠️ Fila sin email, saltando: ${nombre}`);
            skippedCount++;
            continue;
        }
        
        email = email.toLowerCase();
        
        // Metadata para el trigger de Supabase y perfiles
        const metadata = {
            nombre: nombre,
            nivel: nivel,
            avatar_url: foto || '',
            migrado_desde_glide: true,
            peso_actual: row['Peso Actual'] || '',
            estatura: row['Estatura'] || '',
            porcentaje_grasa: row['Grasa Corporal (%)  Actual'] || '',
            masa_muscular: row['Masa Magra Actual (Musculo) '] || '',
            cintura: row['Cintura'] || '',
            cadera: row['Cadera'] || '',
            edad: row['Edad'] || '',
            sexo: row['Sexo'] || '',
            es_argentum: row['Es Argentum'] === 'true',
            es_aurum: row['Es Aurum'] === 'true',
            es_platinum: row['Es Platinum'] === 'true',
            es_vitalicio: row['Es Vitalicio'] === 'true'
        };

        // Crear usuario por medio de Admin API para saltar validación de correo
        const { data: userAuth, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: 'VetaVigor2026!',
            email_confirm: true,
            user_metadata: metadata
        });

        if (authError) {
            if (authError.message.includes('already exists') || authError.code === 'user_already_exists') {
                console.log(`⏩ El usuario ${email} ya existe en Supabase.`);
                
                // Opcional: Actualizar su perfil si ya existía para inyectar las métricas
                const { error: updateError } = await supabase.from('perfiles').update({
                    nivel: nivel,
                    avatar_url: foto || '',
                    // Puedes añadir más campos a actualizar aquí si es necesario
                }).eq('email', email);
                
                skippedCount++;
            } else {
                console.error(`❌ Error creando a ${email}:`, authError.message);
                errorCount++;
            }
        } else {
            console.log(`✅ Usuario migrado con éxito: ${email}`);
            
            // Forzar actualización de tabla perfiles por si el trigger no copió todas las métricas
            if (userAuth && userAuth.user) {
               const { error: profileError } = await supabase.from('perfiles').update({
                    peso_actual: metadata.peso_actual,
                    estatura: metadata.estatura,
                    porcentaje_grasa: metadata.porcentaje_grasa,
                    masa_muscular: metadata.masa_muscular,
                    cintura: metadata.cintura,
                    cadera: metadata.cadera,
                    edad: metadata.edad,
                    sexo: metadata.sexo
               }).eq('id', userAuth.user.id);
               
               if (profileError) {
                    console.log(`⚠️ (Aviso: No se pudieron guardar métricas físicas extra para ${email}. ¿Existen las columnas en perfiles?)`);
               }
            }
            
            successCount++;
        }
    }
    
    console.log("------------------------------------------");
    console.log(`🎉 Migración finalizada.`);
    console.log(`✅ Éxitos: ${successCount}`);
    console.log(`⏩ Saltados (Ya existían o sin email): ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log("------------------------------------------");
}

migrateUsers();
