const fs = require('fs');
const path = require('path');

function checkHooks(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      checkHooks(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      let inComponent = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Find early returns that are indented exactly 2 spaces (typical for component level)
        if (line.match(/^  if\s*\(.*?\)\s*return/) && !line.includes('useEffect') && !line.includes('useState')) {
          // Check if any useHook is defined below this line within the same component
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/^export default function/) || lines[j].match(/^const [A-Z]/)) {
              break; // Next component
            }
            if (lines[j].match(/^  const \[.*?\] = use/)) {
              console.log(`Violation in ${fullPath}: Early return at line ${i + 1}, Hook at line ${j + 1}`);
            }
            if (lines[j].match(/^  useEffect/)) {
              console.log(`Violation in ${fullPath}: Early return at line ${i + 1}, Hook at line ${j + 1}`);
            }
          }
        }
      }
    }
  }
}

checkHooks('src');
