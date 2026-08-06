import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import fs from 'fs';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

const sheetToRetoMap = {
  'Calistenia Nivel 0': '3af61f36-dfce-4b79-8689-efb1b133db07',
  'Calistenia Nivel 1': '6b6e611f-31e3-4985-a549-4cf7f356b91f',
  'Gym Nivel 0': 'db8f4da2-ff41-45db-898b-951ff4c3242d',
  'Gym Nivel 1': 'b4a23b9e-da61-4956-a389-348d73b9bb06',
  'Híbrido Nivel 0': '99c65247-3076-4f64-a452-4be291946de0',
  'Híbrido Nivel 1': '29e4bbc2-7686-4817-bd60-821b45e6a574'
};

async function run() {
  try {
    const filePath = 'C:\\Users\\grd_a\\.gemini\\antigravity\\scratch\\Veta_Vigor_App\\Retos_6_Rutas_VETAyVIGOR_DescansoActivo_Cada4.xlsx';
    const workbook = xlsx.readFile(filePath);
    
    console.log("Iniciando importación de rutinas...");
    let sqlOutput = "";

    for (const sheetName of workbook.SheetNames) {
      if (!sheetToRetoMap[sheetName]) {
        console.log(`Skipping unknown sheet: ${sheetName}`);
        continue;
      }

      const retoId = sheetToRetoMap[sheetName];
      console.log(`Processing sheet: ${sheetName} (Reto ID: ${retoId})`);

      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      
      let itemsToUpsert = [];

      for (const row of data) {
        const diaNumero = row['Día'];
        const enfoque = row['Enfoque'] || row['Enfoque '] || 'Sin Enfoque';
        const rutinaJson = row['Ejercicios y Ejecución (Circuito 4 Rondas)'] || row['Ejercicios y Ejecución'] || '';

        if (!diaNumero || !rutinaJson) continue;

        // Limpiar el JSON por si acaso
        let cleanedJson = rutinaJson;
        if (typeof cleanedJson === 'string') {
           // En caso de que haya retornos de carro
           cleanedJson = cleanedJson.replace(/\r\n/g, '\n');
        }

        itemsToUpsert.push({
          reto_id: retoId,
          dia_numero: parseInt(diaNumero),
          enfoque: enfoque.trim(),
          rutina_json: cleanedJson
        });
      }

      if (itemsToUpsert.length > 0) {
        sqlOutput += `-- -----------------------------------------------------\n`;
        sqlOutput += `-- RETO: ${sheetName}\n`;
        sqlOutput += `-- -----------------------------------------------------\n`;
        sqlOutput += `DELETE FROM public.reto_dias WHERE reto_id = '${retoId}';\n\n`;

        itemsToUpsert.forEach(item => {
          // Asegurarnos de que el string es un JSON válido (entre comillas dobles y escapando newlines correctamente)
          let jsonValue = JSON.stringify(item.rutina_json);
          // Escapar las comillas simples de SQL
          let sqlJsonStr = jsonValue.replace(/'/g, "''"); 
          sqlOutput += `INSERT INTO public.reto_dias (reto_id, dia_numero, enfoque, rutina_json) VALUES ('${item.reto_id}', ${item.dia_numero}, '${item.enfoque.replace(/'/g, "''")}', '${sqlJsonStr}');\n`;
        });
        sqlOutput += `\n\n`;
      }
    }
    
    fs.writeFileSync('C:\\Users\\grd_a\\.gemini\\antigravity\\scratch\\Veta_Vigor_App\\VETA_VIGOR_6_RUTAS.sql', sqlOutput);
    console.log("¡Archivo SQL generado exitosamente en VETA_VIGOR_6_RUTAS.sql!");

  } catch(e) {
    console.error(e);
  }
}

run();
