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

async function updateExistingUsers() {
    console.log("🚀 Iniciando actualización de avatares en auth.users...");
    
    // Traer usuarios de Auth
    const { data: authResult, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) {
        console.error("Error trayendo usuarios de auth", authErr);
        return;
    }
    const authUsers = authResult.users;
    console.log(`Encontrados ${authUsers.length} usuarios en Auth.`);

    const usersData = await parseCSV('./Users (1).csv');
    let successCount = 0;
    
    for (const row of usersData) {
        let email = row['Email']?.trim()?.toLowerCase();
        const foto = row['Foto Perfil']?.trim();
        const fotoAntes = row['Foto Antes']?.trim();
        const fotoDespues = row['Foto Actual']?.trim();
        
        if (!email) continue;

        const user = authUsers.find(u => u.email === email);
        if (user) {
            const currentMeta = user.user_metadata || {};
            let newMeta = { ...currentMeta };

            if (foto) newMeta.avatar_url = foto;
            if (fotoAntes) newMeta.foto_antes = fotoAntes;
            if (fotoDespues) newMeta.foto_despues = fotoDespues;

            const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
                user_metadata: newMeta
            });
            
            if (updateErr) {
                console.error(`❌ Error actualizando a ${email}:`, updateErr.message);
            } else {
                console.log(`✅ Avatar y fotos actualizadas para: ${email}`);
                successCount++;
            }
        }
    }
    
    console.log("------------------------------------------");
    console.log(`🎉 Finalizado. Actualizados: ${successCount}`);
}

updateExistingUsers();
