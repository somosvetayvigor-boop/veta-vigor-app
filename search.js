import fs from 'fs';
import path from 'path';

function searchFiles(dir, text) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath, text);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(text)) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}
searchFiles('./src', 'Socio Aurum');
