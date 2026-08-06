import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const filePath = 'C:\\Users\\grd_a\\.gemini\\antigravity\\scratch\\Veta_Vigor_App\\Retos_6_Rutas_VETAyVIGOR_DescansoActivo_Cada4.xlsx';
    const workbook = xlsx.readFile(filePath);
    console.log('Sheet Names:', workbook.SheetNames);
  } catch(e) {
    console.error(e);
  }
}

run();
