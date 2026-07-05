const fs = require('fs');
const path = require('path');

function searchFiles(dir, queries) {
  let results = {};
  
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const q of queries) {
          if (content.includes(q)) {
            if (!results[fullPath]) results[fullPath] = [];
            if (!results[fullPath].includes(q)) results[fullPath].push(q);
          }
        }
      }
    }
  }
  
  walk(dir);
  return results;
}

const res = searchFiles('src', ['es_aurum', 'es_argentum', 'es_platinum', 'es_vitalicio', 'esPro', 'esVIP']);
console.log(JSON.stringify(res, null, 2));
