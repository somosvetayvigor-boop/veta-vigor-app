const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\grd_a\\.gemini\\antigravity\\brain\\23843030-28fb-4e59-a203-4c4b02542117';
const destDir = path.join(__dirname, 'public', 'assets', 'descanso');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const sourceFile = path.join(srcDir, 'descanso_absoluto_1780883649799.png');
const destFile = path.join(destDir, 'absoluto.png');

if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, destFile);
  console.log(`Copied absoluto.png`);
} else {
  console.log(`File not found: ${sourceFile}`);
}
