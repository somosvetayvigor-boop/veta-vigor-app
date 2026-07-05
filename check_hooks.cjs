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
      let foundEarlyReturn = false;
      let earlyReturnLine = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^\s*if\s*\(.*?\)\s*return/)) {
          foundEarlyReturn = true;
          earlyReturnLine = i + 1;
        }
        if (foundEarlyReturn && line.match(/^\s*use(State|Effect|Memo|Callback|Context|Ref)/)) {
          console.log(`Potential Hook Violation in ${fullPath}`);
          console.log(`Early return at line ${earlyReturnLine}, Hook at line ${i + 1}`);
        }
      }
    }
  }
}

checkHooks('src');
