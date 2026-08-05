import fs from 'fs';

const supabaseUrl = 'https://rhxseahupujjqhcrthpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHNlYWh1cHVqanFoY3J0aHBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMjM1NSwiZXhwIjoyMDk2Nzc4MzU1fQ.mqdsUrBn8kF4OckblRovD61HjwrBdZ1iKyyvEj1xLBc';

async function dumpSchema() {
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
  const docs = await res.json();
  const tables = docs.definitions;
  
  let output = '';
  for (const [tableName, tableDef] of Object.entries(tables)) {
    output += `Table: ${tableName}\n`;
    const props = tableDef.properties || {};
    for (const [colName, colDef] of Object.entries(props)) {
      output += `  - ${colName}: ${colDef.type} ${colDef.format || ''}\n`;
    }
    output += '\n';
  }
  
  fs.writeFileSync('schema_dump.txt', output);
  console.log('Schema dumped to schema_dump.txt');
}
dumpSchema();
